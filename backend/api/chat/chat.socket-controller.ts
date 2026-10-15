import {
  CHAT_MSG_ADDED,
  type ChatMsg,
  type ChatMsgInput,
  type ChatRoomInput,
} from '@cat-store/shared'
import type { SocketEvent } from '../../models/socket.ts'
import { alsService } from '../../services/als.service.ts'
import { socketService } from '../../services/socket.service.ts'
import { catService } from '../cat/cat.service.ts'
import { chatService } from './chat.service.ts'

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

// chat:msg-add. Acks the saved msg and broadcasts it to the room.
// io.to(room), not socket.to(room): the sending socket gets the broadcast too. The broadcast and
// the ack go out together. If they reach the client after its ack timeout (a slow network), the
// late ack is dropped (emitWithAck already rejected, the msg shows as failed), but the broadcast
// is a normal event and still fires: its clientMsgId turns the failed msg into saved, with no
// retry.
// The FE merges by _id / clientMsgId, so getting both the ack and the broadcast is harmless.
// A retry of a saved msg acks only: the first try already broadcast it, and tabs that missed it
// get it from the gap fill
async function addMsg({ payload }: SocketEvent<ChatMsgInput>): Promise<{ msg: ChatMsg }> {
  const { msg, isNew } = await chatService.add(payload, alsService.getVerifiedUser()._id)
  if (isNew) {
    socketService.getIo().to(socketService.getCatRoomName(msg.catId)).emit(CHAT_MSG_ADDED, { msg })
  }
  return { msg }
}

export const chatSocketController = {
  join,
  leave,
  addMsg,
}
