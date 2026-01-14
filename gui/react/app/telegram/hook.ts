import type {

    Session,
    SessionExtension,
    SessionValidationState      } from "@core/session-types"

import type {

    LaunchParams                } from "@tma.js/sdk"

import { sendAuthRequest        } from "@core/session-client"
import { isBrowser              } from "@core/tools"
import { useEffect, useState    } from "react"
import { useHref                } from "react-router"
import { init,
         retrieveRawInitData,
         retrieveLaunchParams   } from "@tma.js/sdk"





export type TelegramState<EX extends SessionExtension = {}> = SessionValidationState<Session<EX>>

export type SessionCallback<T> = (initData: string, launchParams: LaunchParams, abort?: AbortController) => T|Promise<T>

export interface TelegramHookOptions<T> {

    getSession  ?: string | SessionCallback<T>
}

export function useTelegram<EX extends SessionExtension = {}>(opt?: TelegramHookOptions<Session<EX>>): TelegramState<EX> {

    const { getSession = useHref("session") } = opt||{}
    const [ tgState, setState       ] = useState<TelegramState<EX>>({})
    const [ initData, setInitData   ] = useState<string|undefined>(undefined)
    const browser = isBrowser()

    useEffect(() => {

        console.log('useTelegram: useEffect:', { tgState, getSession, initData, browser })

        if (browser) {

            if (initData) {

                const update = (data: Partial<TelegramState<EX>>) => setState({ ...tgState, loading: false, ...data })

                if (getSession) {

                    const params = retrieveLaunchParams()

                    if (params?.tgWebAppData) {

                        const promise = createPromise(getSession, initData, params, session => {

                            console.log('useTelegram: session is fetched:', { session })
                            update({ promise, session })
                        })

                        update({ promise, loading: true })
                    }

                    else {

                        console.log('useTelegram: this is not a Miniapp')
                        update({ error: "this is not a miniapp environment" })
                    }
                }

                else {

                    update({ error: "getSession parameter is not valid" })
                }
            }

            else {

                try {

                    init()
                    setInitData(retrieveRawInitData())
                }

                catch(err) {

                    console.error(err)
                    setInitData(undefined)
                    setState({
                        session: undefined,
                        promise: Promise.resolve(undefined),
                        loading: false,
                        error  : err
                    })
                }
            }
        }

    }, [browser, initData, getSession]);

    return tgState
}





function createPromise<EX extends SessionExtension = {}>(
    getSession  : SessionCallback<Session<EX>>|string|undefined,
    initData    : string,
    params      : LaunchParams,
    onSession   : (session: Session<EX>) => void
): Promise<Session<EX>|undefined> {

    return new Promise<Session<EX>|undefined>( async(resolve, reject) => {

        if (getSession && initData) {

            if (typeof getSession === 'string') {

                const session = await sendAuthRequest(getSession, initData, params)
                if (session) { onSession(session as Session<EX>) }
                resolve(session as Session<EX>)
            }

            else if (typeof getSession === 'function') {

                const session = await getSession(initData, params)
                if (session) { onSession(session) }
                resolve(session)
            }

            else {

                reject('Telegram: Authentication Callback (getSession) is not a function nor URL string')
            }
        }

        else {

            reject('Telegram: Invalid empty input for authentication')
        }
    })
}