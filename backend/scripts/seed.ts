import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ObjectId } from 'mongodb'
import { config, requireEnv } from '../config/index.ts'
import { CAT_COLLECTION, type CatDoc } from '../models/cat.ts'
import { REVIEW_COLLECTION, type ReviewDoc } from '../models/review.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { buildSeedCat, type RawCat } from './cat-seed.ts'
import { buildSeedReview, pickRandomReviewers } from './review-seed.ts'
import { SEED_CAT_OWNER_USERNAMES, seedUsers, type SeededUser } from './user-seed.ts'

const CATS_FILE_PATH = join(import.meta.dirname, 'data', 'cats.json')
const REVIEWS_FILE_PATH = join(import.meta.dirname, 'data', 'reviews.json')

// Users: creates the seed users that are missing, keeps the existing ones.
// Cats: wipes the collection and re-inserts every cat from the JSON file, each owned by a random
// cat-owner seed user (about half user, half admin), so there's an admin who owns cats, a user
// who owns cats, and cats the user doesn't own. The other seed users own none.
// Reviews: wiped with the cats, since the cats get fresh ids and old reviews would point at dead
// catIds. Every seed user, owners included, may review each cat, at most once per cat, with a
// text from the JSON pool.
// Re-running is safe: you always end up with the same users (same ids) and the same set of
// cats (fresh ids, labels and owners), with fresh random reviews
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

    const catOwners = seededUsers.filter((user) => SEED_CAT_OWNER_USERNAMES.includes(user.username))
    const rawCats: RawCat[] = JSON.parse(await readFile(CATS_FILE_PATH, 'utf8'))
    const cats = rawCats.map((raw) => buildSeedCat(raw, _pickRandom(catOwners)._id))

    // Built before any wipe too, so a bad row in reviews.json fails with the DB untouched
    const reviewContents: string[] = JSON.parse(await readFile(REVIEWS_FILE_PATH, 'utf8'))
    const reviews = cats.flatMap((cat) => {
      const reviewers = pickRandomReviewers(seededUsers)
      const contents = _pickDistinct(reviewContents, reviewers.length)
      return reviewers.map((reviewer, idx) =>
        buildSeedReview(contents[idx]!, cat._id, reviewer._id, cat.createdAt),
      )
    })

    // Reviews wiped first, so a run that fails halfway never leaves reviews on deleted cats
    const reviewCollection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
    await reviewCollection.deleteMany({})
    const catCollection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
    await catCollection.deleteMany({})

    const { insertedCount: catCount } = await catCollection.insertMany(cats)
    console.log(`Seeded ${catCount} cats into ${config.mongoDbConfig.dbName}`)
    console.log(
      `Owners: ${_countPerUser(
        cats.map((cat) => cat.ownerId),
        catOwners,
      )}`,
    )

    const { insertedCount: reviewCount } = await reviewCollection.insertMany(reviews)
    console.log(`Seeded ${reviewCount} reviews`)
    console.log(
      `Authors: ${_countPerUser(
        reviews.map((review) => review.userId),
        seededUsers,
      )}`,
    )
  } catch (err) {
    console.error('Seed failed:', err)
    process.exitCode = 1
  } finally {
    await mongoService.close()
  }
}

function _pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

// `count` different items, so one cat never shows the same review text twice.
// A partial Fisher-Yates shuffle: only the first `count` slots get shuffled
function _pickDistinct<T>(items: T[], count: number): T[] {
  const pool = [...items]
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, count)
}

// How many of `userIds` belong to each user, e.g. "user: 48, admin: 52"
function _countPerUser(userIds: ObjectId[], users: SeededUser[]): string {
  return users
    .map(({ _id, username }) => {
      const count = userIds.filter((userId) => userId.equals(_id)).length
      return `${username}: ${count}`
    })
    .join(', ')
}

await seed()
