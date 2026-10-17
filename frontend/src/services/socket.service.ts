import { io } from 'socket.io-client'
import { useLoggedInUserStore } from '../store/logged-in-user.store'

// One socket for the whole app: the cat chat joins rooms on it, and site-wide notifications
// (roadmap Part 6 item 2) need it on every page.
// No URL: it connects to the page's own origin, and Vite proxies /socket.io to Express in dev
// (vite.config.ts). The handshake carries the loginToken cookie on its own, since it's same-origin.
// autoConnect is off so importing this module (e.g. in a test) never opens a connection
const _socket = io({ autoConnect: false })

type LoggedInUserState = ReturnType<typeof useLoggedInUserStore.getState>

export const socketService = {
  connect,
}

// Called once in main.tsx, after the logged-in user is loaded, so the handshake sends the
// cookie /me just checked. The handshake is the only time the server reads the cookie
function connect(): void {
  _socket.connect()
  // Subscribed only now, so loading the user in main.tsx doesn't count as a change
  useLoggedInUserStore.subscribe(_reconnectOnUserChange)
}

// The server knows the socket's user only from its handshake, so after a login, a logout or
// clearLoggedInUser() (a 401), the socket would keep acting as the old user. A new connection
// sends a new handshake with the current cookie.
// Compared by _id because the subscription fires on every set(): setting the same user again
// (e.g. a re-hydrate from /me) shouldn't drop the connection and its rooms
function _reconnectOnUserChange(state: LoggedInUserState, prevState: LoggedInUserState): void {
  const userId = state.loggedInUser?._id ?? null
  const prevUserId = prevState.loggedInUser?._id ?? null
  if (userId === prevUserId) return
  _socket.disconnect().connect()
}
