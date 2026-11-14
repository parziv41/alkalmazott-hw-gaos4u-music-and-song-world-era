import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { I18nProvider } from './components/I18n/I18nProvider'
import { PlayerProvider } from './components/Player/PlayerProvider'
import { DAY } from './hooks/useReleases'
import { DiscogsError } from './services/discogsApi'
import { safeLocalStorage } from './utils/misc'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // Retry rate limits, server hiccups and dropped connections, but never other client errors.
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        if (error instanceof DiscogsError) return error.code !== 'missing_token' && (error.status === 429 || error.status >= 500)
        return error instanceof TypeError
      },
      retryDelay: (attempt, error) =>
        error instanceof DiscogsError && error.retryAfter ? error.retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000),
    },
  },
})

// Persisting results means repeat visits show records instantly and spare Discogs' rate limit.
const storage = safeLocalStorage()
const persister = storage ? createSyncStoragePersister({ storage, key: 'gmm:query-cache' }) : undefined

// Only small, slow-to-fetch results are worth storing: Discogs records and charts. The places
// files are static and cached by the browser, and would quickly fill localStorage.
const PERSISTED = new Set(['releases', 'chart'])

export function Providers({ children }: { children: ReactNode }) {
  const content = (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <PlayerProvider>{children}</PlayerProvider>
      </I18nProvider>
    </MotionConfig>
  )
  if (!persister) return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: DAY,
        buster: 'v2',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success' && PERSISTED.has(String(query.queryKey[0])),
        },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  )
}
