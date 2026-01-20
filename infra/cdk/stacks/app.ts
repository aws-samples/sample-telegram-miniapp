import   $                    from "@core/constants"
import   * as cdk             from "aws-cdk-lib"
import   * as bedrock         from "aws-cdk-lib/aws-bedrock"
import { NagSuppressions    } from "cdk-nag"
import { Construct          } from "constructs"
import { GlobalStack        } from "./global"
import { Params             } from "./params"
import { Backend            } from "./backend"
import { DynamoDB           } from "./dynamodb"
import { Logs               } from "./logs"
import { DevTools           } from "./dev"
import { Bot                } from "./bot"
import { CDN                } from "./cdn"

// ╭─────────────────────────────────────────────────────────────────────────────────────────────────╮
// │                                TELEGRAM MINIAPP+BOT SAMPLE STACK                                │
// ╰─────────────────────────────────────────────────────────────────────────────────────────────────╯
//
// ╭────────────────────╮    ╭───────────────────────────────────────────────────────────────────────╮
// │    DEV             │    │          APPLICATION                                                  │
// │    CONSTRUCT       │    │          CONSTRUCTS                                                   │
// │                    │    │                                                                       │
// │ ╔════════════════╗ │    │        ╔═════════════════╗       ╔══════════════╗                     │
// │ ║  GIT CLI       ║ │    │        ║ MINIAPP CLIENT  ║       ║ BOT CLIENT   ║                     │
// │ ╚════════════════╝ │    │        ╚═════════════════╝       ╚══════════════╝                     │
// │        │           │    │                │                        │                             │
// │        │           │    │                │                        │                             │
// │        ▼           │    │                ▼                        ▼                             │
// │ ╭────────────────╮ │    │        ╭─────────────────╮       ╭─────────────╮                      │  
// │ │ CodeCommit     │ │    │        │ Web Application │       │ WAF or CF   │                      │
// │ ╰──────┬─────────╯ │    │        │ Firewall (WAF)  │       │ Function    │                      │
// │        ▼           │    │        ╰───────┬─────────╯       ╰──────┬──────╯                      │   
// │ ╭────────────────╮ │    │                │                        │                             │
// │ │ EventBridge    │ │    │                ▼                        ▼                             │
// │ ╰──────┬─────────╯ │    │        ╭────────────────╮        ╭─────────────╮     ╭─────────────╮  │
// │        ▼           │    │        │  CloudFront    │        │  CloudFront │────►│ Lambda@Edge │  │
// │ ╭────────────────╮ │    │        │ (Miniapp)      │        │ (Webhook)   │◄────│             │  │
// │ │ CodeBuild      │ │    │        ╰───────┬────────╯        ╰──────┬──────╯     ╰─────────────╯  │
// │ ╰──────┬─────────╯ │    │                │                        │                             │
// │        │           │    │        ╭───────┴────────╮               │                             │
// │        │           │    │        │                │               │                             │
// │        ▼           │    │        ▼                ▼               │                             │
// │ ╭────────────────╮ │    │  ╭───────────╮   ╭────────────╮         │                             │
// │ │ CloudFormation │ │    │  │  S3       │   │  Lambda    │◄────────╯                             │
// │ ╰──────┬─────────╯ │    │  │ (Static)  │   │ (Backend)  │                                       │
// ╰────────┼───────────╯    │  ╰───────────╯   ╰──────┬─────╯                                       │
//          │                │                         │                                             │
//          │                │                         │                                             │
//          ╰───────────────►│        ╭────────────────┼────────────────╮                            │
//                           │        │                │                │                            │
//                           │        ▼                ▼                ▼                            │
//                           │  ╭────────────╮  ╭─────────────╮  ╭─────────────╮                     │
//                           │  │ DynamoDB   │  │ Parameter   │  │ Bedrock API │                     │
//                           │  │ Tables     │  │ Store       │  │ + Guardrail │                     │
//                           │  ╰────────────╯  ╰─────────────╯  ╰─────────────╯                     │
//                           │                                                                       │
//                           │  ╭─────────────────────────────────────────────────────────────────╮  │
//                           │  │  CloudWatch Logs (6 months retention)                           │  │
//                           │  │  ├─► CloudFront + Lambda@Edge                                   │  │
//                           │  │  ╰─► Lambda Backend                                             │  │
//                           │  ╰─────────────────────────────────────────────────────────────────╯  │
//                           ╰───────────────────────────────────────────────────────────────────────╯
//
//
//
export class AppStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: cdk.StackProps) {

        const region = props?.env?.region?.toLowerCase() || scope.node.path && cdk.Stack.of(scope).region

        super(scope, id, Object.assign(props, {

            crossRegionReferences: $.artifacts.cdn.waf && region !== "us-east-1"
        }))

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    Constructs                                                                         │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        const theGlobal         = new GlobalStack(this, "Global", {

            prefix              : $.naming.prefix
        })

        const theLogs           = new Logs(this, "Logs", {

            prefix              : $.naming.prefix
        })

        const theBackend        = new Backend(this, "Backend", {

            prefix              : $.naming.prefix,
            package             : $.artifacts.lambda.gui.package,
            logGroup            : theLogs.appLogs,
            memorySize          : $.artifacts.lambda.gui.memorySize,
            timeout             : $.artifacts.lambda.gui.timeout,
            handler             : $.artifacts.lambda.gui.handler,
            execWrapper         : $.artifacts.lambda.gui.execWrapper,
            healthcheck         : $.artifacts.lambda.gui.healthcheck,
            port                : $.artifacts.lambda.gui.port,
            webAdaptor          : {
                x86             : $.aws.lambda.webadaptor.x86(this.region),
                arm64           : $.aws.lambda.webadaptor.arm64(this.region),
            },
            production          : $.artifacts.dev.production,
            waitForCacheInv     : $.artifacts.cdn.wait_for_cdn_cache_invalidation
        })

        const theCDN            = new CDN(this, "CDN", {

            prefix              : $.naming.prefix,
            logBucket           : theLogs.s3,
            backendServer       : theBackend.url,
            staticContent       : theBackend.bucket,
            firewall            : theGlobal.firewall,
            indexFile           :'index.html',
            geoRestrictions     : $.artifacts.cdn.geo.deny,
            basepath            : $.artifacts.lambda.gui.basepath,            
            production          : $.artifacts.dev.production,
        })

        const theBot            = new Bot(this, "Bot", {

            prefix              : $.naming.prefix,
            logBucket           : theLogs.s3,
            backendServer       : theBackend.url,
            global              : theGlobal.deployment,
            telegram            : {
                webHook         : $.telegram.webhook.path,
                firewall        : $.telegram.webhook.firewall,
                rateLimit       : $.telegram.webhook.rate_limit,
            }
        })

        const theDB             = new DynamoDB(this, "Database", {

            tables              : $.artifacts.tables
        })

        const theGuardrail      = new bedrock.CfnGuardrail(this, "Guardrail", {

            name                : `${$.naming.prefix}-guardrail`,
            blockedInputMessaging   : "Sorry, I cannot process this request.",
            blockedOutputsMessaging : "Sorry, I cannot provide this response.",
            contentPolicyConfig : {
                filtersConfig   : [
                    { type: "SEXUAL",           inputStrength: "HIGH", outputStrength: "HIGH" },
                    { type: "VIOLENCE",         inputStrength: "HIGH", outputStrength: "HIGH" },
                    { type: "HATE",             inputStrength: "HIGH", outputStrength: "HIGH" },
                    { type: "INSULTS",          inputStrength: "HIGH", outputStrength: "HIGH" },
                    { type: "MISCONDUCT",       inputStrength: "HIGH", outputStrength: "HIGH" },
                    { type: "PROMPT_ATTACK",    inputStrength: "HIGH", outputStrength: "NONE" },
                ]
            }
        })

        const theDev            = new DevTools(this, "Dev", {

            prefix              : $.naming.prefix,
            repository          : $.artifacts.dev.repository,
            branch              : $.artifacts.dev.branch,
            buildspec           : $.artifacts.dev.specfile,
            timeoutMinutes      : $.artifacts.dev.timeout,
            production          : $.artifacts.dev.production,
            logs                : theLogs.buildLogs
        })

        const theParams         = new Params(this, "Params", {

            webhook             : {
                url             : theBot.url,
                hash            :'<SHOULD-BE-SET-LATER-DURING-APP-INIT>',
                firewall        : {
                    arn         : theBot.firewall,
                    type        : $.telegram.webhook.firewall,
                }
            },

            guardrail           : {
                id              : theGuardrail.attrGuardrailId,
                version         : theGuardrail.attrVersion
            },

            deployment          : {
                name            : $.naming.prefix,
                git             : theDev.gitInfo,
                logs            : theLogs.url,
                miniapp         : theCDN.url,
                webhook         : theBot.url,
                regions         : {
                    main        : this.region,
                    global      : theGlobal.region,
                },
                stacks          : {
                    main        : this.stackId,
                    global      : theGlobal.id,
                },

                database        : {
                    tables      : [
                        {
                            name        : $.artifacts.tables.config.name,
                            partitionKey: { name: $.artifacts.tables.config.pk.name },
                            sortKey     : { name: $.artifacts.tables.config.sk.name },
                            purpose     : 'Application configuration storage'
                        },
                        {
                            name        : $.artifacts.tables.users.name,
                            partitionKey: { name: $.artifacts.tables.users.pk.name },
                            sortKey     : { name: $.artifacts.tables.users.sk.name, type: $.artifacts.tables.users.sk.type },
                            purpose     : 'User data and profiles'
                        },
                        {
                            name        : $.artifacts.tables.sessions.name,
                            partitionKey: { name: $.artifacts.tables.sessions.pk.name },
                            sortKey     : { name: $.artifacts.tables.sessions.sk.name },
                            ttl         : $.artifacts.tables.sessions.ttl,
                            purpose     : 'User sessions (90-day TTL)'
                        }
                    ]
                },

                bedrock         : {
                    region      : $.aws.bedrock.region,
                    model       : $.aws.bedrock.model,
                    maxTokens   : $.aws.bedrock.max_tokens,
                    topP        : $.aws.bedrock.top_p,
                    guardrail   : {
                        id      : theGuardrail.attrGuardrailId,
                        version : theGuardrail.attrVersion
                    }
                },

                security        : {
                    session     : {
                        ttl         : $.session.ttl,
                        cookieName  : $.session.cookie.name,
                        cookieMaxAge: $.session.cookie.max_age
                    },
                    telegram    : {
                        authTolerance   : $.telegram.session.delay_tolerance,
                        webhookPath     : $.telegram.webhook.path,
                        webhookFirewall : $.telegram.webhook.firewall,
                        webhookRateLimit: $.telegram.webhook.rate_limit
                    },
                    cdn         : {
                        waf         : $.artifacts.cdn.waf,
                        geoBlocking : $.artifacts.cdn.geo.deny
                    }
                },

                lambda          : {
                    memorySize  : $.artifacts.lambda.gui.memorySize,
                    timeout     : $.artifacts.lambda.gui.timeout,
                    architecture: 'ARM64',
                    runtime     : 'Node.js 22.x',
                    basePath    : $.artifacts.lambda.gui.basepath,
                    healthCheck : $.artifacts.lambda.gui.healthcheck,
                    port        : $.artifacts.lambda.gui.port
                },

                resources       : {
                    accountId   : this.account,
                    lambda      : {
                        arn     : theBackend.server.functionArn,
                        name    : theBackend.server.functionName
                    },
                    cdn         : {
                        id      : theCDN.cdn.distributionId,
                        domain  : theCDN.cdn.distributionDomainName
                    },
                    bucket      : {
                        name    : theBackend.bucket.bucketName,
                        arn     : theBackend.bucket.bucketArn
                    },
                    repository  : {
                        name    : theDev.repo.repositoryName,
                        arn     : theDev.repo.repositoryArn
                    }
                }
            }
        })

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    Permissions                                                                        │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        theDB.grantReadWriteData(theBackend.server)
        theBackend.deployStaticContent(theCDN.cdn)
        theParams.grantRead(theBackend.server)
        theParams.grantDeploymentAccess(theDev.project)
        theLogs.grantWrite(theCDN.cdn, theBot.cdn)

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    Outputs                                                                            │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        new cdk.CfnOutput(this, "MiniappURL", {

            value       : theCDN.url,
            description : "Telegram Miniapp URL"
        })

        new cdk.CfnOutput(this, "WebhookURL", {

            value       : theBot.url,
            description : "Telegram Bot Webhook"
        })

        new cdk.CfnOutput(this, "GitCloneURL", {

            value       : theDev.gitInfo.ssh,
            description : "Repository Clone URL (SSH)"
        })

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    CDK Nag Suppressions                                                               │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        NagSuppressions.addStackSuppressions(this, [
            {
                id          : "AwsSolutions-IAM5",
                reason      : "Wildcard required for CloudWatch log access"
            },
        ])
    }
}