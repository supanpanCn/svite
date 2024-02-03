import { builtinModules } from "node:module";
export const DEFAULT_CONFIG_FILES = ["svite.config.js"];
export const dataUrlRE = /^\s*data:/i;
export const httpUrlRE = /^(https?:)?\/\//;
export const commentRE = /<!--.*?-->/gs;
export const scriptRE =
  /(<script(?:\s+[a-z_:][-\w:]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^"'<>=\s]+))?)*\s*>)(.*?)<\/script>/gis;
export const typeRE = /\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/i;
export const srcRE = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s'">]+))/i;

export const replaceSlashOrColonRE = /[/:]/g;
export const replaceDotRE = /\./g;
export const replaceNestedIdRE = /(\s*>\s*)/g;
export const replaceHashRE = /#/g;

export const ESBUILD_MODULES_TARGET = [
  "es2020",
  "edge88",
  "firefox78",
  "chrome87",
  "safari14",
];

export const KNOWN_ASSET_TYPES = [
  // images
  "apng",
  "png",
  "jpe?g",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "svg",
  "ico",
  "webp",
  "avif",

  // media
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav",
  "flac",
  "aac",
  "opus",

  // fonts
  "woff2?",
  "eot",
  "ttf",
  "otf",

  // other
  "webmanifest",
  "pdf",
  "txt",
];

export const allExternalTypes = [
  "css",
  // supported pre-processor types
  "less",
  "sass",
  "scss",
  "styl",
  "stylus",
  "pcss",
  "postcss",
  // wasm
  "wasm",
  // known SFC types
  "vue",
  "svelte",
  "marko",
  "astro",
  "imba",
  // JSX/TSX may be configured to be compiled differently from how esbuild
  // handles it by default, so exclude them as well
  "jsx",
  "tsx",
  ...KNOWN_ASSET_TYPES,
];

export const jsMapExtensionRE = /\.js\.map$/i;
export const jsExtensionRE = /\.js$/i;

export const lockfileFormats = [
  { name: "package-lock.json", checkPatches: true, manager: "npm" },
  { name: "yarn.lock", checkPatches: true, manager: "yarn" }, // Included in lockfile for v2+
  { name: "pnpm-lock.yaml", checkPatches: false, manager: "pnpm" }, // Included in lockfile
  { name: "bun.lockb", checkPatches: true, manager: "bun" },
].sort((_, { manager }) => {
  return process.env.npm_config_user_agent?.startsWith(manager) ? 1 : -1;
});

export const builtins = new Set([
  ...builtinModules,
  "assert/strict",
  "diagnostics_channel",
  "dns/promises",
  "fs/promises",
  "path/posix",
  "path/win32",
  "readline/promises",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "timers/promises",
  "util/types",
  "wasi",
]);

export const windowsSlashRE = /\\/g;

export const windowsDrivePathPrefixRE = /^[A-Za-z]:[/\\]/

export const bareImportRE = /^(?![a-zA-Z]:)[\w@](?!.*:\/\/)/

export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//