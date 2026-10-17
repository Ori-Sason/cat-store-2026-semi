import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'
import { buildSeedChatMsg, type ChatThread } from './chat-seed.ts'
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
