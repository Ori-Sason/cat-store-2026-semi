import type { z } from 'zod'
import type { SocketMiddleware } from '../../models/socket.ts'
import { utilService } from '../../services/util.service.ts'

// The socket version of validateBody: parses the payload with the event's schema and swaps in
// the result. Zod strips unknown keys, so a client can't send server-set fields (userId, _id).
// First in every chain, so the checks after it read a valid catId
export function validatePayload(schema: z.ZodType): SocketMiddleware {
  return (event) => {
    event.payload = utilService.parseOrThrow(schema, event.payload, 'payload')
  }
}
