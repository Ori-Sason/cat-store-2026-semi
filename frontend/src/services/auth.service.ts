import type { LoggedInUser, LoginInput, SignupInput } from '@cat-store/shared'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { httpService } from './http.service'

const BASE_PATH = 'auth'
// /me runs before the first render (main.tsx), so a stalled server would leave a blank page.
// Short, so the app starts as a guest instead
const GET_LOGGED_IN_USER_TIMEOUT_MS = 3_000
const AUTH_CHANNEL_NAME = 'auth'

// The tabs of one origin share the cookie jar, so a login or logout in one tab changes the
// cookie for all of them. REST reads the cookie on every request, but the socket reads it only
// at its handshake: without this, after a logout in tab 1, tab 2's socket keeps acting as the old
// user until the token expires (up to 7 days), and tab 2's header shows them too.
// A BroadcastChannel reaches the other tabs of the same origin, never the tab that posts
const _authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME)

export const authService = {
  login,
  signup,
  logout,
  getLoggedInUser,
  loadLoggedInUser,
  syncLoggedInUserAcrossTabs,
}

// login / signup set the httpOnly loginToken cookie - the FE never sees the token itself
async function login(credentials: LoginInput): Promise<LoggedInUser> {
  const loggedInUser = await httpService.post<LoggedInUser>(`${BASE_PATH}/login`, credentials)
  _notifyOtherTabs()
  return loggedInUser
}

async function signup(signupInput: SignupInput): Promise<LoggedInUser> {
  const loggedInUser = await httpService.post<LoggedInUser>(`${BASE_PATH}/signup`, signupInput)
  _notifyOtherTabs()
  return loggedInUser
}

async function logout(): Promise<void> {
  await httpService.post<void>(`${BASE_PATH}/logout`)
  _notifyOtherTabs()
}

// null = a guest (no cookie, an expired token, or a user that no longer exists)
function getLoggedInUser(): Promise<LoggedInUser | null> {
  return httpService.get<LoggedInUser | null>(`${BASE_PATH}/me`, undefined, {
    timeoutMs: GET_LOGGED_IN_USER_TIMEOUT_MS,
  })
}

// Puts the user /me returns into the store, or clears it for a guest. Throws when /me fails,
// so each caller decides what a failure means
async function loadLoggedInUser(): Promise<void> {
  const loggedInUser = await getLoggedInUser()
  const { setLoggedInUser, clearLoggedInUser } = useLoggedInUserStore.getState()
  if (loggedInUser) setLoggedInUser(loggedInUser)
  else clearLoggedInUser()
}

// Called once in main.tsx. Another tab logged in or out: reload the user from /me. The store
// change then reconnects this tab's socket (socketService), so its handshake gets the new cookie
function syncLoggedInUserAcrossTabs(): void {
  _authChannel.onmessage = async () => {
    try {
      await loadLoggedInUser()
    } catch {
      // /me failed (e.g. the server is down): keep the current user. The next REST call
      // that gets a 401 clears it
    }
  }
}

// No payload: the cookie is the truth, so each tab asks /me instead of trusting a message
function _notifyOtherTabs(): void {
  _authChannel.postMessage(null)
}
