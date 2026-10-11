import type {
  Review,
  ReviewContentInput,
  ReviewFilter,
  ReviewInput,
  ReviewWithRefs,
} from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'reviews'

export const reviewService = {
  query,
  add,
  update,
  remove,
}

// A cat's or a user's reviews, newest first. The API requires at least one filter
function query(filterBy: ReviewFilter): Promise<ReviewWithRefs[]> {
  return httpService.get<ReviewWithRefs[]>(BASE_PATH, filterBy)
}

// Returns the stored review (userId / catId), not the joined shape: callers reload the list
function add(review: ReviewInput): Promise<Review> {
  return httpService.post<Review>(BASE_PATH, review)
}

// Content only: a review stays on its cat. Returns the stored review, like add
function update(reviewId: string, input: ReviewContentInput): Promise<Review> {
  return httpService.put<Review>(`${BASE_PATH}/${reviewId}`, input)
}

function remove(reviewId: string): Promise<void> {
  return httpService.delete<void>(`${BASE_PATH}/${reviewId}`)
}
