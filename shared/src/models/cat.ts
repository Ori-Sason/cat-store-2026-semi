import { z } from 'zod'
import type { UserRef } from './user.ts'
import type { SortByDirection } from './util.ts'

export const CAT_LABELS = [
  'Kitten',
  'Adult',
  'Senior',
  'Playful',
  'Calm',
  'Affectionate',
  'Long-hair',
  'Short-hair',
  'Indoor',
  'Good with kids',
] as const

export type CatLabel = (typeof CAT_LABELS)[number]

export const CAT_NAME_MIN_LENGTH = 2
export const CAT_NAME_MAX_LENGTH = 50

const _IMG_URL_ERROR = 'Image must be a valid URL'

export const catSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(CAT_NAME_MIN_LENGTH, { error: `Name must be at least ${CAT_NAME_MIN_LENGTH} characters` })
    .max(CAT_NAME_MAX_LENGTH, { error: `Name must be at most ${CAT_NAME_MAX_LENGTH} characters` }),
  price: z
    .number({ error: 'Price must be a number' })
    .positive({ error: 'Price must be greater than 0' })
    .multipleOf(0.01, { error: 'Price can have at most 2 decimals' }),
  labels: z
    .array(z.enum(CAT_LABELS, { error: 'Unknown label' }))
    .refine((labels) => new Set(labels).size === labels.length, {
      error: 'Labels must be unique',
    }),
  isInStock: z.boolean({ error: 'In-stock must be true or false' }),
  imgUrl: z.union([z.httpUrl({ error: _IMG_URL_ERROR }), z.literal('')], {
    error: _IMG_URL_ERROR,
  }),
})

export type CatInput = z.infer<typeof catSchema>

export interface Cat extends CatInput {
  _id: string
  ownerId: string // the user who created the cat - server-set, so it's not in catSchema
  createdAt: number
  updatedAt: number
}

// A cat joined with its owner, as GET /api/cats and GET /api/cats/:id return it. The owner's ref replaces
// ownerId, like a review's refs replace userId / catId
export interface CatWithRefs extends Omit<Cat, 'ownerId'> {
  owner: UserRef
}

// The fields a joined doc (a review's cat) carries, besides `_id`. An allow-list the backend
// projects with, like USER_REF_FIELDS. ownerId lets a review show an Owner chip when the cat's
// owner wrote it
export const CAT_REF_FIELDS = [
  'name',
  'imgUrl',
  'ownerId',
] as const satisfies readonly (keyof Cat)[]

// A cat as a join carries it: a review's cat
export type CatRef = Pick<Cat, '_id' | (typeof CAT_REF_FIELDS)[number]>

export interface CatLabelStats {
  label: CatLabel
  count: number
  inStockCount: number
  medianPrice: number | null
  minPrice: number | null
  maxPrice: number | null
}

export const CAT_SORT_FIELDS = [
  'name',
  'price',
  'createdAt',
] as const satisfies readonly (keyof Cat)[]

export type CatSortField = (typeof CAT_SORT_FIELDS)[number]

// What the cat list is filtered and sorted by - the query string, parsed
export interface CatFilter {
  txt: string
  isInStock: Cat['isInStock'] | null // null = any
  labels: Cat['labels'] // a cat must have every one of them
  sortBy: CatSortField
  sortDir: SortByDirection
  limit: number | null // the first N after sorting. null = every match
  // One user's cats (the user page). null = any owner.
  // Not validated here: a malformed id stays as is, so the BE can
  // answer "no cats" instead of dropping the filter
  // (by dropping, it will return every cat)
  ownerId: Cat['ownerId'] | null
}

export const DEFAULT_CAT_FILTER: CatFilter = {
  txt: '',
  isInStock: null,
  labels: [],
  sortBy: 'createdAt',
  sortDir: 'desc',
  limit: null,
  ownerId: null,
}
