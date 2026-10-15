import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import type { LoggedInUser } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc } from '../../models/chat.ts'
import { alsService } from '../../services/als.service.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { socketService } from '../../services/socket.service.ts'
import { createFakeSocket } from '../../test/fake-socket.helper.ts'
import { setupTestDb } from '../../test/test-db.helper.ts'
import { requireChatMsgPermission } from './require-chat-msg-permission.socket-middleware.ts'

setupTestDb()

const EVENT = 'test:event'
const CAT_ID = new ObjectId()
const AUTHOR_ID = new ObjectId()

const VERIFIED_USER: LoggedInUser = {
  _id: AUTHOR_ID.toHexString(),
  username: 'maya',
  fullname: 'Maya',
  isAdmin: false,
}

const MSG: ChatMsgDoc = {
  _id: new ObjectId(),
  catId: CAT_ID,
  userId: AUTHOR_ID,
  clientMsgId: randomUUID(),
  text: 'Is she still available?',
  isDeleted: false,
  createdAt: 1,
  updatedAt: 1,
}

// The first step stands in for requireSocketUser. The last one acks { ok: true } if the check
// let the event through
async function _emitWith(
  check: (msgUserId: string, loggedInUser: unknown) => boolean,
  payload: { catId: string; msgId: string },
) {
  const { socket, emit } = createFakeSocket()
  socketService.on(
    socket,
    EVENT,
    () => {
      alsService.getStore().verifiedUser = VERIFIED_USER
    },
    requireChatMsgPermission(check),
    () => ({ ok: true }),
  )
  const ack = vi.fn()
  await emit(EVENT, payload, ack)
  return ack
}

const MSG_PAYLOAD = { catId: CAT_ID.toHexString(), msgId: MSG._id.toHexString() }

describe('requireChatMsgPermission', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const chatMsgs = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
    await chatMsgs.insertOne(MSG)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("passes the msg's author and the verified user to the check, and lets a pass through", async () => {
    const check = vi.fn(() => true)

    const ack = await _emitWith(check, MSG_PAYLOAD)

    expect(check).toHaveBeenCalledWith(AUTHOR_ID.toHexString(), VERIFIED_USER)
    expect(ack).toHaveBeenCalledWith({ ok: true })
  })

  it('rejects a failed check with FORBIDDEN', async () => {
    const ack = await _emitWith(() => false, MSG_PAYLOAD)

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
  })

  // 404 before 403: a check that fails everyone still answers CHAT_MSG_NOT_FOUND
  it('rejects a missing msg with CHAT_MSG_NOT_FOUND, before the check runs', async () => {
    const check = vi.fn(() => false)

    const ack = await _emitWith(check, { ...MSG_PAYLOAD, msgId: new ObjectId().toHexString() })

    expect(ack).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'CHAT_MSG_NOT_FOUND' }),
    })
    expect(check).not.toHaveBeenCalled()
  })

  it('rejects a msg in another room with CHAT_MSG_NOT_FOUND', async () => {
    const ack = await _emitWith(() => true, {
      ...MSG_PAYLOAD,
      catId: new ObjectId().toHexString(),
    })

    expect(ack).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'CHAT_MSG_NOT_FOUND' }),
    })
  })
})
