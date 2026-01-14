import metadata from './bedrock-metadata.json' with { type: "json" }
import { exec 			} from './exec.js'
import { safeProfile 	} from './helpers.js'
export const DEFAULT_REGION ='us-east-1'
export const DEFAULT_MODEL  ='nova-lite'





export async function getDefaultRegion(profile) {	

	const result 	= await exec(['aws', 'configure', 'get', 'region', '--profile', safeProfile(profile)], { json: false, timeout: 5000 })
	const candidate = result.ok && typeof result.stdout === 'string' && result.stdout.split('\n').map(i => i.trim()).find(i => !!i) || undefined
	const supported = getRegions().map(i => i.code)
	return [candidate, DEFAULT_REGION].find(i => i && supported.includes(i)) || DEFAULT_REGION
}

export function getRegions() {

	return Object
		.values(metadata.regions)
		.filter(region => Object.keys(metadata.targetModels).every(tag => region.models[tag]))
}

export function getModels(regionCode = DEFAULT_REGION) {

	const region = metadata.regions[regionCode]

	if (region) {

		return Object
			.values(region.models)
			.sort((a, b) => a.cost.input - b.cost.input)
	}

	return null
}