import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { getSeedUsersPassword, loginViaApi, signUpViaApi } from './helpers/auth.helper.ts'
import { createCatViaApi } from './helpers/cat.helper.ts'
import { createReviewViaApi } from './helpers/review.helper.ts'

// The review rules on cat-details, per role. Seed reviews are random, so each test reviews a
// fresh cat that another user (the `request` fixture, its own cookies) adds and reviews first.
// That keeps the list known, and the other user's review is "someone else's" for every viewer.
// Seed cats aren't touched, so other specs keep their data.

interface OtherUserCat {
  catUrl: string
  otherReviewContent: string
}

// The other user is the cat's owner, so their review also carries the Owner chip
async function _setupOtherUserCat(request: APIRequestContext): Promise<OtherUserCat> {
  await signUpViaApi(request, 'o', 'Other Reviewer')
  const cat = await createCatViaApi(request, { name: `Reviewed cat ${Date.now()}` })
  const otherReviewContent = `Other user's review ${Date.now()}`
  await createReviewViaApi(request, cat._id, otherReviewContent)
  return { catUrl: `/cat/${cat._id}`, otherReviewContent }
}

// Scoped to the reviews section: the cat panel above it is an <article> too
function _getReviews(page: Page) {
  return page.locator('.cat-reviews').getByRole('article')
}

function _getReview(page: Page, content: string) {
  return _getReviews(page).filter({ hasText: content })
}

async function _chooseAction(page: Page, content: string, option: 'Edit' | 'Delete') {
  const review = _getReview(page, content)
  await review.getByRole('button', { name: 'Review actions' }).click()
  await review.getByRole('button', { name: option }).click()
}

async function _editReview(page: Page, content: string, newContent: string) {
  await _chooseAction(page, content, 'Edit')
  const field = page.getByLabel('Edit your review')
  await expect(field).toHaveValue(content)
  await field.fill(newContent)
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('status')).toContainText('Review updated')
  await expect(_getReview(page, newContent)).toBeVisible()
  await expect(page.getByLabel('Edit your review')).toHaveCount(0)
}

async function _deleteReview(page: Page, content: string) {
  await _chooseAction(page, content, 'Delete')
  const dialog = page.getByRole('alertdialog', { name: 'Delete this review?' })
  await dialog.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByRole('status')).toContainText('Review deleted')
  await expect(_getReview(page, content)).toHaveCount(0)
}

test('a guest reads reviews, with no form and no actions menu', async ({ page, request }) => {
  const { catUrl, otherReviewContent } = await _setupOtherUserCat(request)

  await page.goto(catUrl)
  const review = _getReview(page, otherReviewContent)
  await expect(review).toBeVisible()
  await expect(review).toContainText('Other Reviewer')
  await expect(review.getByText('Owner', { exact: true })).toBeVisible()

  await expect(page.getByLabel('Your review')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review actions' })).toHaveCount(0)

  // The login link comes back to this cat
  await page.locator('.cat-reviews').getByRole('link', { name: 'Log in' }).click()
  await expect(page).toHaveURL(new RegExp(`/login\\?redirectTo=${encodeURIComponent(catUrl)}$`))
})

test("a user adds, edits and deletes their own review, not someone else's", async ({
  page,
  request,
}) => {
  const { catUrl, otherReviewContent } = await _setupOtherUserCat(request)
  await signUpViaApi(page.request, 'u')

  await page.goto(catUrl)
  await expect(_getReview(page, otherReviewContent)).toBeVisible()
  // Someone else's review: no actions menu
  await expect(
    _getReview(page, otherReviewContent).getByRole('button', { name: 'Review actions' }),
  ).toHaveCount(0)

  // Add: the new review lands on top with the You chip, and the form clears
  const content = `User review ${Date.now()}`
  await page.getByLabel('Your review').fill(content)
  await page.getByRole('button', { name: 'Post review' }).click()

  await expect(page.getByRole('status')).toContainText('Review added')
  const ownReview = _getReview(page, content)
  await expect(ownReview).toBeVisible()
  await expect(ownReview.getByText('You', { exact: true })).toBeVisible()
  await expect(_getReviews(page).first()).toContainText(content)
  await expect(page.getByLabel('Your review')).toHaveValue('')

  // A reload shows the same list, so it came from the API, not local state
  await page.reload()
  await expect(_getReview(page, content)).toBeVisible()

  const editedContent = `${content} edited`
  await _editReview(page, content, editedContent)
  await _deleteReview(page, editedContent)
  await expect(_getReview(page, otherReviewContent)).toBeVisible()
})

test("a user gets a 403 on someone else's review from the API", async ({ page, request }) => {
  await signUpViaApi(request, 'o')
  const cat = await createCatViaApi(request)
  const otherReview = await createReviewViaApi(request, cat._id)
  await signUpViaApi(page.request, 'u')

  // The BE guard, through the proxy with the real cookie
  const putRes = await page.request.put(`/api/reviews/${otherReview._id}`, {
    data: { content: 'Hacked' },
  })
  expect(putRes.status()).toBe(403)
  const deleteRes = await page.request.delete(`/api/reviews/${otherReview._id}`)
  expect(deleteRes.status()).toBe(403)
})

test("an admin edits and deletes another user's review", async ({ page, request }) => {
  const { catUrl, otherReviewContent } = await _setupOtherUserCat(request)
  await loginViaApi(page.request, { username: 'admin', password: getSeedUsersPassword() })

  await page.goto(catUrl)
  const review = _getReview(page, otherReviewContent)
  await expect(review).toBeVisible()
  // The admin isn't the author: actions, but no You chip
  await expect(review.getByText('You', { exact: true })).toHaveCount(0)

  const editedContent = `${otherReviewContent} edited by admin`
  await _editReview(page, otherReviewContent, editedContent)
  await _deleteReview(page, editedContent)
  await expect(page.getByText('No reviews yet')).toBeVisible()
})
