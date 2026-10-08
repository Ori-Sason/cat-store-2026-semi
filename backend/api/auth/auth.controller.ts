import type { CookieOptions, Request, Response } from 'express'
import type { LoggedInUser, LoginInput, SignupInput } from '@cat-store/shared'
import { LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS } from '../../models/auth.ts'
import { alsService } from '../../services/als.service.ts'
import { authService } from './auth.service.ts'

// req.body is already parsed by validateBody(signupSchema)
export async function signup(req: Request<object, unknown, SignupInput>, res: Response) {
  const { isRemembered, ...userInput } = req.body
  const loggedInUser = await authService.signup(userInput)
  _setLoginTokenCookie(res, loggedInUser, isRemembered)
  res.status(201).json(loggedInUser) // 201 Created - signup also logs the user in
}

// req.body is already parsed by validateBody(loginSchema)
export async function login(req: Request<object, unknown, LoginInput>, res: Response) {
  const loggedInUser = await authService.login(req.body)
  _setLoginTokenCookie(res, loggedInUser, req.body.isRemembered)
  res.json(loggedInUser)
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS)
  res.sendStatus(204) // 204 No Content
}

// 200 with null for a guest
export async function getMe(_req: Request, res: Response) {
  const tokenUser = alsService.getStore().tokenUser
  const loggedInUser = tokenUser && (await authService.getLoggedInUserById(tokenUser._id))
  // A valid token for a user that's gone - drop the cookie so later requests are plain guests
  if (tokenUser && !loggedInUser) res.clearCookie(LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS)
  res.json(loggedInUser ?? null)
}

function _setLoginTokenCookie(res: Response, loggedInUser: LoggedInUser, isRemembered: boolean) {
  const loginToken = authService.createLoginToken(loggedInUser, isRemembered)
  const cookieOptions: CookieOptions = { ...LOGIN_TOKEN_COOKIE_OPTIONS }
  if (isRemembered) cookieOptions.maxAge = authService.getLoginTokenTtlMs(true)
  res.cookie(LOGIN_TOKEN_COOKIE, loginToken, cookieOptions)
}
