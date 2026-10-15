import type { Request, Response } from 'express'
import type { ChatHistoryQuery } from '@cat-store/shared'
import { chatService } from './chat.service.ts'

// req.query is already parsed by validateQuery(chatHistoryQuerySchema).
export async function getChatMsgs(
  req: Request<{ id: string }, unknown, unknown, ChatHistoryQuery>,
  res: Response,
) {
  const page = await chatService.query(req.params.id, req.query)
  res.json(page)
}
