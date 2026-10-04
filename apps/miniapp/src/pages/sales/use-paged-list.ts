import { useCallback, useEffect, useRef, useState } from 'react'

export const SALES_PAGE_SIZE = 20

type Page<T> = { items: T[]; page: number; pageSize: number; total: number }
type ListState<T> = { items: T[]; page: number; total: number; loading: boolean; failedPage: number | null }
const emptyState = <T>(): ListState<T> => ({ items: [], page: 0, total: 0, loading: false, failedPage: null })

export function usePagedList<T extends { id: string }, Query>(
  enabled: boolean,
  query: Query,
  fetchPage: (query: Query, page: number) => Promise<Page<T>>
) {
  const [state, setState] = useState<ListState<T>>(emptyState)
  const requestVersion = useRef(0)
  const inFlight = useRef(false)
  const current = useRef({ enabled, query })
  current.current = { enabled, query }

  const loadPage = useCallback(async (page: number, replace: boolean) => {
    if (!enabled || (!replace && inFlight.current)) return
    const version = ++requestVersion.current
    const isCurrent = () => version === requestVersion.current && current.current.enabled && current.current.query === query
    inFlight.current = true
    setState((previous) => ({ ...(replace ? emptyState<T>() : previous), loading: true, failedPage: null }))
    try {
      const response = await fetchPage(query, page)
      if (!isCurrent()) return
      setState((previous) => ({
        items: Array.from(new Map((replace ? response.items : [...previous.items, ...response.items]).map((item) => [item.id, item])).values()),
        page,
        total: response.total,
        loading: false,
        failedPage: null
      }))
    } catch {
      if (isCurrent()) setState((previous) => ({ ...previous, loading: false, failedPage: page }))
    } finally {
      if (isCurrent()) inFlight.current = false
    }
  }, [enabled, fetchPage, query])

  useEffect(() => {
    if (enabled) void loadPage(1, true)
    else setState(emptyState<T>())
    return () => {
      requestVersion.current += 1
      inFlight.current = false
    }
  }, [enabled, loadPage])

  const hasMore = state.page > 0 && state.page * SALES_PAGE_SIZE < state.total
  return {
    ...state,
    hasMore,
    reload: () => { void loadPage(1, true) },
    loadMore: () => { if (hasMore) void loadPage(state.page + 1, false) },
    retry: () => { if (state.failedPage) void loadPage(state.failedPage, state.failedPage === 1) }
  }
}
