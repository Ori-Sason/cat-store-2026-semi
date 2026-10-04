import type { Filter } from 'mongodb'
import type { CatFilter } from '@cat-store/shared'
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
  if (!cat) throw new HttpError(404, 'CAT_NOT_FOUND', `Cat ${catId} not found`)
  return cat
}

async function remove(catId: string): Promise<void> {
  const _id = utilService.toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const result = _id && (await collection.deleteOne({ _id }))
  if (!result?.deletedCount) throw new HttpError(404, 'CAT_NOT_FOUND', `Cat ${catId} not found`)
}

function _buildCriteria({ txt, isInStock, labels }: CatFilter): Filter<CatDoc> {
  const criteria: Filter<CatDoc> = {}
  // escaped, so "." or "*" in the search box match literally instead of acting as regex
  if (txt) criteria.name = { $regex: utilService.escapeRegex(txt), $options: 'i' }
  if (isInStock !== null) criteria.isInStock = isInStock
  if (labels.length) criteria.labels = { $all: labels }
  return criteria
}

export const catService = {
  query,
  getById,
  remove,
}
