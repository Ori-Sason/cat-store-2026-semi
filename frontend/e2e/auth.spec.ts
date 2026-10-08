import { expect, test, type BrowserContext } from '@playwright/test'

// The E2E seed re-creates cats but keeps existing users, so a fixed username would hit 409 on
// the second run. This is why we use Date.now() for each USERNAME
const USERNAME = `e2e_${Date.now()}`
const PASSWORD = 'Secret1!'
const SEVEN_DAYS_S = 7 * 24 * 60 * 60

async function _getLoginTokenCookie(context: BrowserContext) {
  const cookies = await context.cookies()
  return cookies.find((cookie) => cookie.name === 'loginToken')
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
