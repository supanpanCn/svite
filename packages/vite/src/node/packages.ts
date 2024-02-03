import { join, dirname } from "node:path";
import { statSync, readFileSync } from "node:fs";
import { AnyObj } from "dep-types/helper";
import { normalizePath_r } from './utils'

export function findNearestPackageData(basedir: string,pkgName?:string): AnyObj | null {
  while (basedir) {
    const paths = [basedir,pkgName?'node_modules':'',pkgName || '',"package.json"].filter(v=>v)
    const pkgPath = join(...paths);
    try {
      if (statSync(pkgPath, { throwIfNoEntry: false })?.isFile()) {
        const pkgData = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return {
          ...pkgData,
          pkgDir:normalizePath_r(dirname(pkgPath))
        };
      }
    } catch {}

    const nextBasedir = dirname(basedir);
    if (nextBasedir === basedir) break;
    basedir = nextBasedir;
  }

  return null;
}