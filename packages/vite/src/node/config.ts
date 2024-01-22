import type { UserConfig } from "./index";
import type { Plugin } from "./plugin";
import { resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { build } from "esbuild";
import { DEFAULT_CONFIG_FILES } from "./constants";
import { isBuiltin, asyncFlatten } from "./utils";
import { isPackageExists, resolveModule } from "local-pkg";
import { pathToFileURL } from "node:url";
import { resolvePlugins as mergePlugins } from './plugins'

export type ResolvedConfig = Readonly<Omit<UserConfig, "plugins">> & {
  plugins: readonly Plugin[];
};

export interface PluginHookUtils {
  getSortedPlugins: (hookName: keyof Plugin) => Plugin[]
  getSortedPluginHooks: <K extends keyof Plugin>(
    hookName: K,
  ) => NonNullable<Plugin[K]>[]
}

async function analizePathValue(id: string) {
  if (isPackageExists(id)) {
    const fileUrl = resolveModule(id);
    if (fileUrl) {
      return pathToFileURL(fileUrl).href;
    }
  }
  return "";
}

async function buildBoundle(fileName: string) {
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
          build.onResolve(
            { filter: /^[^.].*/ },
            async ({ path: id, importer, kind }) => {
              if (kind === "entry-point" || isAbsolute(id) || isBuiltin(id)) {
                return null;
              }
              return {
                path: await analizePathValue(id),
                external: true,
              };
            }
          );
        },
      },
    ],
  });
  const { text } = result.outputFiles[0];
  return text;
}

async function loadConfigFromBoundled(code: string, resolvedPath: string) {
  const dynamicImport = new Function("file", "return import(file)");
  const configTimestamp = `${resolvedPath}.timestamp:${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
  return (
    await dynamicImport(
      "data:text/javascript;base64," +
        Buffer.from(`${code}\n//${configTimestamp}`).toString("base64")
    )
  ).default;
}

async function resolvePlugins(userPlugins: Plugin[]) {
  const formattedPlugins = await asyncFlatten<Plugin>(userPlugins);
  const [prePlugins, normalPlugins, postPlugins] =
    sortUserPlugins(formattedPlugins);
  return await mergePlugins(prePlugins,normalPlugins,postPlugins)

}

export function sortUserPlugins(
  plugins: (Plugin | Plugin[])[] | undefined
): [Plugin[], Plugin[], Plugin[]] {
  const prePlugins: Plugin[] = [];
  const postPlugins: Plugin[] = [];
  const normalPlugins: Plugin[] = [];

  if (plugins) {
    plugins.flat().forEach((p) => {
      if (p.enforce === "pre") prePlugins.push(p);
      else if (p.enforce === "post") postPlugins.push(p);
      else normalPlugins.push(p);
    });
  }

  return [prePlugins, normalPlugins, postPlugins];
}

export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

export async function parseConfigFile(conf: object) {
  let resolvedPath: string | undefined;
  for (const filename of DEFAULT_CONFIG_FILES) {
    const filePath = resolve(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    resolvedPath = filePath;
    break;
  }
  if (resolvedPath) {
    const boundleCode = await buildBoundle(resolvedPath);
    const userConfigFile = await loadConfigFromBoundled(
      boundleCode,
      resolvedPath
    );
    return typeof userConfigFile === "function"
      ? userConfigFile(conf)
      : userConfigFile;
  }
  return {};
}

export async function resolveConfig(userConf: UserConfig) {
  const internalConf = {};
  const conf = {
    ...userConf,
    ...internalConf,
  };
  const userConfig = await parseConfigFile(conf);
  const resolved: ResolvedConfig = {
    ...conf,
    ...userConfig,
    cacheDir:'node_modules',
    plugins: await resolvePlugins(conf.plugins || []),
  };
  return resolved;
}
