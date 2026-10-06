import { expect, test } from '@playwright/test'

// Guest smoke flow over the seed data (backend/scripts/data/cats.json).
// Seed labels are random, so the filter step uses name + stock only
test('guest browses, filters and opens a cat', async ({ page }) => {
  await page.goto('/')
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
