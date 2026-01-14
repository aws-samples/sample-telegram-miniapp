import type { WebhookParam  } from "@core/vault"
import { parseArgs          } from "node:util"
import { Bot                } from "grammy"
import { supportedUpdates   } from "@tg/bot"
import { updateFirewallToken} from "../stacks/webhook"
import { useWebhookToken,
         getBot, setBot     } from "@core/vault"
import { calcTokenHash      } from "@core/session-server"





;(function main() {

    console.log('Setting up the Miniapp after successful deployment...')

    setupParams().then(

        ok => {

            console.log(ok
                ? '✅ Setup complete! 🚀'
                : '❌ Setup has failed :('
            )
            process.exit(ok ? 0 : 1)
        },

        err => {

            console.error('APP_SETUP: ERROR:', err)
            process.exit(2)
        }
    )
})()





interface Context {

    args    : { token?: string; webhook?: string; secret?: string }
    bot     : Bot
    webhook : WebhookParam
    token   : string
}

async function setupParams() {

    const config: Partial<Context> = {

        args: parseArgs({
            options: {
                token   : { short: 't', type: 'string' },
                webhook : { short: 'w', type: 'string' },
                secret  : { short: 's', type: 'string' }
            }
        }).values
    }

    const steps = [
        {
            name:'Resolve bot configuration',
            job: initBot
        },
        {
            name:'Resolve webhook configuration',
            job: resolveWebhookConfig
        },
        {
            name:'Set Telegram Bot Webhook',
            job: setupWebhook
        }
    ] as const


    const ok = await steps.reduce(

        async (acc, i) => {

            const { ok, ctx } = await acc;

            return ok
                ? runStep(ctx, i)
                : { ok, ctx }
        },

        Promise.resolve({ ok: true, ctx: config })
    )

    return ok.ok
}





async function initBot(ctx: Partial<Context>): Promise<Partial<Context>> {

    const token = ctx.args?.token || (await getBot()).token || process.env["BOT_TOKEN"] || undefined

    if (!token) {

        throw new Error('Bot Token is not found. Please provide it manually by calling pnpm run setup --token <BOT_TOKEN>')
    }

    const bot = new Bot(token)
    await bot.init()
    await setBot({

        token       : token,
        tokenHash   : calcTokenHash(token),
        info        : bot.botInfo,
    })

    console.log(`✅ Bot: @${bot.botInfo.username}`)

    return { bot }
}





async function resolveWebhookConfig(ctx: Partial<Context>): Promise<Partial<Context>> {

    const [ webhook, commit ] = await useWebhookToken()

    if (webhook) {

        if (webhook?.url && webhook?.firewall?.arn) {

            const token = await updateFirewallToken(webhook.firewall)

            if (token) {

                if (await commit(token)) {

                    return { webhook, token }
                }

                throw new Error('Failure to commit new webhook token hash to params')
            }

            else {

                throw new Error('Failure to update firewall with new webhook token')
            }
        }

        throw new Error(`Invalid webhook config`)
    }

    return {}
}





async function setupWebhook(ctx: Partial<Context>): Promise<Partial<Context>> {

    if (ctx.webhook && ctx.bot && ctx.token) {

        const response = await ctx.bot!.api.setWebhook(

            ctx.webhook.url,
            {
                secret_token    : ctx.token,
                allowed_updates : await supportedUpdates()
            }
        )

        if (!response) {

            throw new Error(`Failure to set Telegram Bot Webhook: response="${response}"`)
        }
    }

    return {}
}





interface Step<CTX, T=any> {

    job         : (ctx: CTX) => Promise<T>
    name        : string
}

async function runStep<CTX extends {}>(ctx: CTX, step: Step<CTX>): Promise<{ ok: boolean, ctx: CTX }> {

    console.log(`⏳ ${step.name}...`)

    try {

        const result = await step.job(ctx)
        console.log(`✅ ${step.name}: Done`)

        return {
            ok  : true,
            ctx : Object.assign(ctx, result)
        }
    }

    catch (e) {

        console.log(`❌ ${step.name}: Failed`)
        console.error(`Error: ${ e instanceof Error ? e.message : String(e) }`)

        return {
            ok: false,
            ctx
        }
    }
}