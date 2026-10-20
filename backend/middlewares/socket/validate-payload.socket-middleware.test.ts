import { chatRoomSchema } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socketService } from '../../services/socket/socket.service.ts'
import { createFakeSocket } from '../../test/fake-socket.helper.ts'
import { validatePayload } from './validate-payload.socket-middleware.ts'

const EVENT = 'test:event'
const CAT_ID = '652f1c2e9b1e8a3d4c5b6a79'

describe('validatePayload', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hands the parsed payload to the next step: lowercased, unknown keys stripped', async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(socket, EVENT, validatePayload(chatRoomSchema), ({ payload }) => payload)
    const ack = vi.fn()

    await emit(EVENT, { catId: CAT_ID.toUpperCase(), userId: 'u1' }, ack)

    expect(ack).toHaveBeenCalledWith({ catId: CAT_ID })
  })

  it('acks VALIDATION_FAILED with fieldErrors, and the chain stops', async () => {
    const { socket, emit } = createFakeSocket()
    const controller = vi.fn()
    socketService.on(socket, EVENT, validatePayload(chatRoomSchema), controller)
    const ack = vi.fn()

    await emit(EVENT, { catId: 'nope' }, ack)

    expect(controller).not.toHaveBeenCalled()
    expect(ack).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'VALIDATION_FAILED',
        message: 'Invalid payload',
        fieldErrors: { catId: ['Invalid cat'] },
      }),
    })
  })

  // socket.emit(name, cb): the callback is the ack, and there's no payload at all
  it('rejects a missing payload', async () => {
    const { socket, emit } = createFakeSocket()
    socketService.on(socket, EVENT, validatePayload(chatRoomSchema), () => ({ ok: true }))
    const ack = vi.fn()

    await emit(EVENT, ack)

    expect(ack).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    })
  })
})
