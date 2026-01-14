import type { SessionExtension  } from "./session"

export interface AuthRequest<EX extends SessionExtension = {}> {

    expectedUser    : number
    authData        : string
    initData?       : EX
}