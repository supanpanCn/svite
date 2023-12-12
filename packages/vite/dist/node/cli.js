import { cac } from 'cac';

const cli = cac("svite");
cli
    .command("[root]", "start dev server")
    .alias("serve")
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
    const { createServer } = await import('./chunks/dep-aba1c0f1.js');
    try {
        const server = await createServer(nomalizedOption);
        await server.listen();
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
cli.parse();
//# sourceMappingURL=cli.js.map
