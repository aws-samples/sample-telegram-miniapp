import {
    type ImageBlock,
    BedrockRuntimeClient,
    ConversationRole,
    ConverseCommand         } from "@aws-sdk/client-bedrock-runtime"
import { Logger             } from "@aws-lambda-powertools/logger"
import   $                    from "@core/constants"

const client    = new BedrockRuntimeClient({ region: $.aws.bedrock.region })
const log       = new Logger({ serviceName: 'telegram-bot-ai-bedrock' })





export interface InvokeProps {

    prompt      : string
    jpeg       ?: Uint8Array
    guardrail  ?: { id: string,  version?: string }
}

export async function invokeLLM({ prompt, jpeg, guardrail }: InvokeProps) {

    const message = {

        role    : ConversationRole.USER,
        content : jpeg
            ? [ { image: { format: 'jpeg', source: { bytes: jpeg } } as ImageBlock }, { text: prompt } ]
            : [ { text: prompt } ]
    }

    const request = {

        modelId : $.aws.bedrock.model,
        messages: [message],
        inferenceConfig : {
            maxTokens   : $.aws.bedrock.max_tokens,
            topP        : $.aws.bedrock.top_p,
        },
        ...(guardrail && {
            guardrailConfig : {
                guardrailIdentifier : guardrail.id,
                guardrailVersion    : guardrail.version || 'DRAFT'
            }
        })
    }

    const cmd = new ConverseCommand(request)

    try {

        const response = await client.send(cmd)
        log.info('Inference', { settings: $.aws.bedrock, response })

        if (response.stopReason === "guardrail_intervened") {

            log.warn('Guardrail intervened', { trace: response.trace })
        }

        return response.output?.message?.content?.map(i => i.text).join("\n")
    }

    catch (error) {

        log.error('Inference', { settings: $.aws.bedrock, error })
    }
}