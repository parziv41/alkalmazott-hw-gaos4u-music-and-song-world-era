/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { GET as artists } from './api/artists.ts'
import { GET as charts } from './api/charts.ts'
import { GET as discography } from './api/discography.ts'
import { GET as discogsSearch } from './api/discogs/search.ts'
import { GET as preview } from './api/preview.ts'
import { GET as search } from './api/search.ts'

type Handler = (request: Request) => Promise<Response>

// Serves the api/ functions locally with the exact handlers Vercel runs in production,
// so the Discogs token stays server-side in every environment.
function apiRoutes(token: string | undefined): Plugin {
  const routes: Record<string, Handler> = {
    '/api/discogs/search': discogsSearch,
    '/api/charts': charts,
    '/api/preview': preview,
    '/api/artists': artists,
    '/api/discography': discography,
    '/api/search': search,
  }
  const mount = (middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => void }) => {
    for (const [path, handler] of Object.entries(routes)) {
      middlewares.use(path, (req, res) => void handle(handler, req, res))
    }
  }
  const handle = async (handler: Handler, req: IncomingMessage, res: ServerResponse) => {
    if (token) process.env.DISCOGS_TOKEN = token
    try {
      const url = new URL((req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/', 'http://localhost')
      const response = await handler(new Request(url))
      res.statusCode = response.status
      response.headers.forEach((value, key) => res.setHeader(key, value))
      res.end(await response.text())
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'proxy_error', message: String(error) }))
    }
  }
  return {
    name: 'api-routes',
    configureServer(server) {
      mount(server.middlewares)
    },
    configurePreviewServer(server) {
      mount(server.middlewares)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), apiRoutes(env.DISCOGS_TOKEN)],
    build: {
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks: app updates don't invalidate the cached libraries and map data.
          // No catch-all group, so the lazy command palette's dependencies stay out of the initial load.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
              { name: 'map', test: /node_modules[\\/](d3-[\w-]+|topojson-client|world-atlas)[\\/]/ },
              { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
            ],
          },
        },
      },
    },
    test: {
      include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'scripts/**/*.test.ts'],
      environment: 'node',
    },
  }
})
