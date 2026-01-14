import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [

    index("routes/home.tsx"),
    route("/session", "routes/session.tsx"),
    route("/bot", "routes/bot.tsx"),
    route("/ok", "routes/healthcheck.tsx"),
    route("/.well-known/appspecific/com.chrome.devtools.json", "routes/devtools.tsx")

] satisfies RouteConfig;