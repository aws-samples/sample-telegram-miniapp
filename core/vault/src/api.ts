import type {
    WebhookParam,
    CookieParam,
    BotParam,
    DeploymentParam } from "./types"
import { Vault      } from "./store"
import { sha256     } from "@core/tools-server"
import   $            from "@core/constants"





const $bot = new Vault<BotParam>({

    id      : $.artifacts.params.bot,
    ttl     : $.artifacts.params.cache_ttl,
    region  : $.aws.region,
    default : {

        token       : "",        
        tokenHash   : "",
        webhookHash : "",
        info        : undefined,
        guardrail   : undefined,
    }
})





export async function getBot(): Promise<BotParam> {

    return $bot.get()
}

export async function setBot(value: Partial<BotParam>) {

    await $bot.set(value)
}

export async function useWebhookToken() {

    const store = new Vault<WebhookParam>({

        id      : $.artifacts.params.webhook,
        region  : $.aws.region,
    })

    return [

        await store.get(true),

        async (token: string) => {

            const hash = sha256(token)
            const result = await Promise.allSettled([

                store.set({ hash, configured: new Date().toUTCString() }),
                setBot({ webhookHash: hash }),
            ])
            return result.every(i => i.status === 'fulfilled')
        }

    ] as const
}

export async function getDeploymentInfo() {

    const $param = new Vault<DeploymentParam>({

        id      : $.artifacts.params.deployment,
        ttl     : $.artifacts.params.cache_ttl,
        region  : $.aws.region
    })

    return $param.get(true)
}





export async function cookieKeys() {

    try {

        const store = new Vault<CookieParam>({

            id      : $.artifacts.params.cookies,
            region  : $.aws.region,
            default : { ts: 0, keys: [] },
        })

        const cfg = await store.get()

        let keys = validKeys(cfg?.keys)
        let ts = cfg?.ts
            && typeof cfg?.ts === 'number'
            ? Date.now()-cfg.ts
            : undefined;

        if (keys.length < 1 || !ts || ts >= $.session.cookie.keys_ttl) {

            keys = [ await Vault.generate() , ...keys.filter((_,n) => n < 2) ]

            await store.set({

                ts: Date.now(),
                keys
            })
        }

        return keys
    }

    catch(err) {

        console.error(err)
        return []
    }

    function validKeys(data? : string[]) {

        return data && Array.isArray(data)
            ? data.filter(i => i && typeof i === 'string')
            : []
    }
}