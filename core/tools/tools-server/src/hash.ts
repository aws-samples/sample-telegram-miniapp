import {

    type BinaryLike,
    type BinaryToTextEncoding,
    createHash

} from "node:crypto"





export function sha256(data: BinaryLike, encoding: BinaryToTextEncoding = 'hex'): string {

    return createHash('sha256').update(data).digest(encoding)
}

export function md5(data: BinaryLike, encoding: BinaryToTextEncoding = 'hex'): string {

    return createHash('md5').update(data).digest(encoding)
}

export function md5binary(data: BinaryLike): Buffer {

    return createHash('md5').update(data).digest()
}