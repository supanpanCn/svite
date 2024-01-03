import type { UserConfig } from "./index";
import type { Plugin } from "./plugin";
export type ResolvedConfig = Readonly<Omit<UserConfig, "plugins">> & {
    plugins: readonly Plugin[];
};
export interface PluginHookUtils {
    getSortedPlugins: (hookName: keyof Plugin) => Plugin[];
    getSortedPluginHooks: <K extends keyof Plugin>(hookName: K) => NonNullable<Plugin[K]>[];
}
export declare function sortUserPlugins(plugins: (Plugin | Plugin[])[] | undefined): [Plugin[], Plugin[], Plugin[]];
export declare function defineConfig(config: UserConfig): UserConfig;
export declare function parseConfigFile(conf: object): Promise<any>;
export declare function resolveConfig(userConf: UserConfig): Promise<ResolvedConfig>;
