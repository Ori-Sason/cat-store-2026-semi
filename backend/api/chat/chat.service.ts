import { MongoServerError, ObjectId, type Document, type Filter } from 'mongodb'
import {
  USER_REF_FIELDS,
  type ChatHistoryQuery,
  type ChatMsg,
  type ChatMsgInput,
  type ChatMsgNewerPage,
  type ChatMsgOlderPage,
  type ChatMsgUpdateInput,
} from '@cat-store/shared'
import { CHAT_MSG_COLLECTION, type ChatMsgDoc, type ChatMsgJoinedDoc } from '../../models/chat.ts'
import { HttpError } from '../../models/http-error.ts'
import { DUPLICATE_KEY_ERROR_CODE } from '../../models/mongodb.ts'
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

// Saves a msg and returns it joined, as the wire ChatMsg. isNew is false for a retry of a msg
// that was already saved (same userId + clientMsgId): the unique index rejects the second
// insert, and the saved msg comes back instead of an error. The controller broadcasts only a new one.
// The cat isn't read: chat:join is the gate, and requireRoomMember already checked membership
async function add(
  { catId, clientMsgId, text }: ChatMsgInput,
  userId: string,
): Promise<{ msg: ChatMsg; isNew: boolean }> {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  const now = Date.now()
  const doc: ChatMsgDoc = {
    _id: new ObjectId(),
    catId: new ObjectId(catId),
    userId: new ObjectId(userId),
    clientMsgId,
    text,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }
  try {
    // No findOne first: the unique index decides, so two retries racing can't both insert
    await collection.insertOne(doc)
    return { msg: await _getJoinedById(doc._id), isNew: true }
  } catch (err) {
    if (!(err instanceof MongoServerError && err.code === DUPLICATE_KEY_ERROR_CODE)) throw err
    const saved = await collection.findOne({ userId: doc.userId, clientMsgId })
    if (!saved) throw err // the unique index is the only one that can throw 11000 here
    return { msg: await _getJoinedById(saved._id), isNew: false }
  }
}

// The stored doc, for requireChatMsgPermission (it needs the author's userId).
// Filtered by catId too: a msg in another room is CHAT_MSG_NOT_FOUND, so a client can't name
// room A (where it's a member) and reach a msg in room B.
// A deleted msg still matches: remove acks the same tombstone on a repeat, and update filters it
// out itself. The ids are already checked by the payload schema, so new ObjectId() can't throw
async function getByIdAndRoom(msgId: string, catId: string): Promise<ChatMsgDoc> {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  const doc = await collection.findOne({ _id: new ObjectId(msgId), catId: new ObjectId(catId) })
  if (!doc) throw _chatMsgNotFound(msgId)
  return doc
}

// Sets the text and updatedAt ("Edited at" is updatedAt > createdAt). isDeleted: false is in the
// filter, not checked before: a msg deleted between requireChatMsgPermission's read and this
// write is caught here, atomically. From the user's view a deleted msg is gone, so it's
// CHAT_MSG_NOT_FOUND
async function update({ catId, msgId, text }: ChatMsgUpdateInput): Promise<ChatMsg> {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  const _id = new ObjectId(msgId)
  const { matchedCount } = await collection.updateOne(
    { _id, catId: new ObjectId(catId), isDeleted: false },
    { $set: { text, updatedAt: Date.now() } },
  )
  if (!matchedCount) throw _chatMsgNotFound(msgId)
  return _getJoinedById(_id)
}

// The doc has only userId. For the user details we need to aggregate
async function _getJoinedById(_id: ObjectId): Promise<ChatMsg> {
  const collection = await mongoService.getCollection<ChatMsgDoc>(CHAT_MSG_COLLECTION)
  const [doc] = await collection
    .aggregate<ChatMsgJoinedDoc>([{ $match: { _id } }, ..._userStages()])
    .toArray()
  return _toWireMsg(doc!)
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

function _chatMsgNotFound(msgId: string): HttpError {
  return new HttpError(404, 'CHAT_MSG_NOT_FOUND', `Chat msg ${msgId} not found`)
}

export const chatService = {
  query,
  add,
  getByIdAndRoom,
  update,
}
