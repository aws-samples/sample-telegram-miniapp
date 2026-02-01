import type { Region, Account } from "@core/types"

export interface ConsoleLinkProps {

    region  ?: string
    account ?: string
    resource?: string
}

type Getter<T extends ConsoleLinkProps> = (props: T) => string
type RegionAndResource  = Getter<{ region :string, resource?:string }>
type RegionIsOptional   = Getter<{ region?:string, resource?:string }>
type WithAccount        = Getter<{ region :string, resource?:string, account?:string }>





function base(region?: string) {

    return region
        ? `https://${region}.console.aws.amazon.com`
        : 'https://console.aws.amazon.com'
}





export const awsConsoleLink = {

    // ============================================================
    // COMPUTE
    // ============================================================
    lambda              : sanitize(({ region, resource }) => `${base(region)}/lambda/home?region=${region}#/functions${resource ? `/${resource}` : ''}`),
    ec2                 : sanitize(({ region, resource }) => `${base(region)}/ec2/home?region=${region}#Instances:${resource ? `instanceId=${resource}` : ''}`),
    ecs_cluster         : sanitize(({ region, resource }) => `${base(region)}/ecs/v2/clusters${resource ? `/${resource}` : ''}?region=${region}`),
    ecs_service         : sanitize(({ region, resource }) => `${base(region)}/ecs/v2/clusters/${resource?.split('/')[0]}/services/${resource?.split('/')[1]}?region=${region}`),
    ecs_task            : sanitize(({ region, resource }) => `${base(region)}/ecs/v2/clusters/${resource?.split('/')[0]}/tasks/${resource?.split('/')[1]}?region=${region}`),
    eks                 : sanitize(({ region, resource }) => `${base(region)}/eks/home?region=${region}#/clusters${resource ? `/${resource}` : ''}`),
    lightsail           : sanitize(({ region, resource }) => `${base(region)}/lightsail/home?region=${region}#/instances${resource ? `/${resource}` : ''}`),
    batch_job           : sanitize(({ region, resource }) => `${base(region)}/batch/home?region=${region}#jobs${resource ? `/detail/${resource}` : ''}`),
    apprunner           : sanitize(({ region, resource }) => `${base(region)}/apprunner/home?region=${region}#/services${resource ? `/${resource}` : ''}`),
    elasticbeanstalk    : sanitize(({ region, resource }) => `${base(region)}/elasticbeanstalk/home?region=${region}#/environment/dashboard?applicationName=${resource?.split('/')[0]}&environmentId=${resource?.split('/')[1]}`),

    // ============================================================
    // STORAGE
    // ============================================================
    s3                  : sanitize(({ region, resource }) => `${base(region)}/s3/buckets${resource ? `/${resource}` : ''}?region=${region}`),
    ebs                 : sanitize(({ region, resource }) => `${base(region)}/ec2/home?region=${region}#${resource ? `VolumeDetails:volumeId=${resource}` : 'Volumes:'}`),
    efs                 : sanitize(({ region, resource }) => `${base(region)}/efs/home?region=${region}#/file-systems${resource ? `/${resource}` : ''}`),
    fsx                 : sanitize(({ region, resource }) => `${base(region)}/fsx/home?region=${region}#${resource ? `file-system-details/${resource}` : 'file-systems'}`),
    glacier             : sanitize(({ region, resource }) => `${base(region)}/glacier/home?region=${region}#/vaults${resource ? `/${resource}` : ''}`),
    storagegateway      : sanitize(({ region, resource }) => `${base(region)}/storagegateway/home?region=${region}#/gateways${resource ? `/${resource}` : ''}`),
    backup              : sanitize(({ region, resource }) => `${base(region)}/backup/home?region=${region}#${resource ? `/backupplan/details/${resource}` : '/backupplans'}`),

    // ============================================================
    // DATABASE
    // ============================================================
    dynamodb            : sanitize(({ region, resource }) => `${base(region)}/dynamodbv2/home?region=${region}#table${ resource ? `?name=${resource}` : 's' }`),
    rds                 : sanitize(({ region, resource }) => `${base(region)}/rds/home?region=${region}#database${resource ? `:id=${resource}` : 's:'}`),
    aurora              : sanitize(({ region, resource }) => `${base(region)}/rds/home?region=${region}#database${resource ? `:id=${resource}` : 's:'}`),
    elasticache         : sanitize(({ region, resource }) => `${base(region)}/elasticache/home?region=${region}#${resource ? `/redis/${resource}` : 'redis:'}`),
    neptune             : sanitize(({ region, resource }) => `${base(region)}/neptune/home?region=${region}#database${resource ? `:id=${resource}` : 's:'}`),
    documentdb          : sanitize(({ region, resource }) => `${base(region)}/docdb/home?region=${region}#${resource ? `cluster-details/${resource}` : 'clusters'}`),
    redshift            : sanitize(({ region, resource }) => `${base(region)}/redshiftv2/home?region=${region}#${resource ? `cluster-details?cluster=${resource}` : 'clusters'}`),
    dax                 : sanitize(({ region, resource }) => `${base(region)}/dynamodbv2/home?region=${region}#dax-clusters${resource ? `:cluster=${resource}` : ':'}`),
    timestream          : sanitize(({ region, resource }) => `${base(region)}/timestream/home?region=${region}#databases${resource ? `/${resource}` : ''}`),
    keyspaces           : sanitize(({ region, resource }) => `${base(region)}/keyspaces/home?region=${region}#keyspaces${resource ? `/${resource}` : ''}`),
    memorydb            : sanitize(({ region, resource }) => `${base(region)}/memorydb/home?region=${region}#/clusters${resource ? `/${resource}` : ''}`),

    // ============================================================
    // NETWORKING & CONTENT DELIVERY
    // ============================================================
    vpc                 : sanitize(({ region, resource }) => `${base(region)}/vpc/home?region=${region}#${resource ? `VpcDetails:VpcId=${resource}` : 'vpcs:'}`),
    subnet              : sanitize(({ region, resource }) => `${base(region)}/vpc/home?region=${region}#${resource ? `SubnetDetails:subnetId=${resource}` : 'subnets:'}`),
    route53_zone        : sanitize<RegionIsOptional>(({ resource }) => `${base()}/route53/v2/hostedzones${resource ? `#ListRecordSets/${resource}` : ''}`),
    alb                 : sanitize(({ region, resource }) => `${base(region)}/ec2/home?region=${region}#LoadBalancers:${resource ? `loadBalancerArn=${resource}` : ''}`),
    nlb                 : sanitize(({ region, resource }) => `${base(region)}/ec2/home?region=${region}#LoadBalancers:${resource ? `loadBalancerArn=${resource}` : ''}`),
    clb                 : sanitize(({ region, resource }) => `${base(region)}/ec2/home?region=${region}#LoadBalancers:${resource ? `name=${resource}` : ''}`),
    apigateway_rest     : sanitize(({ region, resource }) => `${base(region)}/apigateway/home?region=${region}#/apis${resource ? `/${resource}` : ''}`),
    apigateway_http     : sanitize(({ region, resource }) => `${base(region)}/apigateway/home?region=${region}#/apis${resource ? `/${resource}` : ''}`),
    apigateway_websocket: sanitize(({ region, resource }) => `${base(region)}/apigateway/home?region=${region}#/apis${resource ? `/${resource}` : ''}`),
    cloudfront          : sanitize<RegionIsOptional>(({ resource }) => `${base()}/cloudfront/v4/home#/distributions${resource ? `/${resource}` : ''}`),
    directconnect       : sanitize(({ region, resource }) => `${base(region)}/directconnect/v2/home?region=${region}#/connections${resource ? `/${resource}` : ''}`),
    vpn                 : sanitize(({ region, resource }) => `${base(region)}/vpc/home?region=${region}#VpnConnections:${resource ? `VpnConnectionId=${resource}` : ''}`),
    transitgateway      : sanitize(({ region, resource }) => `${base(region)}/vpc/home?region=${region}#TransitGateways:${resource ? `transitGatewayId=${resource}` : ''}`),
    globalaccelerator   : sanitize<RegionIsOptional>(({ resource }) => `${base()}/ec2/home#${resource ? `AcceleratorDetails:acceleratorId=${resource}` : 'Accelerators:'}`),
    cloudmap            : sanitize(({ region, resource }) => `${base(region)}/cloudmap/home?region=${region}#/namespaces${resource ? `/${resource}` : ''}`),

    // ============================================================
    // SECURITY, IDENTITY & COMPLIANCE
    // ============================================================
    iam_user            : sanitize<RegionIsOptional>(({ resource }) => `${base()}/iam/home#/users${resource ? `/details/${resource}` : ''}`),
    iam_role            : sanitize<RegionIsOptional>(({ resource }) => `${base()}/iam/home#/roles${resource ? `/details/${resource}` : ''}`),
    iam_policy          : sanitize<RegionIsOptional>(({ resource }) => `${base()}/iam/home#/policies${resource ? `/${resource}` : ''}`),
    cognito_userpool    : sanitize(({ region, resource }) => `${base(region)}/cognito/v2/idp/user-pools${resource ? `/${resource}` : ''}?region=${region}`),
    cognito_identity    : sanitize(({ region, resource }) => `${base(region)}/cognito/home?region=${region}#${resource ? `/pool/${resource}` : '/pools'}`),
    secretsmanager      : sanitize(({ region, resource }) => `${base(region)}/secretsmanager/${resource ? `secret?name=${resource}&` : 'listsecrets?'}region=${region}`),
    ssm_parameter       : sanitize(({ region, resource }) => `${base(region)}/systems-manager/parameters${resource ? `/${resource}` : ''}?region=${region}`),
    acm                 : sanitize(({ region, resource }) => `${base(region)}/acm/home?region=${region}#/certificates${resource ? `/${resource}` : ''}`),
    kms                 : sanitize(({ region, resource }) => `${base(region)}/kms/home?region=${region}#/kms/keys${resource ? `/${resource}` : ''}`),
    waf                 : sanitize(({ region, resource }) => `${base(region)}/wafv2/homev2${resource ? `/web-acl/${resource}` : ''}?region=${region}`),
    shield              : sanitize<RegionIsOptional>(({ resource }) => `${base()}/wafv2/shieldv2#/protections${resource ? `/${resource}` : ''}`),
    guardduty           : sanitize(({ region, resource }) => `${base(region)}/guardduty/home?region=${region}#/findings${resource ? `?search=id%3D${resource}` : ''}`),
    securityhub         : sanitize(({ region, resource }) => `${base(region)}/securityhub/home?region=${region}#/findings${resource ? `?search=Id%3D${resource}` : ''}`),
    inspector           : sanitize(({ region, resource }) => `${base(region)}/inspector/v2/home?region=${region}#/findings${resource ? `/${resource}` : ''}`),
    macie               : sanitize(({ region, resource }) => `${base(region)}/macie/home?region=${region}#${resource ? `findings/${resource}` : 'findings'}`),
    detective           : sanitize(({ region, resource }) => `${base(region)}/detective/home?region=${region}#${resource ? `investigation/${resource}` : 'investigations'}`),

    // ============================================================
    // DEVELOPER TOOLS
    // ============================================================
    codecommit          : sanitize(({ region, resource }) => `${base(region)}/codesuite/codecommit/repositories${resource ? `/${resource}/browse` : ''}?region=${region}`),
    codebuild           : sanitize(({ region, resource }) => `${base(region)}/codesuite/codebuild/projects${resource ? `/${resource}` : ''}?region=${region}`),
    codedeploy          : sanitize(({ region, resource }) => `${base(region)}/codesuite/codedeploy/applications${resource ? `/${resource}` : ''}?region=${region}`),
    codepipeline        : sanitize(({ region, resource }) => `${base(region)}/codesuite/codepipeline/pipelines${resource ? `/${resource}/view` : ''}?region=${region}`),
    cloud9              : sanitize(({ region, resource }) => `${base(region)}/cloud9/home?region=${region}#/environments${resource ? `/${resource}` : ''}`),
    codeartifact        : sanitize(({ region, resource }) => `${base(region)}/codesuite/codeartifact/repositories${resource ? `/${resource}` : ''}?region=${region}`),
    codeguru_reviewer   : sanitize(({ region, resource }) => `${base(region)}/codeguru/reviewer?region=${region}#/repositoryAssociations${resource ? `/${resource}` : ''}`),
    codeguru_profiler   : sanitize(({ region, resource }) => `${base(region)}/codeguru/profiler?region=${region}#/profiling-groups${resource ? `/${resource}` : ''}`),
    xray                : sanitize(({ region, resource }) => `${base(region)}/xray/home?region=${region}#/traces${resource ? `/${resource}` : ''}`),

    // ============================================================
    // MANAGEMENT & GOVERNANCE
    // ============================================================
    cloudwatch_log      : sanitize(({ region, resource }) => `${base(region)}/cloudwatch/home?region=${region}#logsV2:log-groups${resource ? `/log-group/${encodeURIComponent(resource)}` : ''}`),
    cloudwatch_alarm    : sanitize(({ region, resource }) => `${base(region)}/cloudwatch/home?region=${region}#alarmsV2${resource ? `:alarm/${resource}` : ':'}`),
    cloudwatch_dashboard: sanitize(({ region, resource }) => `${base(region)}/cloudwatch/home?region=${region}#dashboards${resource ? `:name=${resource}` : ':'}`),
    cloudtrail          : sanitize(({ region, resource }) => `${base(region)}/cloudtrail/home?region=${region}#/trails${resource ? `/${resource}` : ''}`),
    cloudformation      : sanitize(({ region, resource }) => `${base(region)}/cloudformation/home?region=${region}#/stacks${resource ? `/stackinfo?stackId=${resource}` : ''}`),
    ssm_automation      : sanitize(({ region, resource }) => `${base(region)}/systems-manager/automation${resource ? `/execution/${resource}` : '/executions'}?region=${region}`),
    ssm_session         : sanitize(({ region, resource }) => `${base(region)}/systems-manager/session-manager${resource ? `/${resource}` : '/sessions'}?region=${region}`),
    config_rule         : sanitize(({ region, resource }) => `${base(region)}/config/home?region=${region}#/rules${resource ? `/details?configRuleName=${resource}` : ''}`),
    opsworks            : sanitize(({ region, resource }) => `${base(region)}/opsworks/home?region=${region}#/stacks${resource ? `/${resource}` : ''}`),
    servicecatalog      : sanitize(({ region, resource }) => `${base(region)}/servicecatalog/home?region=${region}#/products${resource ? `/${resource}` : ''}`),
    organizations       : sanitize<RegionIsOptional>(({ resource }) => `${base()}/organizations/v2/home${resource ? `/accounts/${resource}` : '/accounts'}`),
    controltower        : sanitize(({ region, resource }) => `${base(region)}/controltower/home?region=${region}#/controls${resource ? `/${resource}` : ''}`),
    resource_groups     : sanitize(({ region, resource }) => `${base(region)}/resource-groups${resource ? `/group/${resource}` : '/groups'}?region=${region}`),
    license_manager     : sanitize(({ region, resource }) => `${base(region)}/license-manager/home?region=${region}#/licenses${resource ? `/${resource}` : ''}`),

    // ============================================================
    // ANALYTICS
    // ============================================================
    athena              : sanitize(({ region, resource }) => `${base(region)}/athena/home?region=${region}#/query-editor${resource ? `/history/${resource}` : ''}`),
    emr                 : sanitize(({ region, resource }) => `${base(region)}/emr/home?region=${region}#${resource ? `/clusterDetails/${resource}` : '/clusters'}`),
    kinesis_stream      : sanitize(({ region, resource }) => `${base(region)}/kinesis/home?region=${region}#/streams${resource ? `/details/${resource}` : ''}`),
    kinesis_firehose    : sanitize(({ region, resource }) => `${base(region)}/firehose/home?region=${region}#${resource ? `/details/${resource}` : '/streams'}`),
    kinesis_analytics   : sanitize(({ region, resource }) => `${base(region)}/kinesisanalytics/home?region=${region}#/applications${resource ? `/${resource}` : ''}`),
    glue_job            : sanitize(({ region, resource }) => `${base(region)}/glue/home?region=${region}#/v2/etl-jobs${resource ? `/view/${resource}` : ''}`),
    glue_crawler        : sanitize(({ region, resource }) => `${base(region)}/glue/home?region=${region}#/v2/data-catalog/crawlers${resource ? `/view/${resource}` : ''}`),
    glue_database       : sanitize(({ region, resource }) => `${base(region)}/glue/home?region=${region}#/v2/data-catalog/databases${resource ? `/view/${resource}` : ''}`),
    quicksight          : sanitize<WithAccount>(({ region, account, resource }) => `${base(region)}/quicksight/sn/start/analyses${(account && resource) ? `#/accounts/${account}/analyses/${resource}` : ''}`),
    datapipeline        : sanitize(({ region, resource }) => `${base(region)}/datapipeline/home?region=${region}#${resource ? `/details/${resource}` : '/pipelines'}`),
    msk                 : sanitize(({ region, resource }) => `${base(region)}/msk/home?region=${region}#/clusters${resource ? `/${resource}` : ''}`),
    opensearch          : sanitize(({ region, resource }) => `${base(region)}/aos/home?region=${region}#/opensearch/domains${resource ? `/${resource}` : ''}`),
    datazone            : sanitize(({ region, resource }) => `${base(region)}/datazone/home?region=${region}#/domains${resource ? `/${resource}` : ''}`),

    // ============================================================
    // APPLICATION INTEGRATION
    // ============================================================
    sns                 : sanitize(({ region, resource }) => `${base(region)}/sns/v3/home?region=${region}#/topic${resource ? `/${resource}` : 's'}`),
    sqs                 : sanitize(({ region, resource }) => `${base(region)}/sqs/v3/home?region=${region}#/queues${resource ? `/${encodeURIComponent(resource)}` : ''}`),
    eventbridge_rule    : sanitize(({ region, resource }) => `${base(region)}/events/home?region=${region}#/rules${resource ? `/${resource}` : ''}`),
    eventbridge_bus     : sanitize(({ region, resource }) => `${base(region)}/events/home?region=${region}#/eventbuses${resource ? `/${resource}` : ''}`),
    stepfunctions       : sanitize(({ region, resource }) => `${base(region)}/states/home?region=${region}#/statemachines${resource ? `/view/${resource}` : ''}`),
    appflow             : sanitize(({ region, resource }) => `${base(region)}/appflow/home?region=${region}#/flows${resource ? `/${resource}` : ''}`),
    mq                  : sanitize(({ region, resource }) => `${base(region)}/amazon-mq/home?region=${region}#/brokers${resource ? `/${resource}` : ''}`),
    swf                 : sanitize(({ region, resource }) => `${base(region)}/swf/home?region=${region}#/domains${resource ? `/${resource}` : ''}`),
    appsync             : sanitize(({ region, resource }) => `${base(region)}/appsync/home?region=${region}#${resource ? `/${resource}/v1/home` : '/apis'}`),

    // ============================================================
    // MACHINE LEARNING & AI
    // ============================================================
    sagemaker_notebook  : sanitize(({ region, resource }) => `${base(region)}/sagemaker/home?region=${region}#/notebook-instances${resource ? `/${resource}` : ''}`),
    sagemaker_endpoint  : sanitize(({ region, resource }) => `${base(region)}/sagemaker/home?region=${region}#/endpoints${resource ? `/${resource}` : ''}`),
    sagemaker_model     : sanitize(({ region, resource }) => `${base(region)}/sagemaker/home?region=${region}#/models${resource ? `/${resource}` : ''}`),
    sagemaker_training  : sanitize(({ region, resource }) => `${base(region)}/sagemaker/home?region=${region}#/jobs${resource ? `/${resource}` : ''}`),
    bedrock             : sanitize(({ region, resource }) => `${base(region)}/bedrock/home?region=${region}#/guardrails${resource ? `/${resource}` : ''}`),
    bedrock_model       : sanitize(({ region, resource }) => `${base(region)}/bedrock/home?region=${region}#/models${resource ? `/${resource}` : ''}`),
    rekognition         : sanitize(({ region, resource }) => `${base(region)}/rekognition/home?region=${region}#/collections${resource ? `/${resource}` : ''}`),
    comprehend          : sanitize(({ region, resource }) => `${base(region)}/comprehend/v2/home?region=${region}#${resource ? `/analysis-job/${resource}` : '/analysis-jobs'}`),
    lex                 : sanitize(({ region, resource }) => `${base(region)}/lexv2/home?region=${region}#${resource ? `bot/${resource}` : 'bots'}`),
    forecast            : sanitize(({ region, resource }) => `${base(region)}/forecast/home?region=${region}#/datasets${resource ? `/${resource}` : ''}`),
    personalize         : sanitize(({ region, resource }) => `${base(region)}/personalize/home?region=${region}#/datasets${resource ? `/${resource}` : ''}`),
    transcribe          : sanitize(({ region, resource }) => `${base(region)}/transcribe/home?region=${region}#/jobs${resource ? `/${resource}` : ''}`),
    translate           : sanitize(({ region, resource }) => `${base(region)}/translate/home?region=${region}#/jobs${resource ? `/${resource}` : ''}`),
    polly               : sanitize(({ region, resource }) => `${base(region)}/polly/home?region=${region}#/lexicons${resource ? `/${resource}` : ''}`),

    // ============================================================
    // MIGRATION & TRANSFER
    // ============================================================
    dms                 : sanitize(({ region, resource }) => `${base(region)}/dms/v2/home?region=${region}#${resource ? `replicationInstanceDetails/${resource}` : 'replicationInstances'}`),
    datasync            : sanitize(({ region, resource }) => `${base(region)}/datasync/home?region=${region}#/tasks${resource ? `/${resource}` : ''}`),
    transfer            : sanitize(({ region, resource }) => `${base(region)}/transfer/home?region=${region}#/servers${resource ? `/${resource}` : ''}`),
    migration_hub       : sanitize(({ region, resource }) => `${base(region)}/migrationhub/home?region=${region}#/discover/servers${resource ? `/${resource}` : ''}`),
    application_discovery:sanitize(({ region, resource }) => `${base(region)}/discovery/home?region=${region}#/servers${resource ? `/${resource}` : ''}`),
    server_migration    : sanitize(({ region, resource }) => `${base(region)}/servermigration/home?region=${region}#/applications${resource ? `/${resource}` : ''}`),

    // ============================================================
    // CONTAINERS
    // ============================================================
    ecr                 : sanitize(({ region, resource }) => `${base(region)}/ecr/repositories${resource ? `/private/${resource}` : ''}?region=${region}`),
    ecr_public          : sanitize<RegionIsOptional>(({ resource }) => `${base()}/ecr/repositories/public${resource ? `/gallery/${resource}` : ''}`),

    // ============================================================
    // MEDIA SERVICES
    // ============================================================
    mediaconvert        : sanitize(({ region, resource }) => `${base(region)}/mediaconvert/home?region=${region}#/jobs${resource ? `/summary/${resource}` : ''}`),
    medialive           : sanitize(({ region, resource }) => `${base(region)}/medialive/home?region=${region}#/channels${resource ? `/${resource}` : ''}`),
    mediapackage        : sanitize(({ region, resource }) => `${base(region)}/mediapackage/home?region=${region}#/channels${resource ? `/${resource}` : ''}`),
    mediastore          : sanitize(({ region, resource }) => `${base(region)}/mediastore/home?region=${region}#/containers${resource ? `/${resource}` : ''}`),
    elemental_appliances: sanitize(({ region, resource }) => `${base(region)}/elemental-appliances-software/home?region=${region}#/appliances${resource ? `/${resource}` : ''}`),

    // ============================================================
    // IoT
    // ============================================================
    iot_thing           : sanitize(({ region, resource }) => `${base(region)}/iot/home?region=${region}#/thing${resource ? `/${resource}` : 's'}`),
    iot_rule            : sanitize(({ region, resource }) => `${base(region)}/iot/home?region=${region}#/rule${resource ? `/${resource}` : 's'}`),
    iot_policy          : sanitize(({ region, resource }) => `${base(region)}/iot/home?region=${region}#/polic${resource ? `y/${resource}` : 'ies'}`),
    iot_certificate     : sanitize(({ region, resource }) => `${base(region)}/iot/home?region=${region}#/certificate${resource ? `/${resource}` : 's'}`),
    greengrass          : sanitize(({ region, resource }) => `${base(region)}/greengrass/home?region=${region}#/groups${resource ? `/${resource}` : ''}`),
    iot_analytics       : sanitize(({ region, resource }) => `${base(region)}/iotanalytics/home?region=${region}#/datasets${resource ? `/${resource}` : ''}`),
    iot_sitewise        : sanitize(({ region, resource }) => `${base(region)}/iotsitewise/home?region=${region}#/assets${resource ? `/${resource}` : ''}`),
    iot_events          : sanitize(({ region, resource }) => `${base(region)}/iotevents/home?region=${region}#/detectorModels${resource ? `/${resource}` : ''}`),

    // ============================================================
    // BUSINESS APPLICATIONS
    // ============================================================
    ses_identity        : sanitize(({ region, resource }) => `${base(region)}/ses/home?region=${region}#/verified-identities${resource ? `/${resource}` : ''}`),
    ses_configuration   : sanitize(({ region, resource }) => `${base(region)}/ses/home?region=${region}#/configuration-sets${resource ? `/${resource}` : ''}`),
    pinpoint            : sanitize(({ region, resource }) => `${base(region)}/pinpoint/home?region=${region}#/apps${resource ? `/${resource}` : ''}`),
    connect             : sanitize(({ region, resource }) => `${base(region)}/connect/v2/app${resource ? `/instances/${resource}` : '/instances'}`),
    workspaces          : sanitize(({ region, resource }) => `${base(region)}/workspaces/v2/home?region=${region}#/workspaces${resource ? `/${resource}` : ''}`),
    workmail            : sanitize(({ region, resource }) => `${base(region)}/workmail/v2/home?region=${region}#/organizations${resource ? `/${resource}` : ''}`),
    chime               : sanitize<RegionIsOptional>(({ resource }) => `${base()}/chime/home#/meetings${resource ? `/${resource}` : ''}`),
    workdocs            : sanitize(({ region, resource }) => `${base(region)}/zocalo/home?region=${region}#/sites${resource ? `/${resource}` : ''}`),

    // ============================================================
    // BLOCKCHAIN
    // ============================================================
    blockchain          : sanitize(({ region, resource }) => `${base(region)}/managedblockchain/home?region=${region}#/networks${resource ? `/${resource}` : ''}`),

    // ============================================================
    // SATELLITE
    // ============================================================
    groundstation       : sanitize(({ region, resource }) => `${base(region)}/groundstation/home?region=${region}#/contacts${resource ? `/${resource}` : ''}`),

    // ============================================================
    // QUANTUM
    // ============================================================
    braket              : sanitize(({ region, resource }) => `${base(region)}/braket/home?region=${region}#/quantum-tasks${resource ? `/${resource}` : ''}`),

    // ============================================================
    // GAME DEVELOPMENT
    // ============================================================
    gamelift            : sanitize(({ region, resource }) => `${base(region)}/gamelift/home?region=${region}#/fleets${resource ? `/${resource}` : ''}`),

    // ============================================================
    // END USER COMPUTING
    // ============================================================
    appstream           : sanitize(({ region, resource }) => `${base(region)}/appstream2/home?region=${region}#/stacks${resource ? `/${resource}` : ''}`),
    worklink            : sanitize(({ region, resource }) => `${base(region)}/worklink/home?region=${region}#/fleets${resource ? `/${resource}` : ''}`),

    // ============================================================
    // ADDITIONAL SERVICES
    // ============================================================
    batch_compute_env   : sanitize(({ region, resource }) => `${base(region)}/batch/home?region=${region}#compute-environments${resource ? `/detail/${resource}` : ''}`),
    batch_job_queue     : sanitize(({ region, resource }) => `${base(region)}/batch/home?region=${region}#queues${resource ? `/detail/${resource}` : ''}`),
    batch_job_definition: sanitize(({ region, resource }) => `${base(region)}/batch/home?region=${region}#job-definition${resource ? `/detail/${resource}` : 's'}`),

} as const





function sanitize<F extends Getter<{ region: string, account: string, resource: string }> = RegionAndResource>(getter: F): F {

    return (({ region, account, resource }: ConsoleLinkProps) => getter({

        region      : cleanRegionString(region)!,
        account     : cleanAccountString(account)!,
        resource    : cleanResourceString(resource)!

    })) as F
}





export function cleanAccountString(input: string|number|undefined): Account|undefined {

    if (typeof input === 'number') {

        return input && input > 0
            ? input.toFixed() as `${number}`
            : undefined
    }

    if (typeof input === 'string') {

        input = input.trim()

        return input.match(/^\d+$/)
            ? input as `${number}`
            : undefined
    }

    return undefined
}





export function cleanRegionString(input: string|undefined): Region|undefined {    

    if (typeof input === 'string') {

        input = input.trim().toLowerCase()

        if (input.match(/^[a-z]{2}-[a-z]+-\d+$/)) {

            return input as Region
        }
    }

    return undefined
}





export function cleanResourceString(input: string|undefined): string|undefined {    

    if (typeof input === 'string') {

        input = input.trim()

        if (input.match(/^[.\\-_/#A-Za-z0-9]{1,512}$/)) {

            return input
        }
    }

    return undefined
}