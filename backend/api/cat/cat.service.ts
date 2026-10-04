import { ObjectId, type Filter } from 'mongodb'
import type { CatFilter, CatInput } from '@cat-store/shared'
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
    .toArray()
}

async function getById(catId: string): Promise<CatDoc> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const cat = _id && (await collection.findOne({ _id }))
  if (!cat) throw _catNotFound(catId)
  return cat
}

async function add(input: CatInput): Promise<CatDoc> {
  const now = Date.now()
  const cat: CatDoc = { _id: new ObjectId(), ...input, createdAt: now, updatedAt: now }
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  await collection.insertOne(cat)
  return cat
}

async function update(catId: string, input: CatInput): Promise<CatDoc> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  // $set touches only the client fields and updatedAt - _id and createdAt stay as they are
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

function _buildCriteria({ txt, isInStock, labels }: CatFilter): Filter<CatDoc> {
  const criteria: Filter<CatDoc> = {}
  // escaped, so "." or "*" in the search box match literally instead of acting as regex
  if (txt) criteria.name = { $regex: utilService.escapeRegex(txt), $options: 'i' }
  if (isInStock !== null) criteria.isInStock = isInStock
  if (labels.length) criteria.labels = { $all: labels }
  return criteria
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
}
