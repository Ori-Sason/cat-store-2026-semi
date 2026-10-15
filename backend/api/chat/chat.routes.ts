import { Router } from 'express'
import { chatHistoryQuerySchema } from '@cat-store/shared'
import { validateQuery } from '../../middlewares/validate.middleware.ts'
import { getChatMsgs } from './chat.controller.ts'

// Mounted at /api/cats/:id/chat-msgs. A chat belongs to one cat
// and is never listed across cats, so the cat in the URL is the scope.
// Open to guests: the chat is readable by anyone, like the cat page.
// mergeParams: without it this router can't see the parent's :id
export const chatRoutes = Router({ mergeParams: true })

chatRoutes.get('/', validateQuery(chatHistoryQuerySchema), getChatMsgs)
