import { ObjectId } from 'mongodb'
import { CAT_LABELS, catSchema, type CatLabel } from '@cat-store/shared'
import type { CatDoc } from '../models/cat.ts'

// A row in scripts/data/cats.json
export interface RawCat {
  name: string
  price: number
  createdAt: number
  isInStock: boolean
}

// Pick at most one label from each group, so a cat is never both Kitten and Senior
const _AGE_LABELS: CatLabel[] = ['Kitten', 'Adult', 'Senior']
const _HAIR_LABELS: CatLabel[] = ['Long-hair', 'Short-hair']
const _OTHER_LABELS = CAT_LABELS.filter(
  (label) => !_AGE_LABELS.includes(label) && !_HAIR_LABELS.includes(label),
)

function _pickOneOrNone(labels: CatLabel[]): CatLabel | undefined {
  // Roll over labels.length + 1 slots. Slot 0 reads labels[-1], which is undefined ("none"),
  // so every option, none included, is equally likely
  const index = Math.floor(Math.random() * (labels.length + 1))
  return labels[index - 1]
}

export function getRandomLabels(): CatLabel[] {
  const picked = new Set<CatLabel>()
  const age = _pickOneOrNone(_AGE_LABELS)
  const hair = _pickOneOrNone(_HAIR_LABELS)
  if (age) picked.add(age)
  if (hair) picked.add(hair)
  for (const label of _OTHER_LABELS) {
    if (Math.random() >= 0.5) picked.add(label)
  }
  // CAT_LABELS order, so labels read the same way on every cat
  return CAT_LABELS.filter((label) => picked.has(label))
}

// Fills in the fields the JSON lacks, then validates with the shared schema,
// so a bad row fails here instead of landing in the DB. The caller picks the owner
export function buildSeedCat(raw: RawCat, ownerId: ObjectId): CatDoc {
  const _id = new ObjectId()
  const input = catSchema.parse({
    name: raw.name,
    price: raw.price,
    isInStock: raw.isInStock,
    labels: getRandomLabels(),
    imgUrl: `https://robohash.org/${_id.toHexString()}?set=set4`,
  })
  return { _id, ...input, ownerId, createdAt: raw.createdAt, updatedAt: raw.createdAt }
}
