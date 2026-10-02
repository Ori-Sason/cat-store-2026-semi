import { describe, expect, it } from 'vitest'
import { setupTestDb } from '../test/test-db.helper.ts'
import { mongoService } from './mongodb.service.ts'

setupTestDb()

describe('mongoService', () => {
  it('connects to the test database', async () => {
    const db = await mongoService.connect()

    expect(db.databaseName).toBe(process.env.MONGODB_DATABASE)
  })

  it('starts each test with an empty database', async () => {
    const collection = await mongoService.getCollection('smokeTest')
    await collection.insertOne({ isLeftover: true })

    // setupTestDb's beforeEach wipe runs before the next test reads it
    expect(await collection.countDocuments()).toBe(1)
  })

  it('wipes data left by the previous test', async () => {
    const collection = await mongoService.getCollection('smokeTest')

    expect(await collection.countDocuments()).toBe(0)
  })
})
