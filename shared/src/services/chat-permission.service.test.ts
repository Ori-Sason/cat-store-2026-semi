import { describe, expect, it } from 'vitest'
import { chatPermissionService } from './chat-permission.service.ts'

const MSG_USER_ID = 'user-1'
const MSG_AUTHOR = { _id: 'user-1', isAdmin: false }
const NON_MSG_AUTHOR_USER = { _id: 'user-2', isAdmin: false }
const ADMIN = { _id: 'admin-1', isAdmin: true }
const ADMIN_AUTHOR = { _id: 'user-1', isAdmin: true }

describe('chatPermissionService.canEditChatMsg', () => {
  it("lets the msg's author edit it", () => {
    expect(chatPermissionService.canEditChatMsg(MSG_USER_ID, MSG_AUTHOR)).toBe(true)
  })

  it('lets an admin edit their own msg', () => {
    expect(chatPermissionService.canEditChatMsg(MSG_USER_ID, ADMIN_AUTHOR)).toBe(true)
  })

  it("blocks an admin from editing a msg they didn't write", () => {
    expect(chatPermissionService.canEditChatMsg(MSG_USER_ID, ADMIN)).toBe(false)
  })

  it("blocks a user who didn't write the msg", () => {
    expect(chatPermissionService.canEditChatMsg(MSG_USER_ID, NON_MSG_AUTHOR_USER)).toBe(false)
  })

  it('blocks a guest', () => {
    expect(chatPermissionService.canEditChatMsg(MSG_USER_ID, null)).toBe(false)
  })

  it('blocks everyone, admins included, when the author is gone', () => {
    expect(chatPermissionService.canEditChatMsg(null, ADMIN)).toBe(false)
    expect(chatPermissionService.canEditChatMsg(null, NON_MSG_AUTHOR_USER)).toBe(false)
  })
})

describe('chatPermissionService.canRemoveChatMsg', () => {
  it("lets the msg's author remove it", () => {
    expect(chatPermissionService.canRemoveChatMsg(MSG_USER_ID, MSG_AUTHOR)).toBe(true)
  })

  it("lets an admin remove a msg they didn't write", () => {
    expect(chatPermissionService.canRemoveChatMsg(MSG_USER_ID, ADMIN)).toBe(true)
  })

  it("blocks a user who didn't write the msg", () => {
    expect(chatPermissionService.canRemoveChatMsg(MSG_USER_ID, NON_MSG_AUTHOR_USER)).toBe(false)
  })

  it('blocks a guest', () => {
    expect(chatPermissionService.canRemoveChatMsg(MSG_USER_ID, null)).toBe(false)
  })

  it('lets only an admin remove a msg whose author is gone', () => {
    expect(chatPermissionService.canRemoveChatMsg(null, ADMIN)).toBe(true)
    expect(chatPermissionService.canRemoveChatMsg(null, NON_MSG_AUTHOR_USER)).toBe(false)
    expect(chatPermissionService.canRemoveChatMsg(null, null)).toBe(false)
  })
})
