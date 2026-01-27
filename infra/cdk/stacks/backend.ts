import type { IDistributionRef  } from "aws-cdk-lib/aws-cloudfront"
import   * as cdk                 from "aws-cdk-lib"
import   * as iam                 from "aws-cdk-lib/aws-iam"
import   * as s3                  from "aws-cdk-lib/aws-s3"
import   * as s3Deployment        from "aws-cdk-lib/aws-s3-deployment"
import   * as logs                from "aws-cdk-lib/aws-logs"
import   * as lambda              from "aws-cdk-lib/aws-lambda"
import   * as fs                  from "fs"
import   * as path                from "path"
import   spawn                    from "cross-spawn"
import { Stack                  } from "aws-cdk-lib"
import { NagSuppressions        } from "cdk-nag"
import { Construct              } from "constructs"
import { existsSync             } from "node:fs"
import { tryUniqueId            } from "./uniqueid"





export interface BackendStackProps {

    package             : string
    prefix              : string
    production          : boolean
    logGroup            : logs.ILogGroup
    handler             : string
    healthcheck         : string
    execWrapper         : string
    port                : number
    timeout             : number
    memorySize          : number
    webAdaptor          : {
        x86             : string
        arm64           : string
    }
    waitForCacheInv?    : boolean
}





export class Backend extends Construct {

    #bucket         : s3.Bucket
    #lambda         : lambda.Function
    #url            : lambda.FunctionUrl
    #runDeployment  : undefined | ((distribution: IDistributionRef) => void)

    get url() {

        return this.#url
    }

    get server() {

        return this.#lambda
    }

    get bucket() {

        return this.#bucket
    }

    deployStaticContent(distribution: IDistributionRef) {

        if (typeof this.#runDeployment === 'function') {

            return this.#runDeployment(distribution)
        }
    }

    constructor(scope: Construct, id: string, props: BackendStackProps) {

        super(scope, id)

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    Backend Server code splitting                                                      │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        const guiBuild   = path.join(process.cwd(), ".cdk.lambda")
        const guiServer  = path.join(guiBuild, "server")
        const guiStatic  = path.join(guiBuild, "static")
        const skipGUI    = this.node.tryGetContext('skipGUI') === 'true'
        const isWorkshop = this.node.tryGetContext('workshop')

        if (!skipGUI) {

            fs.rmSync(guiBuild, { recursive: true, force: true })
            spawn.sync('pnpm', ['--filter', props.package, 'deploy', '--prod', '--legacy', '--config.node-linker=hoisted', guiServer], { stdio: 'inherit' })
            const guiStaticSrc = path.join(guiServer, "build/client")
            if (existsSync(guiStaticSrc)) { fs.renameSync(guiStaticSrc, guiStatic) }
        }

        this.#bucket = new s3.Bucket(this, 'StaticContent', {

            bucketName          : tryUniqueId(this, `${props.prefix}-web-static-content`),
            autoDeleteObjects   : true,
            enforceSSL          : true,
            removalPolicy       : cdk.RemovalPolicy.DESTROY,
            blockPublicAccess   : s3.BlockPublicAccess.BLOCK_ALL,
        })

        this.#lambda  = new lambda.Function(this, 'Server', {
            // ↓ IMPORTANT -- this is part of LWA activation   ↓↓↓
            //                handler ='run.sh' or similar script
            //                generated at lambda code build
            functionName    :`${props.prefix}-backend`,
            handler         : props.handler,
            code            : skipGUI
                            ? lambda.Code.fromInline("console.log('Dummy code to allow fast Bootstrap'); process.exit(0);")
                            : lambda.Code.fromAsset(guiServer),
            runtime         : lambda.Runtime.NODEJS_LATEST,
            architecture    : lambda.Architecture.ARM_64,
            timeout         : cdk.Duration.seconds(props.timeout),
            memorySize      : props.memorySize,
            layers          : [ lambda.LayerVersion.fromLayerVersionArn(this, 'LWA', props.webAdaptor.arm64) ],
            environment: {
                // ↓ IMPORTANT! -- this is part of LWA activation  ↓↓↓
                AWS_LWA_READINESS_CHECK_PATH: props.healthcheck,
                // ↓ IMPORTANT! -- this is part of LWA activation  ↓↓↓
                AWS_LAMBDA_EXEC_WRAPPER: props.execWrapper,
                // ↓ IMPORTANT! -- this is part of LWA activation  ↓↓↓
                //                 PORT=3000 is not allowed in Lambda
                PORT            : String(props.port)
            },
            logGroup            : props.logGroup,
            loggingFormat       : lambda.LoggingFormat.JSON,
            role                : new iam.Role(this, 'Role', {

                roleName        :`${props.prefix}-backend-role`,
                assumedBy       : new iam.ServicePrincipal('lambda.amazonaws.com', {

                    region      : Stack.of(this).region,
                    conditions  : { StringEquals: { 'aws:SourceAccount': Stack.of(this).account } }
                }),

                inlinePolicies  : {

                    logging: new iam.PolicyDocument({

                        statements: [

                            new iam.PolicyStatement({

                                effect  : iam.Effect.ALLOW,
                                actions : [
                                    "logs:CreateLogGroup",
                                    "logs:CreateLogStream",
                                    "logs:PutLogEvents",
                                ],
                                resources: [
                                    props.logGroup.logGroupArn,
                                   `${props.logGroup.logGroupArn}:log-stream:*`,
                                ],
                            })
                        ]
                    }),

                    bedrock: new iam.PolicyDocument({ 

                        statements: [

                            new iam.PolicyStatement({

                                actions     : ["bedrock:InvokeModel"],
                                resources   : [
                                    "arn:aws:bedrock:*::foundation-model/anthropic.*",
                                    "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
                                    `arn:aws:bedrock:*:${Stack.of(this).account}:inference-profile/*.anthropic.*`,
                                    `arn:aws:bedrock:*:${Stack.of(this).account}:inference-profile/*.amazon.nova-*`,
                                ]
                            })
                        ]
                    }),

                    marketplace: new iam.PolicyDocument({

                        statements: [

                            new iam.PolicyStatement({

                                effect  : iam.Effect.ALLOW,
                                actions : [
                                    "aws-marketplace:ViewSubscriptions",
                                    "aws-marketplace:Subscribe",
                                ],
                                resources: ["*"]
                            })
                        ]
                    })
                }
            })
        })

        this.#url = this.#lambda.addFunctionUrl({

            authType    : isWorkshop ? lambda.FunctionUrlAuthType.NONE : lambda.FunctionUrlAuthType.AWS_IAM,
            invokeMode  : lambda.InvokeMode.BUFFERED
        })

        if (!skipGUI && existsSync(guiStatic)) {

            const doS3Deployment = (distribution: IDistributionRef | undefined ) => {

                new s3Deployment.BucketDeployment(this, 'WebDeployment', {

                    distribution        : distribution,
                    destinationBucket   : this.#bucket,
                    sources             : [

                        s3Deployment.Source.asset(guiStatic)
                    ],
                    waitForDistributionInvalidation: props.production && props.waitForCacheInv
                })
            }

            if (props.production) {

                this.#runDeployment = doS3Deployment
            }
            else {

                doS3Deployment(undefined)
            }

            NagSuppressions.addStackSuppressions(Stack.of(this), [
                {
                    id      : "AwsSolutions-IAM4",
                    reason  : "/Custom::CDKBucketDeployment - this Lambda is controlled by CDK"
                },
                {
                    id      : "AwsSolutions-L1",
                    reason  : "/Custom::CDKBucketDeployment - this Lambda is controlled by CDK"
                },
            ])
        }

        NagSuppressions.addResourceSuppressions(this.#bucket, [
            {
                id      : "AwsSolutions-S1",
                reason  : "This bucket contains publicly available static content"
            }
        ])

        NagSuppressions.addResourceSuppressions(this.#lambda, [
            {
                id      : "AwsSolutions-L1",
                reason  : "False Positive: the function actually DOES use the latest NodeJS Runtime version: { runtime: lambda.Runtime.NODEJS_LATEST }"
            }
        ], true)
    }
}