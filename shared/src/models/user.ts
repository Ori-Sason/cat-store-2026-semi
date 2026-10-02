export interface User {
  _id: string
  username: string
  fullname: string
  isAdmin: boolean
  createdAt: number
  updatedAt: number
}

export type LoggedInUser = Pick<User, '_id' | 'username' | 'fullname' | 'isAdmin'>
