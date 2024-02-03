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
  isBuiltin,
  isInNodeModules,
} from "../utils";
import {
  windowsDrivePathPrefixRE,
  bareImportRE,
  deepImportRE,
} from "../constants";
import { resolve, relative, dirname, join, isAbsolute } from "node:path";
import { normalize } from "node:path/posix";
import { existsSync, readFileSync } from "node:fs";
import { type DepsOptimizer } from "../optimizer/index";
import { findNearestPackageData } from "../packages";
import { AnyObj } from "dep-types/helper";
import { hasESMSyntax } from "mlly";

export const optionalPeerDepId = "__svite-optional-peer-dep";

function equalWithoutSuffix(path: string, key: string, suffix: string) {
  return key.endsWith(suffix) && key.slice(0, -suffix.length) === path;
}

function tryResolveBrowserMapping(
  id: string,
  config: ResolvedConfig,
  isRel: boolean
) {
  const { packageCache, root } = config;
  const browser = packageCache.browser;
  id = normalizePath_r(id);
  if (isObject(browser)) {
    for (let key in browser) {
      const normalizedKey = normalizePath_r(key);
      const mapId = isRel ? "./" + slash(relative(root!, id)) : id;
      // 补充点
      if (
        normalizedKey === mapId ||
        equalWithoutSuffix(id, normalizedKey, ".js") ||
        equalWithoutSuffix(id, normalizedKey, "/index.js")
      ) {
        return browser[mapId];
      }
    }
  }
  return undefined;
}

function tryFsResolve(fsPath: string) {
  const fileStat = tryStatSync(normalizePath_r(fsPath));
  if (fileStat?.isFile()) {
    return normalize(isWindows ? slash(fsPath) : fsPath);
  }
}

function resolveExports(relativeId: string, exportsField: AnyObj) {
  let matchId: undefined | string;
  function _parseExports(exps: AnyObj) {
    for (let key in exps) {
      if (key === relativeId) {
        matchId = isObject(exps[key]) ? exps[key].import : exps[key];
        break;
      }
      if (isObject(exps[key])) {
        _parseExports(exps[key]);
      }
    }
  }
  _parseExports(exportsField);
  return matchId;
}

function resolveDeepImport(
  id: string,
  pkg: AnyObj,
  baseDir: string
): string | undefined {
  let relativeId: string | undefined | void = id;
  const { exports: exportsField, browser: browserField } = pkg;

  if (exportsField) {
    if (isObject(exportsField) && !Array.isArray(exportsField)) {
      const matchId = resolveExports(relativeId, exportsField);
      if (matchId !== undefined) {
        relativeId = matchId;
      } else {
        relativeId = undefined;
      }
    } else {
      relativeId = undefined;
    }
    if (!relativeId) {
      return;
    }
  } else if (isObject(browserField)) {
    const mapped = tryResolveBrowserMapping(
      relativeId,
      {
        packageCache: pkg,
        root: baseDir,
      } as any,
      true
    );
    if (mapped) {
      relativeId = mapped;
    }
  }

  if (relativeId) {
    const resolved = tryFsResolve(join(baseDir, relativeId));
    if (resolved) {
      return resolved;
    }
  }
}

export function resolvePackageEntry(
  _: string,
  pkg: AnyObj,
  baseDir: string
): string | undefined {
  try {
    const { exports, browser, module } = pkg;
    let entryPoint: string | undefined;
    if (pkg.exports) {
      entryPoint = resolveExports(".", exports);
    }

    const resolvedFromExports = !!entryPoint;

    if (!entryPoint || entryPoint.endsWith(".mjs")) {
      const browserEntry =
        typeof browser === "string"
          ? browser
          : isObject(browser) && browser["."];

      if (browserEntry) {
        if (typeof module === "string" && module !== browserEntry) {
          const resolvedBrowserEntry = tryFsResolve(
            join(baseDir, browserEntry)
          );
          if (resolvedBrowserEntry) {
            const content = readFileSync(resolvedBrowserEntry, "utf-8");
            if (hasESMSyntax(content)) {
              entryPoint = browserEntry;
            } else {
              entryPoint = module;
            }
          }
        } else {
          entryPoint = browserEntry;
        }
      }
    }

    if (!resolvedFromExports && (!entryPoint || entryPoint.endsWith(".mjs"))) {
      for (const field of ["module", "jsnext:main", "jsnext"]) {
        if (field === "browser") continue; // already checked above
        if (typeof pkg[field] === "string") {
          entryPoint = pkg[field];
          break;
        }
      }
    }
    entryPoint ||= pkg.main;

    const entryPoints = entryPoint
      ? [entryPoint]
      : ["index.js", "index.json", "index.node"];

    for (let entry of entryPoints) {
      const { browser: browserField } = pkg;
      if (isObject(browserField)) {
        entry =
          tryResolveBrowserMapping(
            entry,
            {
              packageCache: pkg,
              root: baseDir,
            } as any,
            false
          ) || entry;
      }

      const entryPointPath = join(baseDir, entry);
      const resolvedEntryPoint = tryFsResolve(entryPointPath);
      if (resolvedEntryPoint) {
        return resolvedEntryPoint;
      }
    }
  } catch (e) {
    return "";
  }
  return "";
}

function tryNodeResolve(
  id: string,
  importer: string | undefined,
  root: string,
  depsOptimizer?: DepsOptimizer,
  scan?: boolean
) {
  if (isBuiltin(id)) return;

  let baseDir: string = root;
  if (importer && isAbsolute(importer) && existsSync(importer)) {
    baseDir = dirname(importer);
  }

  const deepMatch = id.match(deepImportRE);
  const pkgId = deepMatch ? deepMatch[1] : id;

  const pkg = findNearestPackageData(baseDir, pkgId);

  if (!pkg) {
    if (baseDir !== root && !id.includes("\0") && bareImportRE.test(id)) {
      const pkg = findNearestPackageData(baseDir);
      if (pkg) {
        if (
          pkg.peerDependencies?.[id] &&
          pkg.peerDependenciesMeta?.[id]?.optional
        ) {
          return `${optionalPeerDepId}:${id}:${pkg.name}`;
        }
      }
    }
    return;
  }

  const resolveId = deepMatch ? resolveDeepImport : resolvePackageEntry;
  const unresolvedId = deepMatch ? "." + id.slice(pkgId.length) : pkgId;

  let resolved: string | undefined;
  try {
    resolved = resolveId(unresolvedId, pkg, pkg.pkgDir);
  } catch (err) {
    return;
  }

  if (!resolved) {
    return;
  }

  if (!isInNodeModules(resolved) || !depsOptimizer || scan) {
    return resolved;
  }

  const optimizedInfo = depsOptimizer!.registerMissingImport(id, resolved);
  resolved = optimizedInfo.file;

  return resolved;
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
      importsPath = normalizePath_r(
        relative(basedir, join(root!, importsPath))
      );
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
        id = res;
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
        if (
          (res = tryNodeResolve(
            id,
            importer,
            root!,
            depsOptimizer,
            resolveOpts?.scan
          ))
        ) {
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
    load(id) {
      if (id.startsWith(optionalPeerDepId)) {
        const [, peerDep, parentDep] = id.split(':')
        return `throw new Error(\`无法从"${parentDep}"中导入"${peerDep}"". 请确认是否已经安装?\`)`
      }
    },
  };
}
