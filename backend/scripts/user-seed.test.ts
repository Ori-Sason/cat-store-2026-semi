import bcrypt from 'bcrypt'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { USER_COLLECTION, type UserDoc } from '../models/user.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { setupTestDb } from '../test/test-db.helper.ts'
import { seedUsers } from './user-seed.ts'

setupTestDb()

const PASSWORD = 'Seed-pass1'

async function _getUsers() {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.find({}, { sort: { username: 1 } }).toArray()
}

describe('seedUsers', () => {
  it('creates user and admin with a hashed password', async () => {
    const before = Date.now()
    expect(await seedUsers(PASSWORD)).toEqual(['user', 'admin'])

    const [admin, user] = await _getUsers()
    expect(admin).toMatchObject({ username: 'admin', fullname: 'Admin User', isAdmin: true })
    expect(user).toMatchObject({ username: 'user', fullname: 'Regular User', isAdmin: false })
    for (const doc of [admin!, user!]) {
      expect(doc.password).not.toBe(PASSWORD)
      expect(await bcrypt.compare(PASSWORD, doc.password)).toBe(true)
      expect(doc.createdAt).toBeGreaterThanOrEqual(before)
      expect(doc.updatedAt).toBe(doc.createdAt)
    }
  })

  it('keeps existing users as they are on a re-run', async () => {
    await seedUsers(PASSWORD)
    const before = await _getUsers()

    expect(await seedUsers(PASSWORD)).toEqual([])
    expect(await _getUsers()).toEqual(before)
  })

  it('creates only the missing user', async () => {
    await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    expect(await seedUsers(PASSWORD)).toEqual(['user'])
  })

  it('throws on a password mismatch, naming the users and leaving them untouched', async () => {
    await seedUsers(PASSWORD)
    const before = await _getUsers()

    await expect(seedUsers('Other-pass1')).rejects.toThrow(
      "SEED_USERS_PASSWORD doesn't match the stored password for: user, admin",
    )
    expect(await _getUsers()).toEqual(before)
  })

  it('throws on a password the schema rejects, before any insert', async () => {
    await expect(seedUsers('password')).rejects.toThrow()
    expect(await _getUsers()).toEqual([])
  })

  it('rejects a duplicate username through the unique index', async () => {
    await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    const now = Date.now()

    await expect(
      collection.insertOne({
        _id: new ObjectId(),
        username: 'admin',
        fullname: 'Another Admin',
        password: 'hash',
        isAdmin: true,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow(/duplicate key/)
  })
})
