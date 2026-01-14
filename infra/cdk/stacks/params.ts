import type {
    DeploymentParam,
    WebhookParam        } from "@core/vault"
import { Construct      } from "constructs"
import * as ssm           from "aws-cdk-lib/aws-ssm"
import * as iam           from "aws-cdk-lib/aws-iam"
import   $                from "@core/constants"





export interface ParamsProps {

    deployment  : DeploymentParam
    webhook     : WebhookParam
    guardrail   : {
        id      : string
        version : string
    }
}

export class Params extends Construct {

    #bot        : ssm.StringParameter
    #webhook    : ssm.StringParameter
    #deployment : ssm.StringParameter
    #cookies    : ssm.StringParameter

    grantRead(grantee: iam.IGrantable) {

        // #webhook and #deployment
        // params are not used during runtime.
        // they are required for app init script only
        this.#bot.grantRead(grantee)
        this.#cookies.grantRead(grantee)
    }

    grantWrite(grantee: iam.IGrantable) {

        // #webhook and #deployment
        // params are not used during runtime.
        // #bot param is read only during runtime
        this.#cookies.grantWrite(grantee)
    }

    grantDeploymentAccess(grantee: iam.IGrantable) {

        [
            this.#cookies,
            this.#bot,
            this.#webhook,
            this.#deployment

        ].forEach(i => {

            i.grantRead(grantee)
            i.grantWrite(grantee)
        })
    }

    constructor(scope: Construct, id: string, props: ParamsProps) {

        super(scope, id)

        this.#bot = new ssm.StringParameter(this, 'Bot', {

            parameterName   : $.artifacts.params.bot,
            stringValue     : JSON.stringify({

                guardrail   : props.guardrail,
                webhookHash : props.webhook.hash
            })
        })

        this.#webhook = new ssm.StringParameter(this, 'Webhook', {

            parameterName   : $.artifacts.params.webhook,
            stringValue     : JSON.stringify(props.webhook)
        })

        this.#deployment = new ssm.StringParameter(this, 'Deployment', {

            parameterName   : $.artifacts.params.deployment,
            stringValue     : JSON.stringify(props.deployment)
        })

        this.#cookies = new ssm.StringParameter(this, 'Cookies', {

            parameterName   : $.artifacts.params.cookies,
            stringValue     : JSON.stringify({ ts: 0, keys: [] })
        })
    }
}