import { join, resolve } from "path";
import { readdirSync, rmSync, mkdirSync, copyFileSync, statSync } from "fs";

const cwd = process.cwd();

function clean() {
  const breaks = [
    ".git",
    "imgs",
    "package.json",
    "scripts",
    "README.md",
    "LIST.md",
  ];
  for (const file of readdirSync(cwd)) {
    if (breaks.find((b) => file === b)) {
      continue;
    }
    rmSync(resolve(cwd, file), { recursive: true, force: true });
  }
}

function copy(src, dest) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    copyFileSync(src, dest);
  }
}

function copyDir(root, dest, first) {
  !first && mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(root)) {
    if ([".git", "node_modules", ".DS_Store", "md"].find((b) => file === b)) {
      continue;
    }
    if (file.endsWith(".md")) continue;
    if (first && file === "package.json") continue;
    const srcFile = resolve(root, file);
    const destFile = resolve(dest, file);
    copy(srcFile, destFile);
  }
}

function processResult(dir) {
  const dirs = readdirSync(dir);
  if (dirs.length) {
    for (const file of dirs) {
      const fullPath = resolve(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        processResult(fullPath);
      }
    }
  } else {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const root = join(cwd, "..", "mini-vite");
  if (root) {
    clean();
    copyDir(root, cwd, true);
    processResult(cwd);
  }
}

main();
