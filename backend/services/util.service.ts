import { ObjectId, type Document, type Sort } from 'mongodb'
import { sharedUtilService, type SortByDirection } from '@cat-store/shared'

// null for a malformed id, so the caller answers 404 instead of new ObjectId() throwing a 500
function toObjectId(id: string): ObjectId | null {
  return sharedUtilService.getObjectIdRegex().test(id) ? new ObjectId(id) : null
}

function escapeRegex(str: string): string {
  // `$&` is the whole match - here always one special character - so `\\$&` puts a backslash before it.
  // Why I didn't use RegExp.escape: that one also hex-escapes letters and spaces ("tom" → "\x74om"),
  // which still works in Mongo but makes the query unreadable in logs
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// TDoc pins sortBy to a real field of the collection's doc: buildSort<CatDoc>(filterBy)
function buildSort<TDoc>({
  sortBy,
  sortDir,
}: {
  sortBy: keyof TDoc & string
  sortDir: SortByDirection
}): Sort {
  // _id as a tiebreak - equal values would otherwise come back in an unstable order
  return { [sortBy]: sortDir === 'asc' ? 1 : -1, _id: 1 }
}

// A $lookup stage that joins one doc by its _id (the default index serves it) and keeps
// only `fields` plus _id. The $project runs inside the foreign collection, so nothing outside
// the allow-list ever enters the pipeline. Inclusion only, never { password: 0 }: an exclusion
// would let a field added later through by default.
// `as` is still an array (0 or 1 docs): the caller picks $unwind (drop the doc when the ref is
// gone) or $first (keep it, with null)
function buildLookup(
  from: string,
  localField: string,
  as: string,
  fields: readonly string[],
): Document {
  const projection = Object.fromEntries(fields.map((field) => [field, 1]))
  return {
    $lookup: { from, localField, foreignField: '_id', as, pipeline: [{ $project: projection }] },
  }
}

export const utilService = {
  toObjectId,
  escapeRegex,
  buildSort,
  buildLookup,
}
