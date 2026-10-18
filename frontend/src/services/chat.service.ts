import type { ChatMsgNewerPage, ChatMsgOlderPage } from '@cat-store/shared'
import { httpService } from './http.service'

// Chat history, plus the composer's draft. Sends, edits and removes go over the socket
// (useCatChat)
export const chatService = {
  getOlderPage,
  getNewerPage,
  getDraft,
  saveDraft,
  removeDraft,
}

function _getBasePath(catId: string) {
  return `cats/${catId}/chat-msgs`
}

// No beforeId: the newest page (the first open). With it: the page before that msg ("load older")
function getOlderPage(catId: string, beforeId?: string): Promise<ChatMsgOlderPage> {
  return httpService.get<ChatMsgOlderPage>(_getBasePath(catId), beforeId ? { beforeId } : undefined)
}

// The page after that msg: the reconnect gap fill, repeated while nextAfterId isn't null
function getNewerPage(catId: string, afterId: string): Promise<ChatMsgNewerPage> {
  return httpService.get<ChatMsgNewerPage>(_getBasePath(catId), { afterId })
}

// The text of a send that hit an expired session. The composer turns into the guest CTA, and
// logging in navigates away, which resets the chat's state. So the text waits here and comes back
// in the composer on the return to the cat. sessionStorage: one tab's draft, gone with the tab.
// Every access is in a try/catch, and a lost draft is only an inconvenience. Reading the
// sessionStorage global itself throws a SecurityError when the browser blocks site data for this
// origin (e.g. Chrome's "block all cookies"), so getItem and removeItem can fail too, not only
// setItem on a full QuotaExceededError
function _getDraftKey(catId: string) {
  // Lowercased like every chat catId: the route param keeps the URL's case
  return `chatDraft:${catId.toLowerCase()}`
}

function getDraft(catId: string): string | null {
  try {
    return sessionStorage.getItem(_getDraftKey(catId))
  } catch {
    return null
  }
}

function saveDraft(catId: string, text: string): void {
  try {
    sessionStorage.setItem(_getDraftKey(catId), text)
  } catch {
    // The failed row still shows the text
  }
}

function removeDraft(catId: string): void {
  try {
    sessionStorage.removeItem(_getDraftKey(catId))
  } catch {
    // Nothing to clean up if storage is out of reach
  }
}
