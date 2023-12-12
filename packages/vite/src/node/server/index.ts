import type { ViteDevServer,UserConfig } from '../index'
import type { Connect } from 'dep-types/connect'
import { resolveConfig } from '../config'
import { createHttpServer } from '../http'
import connect from 'connect'
import { htmlFallbackMiddleware } from './middlewares/htmlFallback'

export function createServer(
  config: UserConfig
): Promise<ViteDevServer> {
  return _createServer(config);
}

async function startServer(server:ViteDevServer) {
  return new Promise((resolve,reject)=>{
    const httpServer = server.httpServer
    const port = 3000
    const host = 'localhost'
    httpServer?.on('error',()=>{
      reject(new Error(`Port ${port} is already in use`))
    })
    httpServer?.listen(port,host,()=>{
      resolve(true)
    })
  })
}

async function _createServer(userConfig:UserConfig){
    const config = await resolveConfig(userConfig)
    const middlewares = connect() as Connect.Server
    const httpServer = await createHttpServer(middlewares)
    const server:ViteDevServer = {
      config,
      httpServer,
      async listen(){
        await startServer(server)
        return server
      }
    }
    middlewares.use(htmlFallbackMiddleware(/\/$/))
    return server
}
