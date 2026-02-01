export interface ICache<T> {

    exp : number
    data: T|undefined
}

export function Cache<T>(ttl: number = 0): ICache<T> {

    let exp: number = 0
    let data: T | undefined = undefined

    return Object.seal(Object.defineProperties({}, {

        data: {

            enumerable: true,
            configurable: false,

            get: () => {

                if (data
                    && ttl > 0
                    && exp < Date.now()) {

                    data = undefined
                }

                return data
            },

            set: (value: T) => {

                exp = Date.now() + (ttl||0)
                data = value
                return data
            }
        },

        exp: {

            enumerable  : true,
            configurable: false,
            get: () => exp
        }

    }) as ICache<T>)
}