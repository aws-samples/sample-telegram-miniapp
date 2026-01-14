import type { User } from "./session"



export interface SessionValidationState<SESSION = User> {

    session ?: SESSION
    promise ?: Promise<SESSION|undefined>
    loading ?: boolean
    error   ?: any
}