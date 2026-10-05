import type { Request, Response } from 'express'
import { catFilterService, type CatInput } from '@cat-store/shared'
import { catService } from './cat.service.ts'

export async function getCats(req: Request, res: Response) {
  // URLSearchParams rather than req.query: req.query gives labels as a string or an array
  // depending on how many there are. The base URL is only there so URL can parse a path
  const { searchParams } = new URL(req.originalUrl, 'http://localhost')
  const filterBy = catFilterService.paramsToFilter(searchParams)
  const cats = await catService.query(filterBy)
  res.json(cats)
}

export async function getCatLabelStats(_req: Request, res: Response) {
  const stats = await catService.getLabelStats()
  res.json(stats)
}

export async function getCatById(req: Request<{ id: string }>, res: Response) {
  const cat = await catService.getById(req.params.id)
  res.json(cat)
}

// req.body is already parsed by validateBody(catSchema)
export async function addCat(req: Request<object, unknown, CatInput>, res: Response) {
  const cat = await catService.add(req.body)
  res.status(201).json(cat) // 201 Created
}

export async function updateCat(req: Request<{ id: string }, unknown, CatInput>, res: Response) {
  const cat = await catService.update(req.params.id, req.body)
  res.json(cat)
}

export async function removeCat(req: Request<{ id: string }>, res: Response) {
  await catService.remove(req.params.id)
  res.sendStatus(204) // 204 No Content
}
