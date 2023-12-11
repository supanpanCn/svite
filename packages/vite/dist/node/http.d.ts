/// <reference types="node" />
import type { Connect } from 'dep-types/connect';
export declare function createHttpServer(app: Connect.Server): Promise<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>>;
