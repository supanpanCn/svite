import connect from 'connect';

async function resolveConfig(userConf) {
    const internalConf = {};
    return {
        ...userConf,
        ...internalConf
    };
}

async function createHttpServer(app) {
    const { createServer } = await import('node:http');
    return createServer(app);
}

function createServer(config) {
    return _createServer(config);
}
async function startServer(server) {
    return new Promise((resolve, reject) => {
        const httpServer = server.httpServer;
        const port = 3000;
        const host = 'localhost';
        httpServer?.on('error', () => {
            reject(new Error(`Port ${port} is already in use`));
        });
        httpServer?.listen(port, host, () => {
            resolve(true);
        });
    });
}
async function _createServer(userConfig) {
    const config = await resolveConfig(userConfig);
    const middlewares = connect();
    const httpServer = await createHttpServer(middlewares);
    const server = {
        config,
        httpServer,
        async listen() {
            await startServer(server);
            return server;
        }
    };
    return server;
}

export { createServer };
//# sourceMappingURL=dep-49f2a9ad.js.map
