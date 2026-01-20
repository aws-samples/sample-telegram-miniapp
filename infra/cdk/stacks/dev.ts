import { Construct        } from "constructs"
import { NagSuppressions  } from "cdk-nag"
import { BOOTSTRAP_QUALIFIER_CONTEXT,
         Duration, Stack  } from "aws-cdk-lib"
import type { ILogGroup   } from "aws-cdk-lib/aws-logs"
import * as codecommit      from "aws-cdk-lib/aws-codecommit"
import * as codebuild       from "aws-cdk-lib/aws-codebuild"
import * as events          from "aws-cdk-lib/aws-events"
import * as targets         from "aws-cdk-lib/aws-events-targets"
import * as iam             from "aws-cdk-lib/aws-iam"

// ╭────────────────────╮
// │    DEV             │
// │    CONSTRUCT       │
// │                    │
// │ ┌────────────────┐ │
// │ │ CodeCommit     │ │
// │ └──────┬─────────┘ │
// │        │           │
// │        ▼           │
// │ ┌────────────────┐ │
// │ │ EventBridge    │ │
// │ └──────┬─────────┘ │
// │        │           │
// │        ▼           │
// │ ┌────────────────┐ │
// │ │ CodeBuild      │ │
// │ └────────────────┘ │
// ╰────────────────────╯

export interface DevProps {

    prefix              : string
    repository          : string
    branch              : string
    buildspec           : string
    production          : boolean
    timeoutMinutes     ?: number
    logs                : ILogGroup
}

export class DevTools extends Construct {

    #repository         : codecommit.Repository
    #buildProject       : codebuild.Project
    #buildTrigger       : events.Rule
    #branch             : string
    #buildspec          : string

    get gitInfo() {

        return {

            http        : this.#repository.repositoryCloneUrlHttp,
            ssh         : this.#repository.repositoryCloneUrlSsh,
            branch      : this.#branch,
            buildspec   : this.#buildspec
        }
    }

    get repo(): codecommit.IRepository {

        return this.#repository
    }

    get project(): codebuild.IProject {

        return this.#buildProject
    }

    grantWebhookUpdatePermissions() {

        this.#buildProject.addToRolePolicy(new iam.PolicyStatement({
            sid: 'CloudFrontFunctionUpdates',
            effect: iam.Effect.ALLOW,
            actions: [
                'cloudfront:DescribeFunction',
                'cloudfront:UpdateFunction',
                'cloudfront:PublishFunction'
            ],
            resources: ['arn:aws:cloudfront::*:function/*']
        }))

        this.#buildProject.addToRolePolicy(new iam.PolicyStatement({
            sid: 'WAFWebACLUpdates',
            effect: iam.Effect.ALLOW,
            actions: [
                'wafv2:GetWebACL',
                'wafv2:UpdateWebACL'
            ],
            resources: ['arn:aws:wafv2:*:*:*/webacl/*/*']
        }))
    }

    constructor(scope: Construct, id: string, props: DevProps) {

        super(scope, id)
        this.#branch = props.branch
        this.#buildspec = props.buildspec

        this.#repository = new codecommit.Repository(this, 'Repository', {

            repositoryName  : props.repository,
            description     : `CodeCommit repository for Telegram Miniapp ${props.prefix}`
        })

        this.#buildProject = new codebuild.Project(this, 'BuildProject', {

            projectName     :`${props.prefix}-build`,
            description     :`Build project for Telegram Miniapp ${props.prefix}`,
            source          : codebuild.Source.codeCommit({
                repository  : this.#repository
            }),
            buildSpec       : codebuild.BuildSpec.fromSourceFilename(props.buildspec),            
            environment     : {
                buildImage  : props.production
                            ? codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0
                            : codebuild.LinuxArmLambdaBuildImage.AMAZON_LINUX_2023_NODE_22,
                computeType : props.production
                            ? codebuild.ComputeType.MEDIUM
                            : codebuild.ComputeType.LAMBDA_2GB,
                privileged  : false,
                environmentVariables: {
                    BUILD_MODE: { value: props.production ? '' : 'development' }
                }
            },
            timeout         : props.production
                            ? Duration.minutes(props.timeoutMinutes||30)
                            : undefined,
            logging         : {
                cloudWatch  : {
                    logGroup: props.logs
                }
            },
            role            : new iam.Role(this, 'Role', {

                roleName        :`${props.prefix}-codebuild-deployment-role`,
                assumedBy       : new iam.ServicePrincipal('codebuild'),
                inlinePolicies  : getDeploymentPolicy({
                    account     : Stack.of(this).account,
                    region      : Stack.of(this).region,
                    prefix      : props.prefix,
                    cdkQualifier: Stack.of(this).node.tryGetContext(BOOTSTRAP_QUALIFIER_CONTEXT)
                })
            })
        })

        this.#buildTrigger = new events.Rule(this, 'BuildTrigger', {

            ruleName        : `${props.prefix}-codebuild-trigger`,
            description     : `Trigger build on commits to ${props.repository}/${props.branch}`,
            eventPattern    : {
                source      : ['aws.codecommit'],
                detailType  : ['CodeCommit Repository State Change'],
                detail      : {
                    event               : ['referenceCreated', 'referenceUpdated'],
                    referenceType       : ['branch'],
                    referenceName       : [ props.branch ]
                },
                resources   : [this.#repository.repositoryArn]
            }
        })

        this.#buildTrigger.addTarget(new targets.CodeBuildProject(this.#buildProject, {

            eventRole: new iam.Role(this, 'TriggerRole', {

                roleName    :`${props.prefix}-codebuild-trigger-role`,
                assumedBy   : new iam.ServicePrincipal('events.amazonaws.com')
            })
        }))

    // ╭───────────────────────────────────────────────────────────────────────────────────────╮
    // │                                                                                       │
    // │    CDK Nag Suppressions                                                               │
    // │                                                                                       │
    // ╰───────────────────────────────────────────────────────────────────────────────────────╯

        NagSuppressions.addResourceSuppressions(this.#buildProject, [
            {
                id      : 'AwsSolutions-IAM5',
                reason  : 'Wildcard permissions required for CodeBuild to access CloudWatch Logs and S3 cache'
            },
            {
                id      : 'AwsSolutions-CB3',
                reason  : 'Privileged mode disabled - can be enabled via props if needed for Docker builds'
            },
            {
                id      : 'AwsSolutions-CB4',
                reason  : 'KMS encryption not required for this build project'
            }
        ], true)
    }
}





// ╭────────────────────────────────────────────────────────────────────────────────────────╮
// │                                                                                        │
// │    IAM role policies                                                                   │
// │    that allows CodeBuild project to deploy all resources                               │
// │    defined by this CDK application                                                     │
// │                                                                                        │
// ╰────────────────────────────────────────────────────────────────────────────────────────╯

export interface CodeBuildPolicyConfig {

    account         : string
    region          : string
    prefix          : string
    cdkQualifier   ?: string
}

export function getDeploymentPolicy(config: CodeBuildPolicyConfig) {

    const {
        account,
        region,
        prefix,
        cdkQualifier = 'hnb659fds'

    } = config

    const globalRegion = 'us-east-1'
    const regions = region === globalRegion ? [region] : [region, globalRegion]

    // [`${props.prefix}-deployment`]: new iam.PolicyDocument({

    //                     statements: getDeploymentPolicy({

    //                         account     : Stack.of(this).account,
    //                         region      : Stack.of(this).region,
    //                         prefix      : props.prefix,
    //                         cdkQualifier: Stack.of(this).node.tryGetContext(BOOTSTRAP_QUALIFIER_CONTEXT)
    //                     })
    //                 })

    return {

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ STS - For CDK deployments and cross-region operations                                  │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-sts`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'STSAssumeRole',
                    effect: iam.Effect.ALLOW,
                    actions: ['sts:AssumeRole'],
                    resources: regions.flatMap(r => [
                        `arn:aws:iam::${account}:role/cdk-${cdkQualifier}-cfn-exec-role-${account}-${r}`,
                        `arn:aws:iam::${account}:role/cdk-${cdkQualifier}-deploy-role-${account}-${r}`,
                        `arn:aws:iam::${account}:role/cdk-${cdkQualifier}-file-publishing-role-${account}-${r}`,
                        `arn:aws:iam::${account}:role/cdk-${cdkQualifier}-lookup-role-${account}-${r}`,
                    ])
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ IAM - Roles for Lambda, CodeBuild, and service-linked roles                            │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-iam`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'IAMRoleManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'iam:List*',
                        'iam:*RolePolicy',
                        'iam:GetRole',
                        'iam:CreateRole',
                        'iam:UpdateRole',
                        'iam:DeleteRole',
                        'iam:TagRole',
                        'iam:UntagRole',
                    //  'iam:CreateRole',
                    //  'iam:DeleteRole',
                    //  'iam:GetRole',
                    //  'iam:UpdateRole',
                    //  'iam:PutRolePolicy',
                    //  'iam:DeleteRolePolicy',
                    //  'iam:GetRolePolicy',
                    //  'iam:AttachRolePolicy',
                    //  'iam:DetachRolePolicy',
                    //  'iam:TagRole',
                    //  'iam:UntagRole',
                    //  'iam:ListRolePolicies',
                    //  'iam:ListAttachedRolePolicies',
                    //  'iam:ListRoleTags',
                    ],
                    resources: [
                        `arn:aws:iam::${account}:role/${prefix}-*`,
                        // CDK-generated roles
                        `arn:aws:iam::${account}:role/*-Custom*`,
                        `arn:aws:iam::${account}:role/*-Provider*`,
                        `arn:aws:iam::${account}:role/*-LogRetention*`,
                    ]
                }),

                new iam.PolicyStatement({
                    sid: 'IAMPassRole',
                    effect: iam.Effect.ALLOW,
                    actions: ['iam:PassRole'],
                    resources: [
                        `arn:aws:iam::${account}:role/${prefix}-*`,
                        `arn:aws:iam::${account}:role/*-Custom*`,
                        `arn:aws:iam::${account}:role/*-Provider*`,
                    ],
                    conditions: {
                        StringEquals: {
                            'iam:PassedToService': [
                                'lambda.amazonaws.com',
                                'edgelambda.amazonaws.com',
                                'codebuild.amazonaws.com',
                                'events.amazonaws.com',
                            ]
                        }
                    }
                }),

                new iam.PolicyStatement({
                    sid: 'IAMServiceLinkedRoles',
                    effect: iam.Effect.ALLOW,
                    actions: ['iam:CreateServiceLinkedRole'],
                    resources: [
                        `arn:aws:iam::${account}:role/aws-service-role/replicator.lambda.amazonaws.com/*`,
                        `arn:aws:iam::${account}:role/aws-service-role/cloudfront.amazonaws.com/*`,
                    ],
                    conditions: {
                        StringEquals: {
                            'iam:AWSServiceName': [
                                'replicator.lambda.amazonaws.com',
                                'cloudfront.amazonaws.com',
                            ]
                        }
                    }
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ CloudFormation - Core deployment permissions                                           │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-cloudformation`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'CloudFormationStackManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'cloudformation:*Stack',
                        'cloudformation:Describe*',
                        'cloudformation:Get*',
                        'cloudformation:List*',
                        'cloudformation:ValidateTemplate',
                        'cloudformation:*ChangeSet',
                    //  'cloudformation:CreateStack',
                    //  'cloudformation:UpdateStack',
                    //  'cloudformation:DeleteStack',
                    //  'cloudformation:DescribeStacks',
                    //  'cloudformation:DescribeStackEvents',
                    //  'cloudformation:DescribeStackResources',
                    //  'cloudformation:GetTemplate',
                    //  'cloudformation:GetTemplateSummary',
                    //  'cloudformation:ValidateTemplate',
                    //  'cloudformation:ListStacks',
                    //  'cloudformation:ListStackResources',
                    //  'cloudformation:CreateChangeSet',
                    //  'cloudformation:DescribeChangeSet',
                    //  'cloudformation:ExecuteChangeSet',
                    //  'cloudformation:DeleteChangeSet',
                    //  'cloudformation:ListChangeSets',
                    ],
                    resources: regions.flatMap(r => [
                        `arn:aws:cloudformation:${r}:${account}:stack/${prefix}/*`,
                        `arn:aws:cloudformation:${r}:${account}:stack/${prefix}-global/*`,
                    ])
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ S3 - Static content bucket, logs bucket, CDK assets                                    │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-s3`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'S3BucketManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        's3:*Bucket*',
                        's3:*Encryption*',
                        's3:*Lifecycle*',
                        's3:*Object*',
                    //  's3:ListBucket',
                    //  's3:CreateBucket',
                    //  's3:DeleteBucket',
                    //  's3:PutBucketPolicy',
                    //  's3:GetBucketPolicy',
                    //  's3:DeleteBucketPolicy',
                    //  's3:PutBucketPublicAccessBlock',
                    //  's3:GetBucketPublicAccessBlock',
                    //  's3:PutEncryptionConfiguration',
                    //  's3:GetEncryptionConfiguration',
                    //  's3:PutLifecycleConfiguration',
                    //  's3:GetLifecycleConfiguration',
                    //  's3:PutBucketOwnershipControls',
                    //  's3:GetBucketOwnershipControls',
                    //  's3:GetBucketLocation',
                    //  's3:GetBucketVersioning',
                    //  's3:PutBucketVersioning',
                    //  's3:PutBucketTagging',
                    //  's3:GetBucketTagging',
                    //  's3:PutBucketAcl',
                    //  's3:GetBucketAcl',
                    ],
                    resources: [
                        `arn:aws:s3:::${prefix}-web-static-content`,
                        `arn:aws:s3:::${prefix}-logs`,
                    ]
                }),

                new iam.PolicyStatement({
                    sid: 'S3ObjectOperations',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        's3:PutObject',
                        's3:GetObject',
                        's3:DeleteObject',
                        's3:ListBucket',
                        's3:GetBucketLocation'
                    ],
                    resources: [
                        `arn:aws:s3:::${prefix}-web-static-content`,
                        `arn:aws:s3:::${prefix}-web-static-content/*`,
                        `arn:aws:s3:::${prefix}-logs`,
                        `arn:aws:s3:::${prefix}-logs/*`,
                        ...regions.flatMap(r => [
                            `arn:aws:s3:::cdk-${cdkQualifier}-assets-${account}-${r}`,
                            `arn:aws:s3:::cdk-${cdkQualifier}-assets-${account}-${r}/*`,
                        ])
                    ]
                }),

                // new iam.PolicyStatement({
                //     sid: 'CDKBootstrapBucket',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         's3:GetObject',
                //         's3:PutObject',
                //         's3:ListBucket',
                //         's3:GetBucketLocation',
                //     ],
                //     resources: regions.flatMap(r => [
                //         `arn:aws:s3:::cdk-${cdkQualifier}-assets-${account}-${r}`,
                //         `arn:aws:s3:::cdk-${cdkQualifier}-assets-${account}-${r}/*`,
                //     ])
                // }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ DynamoDB - Application tables                                                          │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-dynamodb`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'DynamoDBTableManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'dynamodb:*Table',
                        'dynamodb:Describe*',
                        'dynamodb:Update*',
                        'dynamodb:*Tag*',
                        'dynamodb:List*',
                    //  'dynamodb:CreateTable',
                    //  'dynamodb:DeleteTable',
                    //  'dynamodb:DescribeTable',
                    //  'dynamodb:UpdateTable',
                    //  'dynamodb:UpdateTimeToLive',
                    //  'dynamodb:DescribeTimeToLive',
                    //  'dynamodb:TagResource',
                    //  'dynamodb:UntagResource',
                    //  'dynamodb:ListTagsOfResource',
                    //  'dynamodb:UpdateContinuousBackups',
                    //  'dynamodb:DescribeContinuousBackups',
                    ],
                    resources: [
                        `arn:aws:dynamodb:${region}:${account}:table/${prefix}-*`,
                    ]
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ Lambda - Backend server, Lambda@Edge, CDK custom resources                             │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-lambda`]: new iam.PolicyDocument({

            statements: [
                new iam.PolicyStatement({
                    sid: 'LambdaFunctionManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'lambda:*Function*',
                        'lambda:*Permission',
                        'lambda:*Tag*', 
                        'lambda:PublishVersion', 
                        'lambda:ListVersionsByFunction',
                        'lambda:GetPolicy',
                        'lambda:GetLayerVersion',
                        'lambda:InvokeFunction', 
                        'lambda:EnableReplication*',
                        'lambda:DisableReplication*',
                    //  'lambda:CreateFunction',
                    //  'lambda:UpdateFunctionCode',
                    //  'lambda:UpdateFunctionConfiguration',
                    //  'lambda:DeleteFunction',
                    //  'lambda:GetFunction',
                    //  'lambda:GetFunctionConfiguration',
                    //  'lambda:AddPermission',
                    //  'lambda:RemovePermission',
                    //  'lambda:PublishVersion',
                    //  'lambda:ListVersionsByFunction',
                    //  'lambda:GetPolicy',
                    //  'lambda:TagResource',
                    //  'lambda:UntagResource',
                    //  'lambda:ListTags',
                    ],
                    resources: [
                       `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayer*:*`,
                        ...regions.flatMap(r => [
                            `arn:aws:lambda:${r}:${account}:function:${prefix}-*`,
                            `arn:aws:lambda:${r}:${account}:function:*-Custom*`,
                            `arn:aws:lambda:${r}:${account}:function:*-Provider*`,
                            `arn:aws:lambda:${r}:${account}:function:*-LogRetention*`,
                        ]),
                    ]
                }),

                // new iam.PolicyStatement({
                //     sid: 'LambdaFunctionUrl',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'lambda:CreateFunctionUrlConfig',
                //         'lambda:UpdateFunctionUrlConfig',
                //         'lambda:DeleteFunctionUrlConfig',
                //         'lambda:GetFunctionUrlConfig',
                //     ],
                //     resources: [
                //         `arn:aws:lambda:${region}:${account}:function:${prefix}-backend`,
                //     ]
                // }),

                // new iam.PolicyStatement({
                //     sid: 'LambdaEdgeReplication',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'lambda:EnableReplication*',
                //         'lambda:DisableReplication*',
                //     ],
                //     resources: [
                //         `arn:aws:lambda:${globalRegion}:${account}:function:${prefix}-*`,
                //     ]
                // }),

                // new iam.PolicyStatement({
                //     sid: 'LambdaLayerAccess',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'lambda:GetLayerVersion',
                //     ],
                //     resources: [
                //         `arn:aws:lambda:${region}:753240598075:layer:LambdaAdapterLayer*:*`,
                //     ]
                // }),

                // CDK Custom Resource Lambdas (bucket deployment, cross-region refs)
                // new iam.PolicyStatement({
                //     sid: 'CDKCustomResourceLambdas',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'lambda:CreateFunction',
                //         'lambda:UpdateFunctionCode',
                //         'lambda:UpdateFunctionConfiguration',
                //         'lambda:DeleteFunction',
                //         'lambda:GetFunction',
                //         'lambda:InvokeFunction',
                //         'lambda:AddPermission',
                //         'lambda:RemovePermission',
                //         'lambda:TagResource',
                //     ],
                //     resources: regions.flatMap(r => [
                //         `arn:aws:lambda:${r}:${account}:function:*-Custom*`,
                //         `arn:aws:lambda:${r}:${account}:function:*-Provider*`,
                //         `arn:aws:lambda:${r}:${account}:function:*-LogRetention*`,
                //     ])
                // }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ Bedrock - Guardrail management                                                         │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-bedrock`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'BedrockGuardrailManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'bedrock:*Guardrail*',
                        'bedrock:*Tag*',
                    //  'bedrock:CreateGuardrail',
                    //  'bedrock:UpdateGuardrail',
                    //  'bedrock:DeleteGuardrail',
                    //  'bedrock:GetGuardrail',
                    //  'bedrock:ListGuardrails',
                    //  'bedrock:CreateGuardrailVersion',
                    //  'bedrock:TagResource',
                    //  'bedrock:UntagResource',
                    //  'bedrock:ListTagsForResource',
                    ],
                    resources: [
                        `arn:aws:bedrock:${region}:${account}:guardrail/*`,
                    ]
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ CloudFront - Distributions, functions, OAC                                             │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-cloudfront`]: new iam.PolicyDocument({

            statements: [
                new iam.PolicyStatement({
                    sid: 'CloudFrontDistributionManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'cloudfront:*Distribution*',
                        'cloudfront:*Function*',
                        'cloudfront:*Tag*',
                        'cloudfront:*Invalidation*',
                        'cloudfront:*OriginAccessControl*',
                    //  'cloudfront:CreateDistribution',
                    //  'cloudfront:UpdateDistribution',
                    //  'cloudfront:DeleteDistribution',
                    //  'cloudfront:GetDistribution',
                    //  'cloudfront:GetDistributionConfig',
                    //  'cloudfront:TagResource',
                    //  'cloudfront:UntagResource',
                    //  'cloudfront:ListTagsForResource',
                    //  'cloudfront:CreateInvalidation',
                    //  'cloudfront:GetInvalidation',
                    //  'cloudfront:ListDistributions',
                    ],
                    resources: [
                        `arn:aws:cloudfront::${account}:distribution/*`,
                        `arn:aws:cloudfront::${account}:function/${prefix}-*`,
                    ]
                }),

                // new iam.PolicyStatement({
                //     sid: 'CloudFrontFunctionManagement',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'cloudfront:CreateFunction',
                //         'cloudfront:UpdateFunction',
                //         'cloudfront:DeleteFunction',
                //         'cloudfront:DescribeFunction',
                //         'cloudfront:PublishFunction',
                //         'cloudfront:GetFunction',
                //         'cloudfront:ListFunctions',
                //     ],
                //     resources: [
                //         `arn:aws:cloudfront::${account}:function/${prefix}-*`,
                //     ]
                // }),

                new iam.PolicyStatement({
                    sid: 'CloudFrontOriginAccessControl',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'cloudfront:*OriginAccessControl*',
                    //  'cloudfront:CreateOriginAccessControl',
                    //  'cloudfront:UpdateOriginAccessControl',
                    //  'cloudfront:DeleteOriginAccessControl',
                    //  'cloudfront:GetOriginAccessControl',
                    //  'cloudfront:ListOriginAccessControls',
                    ],
                    resources: ['*']  // OAC doesn't support resource-level permissions
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ WAF v2 - Web ACLs and IP sets (global for CloudFront)                                  │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-waf`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'WAFv2WebACLManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'wafv2:*WebACL*',
                        'wafv2:*IPSet*',
                        'wafv2:*Tag*',
                    //  'wafv2:CreateWebACL',
                    //  'wafv2:UpdateWebACL',
                    //  'wafv2:DeleteWebACL',
                    //  'wafv2:GetWebACL',
                    //  'wafv2:ListWebACLs',
                    //  'wafv2:AssociateWebACL',
                    //  'wafv2:DisassociateWebACL',
                    //  'wafv2:TagResource',
                    //  'wafv2:UntagResource',
                    //  'wafv2:ListTagsForResource',
                    ],
                    resources: [
                        `arn:aws:wafv2:${globalRegion}:${account}:global/webacl/${prefix}-*`,
                        `arn:aws:wafv2:${globalRegion}:${account}:global/ipset/${prefix}-*`,
                    ]
                }),

                // new iam.PolicyStatement({
                //     sid: 'WAFv2IPSetManagement',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'wafv2:CreateIPSet',
                //         'wafv2:UpdateIPSet',
                //         'wafv2:DeleteIPSet',
                //         'wafv2:GetIPSet',
                //         'wafv2:ListIPSets',
                //         'wafv2:TagResource',
                //     ],
                //     resources: [
                //         `arn:aws:wafv2:${globalRegion}:${account}:global/ipset/*`,
                //     ]
                // }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ CloudWatch Logs - Log groups for app and build                                         │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-logs`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'CloudWatchLogsManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'logs:*LogGroup',
                        'logs:*LogGroups',
                        'logs:*Retention*',
                        'logs:*Tag*',
                    //  'logs:CreateLogGroup',
                    //  'logs:DeleteLogGroup',
                    //  'logs:DescribeLogGroups',
                    //  'logs:PutRetentionPolicy',
                    //  'logs:DeleteRetentionPolicy',
                    //  'logs:TagLogGroup',
                    //  'logs:UntagLogGroup',
                    //  'logs:ListTagsLogGroup',
                    //  'logs:TagResource',
                    //  'logs:UntagResource',
                    //  'logs:ListTagsForResource',
                    ],
                    resources: regions.flatMap(r => [
                        `arn:aws:logs:${r}:${account}:log-group:${prefix}*`,
                        `arn:aws:logs:${r}:${account}:log-group:/aws/lambda/${prefix}-*`,
                        `arn:aws:logs:${r}:${account}:log-group:/aws/codebuild/${prefix}-*`,
                    ])
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ SSM Parameter Store - Application parameters                                           │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-ssm`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'SSMParameterManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ssm:*Parameter*',
                        'ssm:*Tags*',
                    //  'ssm:PutParameter',
                    //  'ssm:GetParameter',
                    //  'ssm:GetParameters',
                    //  'ssm:DeleteParameter',
                    //  'ssm:AddTagsToResource',
                    //  'ssm:RemoveTagsFromResource',
                    //  'ssm:ListTagsForResource',
                    //  'ssm:DescribeParameters',
                    ],
                    resources: [
                        `arn:aws:ssm:${region}:${account}:parameter/${prefix}/*`,
                        ...regions.flatMap(r => [`arn:aws:ssm:${r}:${account}:parameter/cdk/exports/*`]),
                    ]
                }),

                // CDK cross-region SSM exports
                // new iam.PolicyStatement({
                //     sid: 'SSMCrossRegionExports',
                //     effect: iam.Effect.ALLOW,
                //     actions: [
                //         'ssm:GetParameter',
                //         'ssm:PutParameter',
                //         'ssm:DeleteParameter',
                //     ],
                //     resources: regions.flatMap(r => [
                //         `arn:aws:ssm:${r}:${account}:parameter/cdk/exports/*`,
                //     ])
                // }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ CodeCommit - Repository management                                                     │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-codecommit`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'CodeCommitRepositoryManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'codecommit:*Repository*',
                        'codecommit:*Tag*',
                    //  'codecommit:CreateRepository',
                    //  'codecommit:DeleteRepository',
                    //  'codecommit:GetRepository',
                    //  'codecommit:UpdateRepositoryDescription',
                    //  'codecommit:TagResource',
                    //  'codecommit:UntagResource',
                    //  'codecommit:ListTagsForResource',
                    ],
                    resources: [
                        `arn:aws:codecommit:${region}:${account}:${prefix}`,
                    ]
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ CodeBuild - Build project management                                                   │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-codebuild`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'CodeBuildProjectManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'codebuild:*Project*',
                        'codebuild:Batch*',
                    //  'codebuild:CreateProject',
                    //  'codebuild:UpdateProject',
                    //  'codebuild:DeleteProject',
                    //  'codebuild:BatchGetProjects',
                    ],
                    resources: [
                        `arn:aws:codebuild:${region}:${account}:project/${prefix}-*`,
                    ]
                }),
            ]
        }),

    // ╭────────────────────────────────────────────────────────────────────────────────────────╮
    // │ EventBridge - Build trigger rules                                                      │
    // ╰────────────────────────────────────────────────────────────────────────────────────────╯
        [`${prefix}-eventbridge`]: new iam.PolicyDocument({

            statements: [

                new iam.PolicyStatement({
                    sid: 'EventBridgeRuleManagement',
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'events:*Rule',
                        'events:*Targets',
                        'events:*Tag*',
                    //  'events:PutRule',
                    //  'events:DeleteRule',
                    //  'events:DescribeRule',
                    //  'events:EnableRule',
                    //  'events:DisableRule',
                    //  'events:PutTargets',
                    //  'events:RemoveTargets',
                    //  'events:ListTargetsByRule',
                    //  'events:TagResource',
                    //  'events:UntagResource',
                    //  'events:ListTagsForResource',
                    ],
                    resources: [
                        `arn:aws:events:${region}:${account}:rule/${prefix}-*`,
                    ]
                }),
            ]
        }),
    }
}