import type { LoggedInUser } from '@cat-store/shared'
import type { AppSocket } from '../models/socket.ts'

// A stand-in for a server-side socket, for testing on() and the chain steps without a server.
// on() binds through socket.on, so emit() calls the bound handler directly and returns its
// promise: a test can await the whole chain, error path included
export function createFakeSocket({
  tokenUser = null,
  tokenExp = null,
  rooms = [],
}: { tokenUser?: LoggedInUser | null; tokenExp?: number | null; rooms?: string[] } = {}) {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>()

  const socket = {
    id: 'fake-socket-id',
    data: { tokenUser, tokenExp },
    rooms: new Set(rooms),
    on(eventName: string, handler: (...args: unknown[]) => Promise<void>) {
      handlers.set(eventName, handler)
    },
  }

  // Args as the client would send them: (payload, ack), (payload), or (ack) alone
  async function emit(eventName: string, ...args: unknown[]): Promise<void> {
    const handler = handlers.get(eventName)
    if (!handler) throw new Error(`No handler bound for ${eventName}`)
    await handler(...args)
  }

  return { socket: socket as unknown as AppSocket, emit }
}
