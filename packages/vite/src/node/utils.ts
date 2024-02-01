import { isAbsolute, resolve, dirname, join } from "node:path";
import { existsSync, rename, stat, statSync, type Stats } from "node:fs";
import { normalize } from "node:path/posix";
import os from "node:os";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { dataUrlRE, httpUrlRE, builtins, windowsSlashRE } from "./constants";

export const isWindows = os.platform() === "win32";

const NODE_BUILTIN_NAMESPACE = "node:";
export function isBuiltin(id: string): boolean {
  return builtins.has(
    id.startsWith(NODE_BUILTIN_NAMESPACE)
      ? id.slice(NODE_BUILTIN_NAMESPACE.length)
      : id
  );
}

export async function asyncFlatten<T>(arr: T[]): Promise<T[]> {
  do {
    arr = (await Promise.all(arr)).flat(Infinity) as any;
  } while (arr.some((v: any) => v?.then));
  return arr;
}

export function normalizePath(p: string, root: string, type: "absolute") {
  if (type === "absolute") {
    if (!isAbsolute(p)) {
      p = resolve(root, p);
    }
    if (existsSync(p)) {
      return p;
    }
  }
  return "";
}

export function normalizePath_r(id: string): string {
  return normalize(isWindows ? slash(id) : id)
}

export function isInNodeModules(id: string): boolean {
  return id.includes("node_modules");
}

export function formatPath(id: string): string {
  return normalize(isWindows ? id.replace(/\\/g, "/") : id);
}

export function getHash(text: Buffer | string): string {
  return createHash("sha256").update(text).digest("hex").substring(0, 8);
}

const GRACEFUL_RENAME_TIMEOUT = 5000;
export const safeRename = promisify(function gracefulRename(
  from: string,
  to: string,
  cb: (error: NodeJS.ErrnoException | null) => void
) {
  const start = Date.now();
  let backoff = 0;
  rename(from, to, function CB(er) {
    if (
      er &&
      (er.code === "EACCES" || er.code === "EPERM") &&
      Date.now() - start < GRACEFUL_RENAME_TIMEOUT
    ) {
      setTimeout(function () {
        stat(to, function (stater, st) {
          if (stater && stater.code === "ENOENT") rename(from, to, CB);
          else CB(er);
        });
      }, backoff);
      if (backoff < 100) backoff += 10;
      return;
    }
    if (cb) cb(er);
  });
});

export function tryStatSync(file: string): Stats | undefined {
  try {
    return statSync(file, { throwIfNoEntry: false });
  } catch {}
}

export function lookupFile(
  dir: string,
  fileNames: string[]
): string | undefined {
  while (dir) {
    for (const fileName of fileNames) {
      const fullPath = join(dir, fileName);
      if (tryStatSync(fullPath)?.isFile()) return fullPath;
    }
    const parentDir = dirname(dir);
    if (parentDir === dir) return;

    dir = parentDir;
  }
}

export const isDataUrl = (url: string): boolean => dataUrlRE.test(url);

export const isNetUrl = (url: string): boolean => httpUrlRE.test(url);

export function slash(p: string): string {
  return p.replace(windowsSlashRE, "/");
}

export function isObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]'
}