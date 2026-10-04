import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'

export async function catDetailsLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  const cat = await catService.getById(params.id!)
  return { cat }
}
