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
  it('creates user and admin with a hashed password, and returns them', async () => {
    const before = Date.now()
    const seededUsers = await seedUsers(PASSWORD)

    const [admin, user] = await _getUsers()
    expect(seededUsers).toEqual([
      { _id: user!._id, username: 'user', isAdmin: false, isCreated: true },
      { _id: admin!._id, username: 'admin', isAdmin: true, isCreated: true },
    ])
    expect(admin).toMatchObject({ username: 'admin', fullname: 'Admin User', isAdmin: true })
    expect(user).toMatchObject({ username: 'user', fullname: 'Regular User', isAdmin: false })
    for (const doc of [admin!, user!]) {
      expect(doc.password).not.toBe(PASSWORD)
      expect(await bcrypt.compare(PASSWORD, doc.password)).toBe(true)
      expect(doc.createdAt).toBeGreaterThanOrEqual(before)
      expect(doc.updatedAt).toBe(doc.createdAt)
    }
  })

  it('keeps existing users as they are on a re-run, and still returns their ids', async () => {
    const firstRun = await seedUsers(PASSWORD)
    const before = await _getUsers()

    expect(await seedUsers(PASSWORD)).toEqual(
      firstRun.map((user) => ({ ...user, isCreated: false })),
    )
    expect(await _getUsers()).toEqual(before)
  })

  it('creates only the missing user, and returns both in SEED_USERS order', async () => {
    const [, firstAdmin] = await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    const [user, admin] = await seedUsers(PASSWORD)
    expect(user).toMatchObject({ username: 'user', isCreated: true })
    expect(admin).toEqual({ ...firstAdmin, isCreated: false })
  })

  it('throws on a password mismatch, naming the users and leaving them untouched', async () => {
    await seedUsers(PASSWORD)
    const before = await _getUsers()

    await expect(seedUsers('Other-pass1')).rejects.toThrow(
      "SEED_USERS_PASSWORD doesn't match the stored password for: user, admin",
    )
    expect(await _getUsers()).toEqual(before)
  })

  // Regression: the missing users were inserted before the mismatch check threw
  it('creates no user when an existing one mismatches', async () => {
    await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    await expect(seedUsers('Other-pass1')).rejects.toThrow('stored password for: admin')
    expect(await collection.findOne({ username: 'user' })).toBeNull()
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
