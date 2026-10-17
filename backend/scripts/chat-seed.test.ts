import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ObjectId } from 'mongodb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'
import { CHAT_MSG_PAGE_SIZE } from '../api/chat/chat.service.ts'
import type { ChatMsgDoc } from '../models/chat.ts'
import type { RawCat } from './cat-seed.ts'
import {
  buildChatLog,
  buildScriptedChatLog,
  buildRandomChatLog,
  buildSeedChatMsg,
  SCRIPTED_CHAT_SPECS,
  pickScriptedChatCats,
  SEED_CHAT_EDIT_DELAY_MS,
  SEED_CHAT_LINE_GAP_MS,
  SEED_RANDOM_CHAT_MAX_SIZE,
  SEED_RANDOM_CHAT_MIN_SIZE,
  type ChatThread,
  type PlannedChatThread,
  type SeedChatMsgState,
} from './chat-seed.ts'
import { SEED_USERS } from './user-seed.ts'

const CREATED_AT = 1700000000000
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const threads: ChatThread[] = JSON.parse(
  readFileSync(join(import.meta.dirname, 'data', 'chat-threads.json'), 'utf8'),
)

describe('buildSeedChatMsg', () => {
  const catId = new ObjectId()
  const userId = new ObjectId()

  it('builds a plain msg on the given cat, by the given user, with trimmed text', () => {
    const msg = buildSeedChatMsg('  Is she ok with dogs?  ', catId, userId, CREATED_AT)
    expect(msg).toEqual({
      _id: expect.any(ObjectId),
      catId,
      userId,
      clientMsgId: expect.stringMatching(UUID_REGEX),
      text: 'Is she ok with dogs?',
      isDeleted: false,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    })
  })

  // The chat:msg-add dedupe is unique on { userId, clientMsgId }, so a repeat would fail the insert
  it('gives every msg its own clientMsgId', () => {
    const first = buildSeedChatMsg('Hi', catId, userId, CREATED_AT)
    const second = buildSeedChatMsg('Hi', catId, userId, CREATED_AT)
    expect(first.clientMsgId).not.toBe(second.clientMsgId)
  })

  // History pages by _id, so the planner relies on call order matching id order
  it('gives a later call a bigger _id', () => {
    const first = buildSeedChatMsg('Hi', catId, userId, CREATED_AT)
    const second = buildSeedChatMsg('Hi', catId, userId, CREATED_AT)
    expect(first._id.toHexString() < second._id.toHexString()).toBe(true)
  })

  it('throws on text the schema rejects', () => {
    expect(() => buildSeedChatMsg('   ', catId, userId, CREATED_AT)).toThrow()
    const tooLong = 'a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH + 1)
    expect(() => buildSeedChatMsg(tooLong, catId, userId, CREATED_AT)).toThrow()
  })
})

describe('chat-threads.json', () => {
  it('has threads of 3 to 8 lines', () => {
    expect(threads.length).toBeGreaterThan(0)
    for (const { lines } of threads) {
      expect(lines.length).toBeGreaterThanOrEqual(3)
      expect(lines.length).toBeLessThanOrEqual(8)
    }
  })

  it('builds every line', () => {
    const catId = new ObjectId()
    const userId = new ObjectId()
    expect(() =>
      threads.flatMap(({ lines }) =>
        lines.map(({ text }) => buildSeedChatMsg(text, catId, userId, CREATED_AT)),
      ),
    ).not.toThrow()
  })

  // Each slot takes a distinct seed user, so a thread can't have more slots than there are users
  it('keeps every speaker slot in range of the seed users', () => {
    for (const { lines } of threads) {
      for (const { speaker } of lines) {
        expect(Number.isInteger(speaker)).toBe(true)
        expect(speaker).toBeGreaterThanOrEqual(0)
        expect(speaker).toBeLessThan(SEED_USERS.length)
      }
    }
  })
})

// A log oldest first is sorted when each msg is later, with a bigger _id, than the one before
function _expectAscending(log: ChatMsgDoc[]) {
  for (let i = 1; i < log.length; i++) {
    expect(log[i]!.createdAt).toBeGreaterThan(log[i - 1]!.createdAt)
    expect(log[i]!._id.toHexString() > log[i - 1]!._id.toHexString()).toBe(true)
  }
}

// An edit moves updatedAt by exactly the edit delay, and a delete never moves it
function _expectUpdatedAtRules(log: ChatMsgDoc[]) {
  for (const { createdAt, updatedAt } of log) {
    expect([createdAt, createdAt + SEED_CHAT_EDIT_DELAY_MS]).toContain(updatedAt)
  }
}

function _toState({ isDeleted, createdAt, updatedAt }: ChatMsgDoc): SeedChatMsgState {
  const isEdited = updatedAt > createdAt
  if (isEdited && isDeleted) return 'editedThenDeleted'
  if (isEdited) return 'edited'
  return isDeleted ? 'deleted' : 'plain'
}

describe('buildChatLog', () => {
  const NOW = Date.now()
  const cat = { _id: new ObjectId(), createdAt: NOW - 30 * 24 * 60 * 60 * 1000 }
  const [alice, bob] = [new ObjectId(), new ObjectId()]
  const _thread = (...texts: string[]): ChatThread => ({
    lines: texts.map((text, idx) => ({ speaker: idx % 2, text })),
  })
  // Newest first, the newer thread a day after the older one
  const planned: PlannedChatThread[] = [
    { thread: _thread('b1', 'b2', 'b3'), speakerIds: [alice, bob], endAt: NOW - 60 * 60 * 1000 },
    {
      thread: _thread('a1', 'a2', 'a3'),
      speakerIds: [bob, alice],
      endAt: NOW - 25 * 60 * 60 * 1000,
    },
  ]
  const _plain = (): SeedChatMsgState => 'plain'

  it('builds oldest first, trimming the head of the oldest thread', () => {
    const log = buildChatLog(cat, planned, 5, _plain)
    expect(log.map(({ text }) => text)).toEqual(['a2', 'a3', 'b1', 'b2', 'b3'])
    expect(log.map(({ userId }) => userId)).toEqual([alice, bob, alice, bob, alice])
    expect(log.every((msg) => msg.catId === cat._id)).toBe(true)
  })

  it('spaces lines in a thread by the line gap, back from its endAt', () => {
    const log = buildChatLog(cat, planned, 3, _plain)
    expect(log.map(({ createdAt }) => createdAt)).toEqual([
      planned[0]!.endAt - 2 * SEED_CHAT_LINE_GAP_MS,
      planned[0]!.endAt - SEED_CHAT_LINE_GAP_MS,
      planned[0]!.endAt,
    ])
  })

  it('keeps times and ids ascending when a thread overlaps the newer one', () => {
    const overlapping = planned.map((plannedThread) => ({
      ...plannedThread,
      endAt: planned[0]!.endAt,
    }))
    const log = buildChatLog(cat, overlapping, 6, _plain)
    _expectAscending(log)
  })

  it('applies the picked state by offset from the newest msg', () => {
    const states: SeedChatMsgState[] = ['plain', 'edited', 'deleted', 'editedThenDeleted']
    const log = buildChatLog(cat, planned, 4, (offset) => states[offset]!)
    expect(log.toReversed().map(_toState)).toEqual(states)
    _expectUpdatedAtRules(log)
  })

  it('throws when the threads run short of the size', () => {
    expect(() => buildChatLog(cat, planned, 7, _plain)).toThrow()
  })

  it("throws on a msg before the cat's createdAt or an edit after now", () => {
    const lateCat = { ...cat, createdAt: planned[1]!.endAt }
    expect(() => buildChatLog(lateCat, planned, 6, _plain)).toThrow()
    const tooNew = [{ ...planned[0]!, endAt: NOW }]
    expect(() => buildChatLog(cat, tooNew, 3, () => 'edited')).toThrow()
  })

  it('throws on a speaker slot with no user', () => {
    const missingSlot = [{ ...planned[0]!, speakerIds: [alice] }]
    expect(() => buildChatLog(cat, missingSlot, 3, _plain)).toThrow()
  })
})

describe('buildScriptedChatLog', () => {
  const users = SEED_USERS.map(() => ({ _id: new ObjectId() }))
  const rawCats: RawCat[] = JSON.parse(
    readFileSync(join(import.meta.dirname, 'data', 'cats.json'), 'utf8'),
  )
  // The newest seed cat: the strictest createdAt any scripted cat can have
  const cat = { _id: new ObjectId(), createdAt: Math.max(...rawCats.map((raw) => raw.createdAt)) }

  // A user's index in `users`, or 'ghost' for an id with no user
  const _toAuthor = ({ userId }: ChatMsgDoc) => {
    const idx = users.findIndex(({ _id }) => _id.equals(userId))
    return idx === -1 ? 'ghost' : idx
  }

  // History pages, newest first, each page newest first: the order offsets count in
  const _toPages = (log: ChatMsgDoc[]) => {
    const newestFirst = log.toReversed()
    const pages: ChatMsgDoc[][] = []
    for (let i = 0; i < newestFirst.length; i += CHAT_MSG_PAGE_SIZE) {
      pages.push(newestFirst.slice(i, i + CHAT_MSG_PAGE_SIZE))
    }
    return pages
  }

  describe.each(SCRIPTED_CHAT_SPECS)('the $size msgs spec', (spec) => {
    const log = buildScriptedChatLog(cat, users, threads, spec)
    const pages = _toPages(log)
    const showcasePages = pages.filter((page) => page.length >= 20)

    it('has the exact size', () => {
      expect(log).toHaveLength(spec.size)
    })

    it('builds the same texts, authors and states every time', () => {
      const _toFixture = (msgs: ChatMsgDoc[]) =>
        msgs.map((msg) => [msg.text, _toAuthor(msg), _toState(msg)])
      expect(_toFixture(buildScriptedChatLog(cat, users, threads, spec))).toEqual(_toFixture(log))
    })

    it('puts the showcase states at their offsets on every page of 20 or more', () => {
      expect(showcasePages.length).toBeGreaterThan(0)
      for (const page of showcasePages) {
        const states = page.map(_toState)
        expect(states[1]).toBe('edited')
        expect(states[4]).toBe('deleted')
        expect(states[7]).toBe('editedThenDeleted')
        expect(states.filter((state) => state !== 'plain')).toHaveLength(3)
      }
    })

    it('has a ghost and every seed user on every page of 20 or more', () => {
      for (const page of showcasePages) {
        const authors = new Set(page.map(_toAuthor))
        expect(authors).toEqual(new Set(['ghost', ...users.keys()]))
      }
    })

    it('uses one ghost id for the whole log', () => {
      const ghostIds = new Set(
        log.filter((msg) => _toAuthor(msg) === 'ghost').map(({ userId }) => userId.toHexString()),
      )
      expect(ghostIds.size).toBe(1)
    })

    it("keeps times and ids ascending, between the cat's createdAt and now", () => {
      _expectAscending(log)
      _expectUpdatedAtRules(log)
      expect(log[0]!.createdAt).toBeGreaterThan(cat.createdAt)
      expect(log.at(-1)!.updatedAt).toBeLessThan(Date.now())
    })

    it('uses each thread at most once', () => {
      // A thread's first line is unique enough across the pool to stand for it
      const threadStarts = new Set(threads.map(({ lines }) => lines[0]!.text))
      const startsInLog = log.map(({ text }) => text).filter((text) => threadStarts.has(text))
      expect(new Set(startsInLog).size).toBe(startsInLog.length)
    })
  })

  it('gives the 51 msgs cat a single older msg, by the ghost', () => {
    const spec = SCRIPTED_CHAT_SPECS.find(({ size }) => size === 51)!
    const pages = _toPages(buildScriptedChatLog(cat, users, threads, spec))
    expect(pages.map((page) => page.length)).toEqual([50, 1])
    expect(_toAuthor(pages[1]![0]!)).toBe('ghost')
    expect(_toState(pages[1]![0]!)).toBe('plain')
  })

  it('starts each spec at a different thread', () => {
    const newestTexts = SCRIPTED_CHAT_SPECS.map(
      (spec) => buildScriptedChatLog(cat, users, threads, spec).at(-1)!.text,
    )
    expect(new Set(newestTexts).size).toBe(SCRIPTED_CHAT_SPECS.length)
  })
})

describe('buildRandomChatLog', () => {
  const HOUR_MS = 60 * 60 * 1000
  const users = SEED_USERS.map(() => ({ _id: new ObjectId() }))
  const cat = { _id: new ObjectId(), createdAt: Date.now() - 2 * 365 * 24 * HOUR_MS }
  // Enough builds that a 10% ghost or a 20% empty log shows up for sure in practice
  const BUILD_COUNT = 300

  const _isUser = (userId: ObjectId) => users.some(({ _id }) => _id.equals(userId))

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds an empty log, or one in the size range', () => {
    const sizes = Array.from(
      { length: BUILD_COUNT },
      () => buildRandomChatLog(cat, users, threads).length,
    )
    expect(sizes).toContain(0)
    for (const size of sizes.filter((size) => size > 0)) {
      expect(size).toBeGreaterThanOrEqual(SEED_RANDOM_CHAT_MIN_SIZE)
      expect(size).toBeLessThanOrEqual(SEED_RANDOM_CHAT_MAX_SIZE)
    }
  })

  it('hits both ends of the size range on the extreme rolls', () => {
    // The first roll is the empty check, the second the size, the rest don't matter here
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    expect(buildRandomChatLog(cat, users, threads)).toHaveLength(SEED_RANDOM_CHAT_MIN_SIZE)
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)
    expect(buildRandomChatLog(cat, users, threads)).toHaveLength(SEED_RANDOM_CHAT_MAX_SIZE)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(buildRandomChatLog(cat, users, threads)).toEqual([])
  })

  it("keeps times and ids ascending, between the cat's createdAt and now", () => {
    for (let i = 0; i < BUILD_COUNT; i++) {
      const log = buildRandomChatLog(cat, users, threads)
      _expectAscending(log)
      _expectUpdatedAtRules(log)
      for (const { createdAt, updatedAt } of log) {
        expect(createdAt).toBeGreaterThanOrEqual(cat.createdAt)
        expect(updatedAt).toBeLessThan(Date.now())
      }
    }
  })

  // The low end of the thread times leaves room for a full log pushed back behind it
  it('fits a full log on a cat listed 3 hours ago, every thread on the earliest time', () => {
    const newCat = { ...cat, createdAt: Date.now() - 3 * HOUR_MS }
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.9999)
      .mockReturnValue(0)
    const log = buildRandomChatLog(newCat, users, threads)
    expect(log).toHaveLength(SEED_RANDOM_CHAT_MAX_SIZE)
    _expectAscending(log)
    expect(log[0]!.createdAt).toBeGreaterThanOrEqual(newCat.createdAt)
  })

  it('sometimes has a ghost, at most one per log, matching no user', () => {
    let ghostLogCount = 0
    for (let i = 0; i < BUILD_COUNT; i++) {
      const log = buildRandomChatLog(cat, users, threads)
      const ghostIds = new Set(
        log.filter(({ userId }) => !_isUser(userId)).map(({ userId }) => userId.toHexString()),
      )
      expect(ghostIds.size).toBeLessThanOrEqual(1)
      if (ghostIds.size) ghostLogCount++
    }
    expect(ghostLogCount).toBeGreaterThan(0)
  })
})

describe('pickScriptedChatCats', () => {
  const _cat = (createdAt: number) => ({ _id: new ObjectId(), createdAt })
  const cats = [_cat(5), _cat(1), _cat(4), _cat(2), _cat(3), _cat(6)]

  it('picks one cat per spec, newest first, whatever the array order', () => {
    const newestFirst = [cats[5], cats[0], cats[2], cats[4]]
    expect(pickScriptedChatCats(cats)).toEqual(newestFirst)
    expect(pickScriptedChatCats(cats.toReversed())).toEqual(newestFirst)
    expect(newestFirst).toHaveLength(SCRIPTED_CHAT_SPECS.length)
  })

  // The /cat sort breaks a createdAt tie by _id ascending
  it('breaks a createdAt tie by the smaller _id first', () => {
    const [first, second] = [_cat(9), _cat(9)]
    expect(pickScriptedChatCats([second!, first!, ...cats]).slice(0, 2)).toEqual([first, second])
  })
})
