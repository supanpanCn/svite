import { join, dirname } from "node:path";
import { statSync, readFileSync } from "node:fs";
import { AnyObj } from "../types/helper";

export function findNearestPackageData(basedir: string): AnyObj {
  while (basedir) {
    const pkgPath = join(basedir, "package.json");
    try {
      if (statSync(pkgPath, { throwIfNoEntry: false })?.isFile()) {
        const pkgData = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkgData;
      }
    } catch {}

    const nextBasedir = dirname(basedir);
    if (nextBasedir === basedir) break;
    basedir = nextBasedir;
  }

  return {};
}
