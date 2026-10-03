import type { Config } from '../models/config.ts'

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env variable: ${name}`)
  return value
}

const mongoDbConfig = {
  mongoDbURL: requireEnv('MONGODB_URI'),
  dbName: requireEnv('MONGODB_DATABASE'),
}

export const config: Config = {
  mongoDbConfig,
}
