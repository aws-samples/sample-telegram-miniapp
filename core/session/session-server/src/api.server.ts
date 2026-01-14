import type {
    User,
    Session,
    SessionID,       
    SessionExtension} from "@core/session-types"
import { Logger     } from "@aws-lambda-powertools/logger"
import { db         } from "@core/db"
import   $            from "@core/constants"





const log = new Logger({ serviceName: 'SESSION' })

enum PROFILE_PARTS {

    header = 0,
}

function str(id: string|number): string {

    return typeof id === 'string'
        ? id
        : id.toString()
}





export async function setProfile(profile: User) {

    const ts = Date.now()

    if (profile && profile.id) {

        await db.users
        .put(profile, {

            pk  : str(profile.id),
            sk  : PROFILE_PARTS.header,
            add : { ts }
        })
        .then(

            out => log.info("SET_PROFILE", { profile, out }),
            err => log.error("SET_PROFILE: ERROR", { err, profile })
        )
    }

    return undefined
}





export async function getProfile(user: string | number) {

    if (user) {

        const data = await db.users.collect<User>(str(user))

        if (data) {

            log.info("GET_USER_METADATA", { user, data })
            return data
        }

        else {

            log.info("GET_USER_METADATA: EMPTY", { data })
            return undefined
        }
    }

    return undefined
}





export async function setSession(id: SessionID, data: Record<string, any>) {

    const [ user, session ] = id.split(':')
    const ts = Date.now()

    if (user && session) {

        await db.sessions.put(data, {

            pk  : user,
            sk  : session,
            add : { ts },
            ttl : $.session.ttl
        })
        .then(

            out => log.info("SET_SESSION", { id, data, out }),
            err => log.error("SET_SESSION: ERROR", { err, id, data })
        )
    }

    return undefined
}





export async function getSession<EX extends SessionExtension>
    (id: SessionID|string|undefined)
    :Promise<Session<EX>|undefined> {

    if (id) {

        const [ user, session ] = id.split(':')
    
        if (user && session) {
    
            return db.sessions
            .get<Session<EX>>(user, session)
            .then(

                data => {

                    const verify = data && str(data.id) === user
                    log.info("GET_SESSION", { data, id, user, session, verify })
                    return verify ? data : undefined
                },

                err => {

                    log.error("GET_SESSION: ERROR", { err, id, user, session })
                    return undefined
                }
            )
        }
    }

    return undefined
}