import { promisify } from 'node:util'
import fs 	from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'





/**
 * @param {string} root
 * @param {{ region: string, appName: string, botToken: string, llm: string, accountId: string }} config
 * @param {logFile} string
 */
export async function updateAppYaml(root, config, logFile) {

	const {
		aws			= '',
		git			= '',
		pnpm		= '',
		appName		= '',
		target		= '',
		region		= '',
		llm			= '',
		branch		= '',
		user		= '',
		profile		= '',
		accountId	= '',
		accountName	= '',
		workshop	= '',
	} = config

	const appYamlPath = path.join(root, 'app.yaml');

	const doc = fs.existsSync(appYamlPath)
		? YAML.parseDocument(await promisify(fs.readFile)(appYamlPath, 'utf-8'))
		: new YAML.Document({})
	;[
		['app.name'		, appName	],
		['aws.region'	, region	],
		['aws.account'	, accountId	],
		['bedrock.model', llm		],
		...(workshop && typeof workshop === 'string' ? [['app.workshop', workshop]] : []),

	].forEach(

		([t, value]) => {

			const sections	= t.split('.').slice(0, -1)
			const key		= t.split('.').at(-1)
			const node		= sections.reduce((node, i) => node.get(i) || node.set(i, new YAML.YAMLMap()).get(i), doc)

			node.set(key, value)
		}
	)

	if (logFile) {

		fs.writeFileSync(
			logFile,
			['\n', new Date().toISOString(),
				'Commiting user answers:',
				`aws			: "${aws}"`,
				`git			: "${git}"`,
				`pnpm		: "${pnpm}"`,
				`appName		: "${appName}"`,
				`target		: "${target}"`,
				`region		: "${region}"`,
				`llm			: "${llm}"`,
				`branch		: "${branch}"`,
				`user		: "${user}"`,
				`profile		: "${profile}"`,
				`accountId	: "${accountId}"`,
				`accountName	: "${accountName}"`,
				`workshop	: "${workshop}"`,
			 ].join('\n'),
			{ flag: 'a', encoding: 'utf-8' }
		)
	}

	fs.writeFileSync(appYamlPath, doc.toString(), 'utf-8')

	return true
}