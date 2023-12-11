import type { UserConfig } from './index'

export async function resolveConfig(userConf:UserConfig) {
    const internalConf = {}
    return {
        ...userConf,
        ...internalConf
    }
}