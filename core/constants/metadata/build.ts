import { fileURLToPath      } from "node:url"
import { existsSync,
          readFileSync,
          writeFileSync     } from "node:fs"
import * as path              from "node:path"
import * as yaml              from "yaml"
import      bedrock           from "./bedrock.json" with { type: "json" }

const inputFile     = "app.yaml"
const outputFile    = "metadata/app.config.json"
const config        = findRootFolder(inputFile)





if (config) {

    writeFileSync(outputFile, JSON.stringify(config), { encoding: "utf8" })
}

function findRootFolder(fileName: string) {

    let dir = typeof __dirname === 'undefined'
        ? path.dirname(fileURLToPath(import.meta.url))
        : __dirname

    while (true) {

        const filePath = path.join(dir, fileName);

        if (existsSync(filePath)) {

            const data = readFileSync(filePath, { encoding: 'utf8' })

            const models = Object
                .values(bedrock.regions)
                .map(i => Object.values(i.models))
                .flat()
                .reduce(
                    (acc, m) => Object.assign(acc, {[m.region]: Object.assign(acc[m.region]||{}, {[m.tag]: m.endpoint})}),
                    {} as Record<string, {}>
                )

            return Object.assign(
                yaml.parse(data),
                { root: dir },
                { $bedrock_endpoints: models }
            )
        }

        const parentDir = path.dirname(dir)

        if (parentDir === dir) {

            throw new Error(`Failure to identify project root where ${fileName} file should be stored.`)
        }

        dir = parentDir
    }
}