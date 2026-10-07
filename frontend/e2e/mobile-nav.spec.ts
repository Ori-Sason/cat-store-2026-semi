import { expect, test } from '@playwright/test'

// Below $bp-md the bar's nav is hidden, and the header menu (a hamburger) holds the pages
test.use({ viewport: { width: 390, height: 844 } })

test('a guest reaches a page through the mobile menu', async ({ page }) => {
  await page.goto('/cat')
  const menuBtn = page.getByRole('button', { name: 'Menu', exact: true })
  // The bar's nav and Login link are hidden at this width
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Login' })).toBeHidden()

  await menuBtn.click()
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.menu-card').getByRole('link', { name: 'Login' })).toBeVisible()
  await page.locator('.menu-card').getByRole('link', { name: 'Dashboard' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.menu-card')).toHaveCount(0)
})

test('a logged-in user gets the hamburger, not the avatar, and the greeting in the menu', async ({
  page,
}) => {
  // Sign up through the API: page.request shares the browser context's cookies
  const username = `e2e_m${Date.now()}`
  const res = await page.request.post('/api/auth/signup', {
    data: { fullname: 'Mobile Tester', username, password: 'Secret1!', isRemembered: false },
  })
  expect(res.ok()).toBe(true)

  await page.goto('/cat')
  const menuBtn = page.getByRole('button', { name: 'Menu', exact: true })
  await expect(menuBtn.locator('.hamburger')).toBeVisible()
  await expect(menuBtn.locator('.user-avatar')).toBeHidden()

  await menuBtn.click()
  const card = page.locator('.menu-card')
  await expect(card).toContainText('Hi, Mobile!')
  await expect(card.getByRole('link', { name: 'About' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Logout' })).toBeVisible()
})
