import $ from "@core/constants"

import type {

    CfnWebACL

} from "aws-cdk-lib/aws-wafv2"

import type {

    ARN,
    Firewall

} from "@core/types"

import {

    CloudFrontClient,
    DescribeFunctionCommand,
    UpdateFunctionCommand,
    PublishFunctionCommand

} from "@aws-sdk/client-cloudfront"

import {

    WAFV2Client,
    GetWebACLCommand,
    UpdateWebACLCommand,
    type Rule,
    type Statement,

} from "@aws-sdk/client-wafv2"

import {

    sha256,
    randomValueSync,
    md5,
    md5binary

} from "@core/tools-server"





export function webhookValue() {

    return randomValueSync($.telegram.webhook.rate_limit)
}

export function webhookAllowedIPs() {

    return $.telegram.webhook.source_ip
}

export function webhookWAFRuleName() {

    return $.telegram.webhook.waf_rule_name
}

export function webhookWAFStatement(token: string): CfnWebACL.StatementProperty {

    const isValid = token && typeof token === 'string'

    return {

        andStatement: {

            statements: [

                /// Telegram WebHooks use POST methods only
                {
                    byteMatchStatement: {
                        searchString: 'POST',
                        fieldToMatch: { method: {} },
                        positionalConstraint: 'EXACTLY',
                        textTransformations: [{ priority: 0, type: 'NONE' }],
                    },
                },

                /// Telegram should provide a token
                /// that was set during the application init phase
                /// with setWebhook method:
                {
                    byteMatchStatement      : {
                        searchString        : isValid ? undefined : '<NEEDS_TO_BE_SET_DURING_APP_INIT>',
                        searchStringBase64  : isValid ? md5(token, 'base64') : undefined,
                        fieldToMatch        : {
                            singleHeader    : { Name: $.telegram.webhook.header },
                        },
                        positionalConstraint: 'EXACTLY',
                        textTransformations : [{ priority: 0, type: isValid ? 'MD5' : 'NONE' }],
                    },
                },
            ],
        }
    }
}

export function updateWAFStatement(rule: Rule, token: string): Rule {

    if (token
        && typeof token === 'string'
        && rule.Name === webhookWAFRuleName()) {

        const Statement: Statement = {

            AndStatement: {

                Statements: [

                    /// Telegram WebHooks use POST methods only
                    {
                        ByteMatchStatement: {
                            SearchString: Buffer.from('POST'),
                            FieldToMatch: { Method: {} },
                            PositionalConstraint: 'EXACTLY',
                            TextTransformations: [{ Priority: 0, Type: 'NONE' }],
                        },
                    },

                    /// Telegram should provide a token
                    /// that was set during the application init phase
                    /// with setWebhook method:
                    {
                        ByteMatchStatement: {                            
                            SearchString: md5binary(token),
                            FieldToMatch: {
                                SingleHeader: { Name: $.telegram.webhook.header },
                            },
                            PositionalConstraint: 'EXACTLY',
                            TextTransformations: [{ Priority: 0, Type: 'MD5' }],
                        },
                    },
                ],
            }
        }

        Object.assign(rule, { Statement })
    }

    return rule
}

export function webhookCFFCode(token: string = '') {

    const toNum = (ip: string): number => ip
        .split('.')
        .map(i => parseInt(i))
        .reverse()
        .reduce((acc, i, n) => acc + (i << n*8) , 0) >>> 0;

    const ranges = webhookAllowedIPs().map(cidr => {
        const [ip, prefix] = cidr.split('/')
        const mask = -1 << (32-parseInt(prefix))
        const network = toNum(ip) & mask
        return `{ nw: ${network.toFixed()}, mask: ${mask.toFixed()} }`
    }).join(', ')    

    return `const crypto = require('crypto');

function handler(event) {

    const request = event.request;
    const ip = event.viewer.ip;

    if (!isIPInRanges(ip, [ ${ranges} ])) {

        return {

            statusCode: 403,
            statusDescription: 'Forbidden',
            headers: { 'content-type': { value: 'text/plain' } },
            body: 'Access denied'
        }
    }

    const header = request.headers['${$.telegram.webhook.header}'];
    const expectedToken = '${ token && typeof token === 'string' ? sha256(token) : '<NEEDS_TO_BE_SET_DURING_APP_INIT>'}';

    if (!header || sha256(header.value) !== expectedToken) {

        return {

            statusCode: 403,
            statusDescription: 'Forbidden',
            headers: { 'content-type': { value: 'text/plain' } },
            body: 'Access denied by CFF'
        }
    }

    request.headers['x-telegram-ip'] = { value: ip };
    request.headers['x-telegram-validated'] = { value: 'true' };
    return request;
}

function isIPInRanges(ip, ranges) {

    const ipNum = ip.split('.').map(i => parseInt(i)).reverse().reduce((acc, i, n) => acc + (i << n*8) , 0);
    return ranges.some(r => r.nw === (ipNum & r.mask))
}

function sha256(data) {

    return crypto.createHash('sha256').update(data||'').digest('hex')
}`
}





export async function updateFirewallToken({ type, arn }: { type: Firewall, arn: ARN }): Promise<string|undefined> {

    const token = webhookValue()

    if (type === 'cff') {

        if (await updateCFF(arn, token)) {

            return token
        }
    }

    else if (type === 'waf') {

        if (await updateWAF(arn, token)) {

            return token
        }
    }

    return undefined
}





export async function updateCFF(arn: ARN, token: string): Promise<boolean> {

    const client = new CloudFrontClient({})

    const functionName = arn.split('/').pop()

    if (!functionName) {

        throw new Error(`Invalid CloudFront Function ARN: ${arn}`)
    }

    const description = await client.send(

        new DescribeFunctionCommand({ Name: functionName })
    )

    const etag = description.ETag

    if (!etag) {

        throw new Error(`Could not retrieve ETag for function: ${functionName}`)
    }

    const newCode           = webhookCFFCode(token)
    const codeBuffer        = Buffer.from(newCode, 'utf-8')
    const updateResponse    = await client.send(

        new UpdateFunctionCommand({
            Name            : functionName,
            IfMatch         : etag,
            FunctionCode    : codeBuffer,
            FunctionConfig  : description.FunctionSummary?.FunctionConfig
        })
    )

    const newETag = updateResponse.ETag

    if (!newETag) {

        throw new Error(`Could not retrieve new ETag after update for function: ${functionName}`)
    }

    await client.send(

        new PublishFunctionCommand({
            Name    : functionName,
            IfMatch : newETag
        })
    )

    return true
}





export async function updateWAF(arn: ARN, token: string): Promise<boolean> {
    
    const client = new WAFV2Client({ region: 'us-east-1' })

    const resp = await client.send(

        new GetWebACLCommand({ ARN: arn })
    )

    const { WebACL, LockToken } = resp

    if (!WebACL || !LockToken) {

        throw new Error(`Could not retrieve WebACL: ${arn}`)
    }

    await client.send(

        new UpdateWebACLCommand({

            Scope           :'CLOUDFRONT',
            LockToken       : LockToken,
            Name            : WebACL.Name,
            Id              : WebACL.Id,
            Rules           : WebACL.Rules?.map(r => updateWAFStatement(r, token)),
            DefaultAction   : WebACL.DefaultAction,
            VisibilityConfig: WebACL.VisibilityConfig
        })
    )

    return true
}