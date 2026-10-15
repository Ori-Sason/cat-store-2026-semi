import type { ChatRoomInput } from '@cat-store/shared'
import type { SocketEvent } from '../../models/socket.ts'
import { socketService } from '../../services/socket.service.ts'
import { catService } from '../cat/cat.service.ts'

// chat:join. The only chat event that reads the cat: join is the gate, so membership means the
// cat existed when the socket joined.
// Idempotent, so StrictMode's join → leave → join is harmless.
// payload.catId is lowercased by chatRoomSchema; the room name comes from the cat's own
// toHexString() anyway, so it always matches the room broadcasts go to
async function join({ socket, payload }: SocketEvent<ChatRoomInput>): Promise<object> {
  const { wantedCatIds } = socket.data
  wantedCatIds.add(payload.catId)
  try {
    const cat = await catService.getById(payload.catId) // 404 CAT_NOT_FOUND
    // A leave that ran during catService.getById removed catId from wantedCatIds
    // joining now would put the socket in a room it already left
    if (wantedCatIds.has(payload.catId)) {
      await socket.join(socketService.getCatRoomName(cat._id.toHexString()))
    }
    return {}
  } catch (err) {
    wantedCatIds.delete(payload.catId)
    throw err
  }
}

// chat:leave. Sync, no cat read: leaving a room is always allowed, even for a deleted cat
async function leave({ socket, payload }: SocketEvent<ChatRoomInput>): Promise<void> {
  socket.data.wantedCatIds.delete(payload.catId)
  await socket.leave(socketService.getCatRoomName(payload.catId))
}

export const chatSocketController = {
  join,
  leave,
}
