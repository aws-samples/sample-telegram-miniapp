import type { Route         } from "./+types/session"
import      { CookieAuthenticator,
              CookieJar     } from "@core/session-server"
import      { sha256        } from "@core/tools-server"
import      { safeJson      } from "@core/tools"
import      { Logger        } from "@aws-lambda-powertools/logger"
import        $               from "@core/constants"

const log               = new Logger({ serviceName: "session-validation-at-backend" })
const authenticator     = new CookieAuthenticator()





export async function action({ request }: Route.ActionArgs) {

    try {

        const cookie    = new CookieJar()
        const payload   = await safeJson({

            input               : request, 
            max_size_bytes      : $.session.max_payload_size,
            use_hash_check      : {
                hasher          : sha256,
                header          : $.session.hash_header_name,
            }
        })

        if (!payload.ok) {

            log.error('BAD PAYLOAD', { err: payload.error })

            return new Response(

                'BAD REQUEST',
                {
                    status      : 400,
                    statusText  :'BAD REQUEST',
                    headers     : {

                        'Content-Type'  :'text/plain'
                    }
                }
            )
        }

        const session   = await authenticator.login(cookie, payload.json)

        if (session) {

            return new Response(

                JSON.stringify(session),
                {
                    status      : 201,
                    statusText  :'SESSION ACCEPTED',
                    headers     : {
    
                        'Content-Type'  :'application/json',
                        'Set-Cookie'    : cookie.value
                    }
                }
            )
        }

        else {

            log.error("Backend: session validation has failed", { session, cookie: cookie.value })

            return new Response(

                'SESSION REJECTED',
                {
                    status      : 403,
                    statusText  :'SESSION REJECTED',
                    headers     : {

                        'Content-Type'  :'text/plain'
                    }
                }
            )
        }
    }

    catch (err) {

        log.error("Backend: error", { err })
    }

    return new Response(
    
        'SESSION ERROR',
        {
            status      : 500,
            statusText  :'SESSION ERROR',
            headers     : {

                'Content-Type'  :'text/plain'
            }
        }
    )
}