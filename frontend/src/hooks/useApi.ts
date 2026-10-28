import { useCallback, useEffect, useState } from 'react'
import { fetchData, fetchPage, getErrorMessage } from '../services/api'
import type { PageMeta } from '../types'

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
  setData: (value: T) => void
}

export function useApi<T>(
  url: string | null,
  params?: Record<string, unknown>,
): QueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const paramsKey = params ? JSON.stringify(params) : ''

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchData<T>(url, params)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // params dikunci lewat paramsKey agar objek baru tidak memicu request berulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { data, loading, error, reload, setData }
}

interface PageState<T> {
  data: T[]
  meta: PageMeta | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePage<T>(
  url: string | null,
  params?: Record<string, unknown>,
): PageState<T> {
  const [data, setData] = useState<T[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const paramsKey = params ? JSON.stringify(params) : ''

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchPage<T>(url, params)
      .then((result) => {
        if (active) {
          setData(result.data)
          setMeta(result.meta)
        }
      })
      .catch((err: unknown) => {
        if (active) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { data, meta, loading, error, reload }
}
