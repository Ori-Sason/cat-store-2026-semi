import type { PublicUser } from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'users'

export const userService = {
  getById,
}

// Public: no username or password, only what the user page shows
function getById(userId: string): Promise<PublicUser> {
  return httpService.get<PublicUser>(`${BASE_PATH}/${userId}`)
}
