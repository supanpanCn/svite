import { type ResolvedConfig } from "../config";
import { scanImports } from "./scan";
import type { AnyObj } from "../../types/helper";
import { preBoundle } from "./build";
import {
  replaceSlashOrColonRE,
  replaceDotRE,
  replaceNestedIdRE,
  replaceHashRE,
  lockfileFormats,
} from "../constants";
import { lookupFile, tryStatSync, getHash } from "../utils";
import { readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";

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
  deps: Record<string, string>
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
      entrys:config.optimizeDeps?.entries || []
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
  };
}

export function processMetaData<T extends AnyObj, K extends keyof T>(
  target: T,
  key: K,
  value: any
) {
  const valueIsFunction = typeof value === "function";
  target[key] = valueIsFunction ? value(target[key]) : value;
}

export const flattenId = (id: string): string =>
  id
    .replace(replaceSlashOrColonRE, "_")
    .replace(replaceDotRE, "__")
    .replace(replaceNestedIdRE, "___")
    .replace(replaceHashRE, "____");
