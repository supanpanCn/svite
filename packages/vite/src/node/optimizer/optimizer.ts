import { type ViteDevServer } from "../index";
import { type ResolvedConfig } from "../config";
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
  const cachedMetadata = await loadCachedDepOptimizationMetadata(config);
  let metadata = (cachedMetadata ||
    initDepsOptimizerMetadata(config)) as DepOptimizationMetadata;

  const depsOptimizer: DepsOptimizer = {
    metadata,
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
}
