import { catFilterService } from '@cat-store/shared'
import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../services/cat.service'

export async function catAppLoader({ request }: Pick<LoaderFunctionArgs, 'request'>) {
  const filterBy = catFilterService.paramsToFilter(new URL(request.url).searchParams)
  const cats = await catService.query(filterBy)
  return { cats, filterBy }
}
