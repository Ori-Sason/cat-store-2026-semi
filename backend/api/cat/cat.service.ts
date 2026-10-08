import { ObjectId, type Filter } from 'mongodb'
import { CAT_LABELS, type CatFilter, type CatInput, type CatLabelStats } from '@cat-store/shared'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { HttpError } from '../../models/http-error.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { utilService } from '../../services/util.service.ts'

async function query(filterBy: CatFilter): Promise<CatDoc[]> {
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  return collection
    .find(_buildCriteria(filterBy))
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

async function remove(catId: string): Promise<void> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const result = _id && (await collection.deleteOne({ _id }))
  if (!result?.deletedCount) throw _catNotFound(catId)
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

function _buildCriteria({ txt, isInStock, labels }: CatFilter): Filter<CatDoc> {
  const criteria: Filter<CatDoc> = {}
  // escaped, so "." or "*" in the search box match literally instead of acting as regex
  if (txt) criteria.name = { $regex: utilService.escapeRegex(txt), $options: 'i' }
  if (isInStock !== null) criteria.isInStock = isInStock
  if (labels.length) criteria.labels = { $all: labels }
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
  add,
  update,
  remove,
  getLabelStats,
}
