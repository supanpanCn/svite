import type { Plugin } from "../plugin";
import type { ResolvedConfig } from "../config";
import {
  isDataUrl,
  isNetUrl,
  tryStatSync,
  isWindows,
  slash,
  isObject,
  normalizePath_r,
} from "../utils";
import { windowsDrivePathPrefixRE, bareImportRE } from "../constants";
import { resolve, relative, dirname, join } from "node:path";
import { normalize } from "node:path/posix";
import { type DepsOptimizer } from "../optimizer/index";
import { isPackageExists, resolveModule } from "local-pkg";

function tryResolveBrowserMapping(
  id: string,
  config: ResolvedConfig,
  isRel: boolean
) {
  const { packageCache, root } = config;
  const browser = packageCache.browser;
  if (isObject(browser)) {
    const mapId = isRel ? "./" + slash(relative(root!, id)) : id;
    return browser[mapId];
  }
  return undefined;
}

function tryFsResolve(fsPath: string) {
  const fileStat = tryStatSync(fsPath);
  if (fileStat?.isFile()) {
    return normalize(isWindows ? slash(fsPath) : fsPath);
  }
}

function tryNodeResolve(id: string) {
  if (isPackageExists(id)) {
    const fileUrl = resolveModule(id);
    if (fileUrl) {
      return normalizePath_r(fileUrl);
    }
  }
  return id;
}

function resolveSubpathImports(
  id: string,
  importer: string | undefined,
  config: ResolvedConfig
) {
  if (!importer || !id.startsWith("#")) return;
  const { packageCache, root } = config;
  const basedir = dirname(importer);

  const imports = packageCache.imports || {};
  let importsPath = imports[id];
  if (importsPath) {
    if (importsPath?.[0] === ".") {
      importsPath = normalizePath_r(relative(basedir, join(root!, importsPath)));
      if (importsPath[0] !== ".") {
        importsPath = `./${importsPath}`;
      }
    }
  }

  return importsPath;
}

export async function tryOptimizedResolve(
  depsOptimizer: DepsOptimizer,
  id: string
): Promise<string | undefined> {
  await depsOptimizer.scanProcessing;
  const metadata = depsOptimizer.metadata;
  const optimizedDepInfoFromId = () => {
    return (
      metadata.optimized[id] || metadata.discovered[id] || metadata.chunks[id]
    );
  };
  const depInfo = optimizedDepInfoFromId();
  if (depInfo) {
    return depInfo.file;
  }
}

export function resolvePlugin(payload: {
  config: ResolvedConfig;
  getDepsOptimizer: () => DepsOptimizer | undefined;
}): Plugin {
  const { config, getDepsOptimizer } = payload;
  const { root } = config;
  return {
    name: "svite:resolve",
    async resolveId(id, importer, resolveOpts) {
      if (
        id[0] === "\0" ||
        id.startsWith("virtual:") ||
        id.startsWith("/virtual:")
      ) {
        return;
      }

      if (isDataUrl(id) || isNetUrl(id)) {
        return null;
      }

      let res;

      if ((res = resolveSubpathImports(id, importer, config))) {
        id = res
      }

      if (id[0] === "/") {
        const fsPath = resolve(root!, id.slice(1));
        if ((res = tryFsResolve(fsPath))) {
          return res;
        }
      }

      if (windowsDrivePathPrefixRE.test(id) && (res = tryFsResolve(id))) {
        return res;
      }

      const depsOptimizer = getDepsOptimizer();

      if (bareImportRE.test(id)) {
        if (
          depsOptimizer &&
          !resolveOpts?.scan &&
          (res = await tryOptimizedResolve(depsOptimizer, id))
        ) {
          return res;
        }
        if ((res = tryResolveBrowserMapping(id, config, false))) {
          return res;
        }
        if ((res = tryNodeResolve(id))) {
          return res;
        }
      }

      if (id[0] === ".") {
        const basedir = importer ? dirname(importer) : process.cwd();
        const fsPath = normalizePath_r(resolve(basedir, id));
        if (depsOptimizer?.isOptimizedDepFile(fsPath)) {
          return fsPath;
        }
        if ((res = tryResolveBrowserMapping(fsPath, config, true))) {
          return res;
        }
        if ((res = tryFsResolve(fsPath))) {
          return res;
        }
      }

      console.error(`[模块解析失败]:${id}`);

      return "";
    },
  };
}
