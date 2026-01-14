import type { LambdaFunctionURLHandler } from "aws-lambda"
import { Logger             } from "@aws-lambda-powertools/logger"
import { safeJson           } from "@core/tools"
import { handleBotUpdate    } from "./bot"
import   $                    from "@core/constants"

const log = new Logger({ serviceName: "telegram-bot-lambda" })





export const handler: LambdaFunctionURLHandler = async (event, context) => {

    try {

        log.addContext(context)    
        log.info("Telegram: Incoming update", { event })

        const body = await safeJson({

            input           : event.body,
            max_size_bytes  : $.telegram.webhook.max_payload_size,
            use_hash_check  : false
        })

        if (body.ok) {

            const resp = await handleBotUpdate(body.json)

            if (resp.ok) {

                return {

                    statusCode  : 200,
                    headers     : {"Content-Type": "application/json"},
                    body        : resp.body
                }
            }
        }

        return {

            statusCode  : 422,
            headers     : {"Content-Type": "text/plain"},
            body        :  "Unprocessable Entity",
        }
    }

    catch (error) {

        log.error("Telegram Bot Lambda: Error", {

            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })

        return {

            statusCode  : 500,
            headers     : {"Content-Type": "text/plain"},
            body        :  "Internal Server Error"
        }
    }
}