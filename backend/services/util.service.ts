import { ObjectId, type Sort } from 'mongodb'
import type { SortByDirection } from '@cat-store/shared'

// null for a malformed id, so the caller answers 404 instead of new ObjectId() throwing a 500.
// Didn't use ObjectId.isValid: it also accepts any 12-character string, e.g. "twelve chars"
function toObjectId(id: string): ObjectId | null {
  return /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null
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

export const utilService = {
  toObjectId,
  escapeRegex,
  buildSort,
}
