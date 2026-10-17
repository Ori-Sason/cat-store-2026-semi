import { io } from 'socket.io-client'

// One socket for the whole app: the cat chat joins rooms on it, and site-wide notifications
// (roadmap Part 6 item 2) need it on every page.
// No URL: it connects to the page's own origin, and Vite proxies /socket.io to Express in dev
// (vite.config.ts). The handshake carries the loginToken cookie on its own, since it's same-origin.
// autoConnect is off so importing this module (e.g. in a test) never opens a connection
const _socket = io({ autoConnect: false })

export const socketService = {
  connect,
}

// Called once in main.tsx, after the logged-in user is loaded, so the handshake sends the
// cookie /me just checked. The handshake is the only time the server reads the cookie
function connect(): void {
  _socket.connect()
}
