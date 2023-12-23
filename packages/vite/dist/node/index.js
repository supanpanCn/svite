import { resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { isPackageExists, resolveModule } from 'local-pkg';
import { pathToFileURL } from 'node:url';

const DEFAULT_CONFIG_FILES = ["svite.config.ts"];

const builtins = new Set([
    ...builtinModules,
    "assert/strict",
    "diagnostics_channel",
    "dns/promises",
    "fs/promises",
    "path/posix",
    "path/win32",
    "readline/promises",
    "stream/consumers",
    "stream/promises",
    "stream/web",
    "timers/promises",
    "util/types",
    "wasi",
]);
const NODE_BUILTIN_NAMESPACE = 'node:';
function isBuiltin(id) {
    return builtins.has(id.startsWith(NODE_BUILTIN_NAMESPACE)
        ? id.slice(NODE_BUILTIN_NAMESPACE.length)
        : id);
}

async function analizePathValue(id) {
    if (isPackageExists(id)) {
        const fileUrl = resolveModule(id);
        if (fileUrl) {
            return pathToFileURL(fileUrl).href;
        }
    }
    return "";
}
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
        plugins: [
            {
                name: "externalize-deps",
                setup(build) {
                    build.onResolve({ filter: /^[^.].*/ }, async ({ path: id, importer, kind }) => {
                        if (kind === "entry-point" || isAbsolute(id) || isBuiltin(id)) {
                            return null;
                        }
                        return {
                            path: await analizePathValue(id),
                            external: true,
                        };
                    });
                },
            },
        ],
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
