import bcrypt from 'bcrypt'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { USER_COLLECTION, type UserDoc } from '../models/user.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { setupTestDb } from '../test/test-db.helper.ts'
import { SEED_CAT_OWNER_USERNAMES, SEED_USERS, seedUsers } from './user-seed.ts'

setupTestDb()

const PASSWORD = 'Seed-pass1'

async function _getUsers() {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.find({}, { sort: { username: 1 } }).toArray()
}

describe('seedUsers', () => {
  it('creates every seed user with a hashed password, and returns them in SEED_USERS order', async () => {
    const before = Date.now()
    const seededUsers = await seedUsers(PASSWORD)

    const users = await _getUsers()
    const _getId = (username: string) => users.find((user) => user.username === username)!._id
    expect(seededUsers).toEqual(
      SEED_USERS.map(({ username, isAdmin }) => ({
        _id: _getId(username),
        username,
        isAdmin,
        isCreated: true,
      })),
    )
    expect(users).toHaveLength(SEED_USERS.length)
    for (const seedUser of SEED_USERS) {
      expect(users.find((user) => user.username === seedUser.username)).toMatchObject(seedUser)
    }
    for (const doc of users) {
      expect(doc.password).not.toBe(PASSWORD)
      expect(await bcrypt.compare(PASSWORD, doc.password)).toBe(true)
      expect(doc.createdAt).toBeGreaterThanOrEqual(before)
      expect(doc.updatedAt).toBe(doc.createdAt)
    }
  })

  it('has exactly one admin, and every cat owner is a seed user', () => {
    expect(SEED_USERS.filter((user) => user.isAdmin).map((user) => user.username)).toEqual([
      'admin',
    ])
    const usernames = SEED_USERS.map((user) => user.username)
    for (const username of SEED_CAT_OWNER_USERNAMES) expect(usernames).toContain(username)
  })

  it('keeps existing users as they are on a re-run, and still returns their ids', async () => {
    const firstRun = await seedUsers(PASSWORD)
    const before = await _getUsers()

    expect(await seedUsers(PASSWORD)).toEqual(
      firstRun.map((user) => ({ ...user, isCreated: false })),
    )
    expect(await _getUsers()).toEqual(before)
  })

  it('creates only the missing user, and returns all of them in SEED_USERS order', async () => {
    const [, ...firstOthers] = await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    const [user, ...others] = await seedUsers(PASSWORD)
    expect(user).toMatchObject({ username: 'user', isCreated: true })
    expect(others).toEqual(firstOthers.map((other) => ({ ...other, isCreated: false })))
  })

  it('throws on a password mismatch, naming the users and leaving them untouched', async () => {
    await seedUsers(PASSWORD)
    const before = await _getUsers()

    await expect(seedUsers('Other-pass1')).rejects.toThrow(
      "SEED_USERS_PASSWORD doesn't match the stored password for: user, admin, maya, noam, dana",
    )
    expect(await _getUsers()).toEqual(before)
  })

  // Regression: the missing users were inserted before the mismatch check threw
  it('creates no user when an existing one mismatches', async () => {
    await seedUsers(PASSWORD)
    const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
    await collection.deleteOne({ username: 'user' })

    await expect(seedUsers('Other-pass1')).rejects.toThrow(
      'stored password for: admin, maya, noam, dana',
    )
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
