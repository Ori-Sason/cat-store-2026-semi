import type { ReviewFilter, ReviewWithRefs } from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'reviews'

export const reviewService = {
  query,
}

// A cat's or a user's reviews, newest first. The API requires at least one filter
function query(filterBy: ReviewFilter): Promise<ReviewWithRefs[]> {
  return httpService.get<ReviewWithRefs[]>(BASE_PATH, filterBy)
}
