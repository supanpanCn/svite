import type { UserConfig } from "./index";
export declare function defineConfig(config: UserConfig): UserConfig;
export declare function parseConfigFile(conf: object): Promise<any>;
export declare function resolveConfig(userConf: UserConfig): Promise<any>;
