import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { chatMsgSchema } from '@cat-store/shared'
import { CHAT_MSG_PAGE_SIZE } from '../api/chat/chat.service.ts'
import type { CatDoc } from '../models/cat.ts'
import type { ChatMsgDoc } from '../models/chat.ts'

// One conversation from data/chat-threads.json. `speaker` is a slot inside the thread, not a user:
// the planner fills each slot with a distinct user (or the ghost, a user who got deleted), so nobody answers themselves.
// Threads repeat across cats, so a line never names the cat, its owner or its gender
export interface ChatThreadLine {
  speaker: number
  text: string
}

export interface ChatThread {
  lines: ChatThreadLine[]
}

// How a msg ends up. The planner picks one per msg, the core applies it
export type SeedChatMsgState = 'plain' | 'edited' | 'deleted' | 'editedThenDeleted'

// A thread placed in a log: its speaker slots filled (index = slot), and the time of its newest line
export interface PlannedChatThread {
  thread: ChatThread
  speakerIds: ObjectId[]
  endAt: number
}

export const SEED_CHAT_LINE_GAP_MS = 2 * 60 * 1000
export const SEED_CHAT_EDIT_DELAY_MS = 5 * 60 * 1000
// The newest msg of a log is at least this old, so its edit still lands before now
export const SEED_CHAT_NEWEST_AGE_MS = 2 * 60 * 60 * 1000
const _PAGING_THREAD_GAP_MS = 2 * 24 * 60 * 60 * 1000

// The 4 newest cats, i.e. the top of /cat's default sort, in that order. Fixed fixtures for the
// manual checks of "load older", so the same log comes back on every re-seed. Sized around the
// history page (50): 120 → 2 loads, 70 → 1, 50 → no button, 51 → 1 load that brings only the ghost.
// The owners replace the random ones, so each owner gets a cat with chips to check.
// firstThreadIdx spreads the specs over the pool, so the 4 logs don't read the same
export interface PagingChatSpec {
  size: number
  ownerUsername: 'user' | 'admin'
  firstThreadIdx: number
}

export const PAGING_CHAT_SPECS: PagingChatSpec[] = [
  { size: 120, ownerUsername: 'user', firstThreadIdx: 0 },
  { size: 70, ownerUsername: 'admin', firstThreadIdx: 8 },
  { size: 50, ownerUsername: 'user', firstThreadIdx: 16 },
  { size: 51, ownerUsername: 'admin', firstThreadIdx: 24 },
]

// The showcase every page of the paging cats carries, by offset from that page's newest msg.
// A page shorter than _SHOWCASE_MIN_PAGE_SIZE is too thin for it, and gets only the ghost
const _SHOWCASE_MIN_PAGE_SIZE = 20
const _SHOWCASE_STATES: Partial<Record<number, SeedChatMsgState>> = {
  1: 'edited',
  4: 'deleted',
  7: 'editedThenDeleted',
}
const _SHOWCASE_GHOST_OFFSET = 10

// One plain msg. The planner owns the times and the states: it passes createdAt and applies an
// edit or a delete on the returned doc. Validates with the shared schema, so a bad line in
// chat-threads.json fails here instead of landing in the DB.
// `_id` is made here, so call it oldest first: ids from one process grow with each call, and
// history pages by `_id` while the UI shows createdAt. clientMsgId comes from Node's
// randomUUID: the browser's secure-context limit doesn't apply here
export function buildSeedChatMsg(
  text: string,
  catId: ObjectId,
  userId: ObjectId,
  createdAt: number,
): ChatMsgDoc {
  const input = chatMsgSchema.parse({
    catId: catId.toHexString(),
    clientMsgId: randomUUID(),
    text,
  })
  return {
    _id: new ObjectId(),
    catId,
    userId,
    clientMsgId: input.clientMsgId,
    text: input.text,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  }
}

// The core both planners go through. The planner picks the threads, who speaks and each msg's
// state, and the core owns every rule that makes a log valid, so they're tested once:
// - Built newest first, since the planners count offsets from the newest msg. Lines in a thread
//   are SEED_CHAT_LINE_GAP_MS apart, back from the thread's endAt. A thread whose endAt overlaps
//   the newer one is pushed back, so times always go down.
// - Trimmed to `size`, which cuts the head of the oldest thread. A log that starts
//   mid-conversation is fine for seed data.
// - Reversed, then built oldest first, so `_id` order matches createdAt order (history pages by
//   `_id`, the UI shows createdAt).
// - An edit sets updatedAt = createdAt + SEED_CHAT_EDIT_DELAY_MS. A delete sets only isDeleted,
//   like the real remove, so "Edited at" survives on an edited-then-deleted msg.
// Throws when the threads run short of `size`, or a msg falls outside the cat's createdAt..now
export function buildChatLog(
  cat: Pick<CatDoc, '_id' | 'createdAt'>,
  plannedThreads: PlannedChatThread[],
  size: number,
  pickState: (offsetFromNewest: number) => SeedChatMsgState,
): ChatMsgDoc[] {
  const lines: { text: string; userId: ObjectId; createdAt: number }[] = []
  let lastAt = Infinity
  for (const { thread, speakerIds, endAt } of plannedThreads) {
    if (lines.length >= size) break
    let at = Math.min(endAt, lastAt - SEED_CHAT_LINE_GAP_MS)
    for (const { speaker, text } of thread.lines.toReversed()) {
      const userId = speakerIds[speaker]
      if (!userId) throw new Error(`No user for speaker slot ${speaker}`)
      lines.push({ text, userId, createdAt: at })
      lastAt = at
      at -= SEED_CHAT_LINE_GAP_MS
    }
  }
  if (lines.length < size) {
    throw new Error(`The planned threads hold ${lines.length} lines, the log needs ${size}`)
  }

  const now = Date.now()
  return lines
    .slice(0, size)
    .reverse()
    .map(({ text, userId, createdAt }, idx) => {
      const msg = buildSeedChatMsg(text, cat._id, userId, createdAt)
      const state = pickState(size - 1 - idx)
      if (state === 'edited' || state === 'editedThenDeleted') {
        msg.updatedAt = createdAt + SEED_CHAT_EDIT_DELAY_MS
      }
      if (state === 'deleted' || state === 'editedThenDeleted') msg.isDeleted = true
      if (msg.createdAt < cat.createdAt || msg.updatedAt > now) {
        throw new Error(`A chat msg at ${new Date(createdAt).toISOString()} is out of range`)
      }
      return msg
    })
}

// A paging cat's log, the same on every build (ids and clock aside):
// - Threads from the pool in order, starting at the spec's firstThreadIdx, distinct within the log.
// - Times count back from now: the newest msg SEED_CHAT_NEWEST_AGE_MS ago, threads
//   _PAGING_THREAD_GAP_MS apart.
// - Speaker slots are filled from one rotation of `users`, a running pointer across threads, so
//   every page (~20 slots) hears from all of them: the owner, `admin` and the reviewer-only users.
// - Each page gets the showcase states and one ghost (a fresh ObjectId with no user doc, shown as
//   "[Deleted User]"). The ghost takes one whole slot in its thread, so it reads like one person
// `users` are the seed users, in SEED_USERS order
export function buildPagingChatLog(
  cat: Pick<CatDoc, '_id' | 'createdAt'>,
  users: { _id: ObjectId }[],
  threads: ChatThread[],
  spec: PagingChatSpec,
): ChatMsgDoc[] {
  const ghostId = new ObjectId()
  const ghostOffsets = _getGhostOffsets(spec.size)
  const newestAt = Date.now() - SEED_CHAT_NEWEST_AGE_MS
  const plannedThreads: PlannedChatThread[] = []
  let offset = 0 // of the current thread's newest line
  let userIdx = 0
  for (let i = 0; offset < spec.size; i++) {
    if (i === threads.length) throw new Error(`The thread pool is too small for ${spec.size} msgs`)
    const thread = threads[(spec.firstThreadIdx + i) % threads.length]!
    const { lines } = thread
    // Line k sits at offset + (lines.length - 1 - k), counted from the log's newest msg
    const ghostLine = lines.find((_, k) => ghostOffsets.includes(offset + lines.length - 1 - k))
    const slotCount = Math.max(...lines.map(({ speaker }) => speaker)) + 1
    const speakerIds = Array.from({ length: slotCount }, (_, slot) =>
      slot === ghostLine?.speaker ? ghostId : users[userIdx++ % users.length]!._id,
    )
    plannedThreads.push({ thread, speakerIds, endAt: newestAt - i * _PAGING_THREAD_GAP_MS })
    offset += lines.length
  }
  return buildChatLog(cat, plannedThreads, spec.size, (offsetFromNewest) =>
    _pickShowcaseState(offsetFromNewest, spec.size),
  )
}

// A page is CHAT_MSG_PAGE_SIZE msgs counted from the newest, the last one possibly shorter
function _toPagePosition(offsetFromNewest: number, size: number) {
  const pageStart = offsetFromNewest - (offsetFromNewest % CHAT_MSG_PAGE_SIZE)
  return {
    pageStart,
    offsetInPage: offsetFromNewest - pageStart,
    isShowcasePage: Math.min(CHAT_MSG_PAGE_SIZE, size - pageStart) >= _SHOWCASE_MIN_PAGE_SIZE,
  }
}

function _pickShowcaseState(offsetFromNewest: number, size: number): SeedChatMsgState {
  const { offsetInPage, isShowcasePage } = _toPagePosition(offsetFromNewest, size)
  return (isShowcasePage && _SHOWCASE_STATES[offsetInPage]) || 'plain'
}

// One ghost per page: near the top of a showcase page, or the newest msg of a short page (the
// 51 cat's single older msg)
function _getGhostOffsets(size: number): number[] {
  const offsets: number[] = []
  for (let pageStart = 0; pageStart < size; pageStart += CHAT_MSG_PAGE_SIZE) {
    const { isShowcasePage } = _toPagePosition(pageStart, size)
    offsets.push(isShowcasePage ? pageStart + _SHOWCASE_GHOST_OFFSET : pageStart)
  }
  return offsets
}
