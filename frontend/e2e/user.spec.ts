import { expect, test } from '@playwright/test'
import { signUpViaApi } from './helpers/auth.helper.ts'
import { getCatByName } from './helpers/cat.helper.ts'

// The cat rules for a logged-in user: add, and edit / delete their own cats only. Seed owners are
// random, so the "own cat" is one this test adds. A fresh user owns no seed cat, so Robin Rivas (cat name)
// is always someone else's.
test.beforeEach(async ({ page }) => {
  await signUpViaApi(page.request, 'u')
})

test('a user adds a cat and gets Edit / Delete only on their own', async ({ page }) => {
  const catName = `User cat ${Date.now()}`

  await page.goto('/cat')
  await page.getByRole('link', { name: '+ Add cat' }).click()
  await expect(page).toHaveURL(/\/cat\/new$/)
  await page.getByLabel('Name').fill(catName)
  await page.getByLabel('Price ($)').fill('120')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}$/)
  await expect(page.getByRole('status')).toContainText('Cat saved')
  await expect(page.getByRole('heading', { level: 1, name: catName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  const ownCatUrl = page.url()

  // Someone else's cat: read only
  const seedCat = await getCatByName(page.request, 'Robin Rivas')
  await page.goto(`/cat/${seedCat._id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Robin Rivas' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)

  // Clean up through the UI, which also covers an owner's delete
  await page.goto(ownCatUrl)
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/cat$/)
  await expect(page.getByRole('status')).toContainText('Cat deleted')
})

test("a user gets a 403 on someone else's cat, in the FE and the API", async ({ page }) => {
  const seedCat = await getCatByName(page.request, 'Robin Rivas')

  // A typed edit URL: the loader throws the 403 route error instead of showing a doomed form
  await page.goto(`/cat/${seedCat._id}/edit`)
  await expect(page.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveCount(0)

  // The BE guard, through the proxy with the real cookie
  const { _id, name, price, labels, isInStock, imgUrl } = seedCat
  const putRes = await page.request.put(`/api/cats/${_id}`, {
    data: { name: `${name} hacked`, price, labels, isInStock, imgUrl },
  })
  expect(putRes.status()).toBe(403)
  const deleteRes = await page.request.delete(`/api/cats/${_id}`)
  expect(deleteRes.status()).toBe(403)
})
