import type { User } from "./session"

export enum ValidationError {

    INPUT       = 'INVALID_INPUT',
    HASHKEY     = 'INVALID_HASHKEY',
    DELAY       = 'INVALID_DELAY_TOLERANCE',
    SIGNATURE   = 'INVALID_SIGNATURE',
    EXPIRED     = 'EXPIRED',
    UNKNOWN     = 'UNKNOWN'
}

export type ValidationResult = ({

    ok          : true
    duration    : number
    user        : User

} | {

    ok          : false
    reason      : ValidationError
    context?    : Record<string, string|number|boolean|undefined|null>
})

export type ValidationOptions = (
    { token     : string }
   |{ tokenHash : string }
)  &{ maxDelay? : number }