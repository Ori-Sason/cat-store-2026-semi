import type { LoggedInUser, LoginInput, SignupInput } from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'auth'
// /me runs before the first render (main.tsx), so a stalled server would leave a blank page.
// Short, so the app starts as a guest instead
const GET_LOGGED_IN_USER_TIMEOUT_MS = 3_000

export const authService = {
  login,
  signup,
  logout,
  getLoggedInUser,
}

// login / signup set the httpOnly loginToken cookie - the FE never sees the token itself
function login(credentials: LoginInput): Promise<LoggedInUser> {
  return httpService.post<LoggedInUser>(`${BASE_PATH}/login`, credentials)
}

function signup(signupInput: SignupInput): Promise<LoggedInUser> {
  return httpService.post<LoggedInUser>(`${BASE_PATH}/signup`, signupInput)
}

function logout(): Promise<void> {
  return httpService.post<void>(`${BASE_PATH}/logout`)
}

// null = a guest (no cookie, an expired token, or a user that no longer exists)
function getLoggedInUser(): Promise<LoggedInUser | null> {
  return httpService.get<LoggedInUser | null>(`${BASE_PATH}/me`, undefined, {
    timeoutMs: GET_LOGGED_IN_USER_TIMEOUT_MS,
  })
}
