import type * as http from "node:http";
import type { PluginContainer } from './server/pluginContainer'
import type { Plugin as UserPlugin } from './plugin'
export interface ViteDevServer {
  config: any;
  httpServer: http.Server | null;
  pluginContainer:PluginContainer,
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>
}

export interface UserConfig {
  server?: {};
  root?: string;
  cacheDir?:string;
  plugins?:UserPlugin[];
  optimizeDeps?:{
    entries?:string[];
    force?:boolean;
  };
  build?:{
    input?:string[]
  }
}

export * from './config'