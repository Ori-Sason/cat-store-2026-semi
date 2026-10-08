import { expect, test, type Page } from '@playwright/test'
import { getSeedUsersPassword, loginViaApi, signUpViaApi } from './helpers/auth.helper.ts'
import { createCatViaApi } from './helpers/cat.helper.ts'

// The cat rules for an admin: full CRUD on every cat, as the seeded `admin`. No test here edits
// or deletes a seed cat, so other specs that rely on a specific seeded cat (e.g Robin Rivas)
// pass in any order.
test.beforeEach(async ({ page }) => {
  await loginViaApi(page.request, { username: 'admin', password: getSeedUsersPassword() })
})

async function _editCat(page: Page, newName: string, newPrice?: string) {
  await page.getByRole('link', { name: 'Edit' }).click()
  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}\/edit$/)
  await page.getByLabel('Name').fill(newName)
  if (newPrice) await page.getByLabel('Price ($)').fill(newPrice)
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}$/)
  await expect(page.getByRole('status')).toContainText('Cat saved')
  await expect(page.getByRole('heading', { level: 1, name: newName })).toBeVisible()
}

async function _deleteCat(page: Page, name: string) {
  await page.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('dialog', { name: `Delete ${name}?` })
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(page).toHaveURL(/\/cat$/)
  await expect(page.getByRole('status')).toContainText('Cat deleted')
  await page.getByRole('searchbox', { name: 'Search by name' }).fill(name)
  await expect(page).toHaveURL(/txt=/)
  await expect(page.locator('.cat-preview')).toHaveCount(0)
}

test('an admin adds, edits and deletes a cat', async ({ page }) => {
  const catName = `Admin cat ${Date.now()}`

  await page.goto('/cat')
  await page.getByRole('link', { name: '+ Add cat' }).click()
  await page.getByLabel('Name').fill(catName)
  await page.getByLabel('Price ($)').fill('120')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/cat\/[a-f0-9]{24}$/)
  await expect(page.getByRole('status')).toContainText('Cat saved')
  await expect(page.getByRole('heading', { level: 1, name: catName })).toBeVisible()

  const editedName = `${catName} edited`
  await _editCat(page, editedName, '150')
  await expect(page.locator('.cat-details .price')).toContainText('150')

  await _deleteCat(page, editedName)
})

test("an admin edits and deletes another user's cat", async ({ page, request }) => {
  // `request` has its own cookies, unlike `page.request`, so this signup doesn't replace the admin
  // login from beforeEach. The page stays admin on a cat it doesn't own
  await signUpViaApi(request, 'o')
  const otherUserCat = await createCatViaApi(request, { name: `Other user cat ${Date.now()}` })

  // A typed (or reloaded) edit URL shows the form: the router waits for /me before running loaders
  await page.goto(`/cat/${otherUserCat._id}/edit`)
  await expect(page.getByLabel('Name')).toHaveValue(otherUserCat.name)

  await page.goto(`/cat/${otherUserCat._id}`)
  await expect(page.getByRole('heading', { level: 1, name: otherUserCat.name })).toBeVisible()

  const editedName = `${otherUserCat.name} edited`
  await _editCat(page, editedName)
  await _deleteCat(page, editedName)
})
