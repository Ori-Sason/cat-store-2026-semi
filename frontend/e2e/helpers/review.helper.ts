import { expect, type APIRequestContext } from '@playwright/test'
import type { Review } from '@cat-store/shared'

// Setup a test doesn't cover through the UI. `request` must be logged in, adding a review needs auth
export async function createReviewViaApi(
  request: APIRequestContext,
  catId: string,
  content = `E2e review ${Date.now()}`,
): Promise<Review> {
  const res = await request.post('/api/reviews', { data: { catId, content } })
  expect(res.status()).toBe(201)
  return (await res.json()) as Review
}
