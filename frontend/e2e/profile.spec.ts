import { expect, test, type Page } from '@playwright/test'
import { signUpViaApi } from './helpers/auth.helper.ts'
import { createCatViaApi } from './helpers/cat.helper.ts'
import { createReviewViaApi } from './helpers/review.helper.ts'

// The user page (/user/:id): reached from a cat's owner link and from the header's Profile row.
// Each test signs up a fresh user who adds one cat and reviews it, so both tabs hold exactly
// what the test made. Seed cats and reviews are random and aren't touched.

function _getTab(page: Page, name: 'Cats' | 'Reviews') {
  return page.getByRole('navigation', { name: 'User sections' }).getByRole('link', { name })
}

function _getReview(page: Page, content: string) {
  return page.locator('.user-reviews').getByRole('article').filter({ hasText: content })
}

test("a guest goes from a cat's owner link to the user page and both tabs", async ({
  page,
  request,
}) => {
  // A unique full name, so the heading and the owner link can't match a seed user
  const fullname = `Profile Owner ${Date.now()}`
  await signUpViaApi(request, 'p', fullname)
  const cat = await createCatViaApi(request, { name: `Profile cat ${Date.now()}` })
  const review = await createReviewViaApi(request, cat._id)

  await page.goto(`/cat/${cat._id}`)
  await page.locator('.owner').getByRole('link', { name: fullname }).click()

  // The cats tab is the index route: the user page's own URL, no /cats suffix
  await expect(page).toHaveURL(/\/user\/[a-f0-9]{24}$/)
  await expect(page.getByRole('heading', { level: 1, name: fullname })).toBeVisible()
  await expect(_getTab(page, 'Cats')).toHaveAttribute('aria-current', 'page')
  const catCard = page.locator('.user-cats').getByRole('link', { name: new RegExp(cat.name) })
  await expect(catCard).toBeVisible()
  // The header already says whose cats these are, so the cards hide the owner
  await expect(catCard).not.toContainText(`by ${fullname}`)

  await _getTab(page, 'Reviews').click()
  await expect(page).toHaveURL(/\/user\/[a-f0-9]{24}\/reviews$/)
  await expect(_getTab(page, 'Reviews')).toHaveAttribute('aria-current', 'page')
  await expect(_getTab(page, 'Cats')).not.toHaveAttribute('aria-current')
  const reviewRow = _getReview(page, review.content)
  await expect(reviewRow).toBeVisible()
  // A user's page shows the cat side of the row. The author reviewed their own cat: Owner chip
  await expect(reviewRow.getByText('Owner', { exact: true })).toBeVisible()
  await expect(reviewRow.getByRole('button', { name: 'Review actions' })).toHaveCount(0)

  // The cat link goes back to the cat's page
  await reviewRow.getByRole('link', { name: cat.name }).click()
  await expect(page).toHaveURL(new RegExp(`/cat/${cat._id}$`))
})

test('a user opens their Profile from the header and edits a review on the reviews tab', async ({
  page,
}) => {
  const fullname = `Profile User ${Date.now()}`
  await signUpViaApi(page.request, 'q', fullname)
  const cat = await createCatViaApi(page.request, { name: `Profile cat ${Date.now()}` })
  const review = await createReviewViaApi(page.request, cat._id)

  await page.goto('/')
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('link', { name: 'Profile' }).click()
  await expect(page).toHaveURL(/\/user\/[a-f0-9]{24}$/)
  await expect(page.getByRole('heading', { level: 1, name: fullname })).toBeVisible()

  // Edit through the shared /review/:id action, from a page other than the cat's
  await _getTab(page, 'Reviews').click()
  const reviewRow = _getReview(page, review.content)
  await reviewRow.getByRole('button', { name: 'Review actions' }).click()
  await reviewRow.getByRole('button', { name: 'Edit' }).click()
  const field = page.getByLabel('Edit your review')
  await expect(field).toHaveValue(review.content)
  const editedContent = `${review.content} edited`
  await field.fill(editedContent)
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('status')).toContainText('Review updated')
  await expect(_getReview(page, editedContent)).toBeVisible()
  await expect(page.getByLabel('Edit your review')).toHaveCount(0)
  // The header stays: the action reloads only the tab
  await expect(page.getByRole('heading', { level: 1, name: fullname })).toBeVisible()

  // A reload shows the edit, so it reached the API
  await page.reload()
  await expect(_getReview(page, editedContent)).toBeVisible()
})
