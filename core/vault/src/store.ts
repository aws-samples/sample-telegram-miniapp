import { Logger         } from "@aws-lambda-powertools/logger"
import { Cache, ICache  } from "@core/tools"
import { randomUUID     } from "node:crypto"
import {
    PutParameterCommand,
    GetParameterCommand,
    ParameterType,
    SSMClient,          } from "@aws-sdk/client-ssm"

import {
    SecretsManagerClient,
    GetRandomPasswordCommand
                        } from "@aws-sdk/client-secrets-manager"

const log = new Logger({ serviceName: 'vault-store' })





export interface VaultProps<T> {

    id          : string
    region     ?: string
    ttl        ?: number
    default    ?: T
    ignore_missing_param ?: boolean
}

export class Vault<T extends Record<string, any>> {

    #id         : string
    #cache      : ICache<T>
    #default    : T
    #client     : SSMClient
    #ignore     : boolean

    constructor(opt: VaultProps<T>) {

        this.#id        = opt.id
        this.#cache     = Cache<T>(opt.ttl||0)
        this.#default   = Object.assign({}, opt.default) as T
        this.#client    = new SSMClient({ region: opt.region || undefined })
        this.#ignore    = Boolean(opt.ignore_missing_param)
    }

    async get(forceFetch: boolean = false) {

        if (this.#cache.data && !forceFetch) {

            return this.#cache.data
        }

        return this.#cache.data = await this.load()
    }

    async set(merge: Partial<T>, forceFetch: boolean = false) {

        const payload = Object.assign({},

            await this.get(forceFetch),
            merge
        )

        return this.#cache.data = await this.commit(payload)
    }

    async erase() {

        return this.#cache.data = await this.commit(this.#default)
    }

    private async load(): Promise<T> {

        let data = {}

        try {

            const cmd = new GetParameterCommand({

                Name            : this.#id,
                WithDecryption  : true
            })

            const resp = await this.#client.send(cmd)

            if (resp.Parameter?.Value) {

                data = JSON.parse(resp.Parameter.Value) as T
            }

            else if (this.#ignore) {

                log.info('Parameter Value is Empty. Using default values', { id: this.#id, defaults: this.#default })
            }

            else {

                throw new Error(`Parameter "${this.#id}" Value is empty; ignore_missing_param="${this.#ignore}"`)
            }
        }

        catch (err) {

            if (this.#ignore) {

                log.error('Failure to load Parameter. Using default values', { id: this.#id, defaults: this.#default, err })
            }

            else {

                log.error('Failure to load Parameter', { id: this.#id, ignore_missing_param: this.#ignore, err })
                throw err
            }
        }

        return {...this.#default, ...data }
    }

    private async commit(payload: T) {

        try {

            const cmd = new PutParameterCommand({

                Name        : this.#id,
                Value       : typeof payload === 'string' ? payload : JSON.stringify(payload),
                Type        : ParameterType.SECURE_STRING,
                Overwrite   : true
            })

            await this.#client.send(cmd)
            return payload
        }

        catch(err) {

            log.error("Failure to Commit parameter to Parameter Store", { id: this.#id, err })
            throw err
        }
    }

    static async generate() {

        const cmd = new GetRandomPasswordCommand({

            ExcludePunctuation: true,
            ExcludeCharacters:`"{}[]()"',`
        })

        const client = new SecretsManagerClient()
        const response = await client.send(cmd)

        if (response?.RandomPassword) {

            return response.RandomPassword
        }

        return randomUUID().replace('-','')
    }
}