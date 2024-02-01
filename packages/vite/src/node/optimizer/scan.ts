import { type ResolvedConfig } from "../config";
import esbuild, { type BuildContext, type Plugin, type Loader } from "esbuild";
import { normalizePath, isInNodeModules,normalizePath_r } from "../utils";
import {
  scriptRE,
  dataUrlRE,
  httpUrlRE,
  commentRE,
  typeRE,
  srcRE,
} from "../constants";
import { resolve, extname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createPluginContainer } from '../server/pluginContainer'

function computeEntries(config: ResolvedConfig) {
  const _getPath = (arr: string[]) =>
    arr.map((v) => normalizePath(v, config.root!, "absolute")).filter((v) => v);
  let entries: string[] = _getPath([resolve(`${config.root}`, "index.html")]);
  const userPreBuildEntries = config.optimizeDeps?.entries || [];
  const buildEntries = config.build?.input || [];

  if (userPreBuildEntries.length) {
    entries = _getPath(userPreBuildEntries);
  } else if (buildEntries.length) {
    entries = _getPath(buildEntries);
  }
  return entries;
}

async function esbuildScanPlugin(deps: Record<string, string>,config:ResolvedConfig): Promise<Plugin> {
  const container = await createPluginContainer(config.plugins);
  const _resolver = async (id: string, importer?: string) => {
    const resolved = await container.resolveId(
      id,
      importer && normalizePath_r(importer),
      {
        scan: true,
      }
    );
    return resolved;
  };
  return {
    name: "vite:dep-scan",
    setup(build) {
      build.onResolve({ filter: httpUrlRE }, ({ path }) => ({
        path,
        external: true,
      }));
      build.onResolve({ filter: dataUrlRE }, ({ path }) => ({
        path,
        external: true,
      }));
      build.onResolve({ filter: /\.(html)$/ }, ({ path }) => {
        return {
          path: path,
          namespace: "html",
        };
      });
      build.onLoad({ filter: /\.(html)$/, namespace: "html" }, ({ path }) => {
        let code = readFileSync(path, "utf-8");
        code = code.replace(commentRE, "<!---->");
        let match: RegExpExecArray | null;
        scriptRE.lastIndex = 0;
        let js = "";
        while ((match = scriptRE.exec(code))) {
          const [, openTag] = match;
          const typeMatch = openTag.match(typeRE);
          const type =
            typeMatch && (typeMatch[1] || typeMatch[2] || typeMatch[3]);
          if (type !== "module") {
            continue;
          }
          if (
            type &&
            !(
              type.includes("javascript") ||
              type.includes("ecmascript") ||
              type === "module"
            )
          ) {
            continue;
          }
          const srcMatch = openTag.match(srcRE);
          if (srcMatch) {
            const src = srcMatch[1] || srcMatch[2] || srcMatch[3];
            js += `import ${JSON.stringify(src)}\n`;
          }
        }
        if (!path.endsWith(".vue") || !js.includes("export default")) {
          js += "\nexport default {}";
        }
        return {
          loader: "js",
          contents: js,
        };
      });

      build.onResolve(
        {
          filter: /^[\w@][^:]/,
        },
        async ({ path: id ,importer}) => {
          const resolved = await _resolver(id,importer) as string;

          if (existsSync(resolved) && isInNodeModules(resolved)) {
            deps[id] = resolved;
            return {
              path: resolved,
              external: true,
            };
          }

          return {
            external: true,
            path: id,
          };
        }
      );
      build.onResolve(
        {
          filter: /.*/,
        },
        async ({ path: id,importer }) => {
          const resolved = await _resolver(id,importer) as string;
          if (existsSync(resolved)) {
            return {
              path: resolved,
            };
          } else {
            return {
              external: true,
              id,
            };
          }
        }
      );

      build.onLoad({ filter: /\.(?:j|t)s$|\.mjs$/ }, ({ path: id }) => {
        let ext = extname(id).slice(1);
        if (ext === "mjs") ext = "js";
        let contents = readFileSync(id, "utf-8");
        return {
          loader: ext as Loader,
          contents,
        };
      });
    },
  };
}

async function prepareEsbuildScanner(
  config: ResolvedConfig,
  entries: string[],
  deps: Record<string, string>
): Promise<BuildContext | undefined> {
  const plugin: Plugin = await esbuildScanPlugin(deps,config);

  return await esbuild.context({
    absWorkingDir: process.cwd(),
    write: false,
    stdin: {
      contents: entries.map((e) => `import ${JSON.stringify(e)}`).join("\n"),
      loader: "js",
    },
    bundle: true,
    format: "esm",
    logLevel: "silent",
    plugins: [plugin],
  });
}

export function scanImports(config: ResolvedConfig): {
  cancel: () => Promise<void>;
  result: Promise<{
    deps: Record<string, string>;
  }>;
} {
  const deps: Record<string, string> = {};
  const entries = computeEntries(config);
  const esbuildContext = prepareEsbuildScanner(config, entries, deps);

  const result = esbuildContext.then((ctx) => {
    return ctx!.rebuild().then(() => {
      return {
        deps,
      };
    });
  });

  return {
    result,
    cancel: async () => {
      return esbuildContext.then((context) => context?.cancel());
    },
  };
}
