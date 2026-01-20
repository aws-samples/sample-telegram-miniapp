import {

    Account,
    Region,
    Firewall,
    CIDR_IPv4,
    TableDescriptor

} from "@core/types"


export interface GlobalConstants {

    root: string,

    aws: {

        account?: Account,
        region ?: Region

        bedrock: {

            region          : string
            model           : string
            max_tokens      : number
            max_image_size  : number
            top_p           : number
        }

        lambda: {

            webadaptor  : {

                x86     : (region: string) => string
                arm64   : (region: string) => string
            }
        }

        s3: {

            max_bucket_name_length: number
        }
    }

    naming: {

        app     : string
        prefix  : string
    }

    telegram: {

        bot             : {

            enabled         : boolean
        }

        session         : {
            // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
            delay_tolerance : number, // max allowed delay [seconds] between auth_date=<auth_date> of initData and Date.now():
            hash: {
                algorithm   : string, // openssl list -digest-algorithms
                key         : string,
            }
        }
        webhook: {
            // https://core.telegram.org/bots/api#setwebhook
            path            : string
            header          : string
            source_ip       : CIDR_IPv4[]
            token_length    : number
            rate_limit      : number
            firewall        : Firewall
            waf_rule_name   : string
            max_payload_size: number
        }
    }

    session: {

        ttl     : number

        cookie  : {

            name    : string
            path    : string
            max_age : number
            keys_ttl: number
            domain  : string
        }

        max_payload_size    : number
        hash_header_name    : string
    }

    artifacts: {

        outputs: {

            keys            : {
                url         : string
                webhook     : string
                guardrail   : string
            }
        }

        lambda: {

            gui: {

                // server      : string
                // static      : string
                package     : string
                basepath    : string
                healthcheck : string
                handler     : string
                execWrapper : string
                port        : number
                memorySize  : number
                timeout     : number
            }

            bot: {

                server      : string
                handler     : string
                memorySize  : number
                timeout     : number
            }
        }

        params: {

            cache_ttl   : number
            deployment  : string
            bot         : string
            webhook     : string
            cookies     : string
        }

        cdn: {

            waf : boolean
            geo : { deny: string[] }
            wait_for_cdn_cache_invalidation: boolean
        }

        dev: {

            production  : boolean
            repository  : string
            branch      : string
            specfile    : string
            timeout     : number
        }

        tables  : Record<string, TableDescriptor>
    }
}