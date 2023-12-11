import type { Connect } from 'dep-types/connect'

export async function createHttpServer(app:Connect.Server){
    const { createServer } = await import('node:http')
    return createServer(app)
}