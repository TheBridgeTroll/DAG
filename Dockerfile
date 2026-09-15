# syntax=docker/dockerfile:1
FROM node:24-alpine
LABEL pl.dag.component="devgui"
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY . .

# Build verification is defined here, not in Compose or a scripts directory.
COPY <<'CHECK_BUILD' /usr/local/lib/devgui/check-build.mjs
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
const root = resolve('dist'), html = await readFile(resolve(root, 'index.html'), 'utf8')
assert.match(html, /<div\s+id="app"/)
assert.doesNotMatch(html, /(?:src|href)=["'](?:(?:\.\/|\/)?src\/|https?:\/\/|\/\/)/)
const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(match => match[1])
assert(assets.some(path => path.endsWith('.js')), 'Brak skryptu JS w dist/index.html')
assert(assets.some(path => path.endsWith('.css')), 'Brak CSS w dist/index.html')
for (const asset of assets) {
  const path = resolve(root, asset.replace(/^\//, ''))
  assert(path.startsWith(root + sep), `Ścieżka poza dist: ${asset}`)
  const info = await stat(path)
  assert(info.isFile() && info.size > 0, `Brak zawartości pliku: ${asset}`)
}
console.log(`Build OK: index.html i ${assets.length} pliki JS/CSS istnieją.`)
CHECK_BUILD

# HTTP and module checks do not replace a browser test.
COPY <<'CHECK_HTTP' /usr/local/lib/devgui/healthcheck.mjs
const origin = process.env.CHECK_URL || 'http://127.0.0.1:5173'
const signal = AbortSignal.timeout(4000)
try {
  const page = await fetch(origin, { signal })
  if (!page.ok || !(await page.text()).includes('id="app"')) throw new Error('Brak strony Vue')
  const entry = await fetch(`${origin}/src/main.js`, { signal })
  if (!entry.ok || !(await entry.text()).includes('createApp')) throw new Error('Nie działa transformacja modułu Vue')
  const component = await fetch(`${origin}/src/App.vue`, { signal })
  if (!component.ok || !(await component.text()).trim()) throw new Error('Nie działa kompilacja App.vue')
} catch (error) { console.error(error.message); process.exit(1) }
CHECK_HTTP

RUN npm test && npm run build && node /usr/local/lib/devgui/check-build.mjs && chown -R node:node /app
USER node
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD ["node", "/usr/local/lib/devgui/healthcheck.mjs"]
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
