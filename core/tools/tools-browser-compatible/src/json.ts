import type { BinaryLike    } from "crypto"
import      { sha256        } from "./hash"





export type Hasher = (data: BinaryLike) => string

export interface SafeJsonResult {

    ok      : boolean
    json    : any
    error   : Error | null
}

export interface SafeJsonInput {

    input           : string|Request|undefined|null
    max_size_bytes  : number
    use_hash_check ?: false | { header?: string, hasher?: Hasher }
}

export async function safeJson(opt: SafeJsonInput): Promise<SafeJsonResult> {

    const { input, max_size_bytes, use_hash_check={}} = opt
    const { header: hash_header, hasher = sha256 } =
        use_hash_check === false
        ? { header: '' }
        : { header: 'X-Amz-Content-SHA256', ...use_hash_check }

    try {

        if ( ! input
            || typeof hasher !== 'function'
            || typeof hash_header  !== 'string'
            || typeof max_size_bytes !== 'number'
            ||        max_size_bytes < 1) {

            return failure('Bad input request')
        }

        if (typeof input === 'string') {

            if (input.length > max_size_bytes) {

                return failure('Input sring is too long')
            }

            return {

                ok      : true,
                json    : JSON.parse(input),
                error   : null
            }
        }

        if (!(input instanceof Request)) {

            return failure('Bad input request')
        }

        const content_length = input.headers.get('Content-Length')

        if (!content_length) {

            return failure('Request misses Content-Length header')
        }

        const expected_size = parseInt(content_length)

        if (isNaN(expected_size) || expected_size < 1) {

            return failure('Content-Length header has invalid value')
        }

        if (expected_size > max_size_bytes) {

            return failure('Content-Length exceeds allowed limit')
        }

        if (hash_header) {

            if (!input.headers.get(hash_header)) {

                return failure(`Data consistency header "${hash_header}" is missing`)
            }
        }

        const reader = input.body?.getReader()

        if (!reader) {

            return failure('Failure to obtain body reader')
        }

        let offset = 0
        const data: Uint8Array<ArrayBuffer> = new Uint8Array(expected_size)

        while (true) {

            const { done, value } = await reader.read()

            if (done) {

                break
            }

            else if (offset + value.length > expected_size) {

                await reader.cancel()
                return failure('Request rejected for body size exceeds announced content length')
            }

            else {

                data.set(value, offset)
                offset += value.length
            }
        }

        if (offset < 1) {

            return failure('Empty body')
        }

        if (expected_size === offset) {

            if (hash_header) {

                const hash = input.headers.get(hash_header)?.toLowerCase()

                if (!hash || hash !== (await hasher(data)).toLowerCase()) {

                    return failure('Failure to verify data consistency')
                }
            }

            const text = new TextDecoder().decode(data)
            const json = JSON.parse(text)

            return {

                ok      : true,
                json    : json,
                error   : null
            }
        }

        else {

            return failure('Content-Length header has invalid value')
        }
    }

    catch (err) {

        return failure(err)
    }

    function failure(err: string | Error | unknown): SafeJsonResult {

        if (typeof err === 'string') {

            return {

                ok      : false,
                json    : undefined,
                error   : new Error(`SafeJSON error: ${err || 'Unknown error'}`)
            }
        }

        if (typeof err === 'object' && err instanceof Error) {

            return {

                ok      : false,
                json    : undefined,
                error   : err
            }
        }

        return {

            ok      : false,
            json    : undefined,
            error   : new Error(`SafeJSON error: ${ err ? String(err) : 'Unknown Error' }`)
        }
    }
}