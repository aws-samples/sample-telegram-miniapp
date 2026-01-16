import   fs					  from "node:fs"
import   path				  from "node:path"
import { fileURLToPath		} from "node:url"
import { Api				} from "grammy"
import { exec				} from "./exec.js"





export function cwd() {

	return typeof __dirname === 'undefined'
		? path.dirname(fileURLToPath(import.meta.url))
		: __dirname
}





export async function isExist(path, timeout = undefined) {

	const test = await Promise.all([
		exec(['test', '-d', path], { json: false, timeout }),
		exec(['test', '-f', path], { json: false, timeout }),
		exec(['test', '-L', path], { json: false, timeout }),
	])

	return test.some(i => i.ok)
}





export function findWorkspaceRoot(fileName = "pnpm-workspace.yaml") {

	let dir = cwd()

	while (dir !== path.dirname(dir)) {

		if (fs.existsSync(path.join(dir, fileName))) {

			return dir;
		}

		dir = path.dirname(dir);
	}

	return ''
}





export function detectTarget() {

	const  target = process.argv[2]?.trim()	|| ''
	return target && safePath(target)		|| ''
}





export function safePath(target, ...segments) {

	const base 		= path.resolve(process.cwd())
	const resolved	= path.resolve(base, target, ...segments)

	if (resolved !== base && !resolved.startsWith(base + path.sep)) {

		throw new Error('Invalid path: directory traversal attempt');
	}

	return resolved
}





export function safeProfile(profile) {

	if (typeof profile === 'string') {

		profile = profile.trim()

		return profile && /^[a-zA-Z0-9+_-]+$/.test(profile)
			? profile
			: ''
	}

	return ''
}





export function isValidWorkspace(workspaceRoot) {

	return fs.existsSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'))
}





export function validateAppName(value) {

	if (!value || value.trim().length === 0) {

		return 'App name is required';
	}

	if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {

		return 'App name must start with a letter and contain only letters, numbers, hyphens, and underscores';
	}

	if (value.length > 32) {

		return 'App name length should not exceed 32 characters. Please make it shorter'
	}

	return undefined;
}





export function validateBotToken(allowEmpty = false) {

	return function (value) {

		if (allowEmpty && (!value || value.trim().length === 0)) {

			return undefined
		}

		if (!/^\d{6,10}:[A-Za-z0-9_-]{24,}$/.test(value.trim())) {

			return 'Invalid token format. Expected format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
		}

		return undefined;
	}
}





export async function verifyBotToken(token) {

	try {

		const api = new Api(token)
		return await api.getMe()
	}
	catch {

		return null
	}
}





export function printDuration(t0) {

	const duration = Date.now() - t0

	if (duration < 1000) {

		return '<1s'
	}

	const seconds = Math.floor(duration / 1000)

	if (seconds < 60) {

		return `${seconds}s`
	}

	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60

	if (minutes < 60) {

		return `${minutes}m ${remainingSeconds}s`
	}

	const hours = Math.floor(minutes / 60)
	const remainingMinutes = minutes % 60

	return `${hours}h ${remainingMinutes}m`
}