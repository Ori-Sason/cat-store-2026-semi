import { describe, expect, it } from 'vitest'
import type { PendingChatMsg } from '../../models/chat'
import { makeMsg, makeMsgId, makeTombstone } from './chat-test.helper'
import {
  getNewestMsgId,
  mergeMsgs,
  pickNewerCopy,
  removePendingMsgs,
  replaceMsg,
} from './chat-log.util'

// The rules on their own. How the hook combines them (a stale fetch after a live edit, the
// reconnect cursor) is in the use-cat-chat.*.test.ts files

function _makePendingMsg(clientMsgId: string): PendingChatMsg {
  const { _id, user, ...msg } = makeMsg(1)
  return { ...msg, clientMsgId, user: user!, isDeleted: false, text: 'hi', sendStatus: 'sending' }
}

describe('mergeMsgs', () => {
  it('sorts by _id, whatever the arrival order', () => {
    const merged = mergeMsgs([makeMsg(1), makeMsg(4)], [makeMsg(3), makeMsg(2)])
    expect(merged.map((msg) => msg._id)).toEqual([1, 2, 3, 4].map(makeMsgId))
  })

  it('keeps one copy per _id', () => {
    expect(mergeMsgs([makeMsg(1)], [makeMsg(1)])).toHaveLength(1)
  })

  it('takes the copy with the later updatedAt', () => {
    const editedMsg = { ...makeMsg(1), text: 'edited', updatedAt: 99 }
    expect(mergeMsgs([makeMsg(1)], [editedMsg])[0]).toBe(editedMsg)
    expect(mergeMsgs([editedMsg], [makeMsg(1)])[0]).toBe(editedMsg)
  })

  it('keeps the held copy on a tie', () => {
    const heldMsg = makeMsg(1)
    expect(mergeMsgs([heldMsg], [{ ...makeMsg(1) }])[0]).toBe(heldMsg)
  })

  it('lets a tombstone win both ways, though a remove keeps updatedAt', () => {
    const tombstone = makeTombstone(1)
    expect(mergeMsgs([makeMsg(1)], [tombstone])[0]).toBe(tombstone)
    expect(mergeMsgs([tombstone], [{ ...makeMsg(1), updatedAt: 99 }])[0]).toBe(tombstone)
  })
})

describe('replaceMsg', () => {
  it('replaces a held msg with a newer copy', () => {
    const editedMsg = { ...makeMsg(2), updatedAt: 99 }
    expect(replaceMsg([makeMsg(1), makeMsg(2)], editedMsg)).toEqual([makeMsg(1), editedMsg])
  })

  // The same list, so React skips the render
  it("returns the held list itself for a msg it doesn't hold", () => {
    const heldMsgs = [makeMsg(1)]
    expect(replaceMsg(heldMsgs, makeMsg(2))).toBe(heldMsgs)
  })

  it("returns the held list itself for a copy that isn't newer", () => {
    const heldMsgs = [makeMsg(1)]
    expect(replaceMsg(heldMsgs, makeMsg(1))).toBe(heldMsgs)
  })
})

describe('pickNewerCopy', () => {
  it('keeps the msg when there is no other copy', () => {
    const msg = makeMsg(1)
    expect(pickNewerCopy(msg, undefined)).toBe(msg)
  })

  it('takes the other copy only when it is newer', () => {
    const editedMsg = { ...makeMsg(1), updatedAt: 99 }
    expect(pickNewerCopy(makeMsg(1), editedMsg)).toBe(editedMsg)
    expect(pickNewerCopy(editedMsg, makeMsg(1))).toBe(editedMsg)
  })
})

describe('getNewestMsgId', () => {
  it('starts from null', () => {
    expect(getNewestMsgId(null, [makeMsg(2), makeMsg(3), makeMsg(1)])).toBe(makeMsgId(3))
  })

  it('keeps the current id when the msgs are all older', () => {
    expect(getNewestMsgId(makeMsgId(5), [makeMsg(2)])).toBe(makeMsgId(5))
  })

  it('stays null with no msgs', () => {
    expect(getNewestMsgId(null, [])).toBeNull()
  })
})

describe('removePendingMsgs', () => {
  it('drops the pending msgs with those clientMsgIds', () => {
    const pendingMsgs = [_makePendingMsg('a'), _makePendingMsg('b')]
    expect(removePendingMsgs(pendingMsgs, new Set(['a']))).toEqual([pendingMsgs[1]])
  })

  it('returns the list itself when none match', () => {
    const pendingMsgs = [_makePendingMsg('a')]
    expect(removePendingMsgs(pendingMsgs, new Set(['z']))).toBe(pendingMsgs)
  })
})
