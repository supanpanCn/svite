import type { Plugin } from "../plugin";
import type { ResolvedConfig } from "../config";
import { init, parse as parseImports } from "es-module-lexer";
import type { ImportSpecifier } from "es-module-lexer";
import MagicString from "magic-string";

export function selectDefine(define:ResolvedConfig['define'],cb:(key:string,value:any)){
  for (const key in define) {
    if (key.startsWith(`import.meta.env.`)) {
      const val = define[key]
      if(typeof cb === 'function'){
        cb(key,val)
      }
    }
  }
}

export function importAnalysisPlugin(config: ResolvedConfig): Plugin {
  function _InjectEnvMeta() {
    const { env,define={} } = config
    let meta = `import.meta.env = ${JSON.stringify(env)};`;
    selectDefine(define,(key,val)=>{
      meta += `${key} = ${
        typeof val === 'string' ? val : JSON.stringify(val)
      };`
    })
    return meta;
  }
  return {
    name: "svite:import-analysis",
    async transform(code) {
      await init;
      let imports!: readonly ImportSpecifier[];
      try {
        [imports] = parseImports(code);
      } catch (_) {
        return code;
      }
      let hasEnv = false;
      await Promise.all(
        imports.map(async (importSpecifier) => {
          const { s: start, e: end } = importSpecifier;
          const rawUrl = code.slice(start, end);
          if (rawUrl === "import.meta") {
            const prop = code.slice(end, end + 4);
            if (prop === ".env") {
              hasEnv = true;
              return;
            }
          }
        })
      );
      const s = new MagicString(code);
      if (hasEnv) {
        s.prepend(_InjectEnvMeta());
      }
      return s.toString();
    },
  };
}
