import type { Db, Document, Collection, IndexSpecification, CreateIndexesOptions } from 'mongodb'
import { MongoClient } from 'mongodb'
import { config } from '../config/index.ts'
import { REVIEW_COLLECTION } from '../models/review.ts'
import { CAT_COLLECTION } from '../models/cat.ts'
import { CHAT_MSG_COLLECTION } from '../models/chat.ts'
import { USER_COLLECTION } from '../models/user.ts'

interface IndexDef {
  collection: string
  key: IndexSpecification
  options?: CreateIndexesOptions
}

const INDEXES: IndexDef[] = [
  // userSchema lowercases usernames, so a plain unique index is enough for case-insensitive uniqueness
  { collection: USER_COLLECTION, key: { username: 1 }, options: { unique: true } },
  // A cat's / a user's reviews, newest first. The compound key serves the sort from the index
  // (a plain { catId: 1 } would sort in memory), and its prefix serves deleteMany({ catId })
  { collection: REVIEW_COLLECTION, key: { catId: 1, createdAt: -1 } },
  { collection: REVIEW_COLLECTION, key: { userId: 1, createdAt: -1 } },
  // A user's cats (the user page). Serves the ownerId match only, not the sort: buildSort adds
  // an _id tiebreak that isn't in the key, so the newest-first order still sorts in memory.
  // Fine at one user's cat count
  { collection: CAT_COLLECTION, key: { ownerId: 1, createdAt: -1 } },
  // A cat's chat paged by _id, in both directions. No `unique`: _id already is.
  // Its catId prefix also serves the cascade deleteMany({ catId })
  { collection: CHAT_MSG_COLLECTION, key: { catId: 1, _id: -1 } },
  // The retry dedupe: a second insert with the same clientMsgId hits a duplicate-key error, and
  // the server answers with the saved msg. Per user, so one user can't block another's id
  {
    collection: CHAT_MSG_COLLECTION,
    key: { userId: 1, clientMsgId: 1 },
    options: { unique: true },
  },
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

// The health check's "can the app serve data" probe: a round trip to the server, no collection
async function ping() {
  const db = await connect()
  await db.command({ ping: 1 })
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
  ping,
}
