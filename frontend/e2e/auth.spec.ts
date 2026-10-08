import { expect, test, type BrowserContext } from '@playwright/test'
import { collectConsoleText, signUpViaApi } from './helpers/auth.helper.ts'

// The E2E seed re-creates cats but keeps existing users, so a fixed username would hit 409 on
// the second run. This is why we use Date.now() for each USERNAME
const USERNAME = `e2e_${Date.now()}`
const PASSWORD = 'Secret1!'
// The password the failure flows type. Distinct from PASSWORD, so finding it in the console
// can only mean a leak from that flow
const OTHER_PASSWORD = 'WrongPass1!'
const SEVEN_DAYS_S = 7 * 24 * 60 * 60

async function _getLoginTokenCookie(context: BrowserContext) {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === 'loginToken')
}

// The failed call must be logged (so the check can't pass on an empty console),
// but never with the password in it
async function _expectPasswordNotLogged(
  getConsoleTexts: () => Promise<string[]>,
  errorCode: string,
  password: string,
) {
  const consoleTexts = await getConsoleTexts()
  expect(consoleTexts.some((text) => text.includes(errorCode))).toBe(true)
  expect(consoleTexts.filter((text) => text.includes(password))).toEqual([])
}

test('sign up, log out and log in again, with and without remember me', async ({
  page,
  context,
}) => {
  await page.goto('/signup')
  // Login and signup have no app header
  await expect(page.locator('.app-header')).toHaveCount(0)

  await page.getByLabel('Full name').fill('E2e Tester')
  await page.getByLabel('Username').fill(USERNAME)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign up' }).click()

  await expect(page).toHaveURL(/\/cat$/)
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveText('E')
  // No remember me → a session cookie (Playwright reports it as expires -1)
  const sessionCookie = await _getLoginTokenCookie(context)
  expect(sessionCookie?.expires).toBe(-1)
  // The flags from LOGIN_TOKEN_COOKIE_OPTIONS. `secure` is skipped: it's on only in production
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' })

  // A session cookie survives a reload too: main.tsx re-reads the user from /api/auth/me
  await page.reload()
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveText('E')

  // Logout goes to / , which redirects to /cat until the home page exists
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.locator('.header-menu .menu')).toContainText('Hi, E2e!')
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/cat$/)
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
  expect(await _getLoginTokenCookie(context)).toBeUndefined()

  await page.getByRole('link', { name: 'Login' }).click()
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcat$/)
  await page.getByLabel('Username').fill(USERNAME)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('checkbox', { name: 'Remember me' }).check()
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/cat$/)
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveText('E')
  // Remember me → a cookie that lasts about 7 days
  const expires = (await _getLoginTokenCookie(context))?.expires ?? 0
  const nowS = Date.now() / 1000
  expect(expires).toBeGreaterThan(nowS + SEVEN_DAYS_S - 60)
  expect(expires).toBeLessThan(nowS + SEVEN_DAYS_S + 60)

  // The session survives a reload: main.tsx re-reads it from /api/auth/me
  await page.reload()
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveText('E')
})

// Failure paths through the real stack. The setup user signs up via the standalone `request`,
// which doesn't share the page's cookies, so the page stays a guest
test('a wrong password shows an error, sets no cookie and stays out of the console', async ({
  page,
  context,
  request,
}) => {
  const { username } = await signUpViaApi(request, 'w')
  const getConsoleTexts = collectConsoleText(page)

  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(OTHER_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page.getByRole('status')).toContainText('Wrong username or password.')
  await expect(page).toHaveURL(/\/login$/)
  expect(await _getLoginTokenCookie(context)).toBeUndefined()
  await _expectPasswordNotLogged(getConsoleTexts, 'INVALID_CREDENTIALS', OTHER_PASSWORD)
})

test('signup with a taken username shows an error and sets no cookie', async ({
  page,
  context,
  request,
}) => {
  const { username } = await signUpViaApi(request, 't')
  const getConsoleTexts = collectConsoleText(page)

  await page.goto('/signup')
  await page.getByLabel('Full name').fill('E2e Tester')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(OTHER_PASSWORD)
  await page.getByLabel('Confirm password').fill(OTHER_PASSWORD)
  await page.getByRole('button', { name: 'Sign up' }).click()

  await expect(page.getByRole('status')).toContainText('This username is already taken.')
  await expect(page).toHaveURL(/\/signup$/)
  expect(await _getLoginTokenCookie(context)).toBeUndefined()
  await _expectPasswordNotLogged(getConsoleTexts, 'USERNAME_TAKEN', OTHER_PASSWORD)
})
