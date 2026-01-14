type DefaultGetter<T = string|number|object> = T | ((param: string, value?: string) => T)

type ExpandRecord<
    KEYS    extends string[],
    TYPES   extends Partial<Record<KEYS[number], any>>,
    DEFAULT = string
> = { [K in KEYS[number]]: K extends keyof TYPES ? TYPES[K] : DEFAULT }





function MANDATORY<T>(param: string): T {

    throw new Error(`Env Variable [${param}] is mandatory, but it doesn't exist in the Env or it's value is empty`)
    return (undefined as T)
}





export function envString(envName: string, defaults: DefaultGetter = MANDATORY) {

    const value = process.env[envName]

    if (value) {

        return value
    }

    if (typeof defaults === 'function') {

        return defaults(envName)
    }

    return defaults
}





export function envConfig<
    R extends Record<string, string|number|object>
    >(defaults: R): R
{
    const keys: string[] = Object.keys(defaults)

    return keys.reduce((acc, k) =>

        Object.assign(acc, {

            [k]: readEnv(k, defaults[k])
        }),

        {} as R
    )
}





const TYPE_CONVERSION: Record<string, (s: string) => string|number|object|boolean> = {

    "undefined" : s => s,
    "string"    : s => s,
    "symbol"    : s => s,
    "function"  : s => s,
    "number"    : s => parseInt(s),
    "bigint"    : s => parseInt(s),
    "boolean"   : s => Boolean(s),
    "object"    : s => JSON.parse(s),
}

function readEnv<T extends string|number|object>(name: string, defaults: DefaultGetter<T> = MANDATORY<T>): T {

    const strValue = process.env[name]

    if (strValue === undefined || strValue.trim() === "") {

        return typeof defaults === 'function' ? defaults(name) : defaults
    }

    try {

        return TYPE_CONVERSION[typeof defaults](strValue) as T
    }

    catch {

        return typeof defaults === 'function' ? defaults(name, strValue) : defaults
    }
}