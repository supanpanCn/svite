import type * as http from "node:http";
export interface ViteDevServer {
  config: any;
  httpServer: http.Server | null;
  listen(port?: number, isRestart?: boolean): Promise<ViteDevServer>
}

export interface UserConfig {
  server: {};
  root: string;
}

export * from './config'