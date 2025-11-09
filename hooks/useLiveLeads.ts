'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { LeadRecord } from '@/app/admin/leads/types'
import { getSupabaseBrowserClient } from '@/lib/supabase'

async function fetchLeadsFromApi(limit: number): Promise<LeadRecord[]> {
  const url = `/api/leads?limit=${limit}`
  const response = await fetch(url, { cache: 'no-store' })
  const payload = (await response.json().catch(() => ({}))) as {
    leads?: LeadRecord[]
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Failed to load leads from the API.')
  }

  return payload.leads ?? []
}

interface UseLiveLeadsOptions {
  limit?: number
}

export function useLiveLeads(initialLeads: LeadRecord[], options: UseLiveLeadsOptions = {}) {
  const limit = options.limit ?? 500
  const [leads, setLeads] = useState<LeadRecord[]>(initialLeads)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isMountedRef = useRef(true)
  const limitRef = useRef(limit)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    limitRef.current = limit
  }, [limit])

  useEffect(() => {
    setLeads(initialLeads)
  }, [initialLeads])

  useEffect(() => {
    return () => {
      isMountedRef.current = false

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
        refreshTimeoutRef.current = null
      }
    }
  }, [])

  const runFetch = useCallback(async () => {
    if (isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true
    setIsRefreshing(true)

    try {
      const latestLeads = await fetchLeadsFromApi(limitRef.current)

      if (isMountedRef.current) {
        setLeads(latestLeads)
        setError(null)
      }
    } catch (error) {
      if (isMountedRef.current) {
        const message = error instanceof Error ? error.message : 'Unable to refresh leads.'
        setError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false)
      }

      isFetchingRef.current = false
    }
  }, [])

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      return
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null
      void runFetch()
    }, 150)
  }, [runFetch])

  useEffect(() => {
    void runFetch()
  }, [runFetch])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel('admin-leads-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        scheduleRefresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [scheduleRefresh])

  return {
    leads,
    error,
    isRefreshing,
    refresh: runFetch,
  }
}
