import type { Plugin, PluginHooks } from "../plugin";

import { createPluginHookUtils } from "../plugins";

type NullValue = null | undefined | void;

export interface PluginContainer {
  buildStart(): Promise<void>;
  resolveId(id: string, importer?: string): Promise<string | NullValue>;
  transform(code: string, id: string): Promise<{ code: string }>;
  load(id: string): Promise<string | NullValue>;
}

export async function createPluginContainer(
  plugins: readonly Plugin[]
): Promise<PluginContainer> {
  const { getSortedPlugins } = createPluginHookUtils(plugins);

  async function hookParallel<H extends keyof PluginHooks>(
    hookName: H,
    context: (plugin: Plugin) => ThisType<Context>,
    args: (plugin: Plugin) => Parameters<PluginHooks[H]>
  ): Promise<void> {
    const parallelPromises: any[] = [];
    for (const plugin of getSortedPlugins(hookName)) {
      const hook = plugin[hookName];
      if (typeof hook !== "function") continue;
      if (plugin.sequential) {
        await Promise.all(parallelPromises);
        parallelPromises.length = 0;
        await hook!.apply(context(plugin), args(plugin));
      } else {
        parallelPromises.push(hook!.apply(context(plugin), args(plugin)));
      }
    }
    await Promise.all(parallelPromises);
  }

  const processesing = new Set<Promise<any>>();
  function handleHookPromise<T>(maybePromise: undefined | T | Promise<T>) {
    if (!(maybePromise as any)?.then) {
      return maybePromise;
    }
    const promise = maybePromise as Promise<T>;
    processesing.add(promise);
    return promise.finally(() => processesing.delete(promise));
  }

  class Context {
    _activePlugin: Plugin | null = null;
    _activeId: string = "";
    _activeCode:string="";
    constructor(initialPlugin?: Plugin) {
      this._activePlugin = initialPlugin || null;
    }
  }

  const container: PluginContainer = {
    async buildStart() {
      await handleHookPromise(
        hookParallel(
          "buildStart",
          (plugin) => new Context(plugin),
          () => []
        )
      );
    },
    async resolveId(rawId, importer) {
      const ctx = new Context();
      let overrideId: string | undefined;
      for (const plugin of getSortedPlugins("resolveId")) {
        if (!plugin.resolveId) continue;
        ctx._activePlugin = plugin;
        const hook = plugin.resolveId!;
        const result = await handleHookPromise(
          hook.call(ctx as any, rawId, importer)
        );
        if (!result) continue;
        overrideId = result;
        break;
      }
      return overrideId || undefined;
    },
    async transform(code, id) {
      const ctx = new Context();
      for (const plugin of getSortedPlugins("transform")) {
        if (!plugin.transform) continue;
        ctx._activePlugin = plugin;
        ctx._activeId = id;
        ctx._activeCode = code;
        let result: string | undefined | null;
        const hook = plugin.transform!;
        result = await handleHookPromise(hook.call(ctx as any, code, id));
        if (!result) continue;
        code = result;
      }
      return {
        code
      };
    },
    async load(id) {
        const ctx = new Context()
        for (const plugin of getSortedPlugins('load')) {
          if (!plugin.load) continue
          ctx._activePlugin = plugin
          const hook = plugin.load!;
          const result = await handleHookPromise(
            hook.call(ctx as any, id),
          )
          if (result != null) {
            return result
          }
        }
        return null
      },
  };
  return container;
}
