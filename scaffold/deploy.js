import { updateAppYaml 		} from './config.js'
import { exec,
	     execSequence 		} from './exec.js'
import { writeFile,
		 readFile,
		 rename,
		 mkdir,
		 cp 				} from 'fs/promises'
import { basename, dirname	} from 'path'
import { printDuration,
		 validateBotToken,
		 verifyBotToken,
		 safeProfile,
		 safePath,		
		 isExist			} from './helpers.js'
import 	 * as p		  	  	  from '@clack/prompts'
import        pc	  	  	  from 'picocolors'





export async function runDeployment(options = {}) {

	const { botToken, source, target, profile, user, workshop } = options
	const report = safePath(target, 'REPORT.md')
    const branch = await gitDefaultBranchName('main')
	const vscode = await detectVSCode()
	const $ = { workshop }

	const steps = [
		{
			name		:`Prepare project structure`,
			command		: () => copyProject(source, target, workshop),
			critical	: true
		},
		{
			name		:`Save user answers to app.yaml`,
			command		: ({ logFile }) => updateAppYaml(target, { ...options, branch, ...$ }, logFile).then(r => ({ ok: r || false }), error => ({ ok: false, error })),
			critical	: true
		},
		{
			name		:`Installing dependencies`,
			command		:['pnpm', 'install'],
			workaround	:`Please make sure that you can successfully run ${pc.bold(pc.greenBright('pnpm install'))} in the project folder "${pc.bold(target)}"`,
			critical	: true,
			progress	: true
		},
		{
			name		:`Building packages`,
			command		:['pnpm', 'build'],
			critical	: true,
			progress	: true
		},
		{
			name		:`CDK bootstrap`,
			command		:['pnpm', 'run', 'bootstrap', '--no-notices', ...(profile ? ['--profile', profile] : [])],
			critical	: true,
			progress	: true
		},
		{
			name		:`Stack deployment (might take 10-15 minutes to complete)`,
			command		:['pnpm', 'run', 'deploy', '--no-notices', ...(profile ? ['--profile', profile] : [])],
			env			:{ BUILD_MODE: 'development' },
			critical	: true,
			progress	: true
		},
		{
			name		:`Describe application stack`,
			command		:['pnpm', '--silent', 'run', 'report', '--output', report],
			context		: report => Object.assign($, {report}),
			critical	: true
		},
		{
			name		:`Bot Token`,
			command		: () => askBotToken(botToken),
			context		: bot => Object.assign($, {bot}),
			critical	: true,
			spinner		: false
		},
		{
			name		:`App initialization`,
		get command()	{ return $.bot?.token ? ['pnpm', 'run', 'setup', '--token', $.bot.token] : false },
			critical	: true,
			progress	: true
		},
		{
			name		:`Git: setup and sync local repo`,
		    command	    : ({ logFile }) => gitConfig({ ...$.report?.git||{}, target, profile, user, logFile }),
			critical	: false
		},
		{
			name		:`VS Code: configure markdown preview`,
			command		: vscode ? () => setupVSCodeSettings(target) : false,
			critical	: false
		},
		{
			name		:`Quick Healthcheck`,
		get command()	{ return $.report.miniapp ? () => runHealthcheckEndpoint($.report.miniapp) : false },
			critical	: true
		}
	]

	p.log.info(`Deployment has started.\nSee logs here:\n\n${pc.cyan(pc.bold(dirname(get_log_file(target))))}`)

	const padIndex = 2*steps.length.toFixed().length + " of ".length

	const ok = await steps.reduce(async (prevStep, i, n) => {

		if (await prevStep) {

			const ts = Date.now()
			const logFile = get_log_file(target, i.name, n)
			const s  = i.spinner !== false ? p.spinner() : undefined

			s && s.start(`${pc.dim(`${n+1} of ${steps.length}`.padStart(padIndex))}: ${i.name}`)

			if (!i.command) {

				s && s.stop(`${pc.dim(`${n+1} of ${steps.length}`.padStart(padIndex))}: ⏭️  ${i.name}: ${pc.bold(pc.yellowBright('skipped.'))}`)
				return true
			}

			const { ok, json, stderr } = typeof i.command === 'function'
				? await i.command({ logFile })
				: await exec(i.command, {
					cwd		: target,
					print	: i.progress ? 20 : undefined,
					env		: i.env || undefined,
					logFile
				})

			if (ok) {

				s && s.stop(`${pc.dim(`${n+1} of ${steps.length}`.padStart(padIndex))}: ✅ ${i.name}: ${pc.bold(pc.greenBright('done.'))} ${pc.dim(`(${printDuration(ts)})`)}`)

				if (json && typeof i.context === 'function') {

					i.context(json)
				}

				return true
			}
			else {

				if (stderr) { p.log.error(`${pc.bold(pc.redBright('ERROR:'))}\n${stderr}`) }
				s && s.stop(`${pc.dim(`${n+1} of ${steps.length}`.padStart(padIndex))}: ❌ ${i.name}: ${pc.bold(pc.redBright('Failed.'))}`)
				if (logFile &&  typeof i.command !== 'function') { p.log.info(`Please consult log file:\n\n${logFile}`) }

				return !i.critical
			}
		}

		return false

	}, Promise.resolve(true))

	if (ok) {

		if (report) {

			p.log.message('')
			p.log.info(pc.cyan(pc.bold('Deployment Report')))
			p.log.message(`You may find some handy notes on your deployed infrastructure in this report:\n${pc.cyan(report)}`)
		}

		if ($.report) {

			p.log.message('')
			p.log.info(pc.cyan(pc.bold('Quick Reference')))
			p.log.message('Useful Commands:')
			p.log.message(pc.dim(`# Clone your repository\n${pc.cyan(`git clone ${$.report.git.http}`)}`))
			p.log.message(pc.dim(`# Tail application logs\n${pc.cyan(`aws logs tail ${$.report.logs.app.split('/').at(-1)} --follow --region ${$.report.regions.main}${profile && profile !== 'default' ? ` --profile ${profile}` : ''}`)}`))
			p.log.message(pc.dim(`# Tail code build logs\n${pc.cyan(`aws logs tail ${$.report.logs.build.split('/').at(-1)} --follow --region ${$.report.regions.main}${profile && profile !== 'default' ? ` --profile ${profile}` : ''}`)}`))
		}

		if ($.bot?.info?.username) {

			p.log.message(pc.dim(`Your Bot:\n${pc.cyan(`https://t.me/${$.bot.info.username}`)}\nThe bot webhook was already set, so you can use it now`))
		}

		if ($.report.miniapp) {

			p.log.message('')
			p.log.success(pc.bgGreen(pc.bold("  Your Mini App's URL:  ")))
			p.log.message(`🚀 ${pc.greenBright(pc.bold($.report.miniapp))}`)
			p.log.message(pc.dim(`Open Telegram's @BotFather to configure your Mini App using the URL ↑ above:\n${pc.cyan('https://t.me/botfather')}`))
		}
	}

	p.outro(ok

		? pc.bold(pc.greenBright(`✅ Deployment complete! 🚀`))
		: pc.bold(pc.redBright('❌ Deployment has failed :('))
	)

	return ok
}





async function copyProject(source, target, workshop) {

	if (await isExist(target)) {

		return {

			ok		: false,
			error	: new Error(`❌ Local repository folder "${target}" does already exist. Please choose another target directory.`)
		}
	}

	try {

		const exclude = new Set([
			"scaffold",
			"svelte",
			"node_modules",
			"build",
			"dist",
			"cdk.out",
			".cdk.staging",
			".react-router",
			".svelte-kit",
			".git",
			".ash",
			".output",
			".vercel",
			".netlify",
			".wrangler",
			".lambda",
			".s3",
			".code",
			".env",
			".logs",
			".DS_Store",
			"Thumbs.db",
		])

		await mkdir(safePath(target, '.logs'), {

			recursive: true
		})

		await cp(source, target, {

			dereference	: true,
			recursive	: true,
			force		: true,
			filter		: src => !exclude.has(basename(src))
		})

		await rename(

			safePath(target, 'docs', 'gitignore.template'),
			safePath(target, '.gitignore')
		)

		if (workshop) {

			return writeCdkContext(target, {

				workshop		: Boolean(workshop),
				workshopPrefix	: workshop
			})
		}

		return { ok: true }
	}

	catch (error) {

		return { ok: false, error }
	}
}





async function askBotToken(token) {

	while(true) {

		const info = token && await verifyBotToken(token)

		if (info) {

			p.log.info(`${pc.bold(pc.greenBright(`@${info.username}`))} (${info.first_name})`)

			return {

				ok: true,
				json: { token, info }
			}
		}

		if (token && !info) {

			p.log.error(`${pc.bold(pc.red('Wrong token?'))}\nI was not able to retrieve Telegram Bot profile with the token that you have provided to me.\n\n${pc.bold(pc.red('Please try another Bot Token.'))}`)
		}

		token = await p.password({
			message		: pc.bold('I need your Telegram Bot Token to proceed further:'),
			mask		: '*',
			validate	: validateBotToken(false),
		})

		if (p.isCancel(token)) {

			return {

				ok: false,
				error: new Error('Cancelled by User')
			}
		}
	}
}





async function gitDefaultBranchName(defaults = 'main') {

	const resp = await exec(['git', 'config', '--global', '--get', 'init.defaultBranch'])
	return resp?.ok && safeProfile(resp?.stdout?.trim() || defaults) || 'main'
}





async function gitGetUserConfigs(user) {

	user = safeProfile(user) || 'anonymous'

	const resp = await Promise.all(

		[
			['user.name' , user],
			['user.email',`${user}@miniapp.sample` ]

		].map(async ([p, defaults]) => {

			const resp 	= await exec(['git', 'config', '--global', '--get', p])
			const ok 	= resp?.ok || (resp?.code === 1 && resp?.stdout?.trim() === '')
			const value = ok && resp.stdout?.trim() || ''
			return {
				...(resp||{}),
				p	: p,
				ok	: ok,
				set	: !value ? defaults : undefined
			}
		})
	)

	if (resp.every(i => i?.ok)) {

		return {

			ok: true,
			commands: resp
				.filter(i => i.ok && i.p && i.set)
				.map(i => ['git', 'config', '--local', i.p, i.set])
		}
	}

	return resp.find(i => !i?.ok) || { ok: false }
}





async function gitConfig({ target, profile, user, http, branch, logFile }) {

	if (false
		|| !http
		|| !branch
		|| !user
		|| !target
	) {
		return {

			ok: false,
			error: new Error(`gitConfig Error: missing required inputs: http=${http}, branch=${branch}, user=${user}, target=${target}`)
		}
	}

	const cfg = await gitGetUserConfigs(user)	

	const credentialHelper = safeProfile(profile)
		? `!aws --profile "${safeProfile(profile)}" codecommit credential-helper $@`
		: '!aws codecommit credential-helper $@'

	return execSequence([

		['git', 'init', '-b', branch],
		...(cfg.ok && cfg.commands || []),
		['git', 'add', '.'],
		['git', 'commit', '--allow-empty', '-am', 'init'],
		['git', 'config', '--local', 'credential.https://git-codecommit.*.amazonaws.com.helper', ''],
		['git', 'config', '--local', '--add', 'credential.https://git-codecommit.*.amazonaws.com.helper', credentialHelper],
		['git', 'config', '--local', 'credential.https://git-codecommit.*.amazonaws.com.UseHttpPath', 'true'],
		http && ['git', 'remote', 'add', 'origin', http ],
		http && ['git', 'push', '-u', 'origin', branch ]

	], { cwd: target, logFile })
}





function get_log_file(path, text='any', n=0) {

	const id = n.toFixed().padStart(2, '0')
	const name = text.toLowerCase().replaceAll(/\s+/g, '_').replace(/[^a-z_]/g, '')
	return safePath(path, '.logs', `${id}.${name}.log`)
}





async function writeCdkContext(target, context) {

	try {

		const { ok, json } = await exec(
			['pnpm', 'list', '--filter', '@infra/cdk', '--json'],
			{ cwd: target }
		)

		if (!ok || !json?.[0]?.path) {

			return { ok: false, error: new Error('Could not resolve @infra/cdk package path') }
		}

		const contextPath	= safePath(json[0].path, 'cdk.context.json')
		const merged 		= { ...await readContext(), ...context }
		await writeFile(contextPath, JSON.stringify(merged, null, '\t'))
		return { ok: true }
	}

	catch (error) {

		return { ok: false, error }
	}

	async function readContext() {

		try {

			const content = await readFile(contextPath, 'utf-8')
			return JSON.parse(content)
		}

		catch {

			return {}
		}
	}
}





export async function setupVSCodeSettings(target) {

	const vscodeDir 	= safePath(target, '.vscode')
	const settingsPath 	= safePath(vscodeDir, 'settings.json')

	try {

		await mkdir(vscodeDir, { recursive: true })

		let settings = {}

		try {

			const content = await readFile(settingsPath, 'utf-8')
			settings = JSON.parse(content)
		}
		catch { }

		settings['workbench.editorAssociations'] = {
			...(settings['workbench.editorAssociations'] || {}),
			'{REPORT,README,THIRD-PARTY-LICENSES}.md': 'vscode.markdown.preview.editor'
		}

		await writeFile(settingsPath, JSON.stringify(settings, null, '\t'))

		return { ok: true }
	}
	catch (error) {

		return { ok: false, error }
	}
}





async function detectVSCode() {

	const { ok } = await exec(['code', '--version'])
	return ok
}





export async function runHealthcheckEndpoint(miniapp) {

	const resp = await fetch(`${miniapp}/ok`)

	return {

		ok		: resp.ok,
		stdout	: await resp.text()
	}	
}