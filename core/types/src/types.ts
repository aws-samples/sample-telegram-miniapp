import type { Bot } from "grammy"

export type BotInfo     = Bot['botInfo']

export type CIDR_IPv4   = `${number}.${number}.${number}.${number}/${number}`

export type Firewall    = 'cff' | 'waf'

export type Region      = `${string}-${string}-${number}`

export type Account     = `${number}`

export type ARN         = `arn:${string}`

export type TableKey    = { name: string, type?: 'N'|'S'|'B' }

export interface TableDescriptor {

    name    : string
    pk      : TableKey
    sk     ?: TableKey
    gsi    ?: Record<string, { pk: TableKey, sk? : TableKey }>
    ttl    ?: string
}