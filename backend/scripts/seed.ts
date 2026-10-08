import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config, requireEnv } from '../config/index.ts'
import { CAT_COLLECTION, type CatDoc } from '../models/cat.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { buildSeedCat, type RawCat } from './cat-seed.ts'
import { seedUsers, type SeededUser } from './user-seed.ts'

const CATS_FILE_PATH = join(import.meta.dirname, 'data', 'cats.json')

// Users: creates the seed users that are missing, keeps the existing ones.
// Cats: wipes the collection and re-inserts every cat from the JSON file, each owned by a random
// seed user (about half user, half admin), so there's an admin who owns cats, a user who owns
// cats, and cats the user doesn't own.
// Re-running is safe: you always end up with the same users (same ids) and the same set of
// cats (fresh ids, labels and owners)
async function seed() {
  try {
    // Read here, not in config: only the seed needs it, the server never does
    const seedPassword = requireEnv('SEED_USERS_PASSWORD')
    // Users first: a password mismatch throws before the cat wipe, so a failed seed changes nothing
    const seededUsers = await seedUsers(seedPassword)
    const createdUsernames = seededUsers
      .filter((user) => user.isCreated)
      .map((user) => user.username)
    const existingCount = seededUsers.length - createdUsernames.length
    console.log(
      `Users: created ${createdUsernames.join(', ') || 'none'}, ${existingCount} already existed`,
    )

    const rawCats: RawCat[] = JSON.parse(await readFile(CATS_FILE_PATH, 'utf8'))
    const cats = rawCats.map((raw) => buildSeedCat(raw, _pickRandomOwner(seededUsers)._id))

    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.deleteMany({})
    const { insertedCount } = await collection.insertMany(cats)
    console.log(`Seeded ${insertedCount} cats into ${config.mongoDbConfig.dbName}`)
    console.log(`Owners: ${_countCatsPerOwner(cats, seededUsers)}`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoService.close()
  }
}

function _pickRandomOwner(users: SeededUser[]): SeededUser {
  return users[Math.floor(Math.random() * users.length)]!
}

// e.g. "user: 48, admin: 52"
function _countCatsPerOwner(cats: CatDoc[], users: SeededUser[]): string {
  return users
    .map(({ _id, username }) => {
      const count = cats.filter((cat) => cat.ownerId.equals(_id)).length
      return `${username}: ${count}`
    })
    .join(', ')
}

await seed()
