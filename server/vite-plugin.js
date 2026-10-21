// Vite plugin: runs the API inside the dev/preview server and rewrites /admin/* to admin.html.
import { createApp } from './app.js'

export function adminApi() {
  let app
  const mount = (server) => {
    app ??= createApp()
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/api/')) return app.handler(req, res)
      if (req.url === '/admin' || req.url.startsWith('/admin/') || req.url.startsWith('/admin?')) req.url = '/admin.html'
      return next()
    })
  }
  return { name: 'dscw-admin-api', configureServer: mount, configurePreviewServer: mount }
}
