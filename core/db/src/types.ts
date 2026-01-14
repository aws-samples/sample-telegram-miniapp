import type { ComparisonOperator } from "@aws-sdk/client-dynamodb"





export type TableKey = { name: string, type?: string }

export interface TableDescriptor {

    name    : string
    pk      : TableKey
    sk     ?: TableKey
    gsi    ?: Record<string, GsiDescriptor>
    ttl    ?: string
}

export interface GsiDescriptor {

    pk      : TableKey
    sk     ?: TableKey
}





type MaybeArray<T> = T extends unknown ? T|ReadonlyArray<T> : never
export type ScalarValue = string|number|boolean
export type QueryValues = MaybeArray<ScalarValue>
export type QueryExpression = Partial<Record<ComparisonOperator, QueryValues>>
export type QueryFilter     = Partial<Record<'>'|'<'|'='|'>='|'<=', QueryValues>>|QueryValues
export interface QueryOptions {

    consistent  ? : boolean
    descending  ? : boolean
    index       ? : string
    sk          ? : QueryExpression
    projection  ? : string | ReadonlyArray<string>
    names       ? : Record<string, string>
    where       ? : Record<string, QueryFilter>
}