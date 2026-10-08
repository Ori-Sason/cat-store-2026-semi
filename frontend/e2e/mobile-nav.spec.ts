import { expect, test } from '@playwright/test'
import { signUpViaApi } from './helpers/auth.helper.ts'

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
  await expect(
    page.locator('.header-menu .menu').getByRole('link', { name: 'Login' }),
  ).toBeVisible()
  await page.locator('.header-menu .menu').getByRole('link', { name: 'Dashboard' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.header-menu .menu')).toHaveCount(0)
})

test('a logged-in user gets the hamburger, not the avatar, and the greeting in the menu', async ({
  page,
}) => {
  await signUpViaApi(page.request, 'm', 'Mobile Tester')

  await page.goto('/cat')
  const menuBtn = page.getByRole('button', { name: 'Menu', exact: true })
  await expect(menuBtn.locator('.hamburger')).toBeVisible()
  await expect(menuBtn.locator('.user-avatar')).toBeHidden()

  await menuBtn.click()
  const menu = page.locator('.header-menu .menu')
  await expect(menu).toContainText('Hi, Mobile!')
  await expect(menu.getByRole('link', { name: 'About' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Logout' })).toBeVisible()
})
