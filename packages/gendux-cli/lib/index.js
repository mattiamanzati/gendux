#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var ts = require("typescript");
function getGenduxConfig(packageJsonPath) {
    // try to read the file
    try {
        // read it
        var fileContent = fs.readFileSync(packageJsonPath);
        var rawSchema = JSON.parse(fileContent.toString("utf8"));
        // parse
        var _a = (rawSchema || {}).gendux, gendux = _a === void 0 ? {} : _a;
        var _b = gendux, _c = _b.models, models_1 = _c === void 0 ? {} : _c, _d = _b.actions, actions_1 = _d === void 0 ? {} : _d;
        // cleanup items with defaults
        var newModels = Object.keys(models_1)
            .map(function (key) {
            var _a = models_1[key] || {}, _b = _a.path, path = _b === void 0 ? "" : _b, _c = _a.singleton, singleton = _c === void 0 ? false : _c;
            return _d = {}, _d[key] = { path: path, singleton: singleton }, _d;
            var _d;
        })
            .reduce(function (agg, item) { return Object.assign({}, agg, item); }, {});
        var newActions = Object.keys(actions_1)
            .map(function (key) {
            var _a = (actions_1[key] || {}).path, path = _a === void 0 ? "" : _a;
            return _b = {}, _b[key] = { path: path }, _b;
            var _b;
        })
            .reduce(function (agg, item) { return Object.assign({}, agg, item); }, {});
        return { models: newModels, actions: newActions };
    }
    catch (e) {
        throw "Error while getting gendux config from " + packageJsonPath;
    }
}
function getPackageName(packageJsonPath) {
    // try to read the file
    try {
        // read it
        var fileContent = fs.readFileSync(packageJsonPath);
        return JSON.parse(fileContent.toString("utf8")).name;
    }
    catch (e) {
        throw "Error while getting package name from " + packageJsonPath;
    }
}
function generateEntryFile(packageJsonPath) {
    // read the config
    var schema = getGenduxConfig(packageJsonPath);
    var moduleName = getPackageName(packageJsonPath);
    var dir = path.parse(packageJsonPath).dir;
    var entryFilePath = dir + "/src/index.ts";
    // export the actions
    var actionsExport = Object.keys(schema.actions)
        .map(function (actionName) {
        var actionPath = schema.actions[actionName].path;
        return "\n                export {default as " + actionName + "} from " + JSON.stringify(actionPath) + "\n                import {default as " + actionName + "} from " + JSON.stringify(actionPath);
    })
        .join("\n");
    var actionsRegister = Object.keys(schema.actions)
        .map(function (actionName) {
        return "\n                packet.action(" + JSON.stringify(actionName) + ", " + actionName + ")";
    })
        .join("\n");
    var entrySource = "\n    import {packet} from \"gendux\"\n    " + actionsExport + "\n    \n    export default packet(" + JSON.stringify(moduleName) + ", packet => {\n        " + actionsRegister + "\n    })\n\n    ";
    console.log("Writing the entry file...");
    fs.writeFileSync(entryFilePath, entrySource);
}
function watch(rootFileNames, options) {
    var files = {};
    // initialize the list of files
    rootFileNames.forEach(function (fileName) {
        files[fileName] = { version: 0 };
    });
    // Create the language service host to allow the LS to communicate with the host
    var servicesHost = {
        getScriptFileNames: function () { return rootFileNames; },
        getScriptVersion: function (fileName) { return files[fileName] && files[fileName].version.toString(); },
        getScriptSnapshot: function (fileName) {
            if (!fs.existsSync(fileName)) {
                return undefined;
            }
            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
        },
        getCurrentDirectory: function () { return process.cwd(); },
        getCompilationSettings: function () { return options; },
        getDefaultLibFileName: function (options) { return ts.getDefaultLibFilePath(options); },
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory
    };
    // Create the language service files
    var services = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
    // Now let's watch the files
    rootFileNames.forEach(function (fileName) {
        // First time around, emit all files
        emitFile(fileName);
        // Add a watch on the file to handle next change
        fs.watchFile(fileName, { persistent: true, interval: 250 }, function (curr, prev) {
            // Check timestamp
            if (+curr.mtime <= +prev.mtime) {
                return;
            }
            // Update the version to signal a change in the file
            files[fileName].version++;
            // write the changes to disk
            emitFile(fileName);
        });
    });
    function emitFile(fileName) {
        var output = services.getEmitOutput(fileName);
        if (!output.emitSkipped) {
            console.log("Emitting " + fileName);
        }
        else {
            console.log("Emitting " + fileName + " failed");
            logErrors(fileName);
        }
        output.outputFiles.forEach(function (o) {
            fs.writeFileSync(o.name, o.text, "utf8");
        });
    }
    function logErrors(fileName) {
        var allDiagnostics = services
            .getCompilerOptionsDiagnostics()
            .concat(services.getSyntacticDiagnostics(fileName))
            .concat(services.getSemanticDiagnostics(fileName));
        allDiagnostics.forEach(function (diagnostic) {
            var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            if (diagnostic.file) {
                var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                console.log("  Error " + diagnostic.file.fileName + " (" + (line + 1) + "," + (character + 1) + "): " + message);
            }
            else {
                console.log("  Error: " + message);
            }
        });
    }
}
// Initialize files constituting the program as all .ts files in the current directory
var currentDirectoryFiles = fs
    .readdirSync(process.cwd())
    .filter(function (fileName) { return fileName.length >= 3 && fileName.substr(fileName.length - 3, 3) === ".ts"; });
// Start the watcher
watch(currentDirectoryFiles, { module: ts.ModuleKind.CommonJS });
// get the current directory
var cwd = process.cwd();
// get the package file path
var packageJsonPath = path.resolve(cwd, "package.json");
// does the package.json exists?
if (!fs.existsSync(packageJsonPath)) {
    throw "Could not find any JSON file at " + packageJsonPath;
}
// Add a watch on the file to handle next change
fs.watchFile(packageJsonPath, { persistent: true, interval: 250 }, function (curr, prev) {
    generateEntryFile(packageJsonPath);
});
generateEntryFile(packageJsonPath);
//# sourceMappingURL=index.js.map