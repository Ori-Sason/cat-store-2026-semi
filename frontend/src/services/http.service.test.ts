import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { httpService } from './http.service'

// The service calls the instance from Axios.create() - swap it for a mock,
// keep the real isAxiosError so the error mapping runs as in the app
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }))
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  return {
    ...actual,
    default: { create: () => mockRequest, isAxiosError: actual.isAxiosError },
  }
})

const LOGIN_BODY = { username: 'ori', password: 'Secret-pass1' }
const INVALID_CREDENTIALS_RESPONSE = {
  status: 401,
  data: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials', requestId: 'req-1' },
}

function _setLoggedInUser() {
  useLoggedInUserStore
    .getState()
    .setLoggedInUser({ _id: 'user-1', username: 'ori', fullname: 'Ori Sason', isAdmin: false })
}

function _axiosError(response?: { status: number; data: unknown }) {
  return new AxiosError(
    'Request failed',
    undefined,
    undefined,
    undefined,
    response as AxiosResponse | undefined,
  )
}

describe('httpService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
    // the service logs every failed call - keep test output clean
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.unstubAllEnvs()
  })

  it('returns the response data', async () => {
    mockRequest.mockResolvedValue({ data: [{ name: 'Mitzi' }] })

    expect(await httpService.get('cats')).toEqual([{ name: 'Mitzi' }])
  })

  it('sends GET data as query params', async () => {
    mockRequest.mockResolvedValue({ data: [] })
    await httpService.get('cats', { name: 'Mitzi' })

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/api/cats', params: { name: 'Mitzi' }, data: undefined }),
    )
  })

  it('times out after 10s by default, or after the timeoutMs passed', async () => {
    mockRequest.mockResolvedValue({ data: [] })
    await httpService.get('cats')
    await httpService.get('auth/me', undefined, { timeoutMs: 3_000 })

    expect(mockRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ timeout: 10_000 }))
    expect(mockRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ timeout: 3_000 }))
  })

  it('throws NETWORK_ERROR on a timeout', async () => {
    mockRequest.mockRejectedValue(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'))

    await expect(httpService.get('cats')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('sends POST data as the body', async () => {
    mockRequest.mockResolvedValue({ data: {} })
    await httpService.post('cats', { name: 'Mitzi' })

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', data: { name: 'Mitzi' }, params: null }),
    )
  })

  it('turns an API error body into an ApiError', async () => {
    const fieldErrors = { name: ['Required'] }
    mockRequest.mockRejectedValue(
      _axiosError({
        status: 400,
        data: { code: 'VALIDATION_FAILED', message: 'Bad cat', fieldErrors, requestId: 'req-1' },
      }),
    )

    await expect(httpService.post('cats', {})).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Bad cat',
      fieldErrors,
      requestId: 'req-1',
    })
  })

  it('throws NETWORK_ERROR with status 0 when no response comes back', async () => {
    mockRequest.mockRejectedValue(_axiosError())

    await expect(httpService.get('cats')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('throws UNKNOWN for a response that is not an API error body', async () => {
    mockRequest.mockRejectedValue(_axiosError({ status: 502, data: '<html>Bad Gateway</html>' }))

    await expect(httpService.get('cats')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
  })

  it('throws UNKNOWN for a body with a code the API does not define', async () => {
    mockRequest.mockRejectedValue(
      _axiosError({ status: 418, data: { code: 'I_AM_A_TEAPOT', message: 'Nope' } }),
    )

    await expect(httpService.get('cats')).rejects.toMatchObject({ status: 418, code: 'UNKNOWN' })
  })

  it('throws UNKNOWN with status 0 for an error that is not from axios', async () => {
    mockRequest.mockRejectedValue(new TypeError('boom'))

    const promise = httpService.get('cats')

    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 0, code: 'UNKNOWN' })
  })

  it('logs the user out on a 401 UNAUTHORIZED', async () => {
    _setLoggedInUser()
    mockRequest.mockRejectedValue(
      _axiosError({ status: 401, data: { code: 'UNAUTHORIZED', message: 'Not logged in' } }),
    )

    await expect(httpService.post('cats', {})).rejects.toMatchObject({ status: 401 })
    expect(useLoggedInUserStore.getState().loggedInUser).toBeNull()
  })

  it('keeps the user logged in on a 401 INVALID_CREDENTIALS', async () => {
    _setLoggedInUser()
    mockRequest.mockRejectedValue(_axiosError(INVALID_CREDENTIALS_RESPONSE))

    await expect(httpService.post('auth/login', LOGIN_BODY)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(useLoggedInUserStore.getState().loggedInUser).not.toBeNull()
  })

  it('masks secret fields when logging a failed call in dev', async () => {
    mockRequest.mockRejectedValue(_axiosError(INVALID_CREDENTIALS_RESPONSE))

    await expect(httpService.post('auth/login', LOGIN_BODY)).rejects.toThrow()

    const logged = JSON.stringify(vi.mocked(console.log).mock.calls)
    expect(logged).not.toContain(LOGIN_BODY.password)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('auth/login'), {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
      requestId: 'req-1',
      data: { username: 'ori', password: '***' },
    })
  })

  it('logs no request body in prod', async () => {
    vi.stubEnv('DEV', false)
    mockRequest.mockRejectedValue(_axiosError(INVALID_CREDENTIALS_RESPONSE))

    await expect(httpService.post('auth/login', LOGIN_BODY)).rejects.toThrow()

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('auth/login'), {
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid credentials',
      requestId: 'req-1',
    })
  })
})
