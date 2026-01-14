import type { SerializeOptions              } from "cookie"
import type { Authenticator, AuthRequest,
              CookieProvider,                
              SessionExtension              } from "@core/session-types"
import        $                               from "@core/constants"
import      { loadSession,  createSession   } from "./store.server"
import      { parse, serialize              } from "cookie"





interface CookieAuthenticatorConfig {

    cookie_name     : string
    cookie_max_age  : number
    cookie_path     : string
}

export type CookieAuthenticatorOptions = Partial<CookieAuthenticatorConfig>





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

        return loadSession<EX>(store.get(this.#opt.cookie_name))
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





export class CookieJar implements CookieProvider {

    #req    : Request | undefined
    #cookie : string  | undefined = undefined

    constructor(req?: Request) {

        this.#req = req
    }

    get(name: string): string | undefined {

        if (this.#req) {

            this.#cookie = parse(this.#req.headers.get('cookie')||'')[name]
            return this.#cookie
        }

        return undefined
    }

    set(name: string, value: string, opt?: SerializeOptions) {

        this.#cookie = serialize(name, value, opt)
    }

    get value(): string {

        return this.#cookie || ""
    }
}