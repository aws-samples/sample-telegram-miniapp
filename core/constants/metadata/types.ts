import type { Firewall, Account, Region, ARN } from "@core/types"

export interface UserInputs {

    app: {

        name        : string
        frontend    :`${string}/${string}`
        workshop   ?: string
    }

    aws: {

        account     : Account | undefined,
        region      : Region
    }

    cdn: {

        firewall    : boolean
        domain      : undefined | string
        certificate : undefined | ARN
        geo         : {

            deny    : string[]
        }
    }

    bot:{

        enable      : boolean
        firewall    : Firewall
    }

    bedrock: {

        region     ?: string
        model       : string
    }
}

export interface Metadata {

    root: string
    $bedrock_endpoints: Record<string, Record<string, string>>
}