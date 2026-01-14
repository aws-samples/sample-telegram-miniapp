import type { DeploymentParam } from "@core/vault"
import { parseArgs          } from "node:util"
import { writeFileSync      } from "node:fs"
import { getDeploymentInfo  } from "@core/vault"
import { awsConsoleLink     } from "@core/tools"





;(function main() {

    const config = parseArgs({
        options: {
            output: { type: 'string' },
        }
    }).values

    describeDeployment(config).then(

        ok => {

            process.exit(ok ? 0 : 1)
        },

        err => {

            console.error('APP_DESCRIBE: ERROR:', err)
            process.exit(2)
        }
    )
})()





async function describeDeployment({ output }: { output?: string }) {

    const info = await getDeploymentInfo()
    const report = generateReport(info)

    process.stdout.write(JSON.stringify(info) + '\n')

    if (output) {

        writeFileSync(output, report, 'utf-8')
    }

    return true
}





function generateReport(input: DeploymentParam): string {

    const sections = [
        generateHeader(input),
        generateQuickStart(input),
        generateGitSection(input),
        generateRedeploySection(input),
        generateMonitoringSection(input),
        generateResourcesSection(input),
        generateDatabaseSection(input),
        generateLambdaSection(input),
        generateAIBedrockSection(input),
        generateSecuritySection(input),
        generateBotWebhookSection(input),
        // generateTroubleshootingSection(input),
        generateNextSteps(input)
    ]

    return sections.filter(Boolean).join('\n\n')

    // ═══════════════════════════════════════════════════════════════════════
    // Header & Quick Start
    // ═══════════════════════════════════════════════════════════════════════

    function generateHeader(info: DeploymentParam) {
        return [
            comment('Hi!', `Press ${process.platform === 'darwin' ? 'Cmd+Shift+V' : 'Ctrl+Shift+V'} to open this report in Preview Mode`),
            h1(`Miniapp "${info.name}" Deployment Report`)
        ].join('\n\n')
    }

    function generateQuickStart(info: DeploymentParam) {
        return [
            h2('Quick Start'),
            `Configure your Miniapp and/or bot's Menu button with ${url('@BotFather', 'https://t.me/botfather')} using:`,
            `**Miniapp URL:** ${url(info.miniapp, info.miniapp)}`,
            '',
            `**Deployed to regions:**`,
            list(
                `Main: ${b(info.regions.main)}`,
                `Global: ${b(info.regions.global)}`
            )
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Database Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateDatabaseSection(info: DeploymentParam) {
        const headers = ['Table Name', 'Partition Key', 'Sort Key', 'TTL', 'Purpose']
        const rows = info.database.tables.map(t => [
            inline(t.name),
            `${t.partitionKey.name}${t.partitionKey.type ? ` (${t.partitionKey.type})` : ''}`,
            t.sortKey ? `${t.sortKey.name}${t.sortKey.type ? ` (${t.sortKey.type})` : ''}` : '-',
            t.ttl ? `✓ (${t.ttl})` : '-',
            t.purpose
        ])

        return [
            h2('Database Tables'),
            `Your application uses ${b(info.database.tables.length.toString())} DynamoDB tables:`,
            '',
            table(headers, rows),
            '',
            url('DynamoDB Console', awsConsoleLink.dynamodb({ region: info.regions.main }))
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI/Bedrock Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateAIBedrockSection(info: DeploymentParam) {
        return [
            h2('AI/Bedrock Configuration'),
            `Your application is configured to use Amazon Bedrock with the following settings:`,
            '',
            list(
                `**Model:** ${inline(info.bedrock.model)}`,
                `**Region:** ${b(info.bedrock.region)}`,
                `**Max Tokens:** ${info.bedrock.maxTokens}`,
                `**Top-P:** ${info.bedrock.topP}`,
                info.bedrock.guardrail
                    ? `**Guardrail:** ${inline(info.bedrock.guardrail.id)} (version ${info.bedrock.guardrail.version})`
                    : ''
            ),
            '',
            alert('info', `Guardrail provides content filtering for: Sexual, Violence, Hate, Insults, Misconduct, and Prompt Attack`),
            '',
            url('Bedrock Console', awsConsoleLink.bedrock({ region: info.bedrock.region }))
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Security Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateSecuritySection(info: DeploymentParam) {
        const sessionTTLDays = Math.floor(info.security.session.ttl / 86400)
        const cookieMaxAgeHours = Math.floor(info.security.session.cookieMaxAge / 3600)
        const authToleranceMins = Math.floor(info.security.telegram.authTolerance / 60)

        return [
            h2('Security Configuration'),
            h3('Session Management'),
            list(
                `**Session TTL:** ${sessionTTLDays} days`,
                `**Cookie Name:** ${inline(info.security.session.cookieName)}`,
                `**Cookie Max Age:** ${cookieMaxAgeHours} hours`,
                `**Telegram Auth Tolerance:** ${authToleranceMins} minutes`
            ),
            '',
            h3('Telegram Webhook'),
            list(
                `**Webhook Path:** ${inline(info.security.telegram.webhookPath)}`,
                `**Firewall:** ${b(info.security.telegram.webhookFirewall)}`,
                `**Rate Limit:** ${info.security.telegram.webhookRateLimit} requests/second within 5 minutes interval`
            ),
            '',
            h3('CDN & WAF'),
            list(
                `**WAF Enabled:** ${info.security.cdn.waf ? '✓ Yes' : '✗ No'}`,
                `**Geo-blocking:** ${info.security.cdn.geoBlocking.length > 0
                    ? info.security.cdn.geoBlocking.join(', ')
                    : 'None (worldwide access)'}`
            ),
            '',
            info.security.cdn.waf
                ? alert('info', 'WAF provides protection against common web exploits and can block traffic from specific geographic regions')
                : alert('warning', 'WAF is disabled - consider enabling it for production deployments')
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Lambda Configuration
    // ═══════════════════════════════════════════════════════════════════════

    function generateLambdaSection(info: DeploymentParam) {
        return [
            h2('Lambda Configuration'),
            `Your application backend runs on AWS Lambda with the following configuration:`,
            '',
            table(
                ['Property', 'Value'],
                [
                    ['Runtime', info.lambda.runtime],
                    ['Architecture', info.lambda.architecture],
                    ['Memory Size', `${info.lambda.memorySize} MB`],
                    ['Timeout', `${info.lambda.timeout} seconds`],
                    ['Base Path', inline(info.lambda.basePath)],
                    ['Health Check', inline(info.lambda.healthCheck)],
                    ['Port', info.lambda.port.toString()]
                ]
            ),
            '',
            url('Lambda Console', awsConsoleLink.lambda({ region: info.regions.main }))
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Git & Deployment Sections
    // ═══════════════════════════════════════════════════════════════════════

    function generateGitSection(info: DeploymentParam) {
        return [
            h2('Code Repository'),
            `Clone your repository, update application code and push it to origin for automatic deployment in the cloud.`,
            '',
            `Setup ${url('credentials helper', 'https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-https-unixes.html')} to allow git authenticate to your CodeCommit repository:`,
            code('bash',
                '# Configure credentials helper',
                `git config --global credential.helper '!aws codecommit credential-helper $@'`,
                `git config --global credential.UseHttpPath true`,
                '',
                '# Clone repository',
                `git clone ${info.git.http}`
            ),
            // '',
            // h3('SSH'),
            // `Generate SSH keys and upload to your IAM user profile. See ${url('SSH setup guide', 'https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-ssh-unixes.html')}:`,
            // code('bash',
            //     '# Clone using SSH',
            //     `git clone ${info.git.ssh}`
            // )
        ].join('\n\n')
    }

    function generateRedeploySection(info: DeploymentParam) {
        return [
            h2('Redeploy Changes'),
            `To publish updates to the cloud:`,
            '',
            code('bash',
                '# 1. Commit your changes',
                'git add .',
                'git commit -m "Your update description"',
                '',
                `# 2. Push to ${info.git.branch} branch to trigger build`,
                `git push origin ${info.git.branch}`
            ),
            '',
            `The build script from ${b(info.git.buildspec)} will run automatically on push to ${b(info.git.branch)}.`
        ].join('\n\n')
    }

    function generateBotWebhookSection(info: DeploymentParam) {
        return [
            h2('Bot Webhook'),
            `Your webhook should already be configured. No action required.`,
            '',
            `If you need to manually set the webhook:`,
            `**Bot Webhook URL:** ${url(info.webhook, info.webhook)}`,
            '',
            alert('info', 'The webhook is automatically configured during deployment')
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Monitoring Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateMonitoringSection(info: DeploymentParam) {
        return [
            h2('Monitoring & Logs'),
            h3('CloudWatch Logs'),
            list(
                `**Application Logs:** ${url('View logs', info.logs.app)}`,
                `  - Lambda execution logs`,
                `  - SSR request/response logs`,
                `  - Retention: 6 months`,
                '',
                `**Build Logs:** ${url('View logs', info.logs.build)}`,
                `  - CodeBuild execution logs`,
                `  - Deployment history`,
                `  - Retention: 6 months`
            ),
            '',
            h3('Useful Commands'),
            code('bash',
                '# Tail application logs',
                `aws logs tail ${info.logs.app} --follow --region ${info.regions.main}`,
                '',
                '# Tail build project logs',
                `aws logs tail ${info.logs.build} --follow --region ${info.regions.main}`,
                '',
                '# View recent errors',
                `aws logs filter-log-events \\`,
                `  --log-group-name ${info.logs.app} \\`,
                `  --filter-pattern "ERROR" \\`,
                `  --region ${info.regions.main}`
            )
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Resources Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateResourcesSection(info: DeploymentParam) {
        return [
            h2('Resource ARNs & Console Links'),
            h3('Lambda Function'),
            list(
                `**Name:** ${inline(info.resources.lambda.name)}`,
                `**ARN:** ${inline(info.resources.lambda.arn)}`,
                url('Open in Console', awsConsoleLink.lambda({ region: info.regions.main, resource: info.resources.lambda.name })),
            ),
            '',
            h3('CloudFront Distribution'),
            list(
                `**ID:** ${inline(info.resources.cdn.id)}`,
                `**Domain:** ${url(info.resources.cdn.domain, `https://${info.resources.cdn.domain}`)}`,
                url('Open in Console', awsConsoleLink.cloudfront({ resource: info.resources.cdn.id })),
            ),
            '',
            h3('S3 Bucket'),
            list(
                `**Name:** ${inline(info.resources.bucket.name)}`,
                `**ARN:** ${inline(info.resources.bucket.arn)}`,
                url('Open in Console', awsConsoleLink.s3({ region: info.regions.main, resource: info.resources.bucket.name })),
            ),
            '',
            h3('CodeCommit Repository'),
            list(
                `**Name:** ${inline(info.resources.repository.name)}`,
                `**ARN:** ${inline(info.resources.repository.arn)}`,
                url('Open in Console', awsConsoleLink.codecommit({ region: info.regions.main, resource: info.resources.repository.name })),
            ),
            '',
            h3('Stack Information'),
            list(
                `**Main Stack:** ${inline(info.stacks.main)}`,
                `**Global Stack:** ${inline(info.stacks.global)}`,
                url('Open CloudFormation', awsConsoleLink.cloudformation({ region: info.regions.main, resource: '' }))
            )
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Troubleshooting Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateTroubleshootingSection(info: DeploymentParam) {
        return [
            h2('Troubleshooting'),
            h3('Common Issues'),
            '',
            b('Miniapp not loading'),
            list(
                `Check CloudWatch logs for Lambda errors: ${url('View logs', info.logs.app)}`,
                `Verify CloudFront distribution is deployed (can take 10-15 minutes)`,
                `Test health check endpoint: ${inline(`curl ${info.miniapp}${info.lambda.healthCheck}`)}`
            ),
            '',
            b('Bot not responding'),
            list(
                `Verify webhook is set correctly with @BotFather`,
                `Check webhook URL: ${url(info.webhook, info.webhook)}`,
                `Review application logs for webhook handler errors`
            ),
            '',
            b('Static assets returning 404'),
            list(
                `CloudFront cache invalidation may be in progress`,
                `Check S3 bucket for uploaded files: ${inline(info.resources.bucket.name)}`,
                `Manually invalidate cache if needed (see command below)`
            ),
            '',
            h3('Useful Troubleshooting Commands'),
            code('bash',
                '# Test Lambda health check',
                `curl ${info.miniapp}${info.lambda.healthCheck}`,
                '',
                '# Check DynamoDB table',
                `aws dynamodb scan \\`,
                `  --table-name ${info.database.tables[0].name} \\`,
                `  --limit 5 \\`,
                `  --region ${info.regions.main}`,
                '',
                '# Invalidate CloudFront cache',
                `aws cloudfront create-invalidation \\`,
                `  --distribution-id ${info.resources.cdn.id} \\`,
                `  --paths "/*"`,
                '',
                '# View Lambda function configuration',
                `aws lambda get-function \\`,
                `  --function-name ${info.resources.lambda.name} \\`,
                `  --region ${info.regions.main}`
            )
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Next Steps Section
    // ═══════════════════════════════════════════════════════════════════════

    function generateNextSteps(info: DeploymentParam) {
        return [
            h2('Next Steps'),
            `Complete your deployment by following these steps:`,
            '',
            list(
                `☐ Test miniapp in Telegram: ${url('Open miniapp', info.miniapp)}`,
                `☐ Review CloudWatch logs to verify everything is working: ${url('View logs', info.logs.app)}`,
                `☐ Clone the repository and make your first commit`,
                `☐ Set up monitoring alerts in CloudWatch (optional)`,
                `☐ Configure custom domain for CloudFront distribution (optional)`,
                `☐ Review security settings and adjust as needed`,
            ),
            '',
            alert('info', `All resources are deployed and ready. Start by testing your miniapp in Telegram!`)
        ].join('\n\n')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════

    function h1(text: string) {
        return `# ${text}`
    }

    function h2(text: string) {
        return `## ${text}`
    }

    function h3(text: string) {
        return `### ${text}`
    }

    function url(text: string, href: string) {
        return `[${text}](${href})`
    }

    function b(text: string) {
        return `**${text}**`
    }

    function inline(text: string) {
        return `\`${text}\``
    }

    function code(lang: string, ...lines: string[]) {
        return [`~~~${lang}`, ...lines, '~~~'].join('\n')
    }

    function comment(...lines: string[]) {
        return `<!--\n\t#\n\t#\t${lines.join('\n\t#\t')}\n\t#\n-->`
    }

    function list(...items: string[]) {
        return items.filter(Boolean).map(item => `- ${item}`).join('\n')
    }

    function table(headers: string[], rows: string[][]) {
        const headerRow = `| ${headers.join(' | ')} |`
        const separator = `| ${headers.map(() => '---').join(' | ')} |`
        const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n')
        return [headerRow, separator, dataRows].join('\n')
    }

    function alert(type: 'info' | 'warning' | 'error', message: string) {
        const emoji = { info: 'ℹ️', warning: '⚠️', error: '❌' }
        return `> ${emoji[type]} **${type.toUpperCase()}**: ${message}`
    }
}