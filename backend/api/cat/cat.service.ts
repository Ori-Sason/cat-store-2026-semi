import { ObjectId, type Filter, type Sort } from 'mongodb'
import type { CatFilter } from '@cat-store/shared'
import { CAT_COLLECTION, type CatDoc } from '../../models/cat.ts'
import { HttpError } from '../../models/http-error.ts'
import { mongoService } from '../../services/mongodb.service.ts'

async function query(filterBy: CatFilter): Promise<CatDoc[]> {
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  return collection
    .find(_buildCriteria(filterBy))
    .sort(_buildSort(filterBy))
    .collation({ locale: 'en' }) // case-insensitive string sort: "bella" sits next to "Bella"
    .toArray()
}

async function getById(catId: string): Promise<CatDoc> {
  const _id = _toObjectId(catId)
  const collection = await mongoService.getCollection<CatDoc>(CAT_COLLECTION)
  const cat = _id && (await collection.findOne({ _id }))
  if (!cat) throw new HttpError(404, 'CAT_NOT_FOUND', `Cat ${catId} not found`)
  return cat
}

// null for a malformed id, so the caller answers 404 instead of new ObjectId() throwing a 500.
// Didn't use ObjectId.isValid: it also accepts any 12-character string, e.g. "twelve chars"
function _toObjectId(id: string): ObjectId | null {
  return /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null
}

function _buildCriteria({ txt, isInStock, labels }: CatFilter): Filter<CatDoc> {
  const criteria: Filter<CatDoc> = {}
  // escaped, so "." or "*" in the search box match literally instead of acting as regex
  if (txt) criteria.name = { $regex: _escapeRegex(txt), $options: 'i' }
  if (isInStock !== null) criteria.isInStock = isInStock
  if (labels.length) criteria.labels = { $all: labels }
  return criteria
}

function _buildSort({ sortBy, sortDir }: CatFilter): Sort {
  // _id as a tiebreak - equal prices would otherwise come back in an unstable order
  return { [sortBy]: sortDir === 'asc' ? 1 : -1, _id: 1 }
}

function _escapeRegex(str: string): string {
  // `$&` is the whole match - here always one special character - so `\\$&` puts a backslash before it.
  // Why I didn't use RegExp.escape: that one also hex-escapes letters and spaces ("tom" → "\x74om"),
  // which still works in Mongo but makes the query unreadable in logs
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const catService = {
  query,
  getById,
}
