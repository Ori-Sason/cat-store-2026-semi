import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'

// No id = /cat/new
export async function catEditLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  if (!params.id) return { cat: null }
  const cat = await catService.getById(params.id)
  return { cat }
}
