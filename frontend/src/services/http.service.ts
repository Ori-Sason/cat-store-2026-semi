import Axios from 'axios'
import { ERROR_CODES, type ApiErrorBody } from '@cat-store/shared'
import { ApiError } from '../models/api-error'
import { useLoggedInUserStore } from '../store/logged-in-user.store'

const BASE_URL = '/api'
const SECRET_FIELDS = new Set(['password', 'confirmPassword'])

const axios = Axios.create({
  withCredentials: true, // relevant on cross-origin (irrelevant for this project since we use Vite's proxy)
})

export const httpService = {
  get<T>(endpoint: string, data?: unknown): Promise<T> {
    return _ajax(endpoint, 'GET', data)
  },
  post<T>(endpoint: string, data?: unknown): Promise<T> {
    return _ajax(endpoint, 'POST', data)
  },
  put<T>(endpoint: string, data?: unknown): Promise<T> {
    return _ajax(endpoint, 'PUT', data)
  },
  delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return _ajax(endpoint, 'DELETE', data)
  },
}

const _ajax = async <T>(endpoint: string, method = 'GET', data: unknown = null): Promise<T> => {
  try {
    const res = await axios({
      url: `${BASE_URL}/${endpoint}`,
      method,
      data: method === 'GET' ? undefined : data,
      params: method === 'GET' ? data : null,
    })
    return res.data
  } catch (err) {
    const apiError = _toApiError(err)
    _logError(method, endpoint, data, apiError)
    if (apiError.code === 'UNAUTHORIZED') useLoggedInUserStore.getState().clearLoggedInUser()
    throw apiError
  }
}

const _toApiError = (err: unknown): ApiError => {
  if (!Axios.isAxiosError(err)) return new ApiError(0, 'UNKNOWN', String(err))

  // Request went out but nothing came back (server down, offline, CORS)
  if (!err.response) return new ApiError(0, 'NETWORK_ERROR', err.message)

  const { status, data } = err.response
  if (_isApiErrorBody(data)) {
    return new ApiError(status, data.code, data.message, data.fieldErrors, data.requestId)
  }

  // A response that isn't ours - e.g. an HTML 502 page from a proxy
  return new ApiError(status, 'UNKNOWN', err.message)
}

const _isApiErrorBody = (data: unknown): data is ApiErrorBody => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof data.code === 'string' &&
    (ERROR_CODES as readonly string[]).includes(data.code)
  )
}

const _logError = (method: string, endpoint: string, data: unknown, apiError: ApiError) => {
  const { status, code, message, requestId } = apiError
  const msg = `Had Issues ${method}ing to the backend, endpoint: ${endpoint}`

  if (import.meta.env.DEV) {
    console.log(msg, { status, code, message, requestId, data: _describeData(data) })
  } else {
    console.log(msg, { status, code, message, requestId })
  }
}

const _describeData = (data: unknown) => {
  if (data instanceof URLSearchParams || data instanceof FormData) {
    return [...data.entries()].map(_maskEntry)
  }
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return Object.fromEntries(Object.entries(data).map(_maskEntry))
  }
  return data
}

const _maskEntry = ([key, value]: [string, unknown]) => [
  key,
  SECRET_FIELDS.has(key) ? '***' : value,
]
