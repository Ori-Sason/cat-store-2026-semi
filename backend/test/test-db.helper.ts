import { afterAll, beforeEach } from 'vitest'
import { mongoService } from '../services/mongodb.service.ts'

const TEST_DB_NAME = 'catsTest'

// Opt-in per file: call at the top level of a test file that touches the DB.
// Files that don't call it never open a Mongo connection
export function setupTestDb() {
  // Second layer behind the least-privilege test user: if the wrong env file loads,
  // refuse before the wipe below touches a real database
  const dbName = process.env.MONGODB_DATABASE
  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Refusing to run tests against "${dbName}", expected "${TEST_DB_NAME}"`)
  }

  beforeEach(async () => {
    await _clearDb()
  })

  afterAll(async () => {
    await mongoService.close()
  })
}

// deleteMany, not drop: indexes are created once per connection, and dropping a
// collection would take its indexes (e.g. unique username) with it
async function _clearDb() {
  const db = await mongoService.connect()
  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  await Promise.all(collections.map(({ name }) => db.collection(name).deleteMany({})))
}
