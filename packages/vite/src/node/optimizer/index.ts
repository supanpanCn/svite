import { type ResolvedConfig } from "../config";
import { scanImports } from "./scan";
import { preBoundle } from "./build";
import {
  replaceSlashOrColonRE,
  replaceDotRE,
  replaceNestedIdRE,
  replaceHashRE,
  lockfileFormats,
} from "../constants";
import { lookupFile, tryStatSync, getHash, normalizePath_r } from "../utils";
import { readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { resolve } from "node:path";
import { getDepsCacheDir } from "./build";

export interface OptimizedDepInfo {
  // 引入的包名称
  file: string;
  // 指向node_modules中指定依赖项的文件地址
  src?: string;
}

export interface DepOptimizationMetadata {
  hash: string;
  discovered: Record<string, OptimizedDepInfo>;
  chunks: Record<string, OptimizedDepInfo>;
  optimized: Record<string, OptimizedDepInfo>;
  depInfoList: OptimizedDepInfo[];
}
export interface DepsOptimizer {
  metadata: DepOptimizationMetadata;
  scanProcessing?: Promise<void>;
  isOptimizedDepFile:(id:string)=>boolean;
  registerMissingImport:(id:string,resolved:string)=>OptimizedDepInfo;
}

export function discoverProjectDependencies(config: ResolvedConfig): {
  cancel: () => Promise<void>;
  result: Promise<Record<string, string>>;
} {
  const { cancel, result } = scanImports(config);

  return {
    cancel,
    result: result.then(({ deps }) => {
      return deps;
    }),
  };
}

export function runOptimizeDeps(
  config: ResolvedConfig,
  deps: Record<string, OptimizedDepInfo>
) {
  config = {
    ...config,
    cacheDir: "node_modules",
  };
  preBoundle(config, deps);
}

export function getDepHash(config: ResolvedConfig): string {
  const lockfileNames = lockfileFormats.map((l) => l.name);
  const lockfilePath = lookupFile(config.root!, lockfileNames);
  let content = lockfilePath ? readFileSync(lockfilePath, "utf-8") : "";
  if (lockfilePath) {
    const lockfileName = basename(lockfilePath);
    const { checkPatches } = lockfileFormats.find(
      (f) => f.name === lockfileName
    )!;
    if (checkPatches) {
      const fullPath = join(dirname(lockfilePath), "patches");
      const stat = tryStatSync(fullPath);
      if (stat?.isDirectory()) {
        content += stat.mtimeMs.toString();
      }
    }
  }
  content += JSON.stringify(
    {
      entrys: config.optimizeDeps?.entries || [],
    },
    (_, value) => {
      if (typeof value === "function" || value instanceof RegExp) {
        return value.toString();
      }
      return value;
    }
  );
  return getHash(content);
}

export function initDepsOptimizerMetadata(config: ResolvedConfig) {
  return {
    hash: getDepHash(config),
    discovered: {},
    chunks: {},
    optimized: {},
    depInfoList:[]
  };
}

export function getOptimizedDepPath(
  id: string,
  config: ResolvedConfig
): string {
  return normalizePath_r(
    resolve(getDepsCacheDir(config, false), flattenId(id) + ".js")
  );
}

export function findOptimizedDepInfoInRecord(
  dependenciesInfo: Record<string, OptimizedDepInfo>,
  callbackFn: (depInfo: OptimizedDepInfo, id: string) => any,
): OptimizedDepInfo | undefined {
  for (const o of Object.keys(dependenciesInfo)) {
    const info = dependenciesInfo[o]
    if (callbackFn(info, o)) {
      return info
    }
  }
}

export function processMetaData(
  target: DepOptimizationMetadata,
  key: 'discovered' | 'optimized' | 'chunks',
  payload: any
) {
  switch (key) {
    case "discovered": {
      const { id, resolved, config } = payload;
      const item = {
        id,
        src: normalizePath_r(resolved),
        file: getOptimizedDepPath(id, config),
      };
      target[key][item.id] = item;
      target.depInfoList.push(item);
      return item;
    }
    case 'optimized':
    case 'chunks':{
      target[key][payload.id] = payload;
      target.depInfoList.push(payload);
      return payload
    }
  }
}

export const flattenId = (id: string): string =>
  id
    .replace(replaceSlashOrColonRE, "_")
    .replace(replaceDotRE, "__")
    .replace(replaceNestedIdRE, "___")
    .replace(replaceHashRE, "____");
