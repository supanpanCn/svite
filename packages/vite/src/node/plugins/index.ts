import type { Plugin } from "../plugin";
import type { PluginHookUtils, ResolvedConfig } from "../config";
import { resolvePlugin } from "./resolver";
import { getDepsOptimizer } from "../optimizer/optimizer";

export async function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Promise<Plugin[]> {
  return [
    ...prePlugins,
    resolvePlugin({
      config,
      getDepsOptimizer: () => getDepsOptimizer(config),
    }),
    ...normalPlugins,
    ...postPlugins,
  ];
}

export function getSortedPluginsByHook(
  hookName: keyof Plugin,
  plugins: readonly Plugin[]
): Plugin[] {
  const pre: Plugin[] = [];
  const normal: Plugin[] = [];
  const post: Plugin[] = [];
  for (const plugin of plugins) {
    const enforce = plugin.enforce;
    const hook = plugin[hookName];
    if (hook) {
      if (enforce === "pre") {
        pre.push(plugin);
        continue;
      }
      if (enforce === "post") {
        post.push(plugin);
        continue;
      }
      normal.push(plugin);
    }
  }
  return [...pre, ...normal, ...post];
}

export function createPluginHookUtils(
  plugins: readonly Plugin[]
): PluginHookUtils {
  const sortedPluginsCache = new Map<keyof Plugin, Plugin[]>();
  function getSortedPlugins(hookName: keyof Plugin): Plugin[] {
    if (sortedPluginsCache.has(hookName))
      return sortedPluginsCache.get(hookName)!;
    const sorted = getSortedPluginsByHook(hookName, plugins);
    sortedPluginsCache.set(hookName, sorted);
    return sorted;
  }
  function getSortedPluginHooks<K extends keyof Plugin>(
    hookName: K
  ): NonNullable<Plugin[K]>[] {
    const plugins = getSortedPlugins(hookName);
    return plugins
      .map((p) => {
        const hook = p[hookName]!;
        return hook;
      })
      .filter(Boolean);
  }

  return {
    getSortedPlugins,
    getSortedPluginHooks,
  };
}
