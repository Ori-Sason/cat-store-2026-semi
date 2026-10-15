import { describe, expect, it } from 'vitest'
import {
  CHAT_MSG_TEXT_MAX_LENGTH,
  chatHistoryQuerySchema,
  chatMsgRemoveSchema,
  chatMsgSchema,
  chatMsgUpdateSchema,
  chatRoomSchema,
  chatTypingSchema,
  type ChatMsgInput,
} from './chat.ts'

const catId = '652f1c2e9b1e8a3d4c5b6a79'
const msgId = '652f1c2e9b1e8a3d4c5b6a80'

const validMsg: ChatMsgInput = {
  catId,
  clientMsgId: '3b241101-e2bb-4255-8caf-4136c566a962',
  text: 'Is she still available?',
}

const _issuePaths = (input: unknown) => {
  const result = chatMsgSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.path.join('.'))
}

describe('chatMsgSchema', () => {
  it('accepts a valid msg as is', () => {
    expect(chatMsgSchema.parse(validMsg)).toEqual(validMsg)
  })

  it('strips userId and server-set fields', () => {
    const parsed = chatMsgSchema.parse({
      ...validMsg,
      _id: msgId,
      userId: 'u1',
      isDeleted: true,
      createdAt: 1,
      updatedAt: 2,
    })
    expect(parsed).toEqual(validMsg)
  })

  describe('catId', () => {
    it('lowercases it, so the room name and the FE filter match', () => {
      expect(chatMsgSchema.parse({ ...validMsg, catId: catId.toUpperCase() }).catId).toBe(catId)
    })

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['not hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
      // ObjectId.isValid accepts any 12-character string. The schema must not
      ['12 characters', 'twelve chars'],
      ['a number', 123],
    ])('rejects a catId that is %s', (_, badCatId) => {
      expect(_issuePaths({ ...validMsg, catId: badCatId })).toEqual(['catId'])
    })
  })

  describe('clientMsgId', () => {
    it.each([
      ['missing', undefined],
      ['not a UUID', 'msg-1'],
      ['an ObjectId', msgId],
    ])('rejects a clientMsgId that is %s', (_, clientMsgId) => {
      expect(_issuePaths({ ...validMsg, clientMsgId })).toEqual(['clientMsgId'])
    })
  })

  describe('text', () => {
    it('trims whitespace', () => {
      expect(chatMsgSchema.parse({ ...validMsg, text: '  Hi  ' }).text).toBe('Hi')
    })

    it('accepts exactly the max length', () => {
      const text = 'a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH)
      expect(chatMsgSchema.parse({ ...validMsg, text }).text).toBe(text)
    })

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['only spaces', '   '],
      ['too long', 'a'.repeat(CHAT_MSG_TEXT_MAX_LENGTH + 1)],
      ['a number', 5],
    ])('rejects text that is %s', (_, text) => {
      expect(_issuePaths({ ...validMsg, text })).toEqual(['text'])
    })
  })
})

describe('chatMsgUpdateSchema', () => {
  const validUpdate = { catId, msgId, text: 'Edited' }

  it('accepts a valid update and drops clientMsgId', () => {
    expect(
      chatMsgUpdateSchema.parse({ ...validUpdate, clientMsgId: validMsg.clientMsgId }),
    ).toEqual(validUpdate)
  })

  it('lowercases both ids', () => {
    const parsed = chatMsgUpdateSchema.parse({
      ...validUpdate,
      catId: catId.toUpperCase(),
      msgId: msgId.toUpperCase(),
    })
    expect(parsed).toEqual(validUpdate)
  })

  it.each([
    ['a missing msgId', { catId, text: 'Edited' }],
    ['a malformed msgId', { catId, msgId: 'nope', text: 'Edited' }],
    ['empty text', { catId, msgId, text: '  ' }],
  ])('rejects %s', (_, update) => {
    expect(chatMsgUpdateSchema.safeParse(update).success).toBe(false)
  })
})

describe('chatMsgRemoveSchema', () => {
  it('keeps only catId and msgId', () => {
    expect(chatMsgRemoveSchema.parse({ catId, msgId, text: 'x' })).toEqual({ catId, msgId })
  })

  it('rejects a missing msgId', () => {
    expect(chatMsgRemoveSchema.safeParse({ catId }).success).toBe(false)
  })
})

describe('chatRoomSchema', () => {
  it('lowercases catId', () => {
    expect(chatRoomSchema.parse({ catId: catId.toUpperCase() })).toEqual({ catId })
  })

  it('rejects a malformed catId', () => {
    expect(chatRoomSchema.safeParse({ catId: 'nope' }).success).toBe(false)
  })
})

describe('chatTypingSchema', () => {
  it.each([true, false])('accepts isTyping %s', (isTyping) => {
    expect(chatTypingSchema.parse({ catId, isTyping })).toEqual({ catId, isTyping })
  })

  it.each([
    ['missing', undefined],
    ['a string', 'true'],
  ])('rejects isTyping that is %s', (_, isTyping) => {
    expect(chatTypingSchema.safeParse({ catId, isTyping }).success).toBe(false)
  })
})

describe('chatHistoryQuerySchema', () => {
  it.each([
    ['nothing (the newest page)', {}],
    ['beforeId', { beforeId: msgId }],
    ['afterId', { afterId: msgId }],
  ])('accepts %s', (_, query) => {
    expect(chatHistoryQuerySchema.parse(query)).toEqual(query)
  })

  it('lowercases the cursor', () => {
    expect(chatHistoryQuerySchema.parse({ beforeId: msgId.toUpperCase() })).toEqual({
      beforeId: msgId,
    })
  })

  it('rejects beforeId and afterId together', () => {
    expect(chatHistoryQuerySchema.safeParse({ beforeId: msgId, afterId: msgId }).success).toBe(
      false,
    )
  })

  it.each([
    ['a malformed beforeId', { beforeId: 'nope' }],
    // a repeated query param (?beforeId=a&beforeId=b) arrives as an array
    ['a repeated afterId', { afterId: [msgId, msgId] }],
  ])('rejects %s', (_, query) => {
    expect(chatHistoryQuerySchema.safeParse(query).success).toBe(false)
  })
})
