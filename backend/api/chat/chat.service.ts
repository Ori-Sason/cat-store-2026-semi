import type { Document, Filter } from 'mongodb'
import {
  USER_REF_FIELDS,
  type ChatHistoryQuery,
  type ChatMsg,
  type ChatMsgNewerPage,
  type ChatMsgOlderPage,
} from '@cat-store/shared'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc, type ChatMsgJoinedDoc } from '../../models/chat.ts'
import { USER_COLLECTION } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { utilService } from '../../services/util.service.ts'
import { catService } from '../cat/cat.service.ts'

const _PAGE_SIZE = 50

// One page of a cat's chat, oldest first in both directions:
// - neither cursor → the newest page, beforeId → the page before it ("load older"),
//   afterId → the page after it (the reconnect gap fill)
// Cursor paging by _id, not an offset, which drifts as new msgs arrive. The { catId: 1, _id: -1 }
// index serves both directions. Fetches one extra to know whether more exist.
// 404 CAT_NOT_FOUND for a missing cat, which also hides orphans of a deleted cat
async function query(
  catId: string,
  { beforeId, afterId }: ChatHistoryQuery,
): Promise<ChatMsgOlderPage | ChatMsgNewerPage> {
  const cat = await catService.getById(catId)
  // The ids are already checked by chatHistoryQuerySchema, so toObjectId can't return null
  const criteria: Filter<ChatMsgDoc> = { catId: cat._id }

  if (afterId) {
    criteria._id = { $gt: utilService.toObjectId(afterId)! }
    const docs = await _queryJoined(criteria, 1)
    const isMore = docs.length > _PAGE_SIZE
    const msgs = docs.slice(0, _PAGE_SIZE).map(_toWireMsg)
    return { msgs, nextAfterId: isMore ? msgs.at(-1)!._id : null }
  }

  if (beforeId) criteria._id = { $lt: utilService.toObjectId(beforeId)! }
  const docs = await _queryJoined(criteria, -1)
  const isMore = docs.length > _PAGE_SIZE
  // Fetched newest first (so the limit keeps the newest), sent oldest first
  const msgs = docs.slice(0, _PAGE_SIZE).reverse().map(_toWireMsg)
  return { msgs, nextBeforeId: isMore ? msgs[0]!._id : null }
}

// $match + $sort + $limit come first, so Mongo reads them off the index and joins only the page.
// The join is a left join, unlike reviews' $unwind (an inner join): a msg whose author is gone
// stays, with user: null. Dropping it would leave later replies without context, and a dropped
// row inside the fetched 51 would break the "is there more" check.
// $lookup always yields an array ([] on no match). $first takes element 0 ([] → missing) and
// $ifNull turns missing into null. A $set can't drop a row, unlike $unwind
async function _queryJoined(
  criteria: Filter<ChatMsgDoc>,
  sortDir: 1 | -1,
): Promise<ChatMsgJoinedDoc[]> {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  const pipeline: Document[] = [
    { $match: criteria },
    { $sort: { _id: sortDir } },
    { $limit: _PAGE_SIZE + 1 },
    ..._userStages(),
  ]
  return collection.aggregate<ChatMsgJoinedDoc>(pipeline).toArray()
}

function _userStages(): Document[] {
  return [
    utilService.buildLookup(USER_COLLECTION, 'userId', 'user', USER_REF_FIELDS),
    { $set: { user: { $ifNull: [{ $first: '$user' }, null] } } },
  ]
}

// The one doc → wire mapper, for history, acks and broadcasts, so no path can leak a deleted
// msg's text or an author field outside UserRef. user comes from the joined doc, so it's always
// the msg's author, never whoever sent the event (an admin's remove still shows the author)
function _toWireMsg({
  _id,
  catId,
  clientMsgId,
  text,
  isDeleted,
  createdAt,
  updatedAt,
  user,
}: ChatMsgJoinedDoc): ChatMsg {
  const base = {
    _id: _id.toHexString(),
    catId: catId.toHexString(),
    clientMsgId,
    createdAt,
    updatedAt,
    user: user && { _id: user._id.toHexString(), fullname: user.fullname, isAdmin: user.isAdmin },
  }
  return isDeleted ? { ...base, isDeleted: true } : { ...base, isDeleted: false, text }
}

export const chatService = {
  query,
}
