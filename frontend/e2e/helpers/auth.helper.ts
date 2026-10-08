import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, type APIRequestContext, type ConsoleMessage, type Page } from '@playwright/test'

const PASSWORD = 'Secret1!'
const BACKEND_ENV_TEST_URL = new URL('../../../backend/.env.test', import.meta.url)

export interface E2eCredentials {
  username: string
  password: string
}

// Signs up a fresh user and leaves `request` logged in as them (page.request shares the page's
// cookies). The E2E seed keeps existing users, so the username needs Date.now() to stay unique
// across runs. A fresh user owns no seed cats, so every seed cat is "someone else's" for them.
export async function signUpViaApi(
  request: APIRequestContext,
  prefix: string,
  fullname = 'E2e Tester',
): Promise<E2eCredentials> {
  const username = `e2e_${prefix}${Date.now()}`
  const res = await request.post('/api/auth/signup', {
    data: { fullname, username, password: PASSWORD, isRemembered: false },
  })
  expect(res.ok()).toBe(true)
  return { username, password: PASSWORD }
}

export async function loginViaApi(request: APIRequestContext, credentials: E2eCredentials) {
  const res = await request.post('/api/auth/login', {
    data: { ...credentials, isRemembered: false },
  })
  expect(res.ok()).toBe(true)
}

// The seeded admin's password. Reads only this one key from backend/.env.test (the file the E2E
// backend runs with), so the rest of that file (DB URI, JWT secret) never enters the runner's env
export function getSeedUsersPassword(): string {
  const env = parseEnv(readFileSync(BACKEND_ENV_TEST_URL, 'utf8'))
  const password = env.SEED_USERS_PASSWORD
  if (!password) throw new Error('SEED_USERS_PASSWORD is missing in backend/.env.test')
  return password
}

// Records every browser console message from now on. Call the returned getter after the flow
// to get each message as one string. It reads the logged values themselves (jsonValue), not
// msg.text(): http.service logs an object, and text() shows only a preview of it, so a leaked
// field could be missed. The handler keeps the promises, so the getter waits for every message
export function collectConsoleText(page: Page): () => Promise<string[]> {
  const pendingTexts: Promise<string>[] = []
  page.on('console', (msg) => pendingTexts.push(_toConsoleText(msg)))
  return () => Promise.all(pendingTexts)
}

// Throws if the page navigated away before the values were read, which fails the test. On
// purpose, no fallback to msg.text(): a preview may cut off the leaked field, and the check
// would pass quietly. For a flow that navigates, serialize inside the page instead
// (addInitScript wrapping console.log)
async function _toConsoleText(msg: ConsoleMessage): Promise<string> {
  const values = await Promise.all(msg.args().map((arg) => arg.jsonValue()))
  return JSON.stringify(values)
}
