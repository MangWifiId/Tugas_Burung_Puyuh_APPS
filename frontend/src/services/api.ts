import axios from 'axios'
import type { AxiosError } from 'axios'
import type { ApiResponse, PageMeta, PaginatedResponse } from '../types'

const TOKEN_KEY = 'puyuh_token'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url || ''
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('puyuh_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export function getErrorStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status
  }
  return undefined
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; details?: unknown } | undefined
    if (data?.error) {
      return data.error
    }
    if (error.code === 'ECONNABORTED') {
      return 'Permintaan melebihi batas waktu. Silakan coba lagi.'
    }
    if (!error.response) {
      return 'Tidak dapat terhubung ke server. Pastikan backend berjalan.'
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan. Silakan coba lagi.'
}

export async function fetchData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<ApiResponse<T>>(url, { params })
  return response.data.data
}

export async function fetchPage<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ data: T[]; meta: PageMeta }> {
  const response = await api.get<PaginatedResponse<T>>(url, { params })
  return { data: response.data.data ?? [], meta: response.data.meta }
}

export { TOKEN_KEY }
