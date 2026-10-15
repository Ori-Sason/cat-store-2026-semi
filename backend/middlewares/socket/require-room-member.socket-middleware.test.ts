import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { socketService } from '../../services/socket.service.ts'
import { createFakeSocket } from '../../test/fake-socket.helper.ts'
import { requireRoomMember } from './require-room-member.socket-middleware.ts'

const EVENT = 'test:event'
const CAT_ID = '652f1c2e9b1e8a3d4c5b6a79'
const OTHER_CAT_ID = '652f1c2e9b1e8a3d4c5b6a80'

async function _emitWith(rooms: string[]) {
  const { socket, emit } = createFakeSocket({ rooms })
  socketService.on(socket, EVENT, requireRoomMember, () => ({ ok: true }))
  const ack = vi.fn()
  await emit(EVENT, { catId: CAT_ID }, ack)
  return ack
}

describe('requireRoomMember', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lets through a socket in the cat's room", async () => {
    const ack = await _emitWith([socketService.getCatRoomName(CAT_ID)])

    expect(ack).toHaveBeenCalledWith({ ok: true })
  })

  it('rejects a socket in another room with FORBIDDEN', async () => {
    const ack = await _emitWith([socketService.getCatRoomName(OTHER_CAT_ID)])

    expect(ack).toHaveBeenCalledWith({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
  })
})
