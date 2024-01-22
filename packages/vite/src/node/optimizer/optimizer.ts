import { type ViteDevServer } from "../index";
import { type ResolvedConfig } from "../config";
import { loadCachedDepOptimizationMetadata } from "./validateCache";
import {
  discoverProjectDependencies,
  runOptimizeDeps,
  initDepsOptimizerMetadata,
  processMetaData,
} from "./index";

export async function initDepsOptimizer(
  server: ViteDevServer,
  config: ResolvedConfig
) {
  const cachedMetadata = await loadCachedDepOptimizationMetadata(config);
  debugger;
  let metadata = cachedMetadata || initDepsOptimizerMetadata(config);
  if (!cachedMetadata) {
    const discover = discoverProjectDependencies(config);
    const deps = await discover.result;
    processMetaData(metadata, "discovered", deps);
    runOptimizeDeps(config, metadata.discovered);
  }
}
