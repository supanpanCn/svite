import { parse } from "dotenv";
import { expand } from "dotenv-expand";
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { tryStatSync } from './utils'

export const prefix = "SVITE_";

export function loadEnv(root: string,mode:string) {
  const env: Record<string, string> = {};
  const envFiles = [`.env`, `.env.local`, `.env.${mode}.local`];
  const parsed = Object.fromEntries(
    envFiles.flatMap((file) => {
      const filePath = join(root, file)
      if (!tryStatSync(filePath)?.isFile()) return []
      return Object.entries(parse(readFileSync(filePath)))
    }),
  )
  expand({ parsed })
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith(prefix)) {
      env[key] = value
    }
  }

  return env
}
