import { cac } from 'cac';

const cli = cac("mini-vite");
cli
    .command("[root]", "start dev server")
    .alias("server")
    .option("--port <port>", "[number] specify port")
    .action(loadAndCreateHttp);
function normalizeConfig(option, root) {
    const config = {
        server: {},
        root,
    };
    return config;
}
async function loadAndCreateHttp(root, option) {
    const nomalizedOption = normalizeConfig(option, root);
    const { createServer } = await import('./chunks/dep-49f2a9ad.js');
    try {
        const server = await createServer(nomalizedOption);
        await server.listen();
    }
    catch (_) {
        process.exit(1);
    }
}
//# sourceMappingURL=cli.js.map
