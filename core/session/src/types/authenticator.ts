import type { SerializeOptions  } from "cookie"
import type { AuthRequest       } from "./request.ts"
import type { Session,
              SessionExtension  } from "./session.ts"

export interface Authenticator<STORE, EX extends SessionExtension = {}> {

    login(store: STORE, request: AuthRequest<EX>): Promise<Session<EX>|undefined>
    authenticate(store: STORE): Promise<Session<EX>|undefined>
}

export interface CookieProvider {

    get(name: string): string | undefined
    set(name: string, value: string, options: SerializeOptions): void
}

export interface CookieAuthenticatorConfig {

    cookie_name     : string
    cookie_max_age  : number
    cookie_path     : string
}

export type CookieAuthenticatorOptions = Partial<CookieAuthenticatorConfig>