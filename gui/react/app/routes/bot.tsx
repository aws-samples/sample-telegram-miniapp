import type { Route                 } from "./+types/bot"
import      { Logger                } from "@aws-lambda-powertools/logger"
import      { handleBotUpdate       } from "@tg/bot"
import      { safeJson              } from "@core/tools"
import        $                       from "@core/constants"

const log = new Logger({ serviceName: "bot-handler" })





export async function action({ request }: Route.ActionArgs) {

    try {

        const body = await safeJson({

            input           : request,
            max_size_bytes  : $.telegram.webhook.max_payload_size,
            use_hash_check  : false
        })

        if (body.ok) {

            const response  = await handleBotUpdate(body.json)
    
            if (response.ok) {
    
                return response.body
            }
    
            return new Response("Failure to process update", {
    
                status: 500
            })
        }

        return new Response("Invalid request", {

            status: 422
        })
    }

    catch (err) {

        log.error("ERROR", { err })
    }    
}