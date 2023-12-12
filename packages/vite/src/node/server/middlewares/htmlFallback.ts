import type { Connect } from "dep-types/connect";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

export function htmlFallbackMiddleware(
  target: RegExp
): Connect.NextHandleFunction {
  return function viteHtmlFallbackMiddleware(req, res, next) {
    if (req.method === "GET") {
      const intactUrl = `http://127.0.0.1${req.url || '/'}`
      const url = new URL(intactUrl);
      const m = url.pathname.match(target);
      if (m) {
        const rewritten = decodeURIComponent(url.pathname) + "index.html";
        const intacFiletPath = join(process.cwd(),rewritten)
        if (existsSync(intacFiletPath)) {
          req.url = rewritten;
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(readFileSync(intacFiletPath,'utf-8'))
        }
      }
    }

    return next();
  };
}
