import type { Connect } from "dep-types/connect";
import type { ViteDevServer } from "../../index";
import { existsSync } from "node:fs";
import fsp from "node:fs/promises";
import { join } from "node:path";
import { normalizePath_r } from "../../utils";
import { applyHtmlTransforms, resolveHtmlTransforms, htmlEnvHook } from "../../plugins/html";

function getHtmlFilename(url: string, server: ViteDevServer) {
    return decodeURIComponent(
        normalizePath_r(join(server.config.root!, url.slice(1)))
    );
}

function createDevHtmlTransformFn(
    server: ViteDevServer
): (url: string, html: string, originalUrl: string) => Promise<string> {
    const [preHooks, normalHooks, postHooks] = resolveHtmlTransforms(
        server.config.plugins
    );
    return (url: string, html: string, originalUrl: string) =>
        applyHtmlTransforms(html, [
            ...preHooks,
            htmlEnvHook(server.config),
            ...normalHooks,
            ...postHooks
        ], {
            path: url,
            originalUrl,
            filename: getHtmlFilename(url, server);
        });
}

export default function indexHtmlMiddleware(
    server: ViteDevServer
): Connect.NextHandleFunction {
    return async function viteIndexHtmlMiddleware(req, res, next) {
        if (res.writableEnded) {
            return next();
        }

        const url = req.url;
        if (url?.endsWith(".html") && req.headers["sec-fetch-dest"] !== "script") {
            const filename = getHtmlFilename(url, server);
            if (existsSync(filename)) {
                try {
                    let html = await fsp.readFile(filename, "utf-8");
                    html = await createDevHtmlTransformFn(server)(
                        url,
                        html,
                        req.originalUrl!
                    );
                    res.setHeader("Content-Type", "text/html");
                    res.statusCode = 200;
                    return res.end(html);
                } catch (e) {
                    return next(e);
                }
            }
        }
        next();
    };
}
