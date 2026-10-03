interface MongoDbConfig {
  mongoDbURL: string
  dbName: string
}

export interface Config {
  mongoDbConfig: MongoDbConfig
}
