interface MongoDbConfig {
  mongoDbURL: string
  dbName: string
}

interface JwtConfig {
  jwtSecret: string
}

export interface Config {
  mongoDbConfig: MongoDbConfig
  jwtConfig: JwtConfig
}
