import { type ViteDevServer } from "../index";
import { type ResolvedConfig } from "../config";
import { type OptimizedDepInfo } from "./index";
import { loadCachedDepOptimizationMetadata } from "./validateCache";
import {
  discoverProjectDependencies,
  runOptimizeDeps,
  initDepsOptimizerMetadata,
  processMetaData,
  type DepsOptimizer,
  type DepOptimizationMetadata,
} from "./index";
import { getDepsCacheDir } from "./build";

const depsOptimizerMap = new WeakMap<ResolvedConfig, DepsOptimizer>();

export function getDepsOptimizer(
  config: ResolvedConfig
): DepsOptimizer | undefined {
  return depsOptimizerMap.get(config);
}

export async function initDepsOptimizer(
  server: ViteDevServer,
  config: ResolvedConfig
) {

  let newDepsDiscovered = false
  let debounceProcessingHandle: NodeJS.Timeout | undefined

  const cachedMetadata = await loadCachedDepOptimizationMetadata(config);
  let metadata = (cachedMetadata ||
    initDepsOptimizerMetadata(config)) as DepOptimizationMetadata;

  const depsOptimizer: DepsOptimizer = {
    metadata,
    registerMissingImport,
    isOptimizedDepFile: (() => {
      const depsCacheDirPrefix = getDepsCacheDir(config);
      return (id: string) => id.startsWith(depsCacheDirPrefix);
    })(),
  };

  depsOptimizerMap.set(config, depsOptimizer);

  if (!cachedMetadata) {
    depsOptimizer.scanProcessing = new Promise(async (resolve) => {
      const discover = discoverProjectDependencies(config);
      const deps = await discover.result;
      for (const id of Object.keys(deps)) {
        if (!metadata.discovered[id]) {
          processMetaData(metadata, "discovered", {
            id,
            resolved: deps[id],
            config,
          });
        }
      }
      runOptimizeDeps(config, metadata.discovered);
      resolve();
    });
  }

  function registerMissingImport(
    id: string,
    resolved: string
  ): OptimizedDepInfo {
    let missing = metadata.discovered[id];
    if (missing) {
      return missing;
    }

    missing = processMetaData(metadata, "discovered", {
      id,
      resolved,
      config,
    });

    newDepsDiscovered = true

    debouncedProcessing();

    return missing;
  }

  function debouncedProcessing(timeout = 100) {
    if (!newDepsDiscovered) {
      return
    }
    if (debounceProcessingHandle) clearTimeout(debounceProcessingHandle)
    debounceProcessingHandle = setTimeout(() => {
      debounceProcessingHandle = undefined
      clearTimeout(debounceProcessingHandle)
      newDepsDiscovered = false
      runOptimizeDeps(config, metadata.discovered);
    }, timeout)
  }
}
