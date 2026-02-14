import { defineConfig } from "vite";
import { reactRouter  } from "@react-router/dev/vite";
import $                from "@core/constants"
import tailwindcss      from "@tailwindcss/vite";
import tsconfigPaths    from "vite-tsconfig-paths";

export default defineConfig({
    base: $.artifacts.lambda.gui.basepath || '/',
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
        open: $.artifacts.lambda.gui.basepath,
        allowedHosts: [ $.session.cookie.domain ]
    }
})