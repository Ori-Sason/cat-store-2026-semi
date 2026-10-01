import type { Db, Document, Collection, IndexSpecification, CreateIndexesOptions } from 'mongodb'
import { MongoClient } from 'mongodb'
import { config } from '../config/index.ts'

interface IndexDef {
  collection: string
  key: IndexSpecification
  options?: CreateIndexesOptions
}

const INDEXES: IndexDef[] = [
  { collection: 'user', key: { username: 1 }, options: { unique: true } },
]

let client: MongoClient | null = null
// Cache the promise, not the resolved Db - it's assigned synchronously,
// so concurrent callers during the first connect all await the same one
let dbPromise: Promise<Db> | null = null

async function getCollection<T extends Document>(collectionName: string): Promise<Collection<T>> {
  const db = await connect()
  return db.collection<T>(collectionName)
}

function connect(): Promise<Db> {
  if (dbPromise) return dbPromise

  const { mongoDbURL, dbName } = config.mongoDbConfig
  const newClient = new MongoClient(mongoDbURL)
  client = newClient
  dbPromise = newClient
    .connect()
    .then(async () => {
      const db = newClient.db(dbName)
      await _ensureIndexes(db)
      return db
    })
    .catch(async (err) => {
      // Don't cache a rejected promise - otherwise every later call fails forever
      dbPromise = null
      client = null
      await newClient.close()
      throw err
    })

  return dbPromise
}

async function _ensureIndexes(db: Db) {
  await Promise.all(
    INDEXES.map(({ collection, key, options = {} }) =>
      db.collection(collection).createIndex(key, options),
    ),
  )
}

async function close() {
  if (!client) return
  const oldClient = client
  client = null
  dbPromise = null
  await oldClient.close()
}

export const mongoService = {
  connect,
  close,
  getCollection,
}
