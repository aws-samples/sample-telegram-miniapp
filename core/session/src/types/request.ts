import type { SessionExtension } from "./session.ts"

export interface AuthRequest<EX extends SessionExtension = {}> {
    expectedUser    : number
    authData        : string
    initData?       : EX
}
