import { expect, test } from '@playwright/test'
import { signUpViaApi } from './helpers/auth.helper.ts'

// Guest smoke flow: home → browse → filter → details → back, over the seed data in
// backend/scripts/data/cats.json. Seed labels are random, so the filter uses name and stock only.
test('guest browses, filters and opens a cat', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Meet your next cat')
  // The lazy sections load through the real API: limit=4 on the cats, label stats for the bars
  await expect(page.locator('.newest-cats .cat-preview')).toHaveCount(4)
  await expect(page.locator('.label-price-teaser .bar-row')).toHaveCount(5)
  await page.locator('.home-hero').getByRole('link', { name: 'Browse cats' }).click()
  await expect(page).toHaveURL(/\/cat$/)

  const cards = page.locator('.cat-preview')
  await expect(cards.first()).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search by name' }).fill('Robin')
  await page
    .getByRole('group', { name: 'Availability' })
    .getByRole('button', { name: 'In stock' })
    .click()

  // The filter lives in the URL
  await expect(page).toHaveURL(/txt=Robin/)
  await expect(page).toHaveURL(/isInStock=true/)
  await expect(cards).toHaveCount(1)

  await cards.getByRole('heading', { name: 'Robin Rivas' }).click()

  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Robin Rivas' })).toBeVisible()
  await expect(page.locator('.cat-details .stock')).toHaveText('In stock')

  // Back keeps the list filter
  await page.getByRole('link', { name: '← Back to cats' }).click()
  await expect(page).toHaveURL(/txt=Robin/)
  await expect(page.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('Robin')
})

// The cat rules for a guest: read only. The BE guards are covered by Supertest, this checks the
// FE hides what a guest can't use
test('a guest sees no Add, Edit or Delete', async ({ page }) => {
  await page.goto('/cat')
  await expect(page.locator('.cat-preview').first()).toBeVisible()
  await expect(page.getByRole('link', { name: '+ Add cat' })).toHaveCount(0)

  await page.locator('.cat-preview').first().getByRole('heading').click()
  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}$/)
  await expect(page.locator('.cat-details h1')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
})

test('a guest who types /cat/new goes to login, and back after it', async ({ page, request }) => {
  // `request` doesn't share the page's cookies, so the page stays a guest
  const credentials = await signUpViaApi(request, 'g')

  await page.goto('/cat/new')
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcat%2Fnew$/)

  await page.getByLabel('Username').fill(credentials.username)
  await page.getByLabel('Password').fill(credentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/cat\/new$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Add cat' })).toBeVisible()
})
