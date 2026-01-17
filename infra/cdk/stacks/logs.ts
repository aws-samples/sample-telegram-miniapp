import { Construct        } from "constructs"
import { NagSuppressions  } from "cdk-nag"
import { tryUniqueId      } from "./uniqueid"
import   * as cdk           from "aws-cdk-lib"
import   * as iam           from "aws-cdk-lib/aws-iam"
import   * as logs          from "aws-cdk-lib/aws-logs"
import   * as s3            from "aws-cdk-lib/aws-s3"
import   * as cf            from "aws-cdk-lib/aws-cloudfront"





export interface LogsProps {

    prefix          : string
    retentionDays  ?: number
}

export class Logs extends Construct {

    #s3     : s3.IBucket
    #app    : logs.ILogGroup
    #build  : logs.ILogGroup

    get appLogs() {

        return this.#app
    }

    get buildLogs() {

        return this.#build
    }

    get s3() {

        return this.#s3
    }

    get url() {

        const region_app = cdk.Stack.of(this.#app).region
        const region_build = cdk.Stack.of(this.#build).region
        return {

            app     : `https://${region_app}.console.aws.amazon.com/cloudwatch/home?region=${region_app}#logsV2:log-groups/log-group/${encodeURIComponent(this.#app.logGroupPhysicalName())}`,
            build   : `https://${region_build}.console.aws.amazon.com/cloudwatch/home?region=${region_build}#logsV2:log-groups/log-group/${encodeURIComponent(this.#build.logGroupPhysicalName())}`
        }
    }

    grantWrite(...cdn: cf.IDistribution[]) {

        cdn.forEach(i => {

            this.#s3.addToResourcePolicy(new iam.PolicyStatement({

                effect      : iam.Effect.ALLOW,
                principals  : [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
                actions     : ['s3:PutObject'],
                resources   : [`${this.#s3.bucketArn}/*`],
                conditions  : {
                    StringEquals: {
                        'AWS:SourceArn': `arn:aws:cloudfront::${cdk.Stack.of(i).account}:distribution/${i.distributionId}`,
                    },
                },
            }))

        //  Ensure CloudFront distributions are deleted BEFORE S3 logging bucket
        //  to prevent race condition where CloudFront writes buffered logs after
        //  the auto-delete Lambda empties the bucket
        //  this.#s3.node.addDependency(i)
        //  i.node.addDependency(this)
        })
    }

    constructor(scope: Construct, id: string, props: LogsProps) {

        super(scope, id)

        this.#app = new logs.LogGroup(this, "CloudWatch:App", {

            logGroupName        : props.prefix,
            retention           : props.retentionDays || logs.RetentionDays.SIX_MONTHS
        })

        this.#build = new logs.LogGroup(this, "CloudWatch:Build", {

            logGroupName        :`${props.prefix}-build`,
            retention           : props.retentionDays || logs.RetentionDays.SIX_MONTHS
        })

        this.#s3 = new s3.Bucket(this, "S3", {

            bucketName          : tryUniqueId(this, `${props.prefix}-logs`),
            objectOwnership     : s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
            blockPublicAccess   : s3.BlockPublicAccess.BLOCK_ALL,
            encryption          : s3.BucketEncryption.S3_MANAGED,
            enforceSSL          : true,
            removalPolicy       : cdk.RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
            lifecycleRules      : [{
                id              :`DeleteLogsIn${props.retentionDays||180}days`,
                expiration      : cdk.Duration.days(props.retentionDays||180)
            }]
        })

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    CDK Nag Suppressions                                                               │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        NagSuppressions.addResourceSuppressions(this.#s3, [
            {
                id      : "AwsSolutions-S1",
                reason  : "The S3 Bucket has server access logs disabled because it's a logging bucket itself."
            }
        ], true)
    }
}