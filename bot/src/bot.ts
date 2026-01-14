import type { FileFlavor        } from "@grammyjs/files"
import type { Update            } from "grammy/types"
import type { PollingOptions,
              Context           } from "grammy"
import      { Bot               } from "grammy"
import      { hydrateFiles      } from "@grammyjs/files"
import      { middleware        } from "./middleware"
import      { getBot            } from "@core/vault"
import      { Logger            } from "@aws-lambda-powertools/logger"
import        $                   from "@core/constants"

const log = new Logger({ serviceName: "telegram-bot" })
const bot = createLazyBot()





export type BotUpdateHandler = (update: Update) => Promise<string>

export type BotResponse = ({

    ok      : true
    id      : number
    body    : string

} | {

    ok      : false
    error   : string
})





async function createBot() {

    const { token, info } = await getBot()    
    const bot = new Bot<FileFlavor<Context>>(token, info && { botInfo: info })

    bot.api.config.use(hydrateFiles(token))
    bot.use(middleware())

    if (!info) {

        await bot.init()
    }

    return bot
}





function createLazyBot() {

    const lazyBot = Object.create(null) as {

        handler: Promise<BotUpdateHandler>
    }

    Object.defineProperty(lazyBot, "handler", {

        enumerable      : false,
        configurable    : true,
        get             : async () => {

            const bot = await createBot()

            const handler: BotUpdateHandler = async function(update) {

                let response: string = ""

                await bot.handleUpdate(update, {

                    send: (payload: string) => { response = payload }
                })

                return response
            }

            Object.defineProperty(lazyBot, "handler", {

                enumerable  : false,
                configurable: false,
                writable    : false,
                value       : handler
            })

            return handler
        }
    })

    return lazyBot
}





export async function handleBotUpdate(update: Update & { update_id?: string|number }): Promise<BotResponse> {

    try {

        if (update && update.update_id) {

            const processor = await bot.handler
            const response  = await processor(update)

            log.info("Telegram Bot: Response", response)

            return {

                ok      : true,
                id      : update.update_id,
                body    : response
            }
        }

        else {

            return {

                ok      : false,
                error   : "Unprocessable Entity",
            }
        }
    }

    catch (err) {

        log.error("Telegram Bot: error during update processing", { err })

        return {

            ok      : false,
            error   : err instanceof Error ? err.message : String(err),
        }
    }
}





export function startBot(opt?: PollingOptions) {

    async function launchBot() {

        const bot = await createBot()
        return bot.start(opt)
    }

    launchBot().then(

        () => console.log('Done.'),
        console.error
    )
}