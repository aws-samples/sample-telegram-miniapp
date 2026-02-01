import { defineConfig } from "tsup"

export default defineConfig({
    entry           : {
        "browser": "src/browser.ts",
        "server": "src/server.ts"
    },
    format          : ["esm"],
    dts             : true,
    clean           : true,
    bundle          : true,
    splitting       : false,
    sourcemap       : true,
    target          : "es2022",
    outDir          : "dist",
    treeshake       : true,
    minify          : true,
    minifyWhitespace: true,
})
