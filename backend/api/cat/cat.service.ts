import { ObjectId, type Filter } from 'mongodb'
import {
  CAT_LABELS,
  USER_REF_FIELDS,
  type CatFilter,
  type CatInput,
  type CatLabelStats,
} from '@cat-store/shared'
import { CAT_COLLECTION, type CatDoc, type CatJoinedDoc } from '../../models/cat.ts'
import { HttpError } from '../../models/http-error.ts'
import { REVIEW_COLLECTION, type ReviewDoc } from '../../models/review.ts'
import { USER_COLLECTION } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { utilService } from '../../services/util.service.ts'

async function query(filterBy: CatFilter): Promise<CatDoc[]> {
  // A malformed ownerId can't own a cat, so the answer is "no cats". Returning early matters:
  // dropping the bad id from the criteria would mean every cat
  const ownerId = filterBy.ownerId ? utilService.toObjectId(filterBy.ownerId) : null
  if (filterBy.ownerId && !ownerId) return []

  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  return collection
    .find(_buildCriteria(filterBy, ownerId))
    .sort(utilService.buildSort<CatDoc>(filterBy))
    .collation({ locale: 'en' }) // case-insensitive string sort: "bella" sits next to "Bella"
    .limit(filterBy.limit ?? 0) // after the sort, so it keeps the first N in sort order. 0 = no limit
    .toArray()
}

async function getById(catId: string): Promise<CatDoc> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const cat = _id && (await collection.findOne({ _id }))
  if (!cat) throw _catNotFound(catId)
  return cat
}

// getById plus the owner's ref, for the details page only. getById stays plain: the owner check,
// update and reviewService.add need the bare cat, and shouldn't pay for a join.
// $unwind is an inner join: a cat whose owner's user is gone is a 404, so the store hides it.
async function getByIdWithOwner(catId: string): Promise<CatJoinedDoc> {
  const _id = utilService.toObjectId(catId)
  if (!_id) throw _catNotFound(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const [cat] = await collection
    .aggregate<CatJoinedDoc>([
      { $match: { _id } },
      utilService.buildLookup(USER_COLLECTION, 'ownerId', 'owner', USER_REF_FIELDS),
      { $unwind: '$owner' },
      { $unset: 'ownerId' }, // the owner's ref replaces it
    ])
    .toArray()
  if (!cat) throw _catNotFound(catId)
  return cat
}

async function add(input: CatInput, ownerId: string): Promise<CatDoc> {
  const now = Date.now()
  const cat: CatDoc = {
    _id: new ObjectId(),
    ...input,
    ownerId: new ObjectId(ownerId),
    createdAt: now,
    updatedAt: now,
  }
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  await collection.insertOne(cat)
  return cat
}

async function update(catId: string, input: CatInput): Promise<CatDoc> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  // $set touches only the client fields and updatedAt - _id, ownerId and createdAt stay as they are
  const cat =
    _id &&
    (await collection.findOneAndUpdate(
      { _id },
      { $set: { ...input, updatedAt: Date.now() } },
      { returnDocument: 'after' },
    ))
  if (!cat) throw _catNotFound(catId)
  return cat
}

// Deletes the cat, then its reviews. Two plain deletes, since the local Mongo is a standalone
// server and transactions need a replica set. Cat first: if the reviews delete fails, the
// leftovers are orphans that reviewService.query's $unwind hides. The other order could wipe
// the reviews of a cat that's still there.
// The reviews collection is hit directly, not through reviewService: reviewService already
// imports catService, and this keeps the two modules from importing each other
async function remove(catId: string): Promise<void> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const result = _id && (await collection.deleteOne({ _id }))
  // !_id is already covered by !result, but TS needs it spelled out to narrow _id for deleteMany
  if (!_id || !result?.deletedCount) throw _catNotFound(catId)
  const reviews = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  await reviews.deleteMany({ catId: _id }) // served by the { catId: 1, createdAt: -1 } index prefix
}

// One row per label, over the whole catalog. A cat counts once in each of its labels,
// and a cat with no labels drops out at $unwind
async function getLabelStats(): Promise<CatLabelStats[]> {
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const rows = await collection
    .aggregate<CatLabelStats>([
      { $unwind: '$labels' },
      {
        $group: {
          _id: '$labels',
          count: { $sum: 1 },
          inStockCount: { $sum: { $cond: ['$isInStock', 1, 0] } },
          // Mongo 8.0 only accepts 'approximate' (t-digest). On small groups (tested up to
          // ~2,000 values) it's exact: a real price, the lower middle one on even-sized
          // groups. On large groups it's an estimate and can be an arbitrary float
          medianPrice: { $median: { input: '$price', method: 'approximate' } },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
      {
        $project: {
          _id: 0,
          label: '$_id',
          count: 1,
          inStockCount: 1,
          medianPrice: 1,
          minPrice: 1,
          maxPrice: 1,
        },
      },
    ])
    .toArray()
  return _fillAllLabels(rows)
}

// ownerId comes in already converted: query() turns a malformed one into an early []
function _buildCriteria(
  { txt, isInStock, labels }: CatFilter,
  ownerId: ObjectId | null,
): Filter<CatDoc> {
  const criteria: Filter<CatDoc> = {}
  // escaped, so "." or "*" in the search box match literally instead of acting as regex
  if (txt) criteria.name = { $regex: utilService.escapeRegex(txt), $options: 'i' }
  if (isInStock !== null) criteria.isInStock = isInStock
  if (labels.length) criteria.labels = { $all: labels }
  if (ownerId) criteria.ownerId = ownerId
  return criteria
}

// $group only returns labels some cat has. Map CAT_LABELS so the order stays fixed and
// labels with no cats still get a row
function _fillAllLabels(rows: CatLabelStats[]): CatLabelStats[] {
  const rowByLabel = new Map(rows.map((row) => [row.label, row]))
  return CAT_LABELS.map(
    (label) =>
      rowByLabel.get(label) ?? {
        label,
        count: 0,
        inStockCount: 0,
        medianPrice: null,
        minPrice: null,
        maxPrice: null,
      },
  )
}

function _catNotFound(catId: string): HttpError {
  return new HttpError(404, 'CAT_NOT_FOUND', `Cat ${catId} not found`)
}

export const catService = {
  query,
  getById,
  getByIdWithOwner,
  add,
  update,
  remove,
  getLabelStats,
}
