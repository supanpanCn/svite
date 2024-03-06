import type { Plugin } from "../plugin";
import type { ResolvedConfig } from "../config";
import { prefix } from "../env";
import { selectDefine } from "./importAnalysis";
import { normalizePath_r } from "../utils";
import { relative } from "node:path";

export type IndexHtmlTransformHook = (
  this: void,
  html: string,
  ctx: {
    path: string;
    filename: string;
    originalUrl?: string;
  }
) => string | void | Promise<string | void>;

export type IndexHtmlTransform =
  | IndexHtmlTransformHook
  | {
      order?: "pre" | "post" | null;
      handler: IndexHtmlTransformHook;
    };

export async function applyHtmlTransforms(
  html: string,
  hooks: IndexHtmlTransformHook[],
  ctx: {
    path: string;
    filename: string;
    originalUrl?: string;
  }
): Promise<string> {
  for (const hook of hooks) {
    const res = await hook(html, ctx);
    if (!res) {
      continue;
    }
    if (typeof res === "string") {
      html = res;
    }
  }
  return html;
}

export function resolveHtmlTransforms(
  plugins: readonly Plugin[]
): [
  IndexHtmlTransformHook[],
  IndexHtmlTransformHook[],
  IndexHtmlTransformHook[]
] {
  const preHooks: IndexHtmlTransformHook[] = [];
  const normalHooks: IndexHtmlTransformHook[] = [];
  const postHooks: IndexHtmlTransformHook[] = [];

  for (const plugin of plugins) {
    const hook = plugin.transformIndexHtml;
    if (!hook) continue;

    if (typeof hook === "function") {
      normalHooks.push(hook);
    } else {
      const order = hook.order ?? "pre";
      const handler = hook.handler;
      if (typeof handler === "function") {
        if (order === "pre") {
          preHooks.push(handler);
        } else if (order === "post") {
          postHooks.push(handler);
        } else {
          normalHooks.push(handler);
        }
      }
    }
  }

  return [preHooks, normalHooks, postHooks];
}

export function htmlEnvHook(config: ResolvedConfig): IndexHtmlTransformHook {
  const pattern = /%(\S+?)%/g;
  const envPrefix = prefix;
  const env: Record<string, any> = { ...config.env };
  selectDefine(config.define || {}, (key, val) => {
    env[key.slice(16)] = typeof val === "string" ? val : JSON.stringify(val);
  });
  return (html, ctx) => {
    return html.replace(pattern, (text, key) => {
      if (key in env) {
        return env[key];
      } else {
        if (key.startsWith(envPrefix)) {
          const relativeHtml = normalizePath_r(
            relative(config.root!, ctx.filename)
          );
          console.warn(`(!) /${relativeHtml}中使用的${text}在环境变量中未找到`);
        }

        return text;
      }
    });
  };
}
