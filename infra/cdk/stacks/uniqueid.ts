import type {IConstruct } from "constructs"
import { Stack, Token   } from "aws-cdk-lib"
import { sha256         } from "@core/tools-server"
import   $                from "@core/constants"





const DEFAULT_MAX = $.aws.s3.max_bucket_name_length

interface TryUniqueIdProps {

    prefix      : string
    separator  ?: string
    maxlen     ?: number
}

export function tryUniqueId(node: IConstruct, opt: string | TryUniqueIdProps ): string | undefined {

    const account   = Stack.of(node).account
    const region    = Stack.of(node).region

    if ([account, region].find(t => Token.isUnresolved(t))) {

        return undefined
    }

    const prefix    = (typeof opt === 'object' ? (opt?.prefix||'') : typeof opt === 'string' ? opt : '') || ''
    const separator = (typeof opt === 'object' ? (opt?.separator||'') : '-')
    const maxlen    =  typeof opt === 'object' ? (opt?.maxlen||DEFAULT_MAX) : DEFAULT_MAX
    const id        = `${prefix}${separator}${sha256(`${account}:${region}`)}`
    return maxlen > 0 ? id.slice(0, maxlen) : id
}