import type { TableDescriptor   } from "@core/types"
import type { IGrantable        } from "aws-cdk-lib/aws-iam"
import      { Construct         } from "constructs"
import      { RemovalPolicy     } from "aws-cdk-lib"
import   * as ddb                 from "aws-cdk-lib/aws-dynamodb"





export interface DynamoProps {

    tables: Record<string, TableDescriptor>
}





export class DynamoDB extends Construct {

    #tables : ddb.ITableV2[]

    grantReadWriteData(grantee: IGrantable) {

        this.#tables.forEach(t =>

            t.grantReadWriteData(grantee)
        )
    }

    constructor(scope: Construct, id: string, props: DynamoProps) {

        super(scope, id)

        this.#tables = Object.keys(props.tables).map(key => {

            const descriptor = props.tables[key]
            const table = createTable(this, descriptor, key)
            return table
        })
    }
}





export function createTable(scope: Construct, props: TableDescriptor, key: string) {

    const prefix = key.replaceAll(/[^a-z0-9]/ig,'').toUpperCase()

    const table = new ddb.TableV2(scope, prefix, {

        tableName   : props.name,

        partitionKey: {
            name    : props.pk.name,
            type    :(props.pk.type || ddb.AttributeType.STRING) as ddb.AttributeType
        },

        sortKey     : props.sk
            ? { name: props.sk.name,
                type: (props.sk.type || ddb.AttributeType.STRING) as ddb.AttributeType }
            : undefined,

        timeToLiveAttribute             : props.ttl || undefined,
        removalPolicy                   : RemovalPolicy.DESTROY,
        pointInTimeRecoverySpecification: {
            pointInTimeRecoveryEnabled  : true
        }
    })

    if (props.gsi) {

        Object.entries(props.gsi).forEach(([name, gsi]) => {

            table.addGlobalSecondaryIndex({

                indexName       : name,
                partitionKey    : {

                    name        : gsi.pk.name,
                    type        :(gsi.pk.type || ddb.AttributeType.STRING) as ddb.AttributeType
                },
                sortKey         : gsi.sk
                    ? {
                        name    : gsi.sk.name,
                        type    :(gsi.sk.type || ddb.AttributeType.STRING) as ddb.AttributeType
                    }
                    : undefined
            })
        })
    }

    return table
}