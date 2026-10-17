import type { ChatMsgNewerPage, ChatMsgOlderPage } from '@cat-store/shared'
import { httpService } from './http.service'

// Chat history only. Sends, edits and removes go over the socket (useCatChat)
export const chatService = {
  getOlderPage,
  getNewerPage,
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
