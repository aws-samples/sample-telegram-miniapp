import type {

    ARN,
    Firewall,
    BotInfo

} from "@core/types"





export interface BotParam {

    token       : string
    tokenHash   : string
    webhookHash : string
    info       ?: BotInfo
    guardrail  ?: { id: string, version: string }
}

export interface CookieParam {

    ts          : number
    keys        : string[]
}

export interface WebhookParam {

    url         : string
    hash        : string
    firewall    : {
        type    : Firewall
        arn     : ARN
    }
    configured ?: string
}

export interface DeploymentParam {

    name: string

    stacks: {

        main    : string
        global  : string
    }

    regions: {

        main    : string
        global  : string
    }

    git         : {

        ssh     : string
        http    : string
        branch  : string
        buildspec: string
    }

    logs        : {

        app     : string
        build   : string
    }

    miniapp     : string
    webhook     : string

    database    : {

        tables  : Array<{
            name        : string
            partitionKey: { name: string, type?: string }
            sortKey    ?: { name: string, type?: string }
            ttl        ?: string
            purpose     : string
        }>
    }

    bedrock     : {

        region      : string
        model       : string
        maxTokens   : number
        topP        : number
        guardrail  ?: {
            id      : string
            version : string
        }
    }

    security    : {

        session     : {
            ttl         : number
            cookieName  : string
            cookieMaxAge: number
        }

        telegram    : {
            authTolerance   : number
            webhookPath     : string
            webhookFirewall : Firewall
            webhookRateLimit: number
        }

        cdn         : {
            waf         : boolean
            geoBlocking : string[]
        }
    }

    lambda      : {

        memorySize  : number
        timeout     : number
        architecture: string
        runtime     : string
        basePath    : string
        healthCheck : string
        port        : number
    }

    resources   : {

        accountId  ?: string

        lambda      : {
            arn     : string
            name    : string
        }

        cdn         : {
            id      : string
            domain  : string
        }

        bucket      : {
            name    : string
            arn     : string
        }

        repository  : {
            name    : string
            arn     : string
        }
    }
}