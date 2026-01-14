import type { SerializeOptions  } from "cookie"
import type { AuthRequest       } from "./request"
import type { Session,
              SessionExtension  } from "./session"





export interface Authenticator<STORE, EX extends SessionExtension = {}> {

    login(store: STORE, request: AuthRequest<EX>): Promise<Session<EX>|undefined>
    authenticate(store: STORE): Promise<Session<EX>|undefined>
}

export interface CookieProvider {

    get(name: string): string | undefined
    set(name: string, value: string, options: SerializeOptions): void
}