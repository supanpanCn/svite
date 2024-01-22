import { type ResolvedConfig } from "../config";
import esbuild, { type BuildContext, type Plugin } from "esbuild";
import { formatPath, getHash, safeRename, isWindows } from "../utils";
import { resolve, relative, join } from "node:path";
import { mkdirSync, writeFileSync, existsSync, renameSync, rm } from "node:fs";
import { initDepsOptimizerMetadata, flattenId } from "./index";
import {
  ESBUILD_MODULES_TARGET,
  allExternalTypes,
  jsExtensionRE,
  jsMapExtensionRE,
} from "../constants";
import { processMetaData } from "./index";
import fsp from "node:fs/promises";

export type ExportsData = {
  hasImports: boolean;
  exports: readonly string[];
};

// TODO：开发到css相关的处理时，移动过去
export const CSS_LANGS_RE =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;

export const isCSSRequest = (request: string): boolean =>
  CSS_LANGS_RE.test(request);

export const isModuleCSSRequest = (request: string): boolean =>
  cssModuleRE.test(request);
const cssModuleRE = new RegExp(`\\.module${CSS_LANGS_RE.source}`);

const externalWithConversionNamespace =
  "svite:dep-pre-bundle:external-conversion";
const convertedExternalPrefix = "svite-dep-pre-bundle-external:";

export function getDepsCacheDir(config: ResolvedConfig, isTemp?: boolean): string {
  let base = formatPath(resolve(config.cacheDir!, ".deps"));
  if (isTemp) {
    base +=
      "_temp_" +
      getHash(
        `${process.pid}:${Date.now().toString()}:${Math.random()
          .toString(16)
          .slice(2)}`
      );
  }
  return base;
}

function esbuildDepPlugin(deps: Record<string, string> = {}): Plugin {
  const _resolver = (id: string) => {
    return id;
  };
  return {
    name: "vite:dep-pre-bundle",
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(
            `\\.(` + allExternalTypes.join("|") + `)(\\?.*)?$`
          ),
        },
        async ({ path: id, importer, kind }) => {
          if (id.startsWith(convertedExternalPrefix)) {
            return {
              path: id.slice(convertedExternalPrefix.length),
              external: true,
            };
          }
          const resolved = _resolver(id);
          if (resolved) {
            if (kind === "require-call") {
              return {
                path: resolved,
                namespace: externalWithConversionNamespace,
              };
            }
            return {
              path: resolved,
              external: true,
            };
          }
        }
      );
      build.onLoad(
        { filter: /./, namespace: externalWithConversionNamespace },
        (args) => {
          const modulePath = `"${convertedExternalPrefix}${args.path}"`;
          return {
            contents:
              isCSSRequest(args.path) && !isModuleCSSRequest(args.path)
                ? `import ${modulePath};`
                : `export { default } from ${modulePath};` +
                  `export * from ${modulePath};`,
            loader: "js",
          };
        }
      );
      build.onResolve(
        { filter: /^[\w@][^:]/ },
        async ({ path: id, importer, kind }) => {
          if (deps[id]) {
            return {
              path: deps[id],
            };
          }

          const resolved = _resolver(id);
          if (resolved) {
            return {
              path: resolved,
            };
          }
        }
      );
    },
  };
}

async function prepareEsbuildOptimizerRun(
  config: ResolvedConfig,
  deps: Record<string, string>,
  processingCacheDir: string
): Promise<{
  context?: BuildContext;
}> {
  const flatIdDeps: Record<string, string> = {};
  Object.keys(deps).map(async (id) => {
    const src = deps[id]!;
    const flatId = flattenId(id);
    flatIdDeps[flatId] = src;
  });

  const context = await esbuild.context({
    absWorkingDir: process.cwd(),
    entryPoints: Object.keys(flatIdDeps),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: ESBUILD_MODULES_TARGET,
    logLevel: "error",
    splitting: true,
    sourcemap: true,
    outdir: processingCacheDir,
    ignoreAnnotations: true,
    metafile: true,
    plugins: [esbuildDepPlugin(flatIdDeps)],
    charset: "utf8",
    supported: {
      "dynamic-import": true,
      "import-meta": true,
    },
  });
  return {
    context,
  };
}

export async function preBoundle(
  config: ResolvedConfig,
  deps: Record<string, string>
) {
  const depsCacheDir = getDepsCacheDir(config);
  const processingCacheDir = getDepsCacheDir(config, true);
  mkdirSync(processingCacheDir, { recursive: true });
  writeFileSync(
    resolve(processingCacheDir, "package.json"),
    `{\n  "type": "module"\n}\n`
  );
  const metadata = initDepsOptimizerMetadata(config);
  const preparedRun = prepareEsbuildOptimizerRun(
    config,
    deps,
    processingCacheDir
  );

  return preparedRun.then(({ context }) => {
    return context!.rebuild().then(async (result) => {
      const processingCacheDirOutputPath = relative(
        process.cwd(),
        processingCacheDir
      );
      const meta = result.metafile!;
      for (const id in deps) {
        processMetaData(metadata, "optimized", {
          [`${id}`]: deps[id],
        });
      }

      for (const o of Object.keys(meta.outputs)) {
        if (!o.match(jsMapExtensionRE)) {
          const id = relative(processingCacheDirOutputPath, o).replace(
            jsExtensionRE,
            ""
          );
          processMetaData(metadata, "chunks", {
            id,
          });
        }
      }

      const dataPath = join(processingCacheDir, "_metadata.json");
      writeFileSync(dataPath, JSON.stringify(metadata, null, 2));

      const temporalPath = getDepsCacheDir(config, true);
      const depsCacheDirPresent = existsSync(depsCacheDir);
      if (isWindows) {
        if (depsCacheDirPresent) await safeRename(depsCacheDir, temporalPath);
        await safeRename(processingCacheDir, depsCacheDir);
      } else {
        if (depsCacheDirPresent) renameSync(depsCacheDir, temporalPath);
        renameSync(processingCacheDir, depsCacheDir);
      }
      if (depsCacheDirPresent)
        fsp.rm(temporalPath, { recursive: true, force: true });
    });
  });
}
