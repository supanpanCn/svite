import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const DEFAULT_CONFIG_FILES = ["svite.config.ts"];

async function buildBoundle(fileName) {
    const result = await build({
        absWorkingDir: process.cwd(),
        entryPoints: [fileName],
        outfile: "out.js",
        write: false,
        target: ["node14.18", "node16"],
        platform: "node",
        bundle: true,
        format: "esm",
        mainFields: ["main"],
        sourcemap: "inline",
        metafile: false,
    });
    const { text } = result.outputFiles[0];
    return text;
}
async function loadConfigFromBoundled(code, resolvedPath) {
    const dynamicImport = new Function("file", "return import(file)");
    const configTimestamp = `${resolvedPath}.timestamp:${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    return (await dynamicImport("data:text/javascript;base64," +
        Buffer.from(`${code}\n//${configTimestamp}`).toString("base64"))).default;
}
function defineConfig(config) {
    return config;
}
async function parseConfigFile(conf) {
    let resolvedPath;
    for (const filename of DEFAULT_CONFIG_FILES) {
        const filePath = resolve(process.cwd(), filename);
        if (!existsSync(filePath))
            continue;
        resolvedPath = filePath;
        break;
    }
    if (resolvedPath) {
        const boundleCode = await buildBoundle(resolvedPath);
        const userConfigFile = await loadConfigFromBoundled(boundleCode, resolvedPath);
        return typeof userConfigFile === "function"
            ? userConfigFile(conf)
            : userConfigFile;
    }
    return {};
}
async function resolveConfig(userConf) {
    const internalConf = {};
    const conf = {
        ...userConf,
        ...internalConf,
    };
    const userConfig = await parseConfigFile(conf);
    return {
        ...conf,
        ...userConfig,
    };
}

export { defineConfig, parseConfigFile, resolveConfig };
//# sourceMappingURL=index.js.map
