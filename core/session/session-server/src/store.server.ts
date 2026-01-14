import type { User, Session, SessionExtension, SessionID } from "@core/session-types"
import      * as api                  from "./api.server"
import      { validate              } from "./validator.server"
import      { getBot                } from "@core/vault"
import      { Logger                } from "@aws-lambda-powertools/logger"

const log = new Logger({ serviceName: 'core/auth/auth-server/session/store' })





export async function loadSession<EX extends SessionExtension>
    (id: SessionID|string|undefined)
    : Promise<Session<EX>|undefined> {

    try {

        if (id && id.trim()) {

            return await api.getSession(id)
        }
    }

    catch(err) {

        console.log({ err })
    }

    return undefined
}





export async function createSession<EX extends Record<string, any> = {}>(authData: string, addinfo?: EX) {

    const result = validate(authData, await getBot())

    if (result.ok) {

        const id    =`${result.user.id}:${crypto.randomUUID().replaceAll('-','').toUpperCase()}` as SessionID
        const name  = getUserName(result.user)
        const meta  = await api.getProfile(result.user.id)
        const user  = Object.assign({ name }, meta, result.user, addinfo) as Session & EX

        await Promise.all([

            api.setProfile(result.user),
            api.setSession(id, user)
        ])

        return { id, user }
    }

    log.error('VALIDATION FAILURE', { result, authData, addinfo })

    return null
}





function getUserName(profile: User) {

    const name = [ profile.first_name, profile.last_name ]
        .map(i => i?.trim())
        .filter(Boolean)
        .join(' ')

    if (name.length > 1) {

        return name
    }

    return [ name, profile.username && `@${profile.username}` ]
        .filter(Boolean)
        .join(' ')
}