import type { Request, Response } from 'express'
import { catFilterService } from '@cat-store/shared'
import { catService } from './cat.service.ts'

export async function getCats(req: Request, res: Response) {
  // URLSearchParams rather than req.query: req.query gives labels as a string or an array
  // depending on how many there are. The base URL is only there so URL can parse a path
  const { searchParams } = new URL(req.originalUrl, 'http://localhost')
  const filterBy = catFilterService.paramsToFilter(searchParams)
  const cats = await catService.query(filterBy)
  res.json(cats)
}

export async function getCatById(req: Request<{ id: string }>, res: Response) {
  const cat = await catService.getById(req.params.id)
  res.json(cat)
}
