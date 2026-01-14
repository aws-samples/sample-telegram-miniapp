import type { Context   } from "grammy"
import type { Update    } from "grammy/types"
import type { FileFlavor} from "@grammyjs/files"
import { Composer       } from "grammy"
import { invokeLLM      } from "./ai"

const MAX_PROMPT_LENGTH = 4*1024
const MAX_IMAGE_SIZE    = 5*1024*1024





export async function supportedUpdates(): Promise<Array<Exclude<keyof Update, 'update_id'>>> {

    // https://core.telegram.org/bots/api#setwebhook
    //
    // A list of the update types you want your bot to receive.
    // For example, specify ["message", "edited_channel_post", "callback_query"] to only receive updates of these types.    
    // Specify an empty list [] to receive all update types except chat_member, message_reaction, and message_reaction_count (default).
    // Please note that this parameter doesn't affect updates created before the call to the setWebhook,
    // so unwanted updates may be received for a short period of time.    

    // Here's the full list of update types:
    // as of December 2025 (please consult Telegram API docs for updated information)
    //
    // return [
    //     "message",
    //     "edited_message",
    //     "channel_post",
    //     "edited_channel_post",
    //     "business_connection",
    //     "business_message",
    //     "edited_business_message",
    //     "deleted_business_messages",
    //     "message_reaction",
    //     "message_reaction_count",
    //     "inline_query",
    //     "chosen_inline_result",
    //     "callback_query",
    //     "shipping_query",
    //     "pre_checkout_query",
    //     "poll",
    //     "poll_answer",
    //     "my_chat_member",
    //     "chat_member",
    //     "chat_join_request",
    //     "chat_boost",
    //     "removed_chat_boost"
    // ]

    return [

        "message",
        "edited_message",
        "message_reaction",
        "business_connection",
        "business_message",
        "edited_business_message",
    ]
}





export function middleware(guardrail?: { id: string, version?: string }) {

    const mw = new Composer<FileFlavor<Context>>()

    mw.use()

    mw.command('start', ctx =>

        ctx.reply('Hi!')
    )

    mw.on([':text', ':photo'], async ctx => {

        const prompt = ctx.update.message?.text || ctx.update.edited_message?.text || ""
        const jpeg   = await loadImage(ctx)

        if (prompt || jpeg) {

            if (prompt && prompt.length > MAX_PROMPT_LENGTH) {

                return ctx.reply("I appologize, but the length of the text you've sent me is too much for me. Could you make it shorter for me, please?")
            }

            if (jpeg && jpeg.byteLength > MAX_IMAGE_SIZE) {

                return ctx.reply("I appologize, but the image you've sent me is too large for me. Could you please send me smaller version of the image, please?")
            }

            const answer = await invokeLLM({ prompt, guardrail, jpeg }) || "Oops, something went wrong"

            return ctx
                .reply(answer, { parse_mode: "MarkdownV2" })
                .catch(() => ctx.reply(answer))
        }
    })

    return mw
}





async function loadImage(ctx: FileFlavor<Context>) {

    try {

        if (ctx.update.message?.photo || ctx.update.edited_message?.photo) {

            const file = await ctx.getFile()

            if (file
                && file.file_size
                && file.file_size > 0
                && file.file_size <= MAX_IMAGE_SIZE
                && typeof file.getUrl === 'function') {

                const url = file.getUrl()

                if (url) {

                    const resp  = await fetch(url)
                    const img   = await resp.arrayBuffer()
                    return Buffer.from(img)
                }
            }
        }
    }

    catch (err) {

        console.error(err)
    }

    return undefined
}