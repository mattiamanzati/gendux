#! /usr/bin/env node
import * as fs from "fs"
import * as path from "path"
import * as ts from "typescript"

type IGenduxModelConfig = {
    path: string
    singleton: boolean
}

type IGenduxActionConfig = {
    path: string
}

type IGenduxConfig = {
    models: { [K: string]: IGenduxModelConfig }
    actions: { [K: string]: IGenduxActionConfig }
}

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> }

function getGenduxConfig(packageJsonPath: string): IGenduxConfig {
    // try to read the file
    try {
        // read it
        const fileContent = fs.readFileSync(packageJsonPath)
        const rawSchema: DeepPartial<{ gendux: IGenduxConfig }> = JSON.parse(
            fileContent.toString("utf8")
        )

        // parse
        const { gendux = {} } = rawSchema || {}
        const { models = {}, actions = {} } = gendux as DeepPartial<IGenduxConfig>

        // cleanup items with defaults
        const newModels = Object.keys(models)
            .map(key => {
                const { path = "", singleton = false } = models[key] || {}
                return { [key]: { path, singleton } }
            })
            .reduce((agg, item) => Object.assign({}, agg, item), {} as {
                [K: string]: IGenduxModelConfig
            })

        const newActions = Object.keys(actions)
            .map(key => {
                const { path = "" } = actions[key] || {}
                return { [key]: { path } }
            })
            .reduce((agg, item) => Object.assign({}, agg, item), {} as {
                [K: string]: IGenduxActionConfig
            })

        return { models: newModels, actions: newActions }
    } catch (e) {
        throw `Error while getting gendux config from ${packageJsonPath}`
    }
}

function getPackageName(packageJsonPath: string): string {
    // try to read the file
    try {
        // read it
        const fileContent = fs.readFileSync(packageJsonPath)
        return JSON.parse(fileContent.toString("utf8")).name
    } catch (e) {
        throw `Error while getting package name from ${packageJsonPath}`
    }
}

function generateEntryFile(packageJsonPath: string) {
    // read the config
    const schema = getGenduxConfig(packageJsonPath)
    const moduleName = getPackageName(packageJsonPath)
    const { dir } = path.parse(packageJsonPath)
    const entryFilePath = dir + "/src/index.ts"

    // export the actions
    const actionsExport = Object.keys(schema.actions)
        .map(actionName => {
            const actionPath = schema.actions[actionName].path
            return `
                export {default as ${actionName}} from ${JSON.stringify(actionPath)}
                import {default as ${actionName}} from ${JSON.stringify(actionPath)}`
        })
        .join("\n")

    const actionsRegister = Object.keys(schema.actions)
        .map(actionName => {
            return `
                packet.action(${JSON.stringify(actionName)}, ${actionName})`
        })
        .join("\n")

    const entrySource = `
    import {packet} from "gendux"
    ${actionsExport}
    
    export default packet(${JSON.stringify(moduleName)}, packet => {
        ${actionsRegister}
    })

    `

    console.log(`Writing the entry file...`)
    fs.writeFileSync(entryFilePath, entrySource)
}

function watch(rootFileNames: string[], options: ts.CompilerOptions) {
    const files: ts.MapLike<{ version: number }> = {}

    // initialize the list of files
    rootFileNames.forEach(fileName => {
        files[fileName] = { version: 0 }
    })

    // Create the language service host to allow the LS to communicate with the host
    const servicesHost: ts.LanguageServiceHost = {
        getScriptFileNames: () => rootFileNames,
        getScriptVersion: fileName => files[fileName] && files[fileName].version.toString(),
        getScriptSnapshot: fileName => {
            if (!fs.existsSync(fileName)) {
                return undefined
            }

            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString())
        },
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => options,
        getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory
    }

    // Create the language service files
    const services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry())

    // Now let's watch the files
    rootFileNames.forEach(fileName => {
        // First time around, emit all files
        emitFile(fileName)

        // Add a watch on the file to handle next change
        fs.watchFile(fileName, { persistent: true, interval: 250 }, (curr, prev) => {
            // Check timestamp
            if (+curr.mtime <= +prev.mtime) {
                return
            }

            // Update the version to signal a change in the file
            files[fileName].version++

            // write the changes to disk
            emitFile(fileName)
        })
    })

    function emitFile(fileName: string) {
        let output = services.getEmitOutput(fileName)

        if (!output.emitSkipped) {
            console.log(`Emitting ${fileName}`)
        } else {
            console.log(`Emitting ${fileName} failed`)
            logErrors(fileName)
        }

        output.outputFiles.forEach(o => {
            fs.writeFileSync(o.name, o.text, "utf8")
        })
    }

    function logErrors(fileName: string) {
        let allDiagnostics = services
            .getCompilerOptionsDiagnostics()
            .concat(services.getSyntacticDiagnostics(fileName))
            .concat(services.getSemanticDiagnostics(fileName))

        allDiagnostics.forEach(diagnostic => {
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            if (diagnostic.file) {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
                    diagnostic.start!
                )
                console.log(
                    `  Error ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
                )
            } else {
                console.log(`  Error: ${message}`)
            }
        })
    }
}

// Initialize files constituting the program as all .ts files in the current directory
const currentDirectoryFiles = fs
    .readdirSync(process.cwd())
    .filter(fileName => fileName.length >= 3 && fileName.substr(fileName.length - 3, 3) === ".ts")

// Start the watcher
watch(currentDirectoryFiles, { module: ts.ModuleKind.CommonJS })

// get the current directory
const cwd = process.cwd()

// get the package file path
const packageJsonPath = path.resolve(cwd, "package.json")

// does the package.json exists?
if (!fs.existsSync(packageJsonPath)) {
    throw `Could not find any JSON file at ${packageJsonPath}`
}

// Add a watch on the file to handle next change
fs.watchFile(packageJsonPath, { persistent: true, interval: 250 }, (curr, prev) => {
    generateEntryFile(packageJsonPath)
})
generateEntryFile(packageJsonPath)
