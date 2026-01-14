import * as p from '@clack/prompts'
import pc from 'picocolors'





/**
 * 
 * @param {Array<{ modelName: string, cost: { input: number, output: number } }>} models 
 * @returns {void}
 */
export function printModelChart(models) {

	if (!isPossibleToBuildChart(models)) {

		return
	}

	const data = models.map(m => ({

		name		: m.modelName,
		input		: m.cost.input,
		output		: m.cost.output,
		scale		: 0,
		scaleInput	: 0,
		scaleOutput	: 0,
		scaleText	:'',

	})).sort((a, b) => a.input - b.input)

	const base		= data.find(i => i.input > 0 && i.output > 0)
	const padName  	= Math.max(...data.map(m => m.name.length))
	const padInput	= Math.max(...data.map(m => formatPrice(m.input).length), "input".length) + 1
	const padOutput = Math.max(...data.map(m => formatPrice(m.output).length), "output".length) + 1 

	data.forEach(m => {

		m.scaleInput = m.input / base.input
		m.scaleOutput = m.output / base.output
		m.scale		 = 0.5*(m.scaleInput + m.scaleOutput)
		m.scaleText  = formatRange(m.scaleInput, m.scaleOutput)
	})

	const maxScale 	= Math.max(...data.map(m => m.scale))
	const padScale 	= Math.max(...data.map(m => m.scaleText.length), base.name.length)
	const padBars  	= 60 - padName - padScale - 3
	const text		= data.map(m => [
		pc.cyanBright(m.name.padEnd(padName)),
		pc.dim(formatPrice(m.input).padStart(padInput)),
		pc.cyan(formatPrice(m.output).padStart(padOutput)),
		pc.cyan(bars(m.scale, maxScale, padBars)),
		pc.dim(m.scaleText.padStart(padScale))
	].join(' '))

	const header = [

		''.padEnd(padName),
		pc.italic('input'.padStart(padInput)),
		pc.italic(pc.cyan('output'.padStart(padOutput))),
		''.padEnd(padBars-3),
		pc.italic(`vs ${base.name}`.padStart(padScale))

	].join(' ')

	const disclaimer = [
		'',
		 pc.bold(pc.yellowBright('* DISCLAIMER')),
		'The cost information is approximate and may be obsolete.',
		'The cost information is provided here solely for the purpose of rough,',
		'approximate and relative comparison of provided Large Language Models.',
		'Please always consult with current pricing at the official AWS Bedrock pricing page:',
		'',
		 pc.cyanBright(pc.underline('https://aws.amazon.com/bedrock/pricing/'))
	]

	p.note(

		[header, ...text, ...disclaimer].join('\n'),
		pc.bold(pc.cyanBright(` Approximate inference cost per 1 million tokens * `))
	)

	function bars(value, maxValue, width = 40) {

		const filled = Math.round((value / maxValue) * width)

		if (filled === 0 && value > 0) {

			return '▌' + '░'.repeat(width - 1)
		}

		return '█'.repeat(filled) + '░'.repeat(width - filled)
	}

	function formatPrice(price) {

		return price < 1 ? `$${price.toFixed(3)}` : `$${price.toFixed(2)}`
	}

	function formatRange(...values) {

		const  minV = Math.ceil(Math.min(...values))
		const  maxV = Math.ceil(Math.max(...values))
		return minV === maxV ? `${minV}x` : `${minV}x-${maxV}x`
	}
}



/**
 * 
 * @param {Array<{ modelName: string, cost: { input: number, output: number } }>} models 
 * @returns {boolean}
 */
export function isPossibleToBuildChart(models) {

	return models
		&& Array.isArray(models)
		&& models.length > 1
		&& models.every(i => i.cost
			&& typeof i.cost.input === 'number'
			&& typeof i.cost.output === 'number'
			&& !isNaN(i.cost.input)
			&& !isNaN(i.cost.output)
		)
}