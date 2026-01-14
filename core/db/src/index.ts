import $ from "@core/constants"
import type { TableDescriptor   } from "./types"
import      { Table             } from "./table.server"

export type * from "./types"
export      * from "./table.server"
export const db = createTables($.artifacts.tables)





function createTables
    <TDS extends Record<string, TableDescriptor>>
    (descriptors: TDS)
    :{[K in keyof TDS]: Table<TDS[K]>} {

    const keys = Object.keys(descriptors) as (keyof TDS)[]

    return keys
        .filter(k => Boolean(
            k
            && descriptors[k]
            && descriptors[k].name
            && descriptors[k].pk?.name
            &&(descriptors[k].sk ? descriptors[k].sk.name : true)
        ))
        .reduce(
            (acc, k) => Object.assign(acc, { [k]: Table.from(descriptors[k]) }),
            {} as {[K in keyof TDS]: Table<TDS[K]>}
        )
}