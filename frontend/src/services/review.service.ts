import type { Review, ReviewFilter, ReviewInput, ReviewWithRefs } from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'reviews'

export const reviewService = {
  query,
  add,
}

// A cat's or a user's reviews, newest first. The API requires at least one filter
function query(filterBy: ReviewFilter): Promise<ReviewWithRefs[]> {
  return httpService.get<ReviewWithRefs[]>(BASE_PATH, filterBy)
}

// Returns the stored review (userId / catId), not the joined shape: callers reload the list
function add(review: ReviewInput): Promise<Review> {
  return httpService.post<Review>(BASE_PATH, review)
}
