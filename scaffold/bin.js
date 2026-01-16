#!/usr/bin/env node
import { runDeployment		} from './deploy.js'
import { verifyEnv 			} from './prerequisites.js'
import { DEFAULT_MODEL,
		 getDefaultRegion,
		 getRegions,
		 getModels 			} from './regions.js'
import { safePath,
		 validateAppName,
		 validateBotToken,
		 verifyBotToken 	} from './helpers.js'
import { isPossibleToBuildChart,
		 printModelChart	} from './charts.js'
import { basename			} from 'node:path'
import 	 crypto				  from 'node:crypto'
import 	 * as p 			  from '@clack/prompts'
import 		  pc 	  		  from 'picocolors'

await main().catch((error) => {

	p.log.error(error.message)
	process.exit(1)
})





async function main() {

	console.clear()

	p.intro(pc.bold(pc.greenBright(' Deploy Telegram Mini App on AWS serverless infrastructure ')))

	const env = await verifyEnv()

	if (!env.ok) {

		p.log.message('')
		p.outro(pc.bold('Deployment is cancelled due to prerequisites not met.'))
		process.exit(1)
	}

	const onCancel = () => {

		p.cancel('Setup cancelled.')
		process.exit(0)
	}

    const { appName, region, profile, user, accountId, accountName, botToken, botInfo, llm } = Object.assign(env, await ask_for_basic_settings(env, onCancel))
	const target = env.target || safePath(appName)

	printSummary([
		{ title: "App Name"			, value: pc.bold(pc.greenBright(appName	))},
		{ title: "Account"			, value: pc.bold(pc.greenBright(`${accountId}${ accountName ? ` (${accountName})` : '' }`))},
		{ title: "Region"			, value: pc.bold(pc.greenBright(region	))},
		{ title: "Profile"			, value: pc.bold(pc.greenBright(profile	))},
		{ title: "User"				, value: pc.bold(pc.greenBright(user	))},
		{ title: "Language Model"	, value: pc.bold(pc.greenBright(llm  	))},
		{ title: "Local Repository" , value: pc.bold(pc.greenBright(target	))},
		{ title: "Bot"				, value: botInfo
			? `${pc.bold(pc.cyan(`@${botInfo?.username}`))} (${botInfo?.first_name})`
			: `${pc.yellow('Skip for now')} ${pc.dim('(I will ask you for the token later.)')}`
		}
	], `\n${pc.bgGreenBright('  Configuration Summary  ')}`)

	const shouldProceed = await p.confirm({

		message		: `${pc.bold(pc.red(`Proceed with deployment to account ${accountId}`))}${accountName ? pc.dim(` (${accountName})`) : ''}${pc.bold(pc.red('?'))}`,
		initialValue: false,
	})

	if (p.isCancel(shouldProceed) || !shouldProceed) {

		p.cancel('Setup cancelled.');
		process.exit(0);
	}

	const success = await runDeployment({ ...env, target, appName, accountId, accountName, region, profile, user, botToken })

	process.exit(success ? 0 : 1)
}





/**
 * @param {Array<{ title: string, value: string }>} summary
 * @param {string} title
 * @returns {void}
 */
function printSummary(summary, title = "Configuration summary:") {

	const pad = Math.max(...summary.map(i => i.title.length)) + 1
	p.log.message(pc.bold(title));
	p.log.message(summary.map(i => `  ${pc.dim(i.title.padEnd(pad))}: ${i.value}`).join('\n'))
}





async function ask_for_basic_settings(env, onCancel) {

	const profilesMap = (env.profiles||[]).reduce((acc, i) => Object.assign(acc, { [i.profile||'']: i } ), {})
	const profileKeys = Object.keys(profilesMap)

    const { appName, profileID, botToken } = await p.group(
		{
			appName: () =>
				p.text({
					message		: pc.bold('What is the name of your application?'),
					placeholder	: env.target && basename(env.target) || 'miniapp',
					validate	: validateAppName,
				}),

			profileID: async () => {				

				if (profileKeys.length > 1) {

					return p.select({

						message		: pc.bold('Which AWS Profile would you like to use?'),
						options		: env.profiles.map(i => ({ value: i.profile, label: `${i.profile} (${i.Account}) - ${i.user}` })),
						initialValue: env.profiles.at(0).profile,
					})
				}

				return profileKeys.at(0) || ''
			},

			botToken: () =>
				p.password({
					message		:`${pc.bold('Your Telegram Bot Token')} ${pc.dim('(press ENTER to skip)')}`,
					mask		: '*',
					validate	: validateBotToken(true),
				}),
		},
		{ onCancel }
	)

	const region 	= await ask_for_region(profileID, onCancel)
	const llm    	= await ask_for_model(region, onCancel)
	const profile	= profilesMap[profileID]

	let botInfo = null

	if (botToken) {

		const s = p.spinner()
		s.start('Verifying bot token')

		try {

			botInfo = await verifyBotToken(botToken)
			s.stop(`Bot verified: ${pc.cyan('@' + botInfo.username)} (${botInfo.first_name})`)
		}

		catch (error) {

			s.stop(pc.red('Invalid bot token'))
			p.log.error('Could not verify the bot token. Please check and try again.')
			process.exit(1)
		}
	}

    return {

		appName, region,
		botToken, botInfo, llm,
		user  		: profile?.user			|| '',
		profile		: profile?.profile		|| '',
		accountId	: profile?.AccountId	|| '',
		accountName : profile?.AccountName	|| '',
	}
}





async function ask_for_region(profile, onCancel) {

	const regions = getRegions()
	const padCode = Math.max(... regions.map(i => i.code.length))
	const options = regions.map(i => ({

		value	: i.code,
		label	:`${pc.bold(i.code.padEnd(padCode))}: ${i.name}`
	}))

	const region = await p.select({

		message		: pc.bold('Which AWS Region would you like to deploy to?'),
		options		: options,
		initialValue: await getDefaultRegion(profile)
	})

	if (p.isCancel(region)) {

		await onCancel()
	}

	return region
}





async function ask_for_model(region, onCancel) {

	const models 	= getModels(region)
    const chartTag	=`<*CHART*>-${crypto.randomUUID()}`

	if (models && models.length > 0) {

		const padName 		= Math.max(...models.map(i => i.modelName.length)) + 1
		const padProvider 	= Math.max(...models.map(i => i.providerName.length)) + 3
		const modelOptions 	= models.map(m => ({
			value	: m.tag,
			label	:`${m.modelName.padEnd(padName)} ${pc.italic(`(${m.providerName})`.padEnd(padProvider))} ${pc.green(m.inputModalities.join(', '))}`,
		}))

		let options = isPossibleToBuildChart(models)
			? [...modelOptions, { value: chartTag, label: `${pc.greenBright(pc.bold('➤ '))} Show me price comparison between those models` }]
			: modelOptions

		while (true) {

			const llm = await p.select({

				message		: pc.bold(`What Large Language Model would you like to use in your application? ${pc.dim(pc.italic('(you can change this later in your code at any time)'))}`),
				options		: options,
				initialValue: DEFAULT_MODEL,
			})

			if (p.isCancel(llm)) {

				await onCancel()
			}
			else if (llm === chartTag) {

				printModelChart(models)
				options = modelOptions
			}
			else {

				return llm
			}
		}
	}

    return ""
}