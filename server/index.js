// Stand-alone API server:  node server/index.js   (or `pnpm api`)
// During `pnpm dev` the same API is mounted inside Vite instead (see server/vite-plugin.js), so one command runs everything.
import { createServer } from 'node:http'
import { config } from './config.js'
import { createApp } from './app.js'

const app = createApp()
if (!app.store.read().users.length) console.warn('No admin account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env and restart.')
createServer(app.handler).listen(config.port, '127.0.0.1', () => console.log(`API listening on http://127.0.0.1:${config.port}`))
