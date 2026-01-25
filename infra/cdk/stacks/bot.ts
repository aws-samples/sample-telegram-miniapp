import type { GlobalDeploymentInfo } from "./global"
import type { ARN, Firewall } from "@core/types"
import { webhookCFFCode,
         webhookWAFStatement, 
         webhookWAFRuleName,
         webhookAllowedIPs  } from "./webhook"
import { Construct          } from "constructs"
import { NagSuppressions    } from "cdk-nag"
import { RemovalPolicy      } from "aws-cdk-lib"
import * as cf                from "aws-cdk-lib/aws-cloudfront"
import * as s3                from "aws-cdk-lib/aws-s3"
import * as waf               from "aws-cdk-lib/aws-wafv2"
import * as origins           from "aws-cdk-lib/aws-cloudfront-origins"
import * as lambda            from "aws-cdk-lib/aws-lambda"





export interface BotProps {

    prefix              : string
    global              : GlobalDeploymentInfo
    backendServer       : lambda.IFunctionUrl
    logBucket           : s3.IBucket
    telegram            : {
        webHook         : string
        rateLimit       : number
        firewall        : Firewall
    }
}





export class Bot extends Construct {

    #cdn        : cf.IDistribution
    #hook       : string
    #firewall   : ARN

    get url() {

        return `https://${this.#cdn.distributionDomainName}${this.#hook}`
    }

    get cdn() {

        return this.#cdn
    }

    get firewall() {

        return this.#firewall
    }

    constructor(scope: Construct, id: string, props: BotProps) {

        super(scope, id)

        const global = new BotGlobalStack(props.global.scope(this), props)

        const isWorkshop = this.node.tryGetContext('workshop')

        const cffWebhookValidator = props.telegram.firewall !== 'cff' ? undefined : new cf.Function(this, 'WebhookValidationFunction', {

            functionName    :`${props.prefix}-bot-webhook-validator`,
            comment         :'IP and Token validation for Telegram Bot webhook',
            code            : cf.FunctionCode.fromInline(webhookCFFCode()),
            runtime         : cf.FunctionRuntime.JS_2_0
        })

        const lambdaOrigin = isWorkshop
            ? new origins.FunctionUrlOrigin(props.backendServer, { originId: 'Webhook' })
            : origins.FunctionUrlOrigin.withOriginAccessControl(props.backendServer, { originId: 'Webhook' })

        const route_to_TgBot: cf.BehaviorOptions = {

            origin                  : lambdaOrigin,
            viewerProtocolPolicy    : cf.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods          : cf.AllowedMethods.ALLOW_ALL,
            cachePolicy             : cf.CachePolicy.CACHING_DISABLED,
            originRequestPolicy     : cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,            
            edgeLambdas             : [{
                eventType           : cf.LambdaEdgeEventType.ORIGIN_REQUEST,
                functionVersion     : global.bodyHasher,
                includeBody         : true
            }],
            functionAssociations    : cffWebhookValidator && [{
                eventType           : cf.FunctionEventType.VIEWER_REQUEST,
                function            : cffWebhookValidator
            }]
        }

        this.#cdn = new cf.Distribution(this, 'Webhook:CDN', {

            // ↓↓↓↓ at the moment "minimumProtocolVersion setting" doesn't have
            //      effect for "cloudfront.net" default domain.
            //      But if you use your own domain then the minimumProtocolVersion
            //      would work for you, and this is the best practice:
            comment                 :`${props.prefix}-bot-webhook`,
            minimumProtocolVersion  : cf.SecurityPolicyProtocol.TLS_V1_3_2025,
            priceClass              : cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion             : cf.HttpVersion.HTTP2_AND_3,
            webAclId                : global.firewall,
            enableLogging           : true,
            logIncludesCookies      : false,
            logBucket               : props.logBucket,
            logFilePrefix           :'bot',
            defaultBehavior         : route_to_TgBot,
            additionalBehaviors     : {

                [props.telegram.webHook]: route_to_TgBot
            }
        })

        this.#hook      = props.telegram.webHook || ''
        this.#firewall  = (cffWebhookValidator?.functionArn || global.firewall || '') as ARN

        NagSuppressions.addResourceSuppressions(this.#cdn, [
            {
                id          : 'AwsSolutions-CFR1',
                reason      : 'Geo restrictions not needed - access is restricted via IP allowlist to Telegram Bot API IP address range only'
            },
            {
                id          : 'AwsSolutions-CFR2',
                reason      : 'This CDN is either use WebACL or CFF for filtering requests initiated from Telegram Bot API official IP ranges only'
            },
            {
                id          : 'AwsSolutions-CFR4',
                reason      : 'Using cloudfront.net domain'
            },
            {
                id          : "AwsSolutions-S1",
                reason      : "The S3 Bucket has server access logs disabled. This is a logging bucket itself."
            },
            {
                id          : "AwsSolutions-S10",
                reason      : "The S3 Logging Bucket is configured by CDK automatically"
            }
        ], true)
    }
}





class BotGlobalStack {

    #webACL         : waf.CfnWebACL | undefined
    #edgeFunction   : cf.experimental.EdgeFunction

    get firewall() {

        return this.#webACL?.attrArn || undefined
    }

    get bodyHasher() {

        return this.#edgeFunction.currentVersion
    }

    constructor(scope: Construct, props: BotProps) {

        this.#edgeFunction = new cf.experimental.EdgeFunction(scope, 'BodyHasher', {

            functionName    :`${props.prefix}-bot-global-bodyhasher`,
            handler         :'index.handler',
            runtime         : lambda.Runtime.NODEJS_LATEST,
            code            : lambda.Code.fromInline(`const { createHash } = require("crypto");

exports.handler = async (event) => {

    const request = event.Records[0].cf.request

    if (request.body && request.body.data) {

        const bodyData = request.body.encoding === 'base64'
            ? Buffer.from(request.body.data, 'base64')
            : request.body.data;

        const sha256Hash = createHash('sha256')
            .update(bodyData)
            .digest('hex');

        request.headers['x-amz-content-sha256'] = [{
            key: 'x-amz-content-sha256',
            value: sha256Hash
        }];
    }

    return request
};`
            ),
        })

        // Lambda@Edge functions can take several hours to be removed after
        // CloudFront distribution deletion. In practice, this means Lambda@Edge
        // removal will be manual. To avoid blocking Global Stack removal, we
        // configure CloudFormation to retain the Function for manual cleanup.

        this.#edgeFunction.node.children.forEach(i => {

            if ("applyRemovalPolicy" in i && typeof i.applyRemovalPolicy === 'function') {

                i.applyRemovalPolicy(RemovalPolicy.RETAIN)
            }
        })

        const ipSet = new waf.CfnIPSet(scope, 'AllowedIPs', {

            scope           :'CLOUDFRONT',
            ipAddressVersion:'IPV4',
            name            :`${props.prefix}-telegram-source-ip`,
            addresses       : webhookAllowedIPs(),
        })

        this.#webACL = props.telegram.firewall !== 'waf' ? undefined : new waf.CfnWebACL(scope, 'Firewall:Bot', {

            scope           :'CLOUDFRONT',
            name            :`${props.prefix}-bot`,
            defaultAction   : { block: {} },
            visibilityConfig: {
                metricName              :'telegram_bot_api_firewall',
                cloudWatchMetricsEnabled: true,
                sampledRequestsEnabled  : true,
            },
            rules: [
                {
                    name        :'telegram_bot_api_allowed_ips',
                    priority    : 0,
                    statement   : {
                        notStatement: {
                            statement: {
                                ipSetReferenceStatement: {
                                    arn: ipSet.attrArn
                                }
                            }
                        }
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        metricName              :'telegram_bot_api_allowed_ips',
                        cloudWatchMetricsEnabled: true,
                        sampledRequestsEnabled  : true,
                    }
                },
                {
                    name        :'telegram_bot_api_rate_limit',
                    priority    : 1,
                    statement   : {
                        rateBasedStatement: {
                            aggregateKeyType    :'IP',
                            limit               : props.telegram.rateLimit,
                        }
                    },
                    action: { block: {} },
                    visibilityConfig: {
                        metricName              :'telegram_bot_api_rate_limit',
                        sampledRequestsEnabled  : true,
                        cloudWatchMetricsEnabled: true,
                    }
                },
                {
                    name        : webhookWAFRuleName(),
                    priority    : 2,
                    action      : { allow: {} },
                    statement   : webhookWAFStatement('<VALUE-WILL-BE-SET-LATER-DURING-APP-INIT>'),
                    visibilityConfig: {
                        metricName              :'telegram_bot_api_webhook',
                        sampledRequestsEnabled  : true,
                        cloudWatchMetricsEnabled: true,
                    },
                }
            ]
        })

        NagSuppressions.addResourceSuppressions(this.#edgeFunction, [
            {
                id      : 'AwsSolutions-IAM4',
                reason  : 'Managed policy required for Lambda@Edge logging due to the fact that Lambda@Edge writes logs in any region where it is invoked',
            },
            {
                id      : "AwsSolutions-L1",
                reason  : "False Positive: the function actually DOES use the latest NodeJS Runtime version: { runtime: lambda.Runtime.NODEJS_LATEST }"
            },

        ], true)
    }
}