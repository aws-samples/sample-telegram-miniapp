import type { LaunchParams          } from "@tma.js/types"
import type { Session, AuthRequest  } from "@core/session-types"
import      { sha256                } from "@core/tools"





export async function sendAuthRequest<SESSION = Session>
    (url: string|URL, authData: string, webapp: LaunchParams)
    :Promise<SESSION|undefined> {

    const data = new TextEncoder().encode(JSON.stringify({

        authData    : authData,
        expectedUser: webapp?.tgWebAppData?.user?.id || 0,
        initData    : { start_param : webapp?.tgWebAppData?.start_param }

    } satisfies AuthRequest))

    const hash = await sha256(data)

    const resp = await fetch(url, {

        method  :'POST',
        body    : data,
        headers : {
            'Content-Type'                  :'application/json',
            'Content-Length'                : data.byteLength.toFixed(),
            'X-Amz-Content-SHA256'          : hash
        }
    })

    if (resp && resp.ok) {

        return await resp.json() as SESSION
    }

    return undefined
}