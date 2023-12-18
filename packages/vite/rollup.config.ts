import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import type { RollupOptions, Plugin } from "rollup";
import { defineConfig } from "rollup";
import MagicString from "magic-string";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url)).toString()
);

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const sharedNodeOptions = defineConfig({
  treeshake: {
    moduleSideEffects: "no-external",
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
  },
  output: {
    dir: "./dist",
    entryFileNames: `node/[name].js`,
    chunkFileNames: "node/chunks/dep-[hash].js",
    exports: "named",
    format: "esm",
    externalLiveBindings: false,
    freeze: false,
  },
  onwarn(warning, warn) {
    if (warning.message.includes("Circular dependency")) {
      return;
    }
    warn(warning);
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    typescript({
      tsconfig: path.resolve(__dirname, "src/node/tsconfig.json"),
      sourceMap: true,
      declaration: true,
      declarationDir: "./dist/node",
    }),
    commonjs({
      extensions: [".js"],
      ignore: ["bufferutil", "utf-8-validate"],
    }),
    json(),
    cjsPatchPlugin(),
  ],
});

const config = defineConfig({
  ...sharedNodeOptions,
  input: {
    index: path.resolve(__dirname, "src/node/index.ts"),
    cli: path.resolve(__dirname, "src/node/cli.ts"),
  },
  output: {
    ...sharedNodeOptions.output,
    sourcemap: true,
  },
  external: [
    ...Object.keys(pkg.dependencies),
    ...Object.keys(pkg.devDependencies),
  ],
});

export default (): RollupOptions[] => {
  return defineConfig([config]);
};

function cjsPatchPlugin(): Plugin {
  const cjsPatch = `
import { fileURLToPath as __cjs_fileURLToPath } from 'node:url';
import { dirname as __cjs_dirname } from 'node:path';
import { createRequire as __cjs_createRequire } from 'node:module';

const __filename = __cjs_fileURLToPath(import.meta.url);
const __dirname = __cjs_dirname(__filename);
const require = __cjs_createRequire(import.meta.url);
const __require = require;
`.trimStart();

  return {
    name: "cjs-chunk-patch",
    renderChunk(code, chunk) {
      if (!chunk.fileName.includes("chunks/dep-")) return;

      const match = code.match(/^(?:import[\s\S]*?;\s*)+/);
      const index = match ? match.index! + match[0].length : 0;
      const s = new MagicString(code);
      // inject after the last `import`
      s.appendRight(index, cjsPatch);
      console.log("patched cjs context: " + chunk.fileName);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },
  };
}
