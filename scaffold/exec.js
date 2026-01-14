import { Transform, PassThrough } from "node:stream"
import { createWriteStream      } from "node:fs"
import   spawn                    from "cross-spawn"





export class Cleaner extends Transform {

    #filters
    #mask

    constructor({ filters, mask }) {

        super()
        this.#filters = Array.isArray(filters) ? filters.filter(i => i instanceof RegExp) : []
        this.#mask = mask && typeof mask === 'string' ? mask : '(*REMOVED*)'

        if (this.#filters.length < 1) {

            this.#filters.push(/\d{6,}:[A-Za-z0-9_-]{24,}/g)
        }
	}

    _transform(chunk, encoding, callback) {

        const text = chunk.toString(encoding === 'buffer' ? 'utf8' : encoding);

        this.push(

            this.#filters.reduce(

               (acc, p) => p.global ? acc.replaceAll(p, this.#mask) : acc.replace(p, this.#mask),
                text
            )
        )

        callback();
    }
}





export class Printer extends Transform {

    #max
    #output
    #formatter
	#buffer = []

    constructor({ max, output, formatter }) {

        super()
        this.#max       = typeof max === 'number' && max > 0  ? max       : 20
        this.#output    = typeof output?.write === 'function' ? output    : process.stdout
        this.#formatter = typeof formatter     === 'function' ? formatter : (str, n) => `\x1b[2m│\x1b[0m ${str}`
	}

    _transform(chunk, encoding, callback) {

        const text   = chunk.toString(encoding === 'buffer' ? 'utf8' : encoding)
        const lines  = text.split('\n').map(i => i.trim()).map(i => this.stripAnsi(i))
        const count  = this.#buffer.length
        this.#buffer = this.#buffer.concat(...lines).filter(Boolean).map(i => this.truncate(i)).slice(-this.#max)
        this.#output.write(`\r${ count > 0 ? `\x1b[${count}A` : ''}${this.#buffer.map((i, n) => this.#formatter(i, n)).join('\x1b[K\n')}\x1b[J\n`)
        callback();
    }

    _flush(callback) {

        const count = this.#buffer.length
        this.#output.write(`\x1b[${count}A\r\x1b[J`)
        setTimeout(callback, 10)
    }

    stripAnsi(str) {

        return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    }

    truncate(str) {

        const maxWidth = (this.#output.columns || 80) - 10
        return str.length > maxWidth ? str.substring(0, maxWidth - 3) + '...' : str
    }
}





export class Collector extends Transform {

	#buffer
	#offset = 0	
	#incrementSize

	constructor(initialSize = 10*1024*1024, incrementSize = initialSize) {

        super()
		this.#incrementSize = incrementSize > 0 ? incrementSize : 1024*1024
		this.#buffer = Buffer.alloc(initialSize > 0 ? initialSize : 1024*1024)
	}

    _transform(chunk, encoding, callback) {

        this.#write(chunk, encoding)
        this.push(chunk, encoding)
        callback();
    }

	#write(chunk, encoding = 'utf8') {

		const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
		const requiredSize = this.#offset + data.length

		if (requiredSize > this.#buffer.length) {

			this.#grow(requiredSize)
		}

		data.copy(this.#buffer, this.#offset)
		this.#offset += data.length
	}

	#grow(requiredSize) {

		const newSize = requiredSize + this.#incrementSize
		const newBuffer = Buffer.alloc(newSize)
		this.#buffer.copy(newBuffer, 0, 0, this.#offset)
		this.#buffer = newBuffer
	}

	toString(encoding = 'utf8') {

		return this.#buffer.toString(encoding, 0, this.#offset)
	}

	toBuffer() {

		return this.#buffer.subarray(0, this.#offset)
	}

	get length() {

		return this.#offset
	}
}





export function exec(cmd, opt = {}) {

    const {

        cwd         = undefined,
        json        = true,
        timeout     = undefined,
        env         = undefined,
        logFile     = undefined,
        bufferMB    = 10,
        pipes       = undefined,
        print       = undefined,
        filters     = undefined

    } = opt

    return new Promise(resolve => {

		const isArray = Array.isArray(cmd)
		const command = isArray ? cmd[0] : cmd
		const args = isArray ? cmd.slice(1) : []

        const child = spawn(command, args, {

            cwd			: cwd || undefined,
            stdio		: ['inherit', 'pipe', 'pipe' ],
            timeout		: timeout,
			env			: env ? { ...process.env, ...env } : undefined
		})

        const log       = logFile ? createWriteStream(logFile, { flags: 'a' }) : new PassThrough()
        const shared    = [print && new Printer({ max: print }), ...(pipes||[])].filter(Boolean)
        const stdout    = new Collector(bufferMB*1024*1024)
        const stderr    = new Collector(1*1024*1024)
        const cleanOut  = new Cleaner({ filters })
        const cleanErr  = new Cleaner({ filters })

        child.stdout.pipe(cleanOut).pipe(stdout).pipe(log)
        child.stderr.pipe(cleanErr).pipe(stderr).pipe(log)

        shared.forEach(p => {

            cleanOut.pipe(p, { end: false })
            cleanErr.pipe(p, { end: false })
        })

        child.on('error', (error) => {

            resolve({

                ok		: false,
                code    : -1,
                json	: null,
                stdout	: stdout.toString(),
                stderr	: stderr.toString(),
                error   : error
            })
        })

        child.on('close', (code) => {

            shared.forEach(p => p.end())

            const data = stdout.toString()

            resolve({

                ok		: code === 0,
                code    : code,
                json	: json ? safeJSON(data) : null,
                stdout	: data,
                stderr	: stderr.toString(),
                error	: code !== 0 ? new Error(`Process exited with code ${code}`) : null
            })
        })
    })
}





export function execSequence(cmd, opt = {}) {

    if (!Array.isArray(cmd)) {

        return exec(cmd, opt)
    }

    return cmd
    .filter(Boolean)
    .filter(i => typeof i === 'string' || Array.isArray(i))
    .reduce(

		async (acc, i) => (await acc)?.ok
			? exec(i, opt)
			: acc,

		Promise.resolve({ ok: true })
	)
}





function tryJSON(data) {

    try {

        return JSON.parse(data)
    }
    catch {

        return null
    }
}

function safeJSON(data) {

    try {

        return data && typeof data === 'string' && JSON.parse(data) || null
    }
    catch {

        return data
            .split('\n')
            .map(i => i.trim())
            .filter(i => i && i.startsWith('{') && i.endsWith('}'))
            .reverse()
            .reduce((acc, i) => acc || tryJSON(i), null)
    }
}