import type { User,
              ValidationResult,
              ValidationOptions } from "../types"
import type { BinaryLike,
              KeyObject         } from "node:crypto"
import      { createHmac        } from "node:crypto"
import      { ValidationError   } from "../types/validator"
import        $                   from "@core/constants"





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    Helpers                                                                             │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

export function validate(initData: string, opt: ValidationOptions): ValidationResult {

    try {

        if (!validString(initData)) {

            return err(ValidationError.INPUT)
        }

        const { maxDelay = $.telegram.session.delay_tolerance } = opt

        if (!positiveNumber(maxDelay)) {

            return err(ValidationError.DELAY)
        }

        const params    = new URLSearchParams(initData)
        const ts        = parseInt(params.get('auth_date')||'0')
        const hash      = params.get('hash')
        const data      = [...params.keys()].sort().filter(k => k !== 'hash').map(k => `${k}=${params.get(k)}`).join('\n')

        if (!validString(hash, data)) {

            return err(ValidationError.INPUT)
        }

        if (!positiveNumber(ts)) {

            return err(ValidationError.INPUT)
        }

        const delay = Math.round(Date.now()/1000 - ts)

        if (delay >= maxDelay) {

            return err(ValidationError.EXPIRED, { max_tolerance: maxDelay, ts, delay })
        }

        const hashKey = getHashKey(opt)

        if (!hashKey || hashKey.length < 32) {

            return err(ValidationError.HASHKEY, { hash_key_length: hashKey?.length })
        }

        const signature = hashString(data, hashKey).toLowerCase()

        if (signature === hash!.toLowerCase()) {

            const user = params.get('user')

            return user ?
                {
                    ok      : true,
                    duration: delay,
                    user    : JSON.parse(user) as User
                }
                : err(ValidationError.UNKNOWN)
        }

        return err(ValidationError.SIGNATURE)
    }

    catch {

        return err(ValidationError.UNKNOWN)
    }
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    Helpers                                                                             │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

export function calcTokenHash(token: string) {

    return hashString(token)
}

function getHashKey(opt: ValidationOptions): Buffer | undefined {

    if ('tokenHash' in opt && opt.tokenHash && typeof opt.tokenHash === 'string') {

        return Buffer.from(opt.tokenHash, 'hex')
    }

    if ('token' in opt && opt.token && typeof opt.token === 'string') {

        return hashBinary(opt.token)
    }

    return undefined
}

function err(e: ValidationError, context?: Record<string, string|number|boolean|undefined|null>): ValidationResult {

    return {

        ok      : false,
        reason  : e,
        ...(context ? { context } : null)
    }
}

function validString(...args: any[]): boolean {

    return args.reduce((acc, i) => acc && i && typeof i === 'string', true)
}

function positiveNumber(...args: any[]): boolean {

    return args.reduce((acc, i) => acc && i && typeof i === 'number' && !isNaN(i) && i > 0, true)
}

function hashString(input: string, key: BinaryLike|KeyObject = $.telegram.session.hash.key): string {

    return createHmac($.telegram.session.hash.algorithm, key).update(input).digest('hex')
}

function hashBinary(input: string, key: BinaryLike|KeyObject = $.telegram.session.hash.key): Buffer {

    return createHmac($.telegram.session.hash.algorithm, key).update(input).digest()
}