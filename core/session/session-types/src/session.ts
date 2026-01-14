import type * as SDK from "@tma.js/types"





export type UserID = SDK.User['id']
export type SessionID = `${UserID}:${string}`

export interface User extends SDK.User {

    name: string
}

export type SessionExtension = Record<string, any>

export type Session<EX extends SessionExtension = {}> = User & EX & {

    start_param?: string
}