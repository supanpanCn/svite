import fsp from "node:fs/promises";
import { getDepsCacheDir } from "./build";
import { type ResolvedConfig } from "../config";
import type { AnyObj } from "../../types/helper";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getDepHash } from "./index";

export async function loadCachedDepOptimizationMetadata(
  config: ResolvedConfig
) {
  const depsCacheDir = getDepsCacheDir(config);
  if (config.optimizeDeps?.force) {
    await fsp.rm(depsCacheDir, { recursive: true, force: true });
    return undefined;
  }
  let cachedMetadata: AnyObj | undefined;
  try {
    const cachedMetadataPath = join(depsCacheDir, "_metadata.json");
    if (existsSync(cachedMetadataPath)) {
      cachedMetadata = JSON.parse(
        await fsp.readFile(cachedMetadataPath, "utf-8")
      );
    } else {
      return undefined;
    }
  } catch (e) {}
  if (cachedMetadata && cachedMetadata.hash === getDepHash(config)) {
    return cachedMetadata;
  }
}
