import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ObjectId } from 'mongodb'
import { config, requireEnv } from '../config/index.ts'
import { CAT_COLLECTION, type CatDoc } from '../models/cat.ts'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc } from '../models/chat.ts'
import { REVIEW_COLLECTION, type ReviewDoc } from '../models/review.ts'
import { mongoService } from '../services/mongodb.service.ts'
import { buildSeedCat, type RawCat } from './cat-seed.ts'
import {
  buildScriptedChatLog,
  buildRandomChatLog,
  SCRIPTED_CHAT_SPECS,
  pickScriptedChatCats,
  type ChatThread,
} from './chat-seed.ts'
import { buildSeedReview, pickRandomReviewers } from './review-seed.ts'
import { SEED_CAT_OWNER_USERNAMES, seedUsers, type SeededUser } from './user-seed.ts'

const CATS_FILE_PATH = join(import.meta.dirname, 'data', 'cats.json')
const REVIEWS_FILE_PATH = join(import.meta.dirname, 'data', 'reviews.json')
const CHAT_THREADS_FILE_PATH = join(import.meta.dirname, 'data', 'chat-threads.json')

// Users: creates the seed users that are missing, keeps the existing ones.
// Cats: wipes the collection and re-inserts every cat from the JSON file, each owned by a random
// cat-owner seed user (about half user, half admin), so there's an admin who owns cats, a user
// who owns cats, and cats the user doesn't own. The other seed users own none.
// Reviews: wiped with the cats, since the cats get fresh ids and old reviews would point at dead
// catIds. Every seed user, owners included, may review each cat, at most once per cat, with a
// text from the JSON pool.
// Chat msgs: wiped with the cats too. The 4 cats on top of /cat are the scripted cats: a fixed
// log and owner each (SCRIPTED_CHAT_SPECS), for the manual checks of "load older" and the msg
// states. Every other cat gets a random log, maybe empty, from the JSON thread pool.
// Re-running is safe: you always end up with the same users (same ids) and the same set of
// cats (fresh ids, labels and owners), with fresh random reviews and chat logs (the scripted
// cats' logs come back the same)
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
    // Owners fixed before reviews and chat are built, so both see each cat's final owner
    const scriptedCats = pickScriptedChatCats(cats)
    scriptedCats.forEach((cat, idx) => {
      const { ownerUsername } = SCRIPTED_CHAT_SPECS[idx]!
      cat.ownerId = catOwners.find(({ username }) => username === ownerUsername)!._id
    })

    // Built before any wipe too, so a bad row in reviews.json fails with the DB untouched
    const reviewContents: string[] = JSON.parse(await readFile(REVIEWS_FILE_PATH, 'utf8'))
    const reviews = cats.flatMap((cat) => {
      const reviewers = pickRandomReviewers(seededUsers)
      const contents = _pickDistinct(reviewContents, reviewers.length)
      return reviewers.map((reviewer, idx) =>
        buildSeedReview(contents[idx]!, cat._id, reviewer._id, cat.createdAt),
      )
    })

    const chatThreads: ChatThread[] = JSON.parse(await readFile(CHAT_THREADS_FILE_PATH, 'utf8'))
    const chatMsgs = cats.flatMap((cat) => {
      const scriptedIdx = scriptedCats.indexOf(cat)
      return scriptedIdx === -1
        ? buildRandomChatLog(cat, seededUsers, chatThreads)
        : buildScriptedChatLog(cat, seededUsers, chatThreads, SCRIPTED_CHAT_SPECS[scriptedIdx]!)
    })

    // Chat msgs and reviews wiped first, so a run that fails halfway never leaves them on
    // deleted cats
    const chatMsgCollection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    await chatMsgCollection.deleteMany({})
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

    // insertMany throws on an empty array. Only possible with a tiny cats.json
    if (chatMsgs.length) await chatMsgCollection.insertMany(chatMsgs)
    console.log(`Seeded ${chatMsgs.length} chat msgs: ${_countChatMsgStates(chatMsgs)}`)
    for (const cat of scriptedCats) {
      const owner = catOwners.find(({ _id }) => _id.equals(cat.ownerId))!
      const size = chatMsgs.filter(({ catId }) => catId.equals(cat._id)).length
      console.log(`Scripted cat: ${cat.name}, ${size} msgs, owned by ${owner.username}`)
    }
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

// e.g. "plain: 900, edited: 95, deleted: 40, edited then deleted: 12"
function _countChatMsgStates(chatMsgs: ChatMsgDoc[]): string {
  const counts = { plain: 0, edited: 0, deleted: 0, 'edited then deleted': 0 }
  for (const { isDeleted, createdAt, updatedAt } of chatMsgs) {
    const isEdited = updatedAt > createdAt
    if (isEdited && isDeleted) counts['edited then deleted']++
    else if (isEdited) counts.edited++
    else if (isDeleted) counts.deleted++
    else counts.plain++
  }
  return Object.entries(counts)
    .map(([state, count]) => `${state}: ${count}`)
    .join(', ')
}

await seed()
