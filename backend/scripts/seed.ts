import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config, requireEnv } from '../config/index.ts'
import { CAT_COLLECTION, type CatDoc } from '../models/cat.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { buildSeedCat, type RawCat } from './cat-seed.ts'
import { SEED_USERS, seedUsers } from './user-seed.ts'

const CATS_FILE_PATH = join(import.meta.dirname, 'data', 'cats.json')

// Users: creates the seed users that are missing, keeps the existing ones.
// Cats: wipes the collection and re-inserts every cat from the JSON file.
// Re-running is safe: you always end up with the same users (same ids) and the same set of
// cats (fresh ids and labels)
async function seed() {
  try {
    // Read here, not in config: only the seed needs it, the server never does
    const seedPassword = requireEnv('SEED_USERS_PASSWORD')
    // Users first: a password mismatch throws before the cat wipe, so a failed seed changes nothing
    const createdUsers = await seedUsers(seedPassword)
    const existingCount = SEED_USERS.length - createdUsers.length
    console.log(
      `Users: created ${createdUsers.join(', ') || 'none'}, ${existingCount} already existed`,
    )

    const rawCats: RawCat[] = JSON.parse(await readFile(CATS_FILE_PATH, 'utf8'))
    const cats = rawCats.map((raw) => buildSeedCat(raw))

    const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await collection.deleteMany({})
    const { insertedCount } = await collection.insertMany(cats)
    console.log(`Seeded ${insertedCount} cats into ${config.mongoDbConfig.dbName}`)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoService.close()
  }
}

await seed()
