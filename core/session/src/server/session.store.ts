import type { User,
              Session,
              SessionID,       
              SessionExtension  } from "../types"
import      { validate          } from "./validator"
import      { Logger            } from "@aws-lambda-powertools/logger"
import      { db                } from "@core/db"
import      { getBot            } from "@core/vault"
import        $                   from "@core/constants"

const log = new Logger({ serviceName: 'session/store' })

enum PROFILE_PARTS {

    header = 0,
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    Session Store                                                                       │
// │    is an abstraction on top of DynamoDB                                                │
// │    to store and retrieve users' profiles and users' sessions                           │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

export async function createSession<EX extends Record<string, any> = {}>(initData: string, addinfo?: EX) {

    const result = validate(initData, await getBot())

    if (result.ok) {

        const id    =`${result.user.id}:${crypto.randomUUID().replaceAll('-','').toUpperCase()}` as SessionID
        const name  = getUserName(result.user)
        const meta  = await getProfile(result.user.id)
        const user  = Object.assign({ name }, meta, result.user, addinfo) as Session & EX

        await Promise.all([

            setProfile(result.user),
            setSession(id, user)
        ])

        return { id, user }
    }

    log.error('VALIDATION FAILURE', { result, authData: initData, addinfo })

    return null
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    DynamoDB - PROFILES                                                                 │
// │                                                                                        │
// │    db.users table stores Telegram profiles recieved                                    │
// │    during initData validation process                                                  │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

async function setProfile(profile: User) {

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

async function getProfile(user: string | number) {

    if (user) {

        const data = await db.users.collect<User>(str(user))

        if (data) {

            log.info("GET_PROFILE", { user, data })
            return data
        }

        else {

            log.info("GET_PROFILE: EMPTY", { data })
            return undefined
        }
    }

    return undefined
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    DynamoDB - SESSIONS                                                                 │
// │                                                                                        │
// │    db.sessions table stores facts of successful session validations                    │
// │    Cookies store reference to session (id is of format "user:session")                 │
// │    AuthN process checks that request cookies contain                                   │
// │    a valid reference to db.sessions record.                                            │
// │                                                                                        │
// │    Session records automatically expires by DynamoDB according to                      │
// │    respective ttl value = $.session.ttl                                                │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

async function setSession<T extends {}>(id: SessionID, data: T) {

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

export async function getSession<T extends { id: string|number } = Session>
    (id: SessionID|string|undefined)
    :Promise<T|undefined> {

    if (id) {

        const [ user, session ] = id.split(':').map(i => i.trim())

        if (user && session) {

            return db.sessions
            .get<T>(user, session)
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





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    Helpers                                                                             │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

function str(id: string|number): string {

    return typeof id === 'string'
        ? id
        : id.toString()
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