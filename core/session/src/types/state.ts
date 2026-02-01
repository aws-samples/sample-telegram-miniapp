import type { User } from "./session.ts"

export interface SessionValidationState<SESSION = User> {

    session ?: SESSION
    promise ?: Promise<SESSION|undefined>
    loading ?: boolean
    error   ?: any
}