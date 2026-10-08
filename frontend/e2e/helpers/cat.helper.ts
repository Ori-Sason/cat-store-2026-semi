import { expect, type APIRequestContext } from '@playwright/test'
import type { Cat, CatInput } from '@cat-store/shared'

// Setup a test doesn't cover through the UI. `request` must be logged in, adding a cat needs auth
export async function createCatViaApi(
  request: APIRequestContext,
  catInput: Partial<CatInput> = {},
): Promise<Cat> {
  const res = await request.post('/api/cats', {
    data: {
      name: `E2e cat ${Date.now()}`,
      price: 100,
      labels: [],
      isInStock: true,
      imgUrl: '',
      ...catInput,
    },
  })
  expect(res.status()).toBe(201)
  return (await res.json()) as Cat
}

// The first cat the API returns for a name search, e.g. a seed cat by its known name
export async function getCatByName(request: APIRequestContext, name: string): Promise<Cat> {
  const res = await request.get('/api/cats', { params: { txt: name } })
  expect(res.ok()).toBe(true)
  const [cat] = (await res.json()) as Cat[]
  if (!cat) throw new Error(`No cat named ${name}`)
  return cat
}
