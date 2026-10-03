import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from '../config/index.ts'
import { CAT_COLLECTION, type CatDoc } from '../models/cat.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { buildSeedCat, type RawCat } from './cat-seed.ts'

const CATS_FILE_PATH = join(import.meta.dirname, 'data', 'cats.json')

// Wipes the cats collection and re-inserts every cat from the JSON file.
// Re-running is safe: you always end up with the same set of cats (fresh ids and labels)
async function seed() {
  try {
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
