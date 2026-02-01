import type { Authenticator,
              AuthRequest,
              Session,
              CookieProvider,
              CookieAuthenticatorOptions,
              CookieAuthenticatorConfig,
              SessionExtension              } from "../types"
import      { getSession, createSession     } from "./session.store"
import        $                               from "@core/constants"





export class CookieAuthenticator<EX extends SessionExtension = {}> implements Authenticator<CookieProvider, EX> {

    #opt: CookieAuthenticatorConfig

    constructor(opt?: CookieAuthenticatorOptions) {

        this.#opt   = Object.assign({
            cookie_name    : $.session.cookie.name,
            cookie_max_age : $.session.cookie.max_age,
            cookie_path    : $.session.cookie.path
        }, opt)
    }

    async authenticate(store: CookieProvider) {

        return getSession<Session<EX>>(store.get(this.#opt.cookie_name))
    }

    async login(store: CookieProvider, request: AuthRequest<EX>) {

        try {

            const session = await createSession(request.authData, request.initData)

            if (session && session.id && session.user.id === request.expectedUser) {

                store.set(this.#opt.cookie_name, session.id, {

                    path        : this.#opt.cookie_path,
                    httpOnly    : true,
                    secure      : true,
                    sameSite    :'strict',
                    maxAge      : this.#opt.cookie_max_age,
                    domain      : $.session.cookie.domain
                })

                return session.user
            }
        }

        catch (err) {

            console.error(err)
        }

        return undefined
    }
}