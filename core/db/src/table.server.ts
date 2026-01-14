import type {
         ScalarValue,
         QueryValues,
         QueryOptions,
         QueryFilter,
         QueryExpression,
         TableDescriptor,
         GsiDescriptor          } from "./types"
import { ComparisonOperator,
         ConditionalOperator,
         DynamoDBClient         } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocument       } from "@aws-sdk/lib-dynamodb"
import { Logger                 } from "@aws-lambda-powertools/logger"

const log = new Logger({ serviceName: 'ddb-table' })
const ddb = new DynamoDBClient()
const doc = DynamoDBDocument.from(ddb)





export class Table<
     D extends TableDescriptor = TableDescriptor,
     T extends Record<string, any> = Record<string, any>,
    PK extends ScalarValue = ScalarValue,
    SK extends ScalarValue = ScalarValue,
> {

    #d: D
    #use: GsiDescriptor & { index: string } | undefined
    #gsi = {} as Record<keyof D['gsi'], Table<TableDescriptor>>

    private constructor(descriptor: D, useGSI?: { gsi: GsiDescriptor, index: string }) {

        this.#use = useGSI && useGSI.index
            ? Object.freeze(Object.assign({}, useGSI.gsi, { index: useGSI.index }))
            : undefined

        this.#d = Object.freeze(
            Object.assign({}, descriptor, this.#use ? { gsi: undefined } : undefined)
        )

        if (this.#d.gsi) {

            this.#gsi = Object.freeze(

                Object
                    .entries(this.#d.gsi)
                    .reduce(
                        (acc, [index, gsi]) => Object.assign(acc, {
                            [index]: new Table(descriptor, { gsi, index })
                        }),
                        {} as Record<keyof D['gsi'], Table<D>>
                    )
            )
        }
    }

    static from<D extends TableDescriptor>(descriptor: D) {

        return new Table<D>(descriptor)
    }

    get by() {

        return this.#gsi
    }

    get pk() {

        return this.#d.pk.name
    }

    get sk() {

        return this.#d.sk?.name || ''
    }

    get descriptor() {

        return this.#d
    }

    get<D = T>(id: PK, sk: SK|undefined = undefined): Promise<D|undefined> {

        return doc.get({

            TableName   : this.#d.name,
            Key         : this.#d.sk
                ? {

                    [this.#d.pk.name]: id,
                    [this.#d.sk.name]: sk
                }
                : {

                    [this.#d.pk.name]: id
                }

        }).then(

            data => {

                if (data.Item) {

                    return data.Item as D
                }

                return undefined
            },

            err => {

                log.error('GET ITEM', err, { table: this.#d.name, pk: id, sk, pk_type: typeof id, sk_type: typeof sk })

                return undefined
            }
        )
    }

    collect<D extends Record<string, any> = T>(id: PK): Promise<D|undefined> {

        if (this.#d.sk?.name) {

            return this
                .query<D>(id)
                .then(data => data && merge(data, this.#d.sk?.name))
        }

        else {

            return this.get(id)
        }
    }

    put(data: T, opt?: {

        pk  ?: ScalarValue,
        sk  ?: ScalarValue,
        add ?: Record<string, any>,
        ttl ?: number
    }) {

        if (opt) {

            data = Object.assign({},

                data,
                opt.add,
                opt.pk !== undefined
                    ? {[this.#d.pk.name]: opt.pk}
                    : undefined,
                
                this.#d.sk && opt.sk !== undefined
                    ? {[this.#d.sk.name]: opt.sk}
                    : undefined,

                this.#d.ttl && typeof opt.ttl === 'number' && !isNaN(opt.ttl)
                    ? { [this.#d.ttl]: Math.round(Date.now()/1000 + opt.ttl) }
                    : undefined
            )
        }

        return doc.put({

            TableName   : this.#d.name,
            Item        : data
        })
        .then(

            put => {

                log.info('PUT', put)
                return Object.assign(put, { ok: true })
            },

            err => {

                log.error('PUT', err)
                return { ok: false, err }
            }
        )
    }

    async query<D=T>(pkValue: QueryValues, opt?: QueryOptions): Promise<Array<D>|undefined> {

        const table = this.#d.name
        const pk = (this.#use || this.#d).pk.name
        const sk = (this.#use || this.#d).sk?.name

        const filter    = filter_expression(opt?.where)
        let names       = Object.assign({}, opt?.names, filter.names)
        let projection  = opt?.projection || undefined

        if (Array.isArray(projection)) {

            const keys = projection.filter(i => typeof i === 'string').map(i => i.trim()).filter(Boolean)

            if (keys.length > 0) {

                projection  = keys.map(i => `#${i}`).join(',')
                names       = Object.assign(names, ...keys.map(i => ({[`#${i}`]:i})))
            }

            else {

                projection = undefined
            }
        }

        const query_expression = {

            TableName                   : table,
            IndexName                   : this.#use?.index,
            ProjectionExpression        : projection as string,
            ScanIndexForward            : opt?.descending === true ? false : undefined,
            ConsistentRead              : opt?.consistent,
            FilterExpression            : filter.expression,
            ExpressionAttributeNames    : Object.keys(names).length > 0 ? names : undefined,
            ExpressionAttributeValues   : filter.values,
            KeyConditions               : {

                [pk]: {

                    ComparisonOperator: 'EQ',
                    AttributeValueList: Array.isArray(pkValue) ? pkValue : [pkValue]
                },

                ...key_expression(sk && opt?.sk ? { [sk]: opt?.sk } : undefined)
            }
        }

        let result      : Array<Array<D>>   = []
        let keepgoing   : any               = undefined

        do {

            const data = await iteration(keepgoing)

            if (data) {

                if (data.items.length > 0) {

                    result.push(data.items)
                }

                keepgoing = data.keepgoing
            }

            else {

                return undefined
            }

        } while(keepgoing)



        return result.length === 1 ? result[0] : result.flat(1)



        function iteration(ExclusiveStartKey: undefined|Record<string, any>) {

            return doc
                .query(Object.assign(query_expression, { ExclusiveStartKey }))
                .then(

                    data => {

                        log.info('QUERY', Object.assign({}, data, {

                            Items: data?.Items?.filter((_, n) => n < 5)
                        }))

                        return {

                            items       : (data.Items||[]) as Array<D>,
                            keepgoing   : data.LastEvaluatedKey
                        }
                    },

                    err => {

                        log.error('QUERY', { err, table, opt, keepgoing, query_expression })
                        return undefined
                    }
                )
        }
    }
}





function key_expression(exp?: QueryExpression) {

    if (exp) {

        return Object
            .entries(exp)
            .filter(([k,v]) => k in ComparisonOperator)
            .reduce((acc, [k,v]) => Object.assign(acc, {

                ComparisonOperator: k as ComparisonOperator,
                AttributeValueList: Array.isArray(v) ? v : [v]

            }), { ComparisonOperator: undefined, AttributeValueList: [] })
    }

    return {}
}

function filter_expression(exp?: Record<string, QueryFilter>) {

    if (exp) {

        return {

            expression  : Object.entries(exp).map(([k,v]) => `#${k} ${ typeof v === 'object' ? Object.entries(v)[0][0] : '=' } :${k}`).join(` ${ConditionalOperator.AND} `),
            names       : Object.keys(exp).reduce((acc, k) => Object.assign(acc, { [`#${k}`]: k }), {}),
            values      : Object.entries(exp).reduce((acc, [k,v]) => Object.assign(acc, { [`:${k}`]: typeof v === 'object' ? Object.entries(v)[0][1] : v }), {})
        }
    }

    return {}
}

function merge<D extends Record<string,any>>(input: D[], ...exclude: (keyof D|undefined)[]) {

    const data = input.reduce((acc, i) => Object.assign(acc, i), {} as D)

    exclude.filter(Boolean).forEach(key => {

        delete data[key!]
    })

    return data
}