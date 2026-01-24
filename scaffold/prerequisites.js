import { findWorkspaceRoot,
         detectTarget,
         safeProfile,
         isExist        } from './helpers.js'
import { exec           } from './exec.js'
import { statfs         } from 'fs/promises'
import 	 * as p		      from '@clack/prompts'
import        pc	      from 'picocolors'





export async function verifyEnv() {

    const s = p.spinner()
    s.start('Verifying current environment')

    const checks = [
        {
            key         : "source",
            name		: "Project Source",
            command		:  verifySource,
            failure		: `❌ ${pc.bold('Workspace root directory')} is not found.`,
            critical	: true,
        },
        {
            key         : "target",
            name		: "Target Dir",
            command		:  verifyTarget,
            failure		: `❌ ${pc.bold(detectTarget())} already exist. Please choose another destination that does not exist yet`,
            critical	: true,
        },
        {
            key         : "freespace",
            name		: "Available Disk Space",
            command		:  verifyFreeSpace,
            failure		: `❌ Please free up at least 512 MB of disk space in the current folder`,
            critical	: true,
        },
        {
            key         : "aws",
            name		: "AWS CLI",
            command		: ['aws', '--version'],
            timeout     :  5000,
            failure		: `❌ ${pc.bold('aws cli')} is not installed`,
            workaround	: {
                header	: pc.bgCyanBright(`  ${pc.bold('aws cli')} is required  `),
                body	: `Please consult the following guide to install ${pc.bold(pc.greenBright('aws cli'))}:\n\n${pc.bold(pc.cyanBright('https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'))}`
            },
            then		: [
                {
                    key         : "profiles",
                    name		: "aws login",
                    timeout     :  10000,
                    command		:  verifyAccountAccess,
                    failure		: `❌ Please authenticate to your AWS account using ${pc.bold(pc.greenBright('aws login'))}`,
                    critical	: true,
                }
            ]
        },
        {
            key         : "git",
            name		: "Git CLI",
            command		: ['git', '--version'],
            timeout     :  5000,
            failure		: `❌ ${pc.bold('git cli')} is not installed`,
            workaround	: {
                header	: pc.bgCyanBright(`  ${pc.bold('git cli')} is required  `),
                body	: `Please consult Git getting started guide in order to install ${pc.bold('git cli')}:\n\n${pc.bold(pc.cyanBright('https://git-scm.com/book/en/v2/Getting-Started-Installing-Git'))}`
            },
            critical	: true,
        },
        {
            key         : "pnpm",
            name		: "pnpm",
            command		: ['pnpm', '--version'],
            timeout     :  5000,
            failure		: `❌ ${pc.bold('pnpm')} is not installed`,
            workaround	: {
                header	: pc.bgCyanBright(`  ${pc.bold('pnpm package manager')} is required  `),
                body	: `Please install pnpm using ${pc.bold(pc.greenBright('npm install -g pnpm'))} or any\nother method described in the official pnpm guide:\n\n${pc.bold(pc.cyanBright('https://pnpm.io/installation'))}`
            },
            critical	: true,
        }
    ]

    const results = await Promise.all(

        VerificationItem.create(checks).map(i => i.promise)
    )

    const ok = results.every(i => i.ok)

    s.stop(`Prerequisites verification: ${ ok
        ? pc.bold(pc.greenBright('✅ OK'))
        : pc.bold(pc.redBright('❌ failed'))
    }`)

    if (!ok) {

        const padName = Math.max(...results.map(i => i.name.length)) + 1
        const padLen  = results.length.toFixed().length*2 + 3

        results.forEach((i, n) => {

            p.log.info(`${pc.dim(`${n+1}/${results.length}:`.padStart(padLen))}  ${i.name.padEnd(padName)}: ${i.status}`)
        })

        results.filter(i => i.failed && i.err).forEach(i => {

            p.log.error(pc.redBright(pc.bold(i.name)))
            p.log.message(i.err)
        })

        results.filter(i => i.failed && i.workaround).forEach(i => {

            p.note(

                i.workaround.body,
                i.workaround.header
            )				
        })
    }

    return Object.assign({}, ...results.map(i => i.data), { ok })
}





async function verifyTarget() {

    const path  = detectTarget()
    const exist = path && (await isExist(path, 1000))
    return { ok: !exist, stdout: path }
}





async function verifySource() {

    return new Promise(resolve => {

        const path = findWorkspaceRoot()
        resolve({ ok: !!path, stdout: path })
    })
}





async function verifyFreeSpace() {

    const stats = await statfs(process.cwd())
    const availableMB = stats.bavail * stats.bsize / 1024 / 1024;
    return {

        ok      : availableMB > 500,
        error   : availableMB > 500 ? undefined : `Not enough disk space left: ${availableMB.toFixed()}MB; I need at least 512MB of free disk space.`
    }
}





async function verifyAccountAccess() {

    const result = await exec(['aws', 'configure', 'list-profiles', '--output', 'text'], { json: false })

    if (result.ok) {

        const profileSet = new Set(['', ...result
            .stdout
            .split('\n')
            .map(i => safeProfile(i))
            .filter(Boolean)])

        const profiles = await Promise.all(

            [...profileSet].map(async profile => {

                const user = await exec(
                    ['aws', 'sts', 'get-caller-identity', '--output', 'json', ...(profile ? ['--profile', profile] : []) ],
                    { json: true, timeout: 10000 }
                )

                if (user && user.ok && user.json && typeof user.json === 'object') {

                    const account = await exec(
                        ['aws', 'account', 'get-account-information', '--output', 'json', ...(profile ? ['--profile', profile] : [])],
                        { json: true, timeout: 10000 }
                    )

                    return Object.assign(

                        { ok: true,  profile },
                        { user: user.json.Arn?.split('/').at(-1) || user.json.UserId || '' },
                        account?.ok && account.json && typeof account.json === 'object'
                            ? account.json
                            : { AccountId: user.json.Account||'', AccountName: '' },
                        user.json
                    )
                }

                return Object.assign(user||{}, { ok: false, profile, user: '' })
            })
        )

        return {

            ok  : profiles.some(i => i.ok),
            json: profiles.filter(i => i.ok),
        }
    }

    return result
}





class VerificationItem {

    constructor(descriptor, parent = null) {

        Object.assign(this, descriptor)

        this.promise = new Promise(async (resolve, reject) => {

            try {
                
                const skip = parent?.promise && (await parent.promise).ok !== true
    
                if (skip) {
    
                    this.result	= { ok: false }
                    this.status = pc.dim(' → skipped')
                }
    
                else {
    
                    this.result = typeof this.command === 'function'
                        ? await this.command()
                        : await exec(this.command, { timeout: this.timeout })
    
                    this.status = this.result.ok
                        ? pc.bold(pc.greenBright('✅ OK'))
                        : this.failure || pc.bold(pc.redBright('❌ failed'))
                }
    
                resolve(this)
            }
            catch(err) {

                reject(err)
            }
        })
    }

    get ok() {

        return this.result.ok
    }

    get failed() {

        return this.result && !this.result.ok
    }

    get err() {

        return this.result?.stderr || ''
    }

    get data() {

        return { [this.key]: this.result?.json || this.result?.stdout?.trim() || null }
    }

    static create(descriptors, parent = null) {

        if (Array.isArray(descriptors)) {

            return descriptors
                .filter(i => i && typeof i === 'object' && i.command && i.key)
                .map(d => {
    
                    const obj = new VerificationItem(d, parent)
                    return [ obj, ...VerificationItem.create(d.then, obj) ]
                }
    
            ).flat()
        }

        return []
    }
}