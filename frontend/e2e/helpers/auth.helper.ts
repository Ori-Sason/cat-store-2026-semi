import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, type APIRequestContext } from '@playwright/test'

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
