import { ObjectId, type Filter } from 'mongodb'
import {
  CAT_REF_FIELDS,
  USER_REF_FIELDS,
  type ReviewContentInput,
  type ReviewFilter,
  type ReviewInput,
} from '@cat-store/shared'
import { CAT_COLLECTION } from '../../models/cat.ts'
import { HttpError } from '../../models/http-error.ts'
import { REVIEW_COLLECTION, type ReviewDoc, type ReviewJoinedDoc } from '../../models/review.ts'
import { USER_COLLECTION } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { utilService } from '../../services/util.service.ts'
import { catService } from '../cat/cat.service.ts'

// A cat's or a user's reviews, newest first, each joined with its author and its cat.
// Stage order matters:
// - $match + $sort come first, so Mongo runs them as one query on the
//   { catId / userId: 1, createdAt: -1 } index, with no in-memory sort. No _id tiebreak:
//   it isn't in the index, so it would bring the in-memory sort back.
// - Mongo 8.0 doesn't move a $match from after a $lookup to before it, so it has to be
//   written first.
// - $unwind is an inner join: a review whose user or cat is gone drops out.
async function query(filterBy: ReviewFilter): Promise<ReviewJoinedDoc[]> {
  const collection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  return collection
    .aggregate<ReviewJoinedDoc>([
      { $match: _buildCriteria(filterBy) },
      { $sort: { createdAt: -1 } },
      utilService.buildLookup(USER_COLLECTION, 'userId', 'user', USER_REF_FIELDS),
      { $unwind: '$user' },
      utilService.buildLookup(CAT_COLLECTION, 'catId', 'cat', CAT_REF_FIELDS),
      { $unwind: '$cat' },
      // Inclusion again: drops userId / catId (the refs replace them) and anything added later
      { $project: { content: 1, createdAt: 1, updatedAt: 1, user: 1, cat: 1 } },
    ])
    .toArray()
}

// The cat must exist: getById throws 404 CAT_NOT_FOUND, so a review can't point at nothing.
// A cat deleted between the check and the insert leaves an orphan, which query's $unwind hides
async function add(input: ReviewInput, userId: string): Promise<ReviewDoc> {
  await catService.getById(input.catId)
  const now = Date.now()
  const review: ReviewDoc = {
    _id: new ObjectId(),
    content: input.content,
    catId: new ObjectId(input.catId),
    userId: new ObjectId(userId),
    createdAt: now,
    updatedAt: now,
  }
  const collection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  await collection.insertOne(review)
  return review
}

async function getById(reviewId: string): Promise<ReviewDoc> {
  const _id = utilService.toObjectId(reviewId)
  const collection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  const review = _id && (await collection.findOne({ _id }))
  if (!review) throw _reviewNotFound(reviewId)
  return review
}

async function update(reviewId: string, input: ReviewContentInput): Promise<ReviewDoc> {
  const _id = utilService.toObjectId(reviewId)
  const collection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  // $set touches only content and updatedAt - catId, userId and createdAt stay as they are
  const review =
    _id &&
    (await collection.findOneAndUpdate(
      { _id },
      { $set: { content: input.content, updatedAt: Date.now() } },
      { returnDocument: 'after' },
    ))
  if (!review) throw _reviewNotFound(reviewId)
  return review
}

async function remove(reviewId: string): Promise<void> {
  const _id = utilService.toObjectId(reviewId)
  const collection = await mongoService.getCollection<ReviewDoc>(REVIEW_COLLECTION)
  const result = _id && (await collection.deleteOne({ _id }))
  if (!result?.deletedCount) throw _reviewNotFound(reviewId)
}

// The ids are already checked by reviewFilterSchema, so new ObjectId() can't throw here
function _buildCriteria({ catId, userId }: ReviewFilter): Filter<ReviewDoc> {
  const criteria: Filter<ReviewDoc> = {}
  if (catId) criteria.catId = new ObjectId(catId)
  if (userId) criteria.userId = new ObjectId(userId)
  return criteria
}

function _reviewNotFound(reviewId: string): HttpError {
  return new HttpError(404, 'REVIEW_NOT_FOUND', `Review ${reviewId} not found`)
}

export const reviewService = {
  query,
  add,
  getById,
  update,
  remove,
}
