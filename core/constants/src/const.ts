import type { GlobalConstants     } from "./types"
import type { UserInputs, Metadata} from "../metadata/types"
import {
    cleanRegionString,
    cleanAccountString            } from "@core/tools"
import * as path                    from "node:path"
import      root_config             from "../metadata/app.config.json"  with { type: "json" }

const user      = root_config as unknown as UserInputs & Metadata
const root      = user.root
const prefix    =`${clean_prefix(user.app.workshop).slice(0,16)}${clean_prefix(user.app.name)}`.slice(0,32)
const basepath  ='/app'
const region    = cleanRegionString(user.aws.region) || cleanRegionString(process.env["AWS_REGION"]) || undefined
const region_ai = cleanRegionString(user.bedrock.region) || region || cleanRegionString('us-east-1')!

function clean_prefix(input: string|undefined): string {

    return input && typeof input === 'string'
        ? input.toLowerCase().replaceAll(/[^a-z0-9-]/ig,'')
        : ''
}





export default {

    root,

    naming  : {

        app     : user.app.name,
        prefix  : prefix
    },

    aws: {

        account : cleanAccountString(user.aws.account) || cleanAccountString(process.env["AWS_ACCOUNT"]) || undefined,
        region  : region,

        s3: {

            max_bucket_name_length: 63
        },

        lambda: {

            // https://github.com/awslabs/aws-lambda-web-adapter            
            webadaptor: {
                x86     : (region) => `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayerX86:25`,
                arm64   : (region) => `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayerArm64:25`
            }
        },

        bedrock : {

            region  : region_ai,
            model   : user.$bedrock_endpoints[region_ai]?.[user.bedrock.model?.trim()] || user.bedrock.model?.trim() || 'global.amazon.nova-2-lite-v1:0',
            // - max allowed image size when attaching pictures to conversations
            //   not inforced by Bedrock itself,
            //   but is used for user input validation
            max_image_size  : 5*1024*1024,

            // - maxTokens: maximum number of tokens to generate
            // - How tokens are counted in Amazon Bedrock:
            // - https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-token-burndown.html
            max_tokens      : 10240,
            // - temperature: randomness (max: 1.0, default: 0.7)
            //   -- OR --
            // - topP: diversity of word choice (max: 1.0, default: 0.9)
            // Note: Use either temperature OR topP, but not both
            top_p           : 0.9,
        }
    },

    telegram: {

        bot: {

            enabled: Boolean(user.bot.enable)
        },

        session: {

            //max allowed delay [seconds] between auth_date=<auth_date> of initData and Date.now():
            delay_tolerance : 300,
            hash: {
                algorithm   : "sha256",
                key         : "WebAppData",
            }
        },

        webhook: {

            // https://core.telegram.org/bots/api#setwebhook
            path            :`${basepath}/bot`,
            header          :'X-Telegram-Bot-Api-Secret-Token'.toLowerCase(),
            source_ip       : ['149.154.160.0/20', '91.108.4.0/22'],
            rate_limit      : 50,
            token_length    : 128,
            firewall        : user.bot.firewall,
            waf_rule_name   :'telegram_bot_api_webhook',

            // Max telegram message is 4000 characters
            // -> might it up to 8KB for non-ASCII Unicode chars
            max_payload_size: 8*1024, // Bytes, not chars!
        }
    },

    session: {

        ttl     : 7_776_000,    // 90 days

        cookie  : {

            name    :'SESSION',
            path    :'/',
            domain  :'.cloudfront.net',
            max_age : 14_400,       // 4 hr
            keys_ttl: 12*3600_000
        },

        max_payload_size    : 1024*1024, // Bytes! not charactes
        hash_header_name    :'X-Amz-Content-SHA256',
    },

    artifacts: {

        dev: {

            timeout         : 15, // Minutes
            repository      : prefix,
            branch          :'main',
            specfile        :'codebuild.yaml',
            get production() { return 'development' !== process.env['BUILD_MODE'] }
        },

        cdn: {

            waf: Boolean(user.cdn.firewall),
            geo: { deny: user.cdn.geo.deny },
            wait_for_cdn_cache_invalidation: true
        },

        params: {

            cache_ttl       : 300,
            bot             :`/${prefix}/bot`,
            deployment      :`/${prefix}/deployment`,
            webhook         :`/${prefix}/webhook`,
            cookies         :`/${prefix}/cookies`,
        },

        outputs: {

            keys            : {

                url             : "MiniappURL",
                webhook         : "BotWebhook",
                guardrail       : "GuardrailID",
            }
        },

        lambda: {

            gui: {

                package     : user.app.frontend,// pnpm workspace package name
                basepath    : basepath,         // we use basepath offset as a first-line, basic filtering method for unwanted scanning traffic
                healthcheck :`${basepath}/ok`,  // LWA: during Lambda init the LWA needs to check if you're web server is up and running
                execWrapper : "/opt/bootstrap", // LWA: this is a requirement of LWA
                handler     : "run.sh",         // LWA: entrypoint script name; this file should exist in your @gui/* code and also be included in "files":[ "run.sh" ] package.json field.
                port        : 7000,             // LWA: PORT=3000 is not allowed in Lambda
                memorySize  : 256,
                timeout     : 30
            },

            bot: {

                server      : path.join(root, "bot/dist/index.js"),
                handler     : "index.handler",
                memorySize  : 256,
                timeout     : 60
            }
        },

        tables: {

            config: {

                name:`${prefix}-config`,
                pk  : { name: "tenant" },
                sk  : { name: "id" }
            },

            users: {

                name:`${prefix}-users`,
                pk  : { name: "id" },
                sk  : { name: "order", type: "N" }
            },

            sessions: {

                name:`${prefix}-sessions`,
                pk  : { name: "user"    },
                sk  : { name: "session" },
                ttl : "ttl",
            },

        } as const
    }

} as const satisfies GlobalConstants