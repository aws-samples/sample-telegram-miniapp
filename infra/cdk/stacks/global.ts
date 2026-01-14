import { Construct        } from "constructs"
import { Stack            } from "aws-cdk-lib"
import * as waf             from "aws-cdk-lib/aws-wafv2"

// ╭───────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                       │
// │    Interfaces                                                                         │
// │                                                                                       │
// ╰───────────────────────────────────────────────────────────────────────────────────────╯

export interface GlobalDeploymentInfo {

    reuseParentStack    : boolean
    stack               : Stack
    scope               : (scope: Construct) => Construct
}

export interface GlobalStackProps {

    prefix              : string
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    Global Stack                                                                        │
// │   (for WebACL should be always deployed to us-east-1 region)                           │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

export class GlobalStack extends Construct {

    #webACL     : waf.CfnWebACL
    #deployment : GlobalDeploymentInfo    

    get firewall() {

        return this.#webACL?.attrArn
    }

    get deployment() {

        return this.#deployment
    }

    get id() {

        return this.#deployment.stack.stackId
    }

    get region() {

        return this.#deployment.stack.region
    }

    constructor(scope: Construct, id: string, props: GlobalStackProps) {

        const global = createGlobalStack(scope, id, `${props.prefix}-global`)

        super(global.scope(scope), id)

        this.#deployment = global

        this.#webACL = new waf.CfnWebACL(global.scope(this), 'Firewall:Web', {

            scope           :'CLOUDFRONT',
            name            :`${props.prefix}-web`,
            defaultAction   : { allow: {} },
            visibilityConfig: {
                metricName              :'firewall',
                cloudWatchMetricsEnabled: true,
                sampledRequestsEnabled  : true,
            },
            rules: [
                {
                    name        : 'ip_reputation',
                    priority    : 1,
                    statement   : {
                        managedRuleGroupStatement: {
                            vendorName  :'AWS',
                            name        :'AWSManagedRulesAmazonIpReputationList',
                        },
                    },
                    overrideAction  : { none: {} },
                    visibilityConfig: {
                        metricName              :'ip_reputation',
                        cloudWatchMetricsEnabled: true,
                        sampledRequestsEnabled  : true,
                    },
                }
            ],
        })
    }
}





// ╭───────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                       │
// │    Helpers                                                                            │
// │                                                                                       │
// ╰───────────────────────────────────────────────────────────────────────────────────────╯

export function createGlobalStack(scope: Construct, id: string, name: string): GlobalDeploymentInfo {

    const parentStack       = scope.node.path ? Stack.of(scope) : undefined
    const reuseParentStack  = parentStack?.region === 'us-east-1'
    const globalStack       = reuseParentStack
        ? parentStack
        : new Stack(scope, id, {

            stackName: name,
            crossRegionReferences: true,
            env: {

                region  :'us-east-1',
                account : parentStack?.account
            }
        })

    return {

        reuseParentStack,
        stack: globalStack,
        scope: reuseParentStack ? i => i : () => globalStack
    }
}