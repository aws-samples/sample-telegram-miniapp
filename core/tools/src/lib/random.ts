import { generateKeySync } from "node:crypto"





export function randomValueSync(max_length: number) {

    return generateKeySync('hmac', { length: 8*max_length })
        .export()
        .toString('base64')
        .replaceAll(/[^a-z0-9]/ig, '')
        .slice(0, max_length)
}