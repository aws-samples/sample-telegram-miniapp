import type { CookieProvider                } from "../types"
import type { SerializeOptions              } from "cookie"
import      { parse, serialize              } from "cookie"

// ╭───────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                       │
// │    CookieJar - a cookie store helper,                                                 │
// │    that implements simple get/set interface for cookies                               │
// │    compatible with SvelteKit's cookies interface                                      │
// │                                                                                       │
// ╰───────────────────────────────────────────────────────────────────────────────────────╯

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