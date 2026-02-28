import type { Config } from "@react-router/dev/config";
import $                from "@core/constants"

export default {

    ssr             : true,
    basename        : $.artifacts.lambda.gui.basepath || '/',
    prerender       : ["/"],
    routeDiscovery  : {
        // "initial" embeds all routes in the HTML — no __manifest request needed.
        // This eliminates a Lambda call on client-side navigation and works
        // cleanly with the S3-default CloudFront setup.
        mode        : "initial"
    },
    future          : {

        v8_splitRouteModules: "enforce"
    }

} satisfies Config;