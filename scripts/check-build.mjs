import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
const root = resolve('dist'), html = await readFile(resolve(root, 'index.html'), 'utf8')
assert.match(html, /<div\s+id="app"/)
assert.doesNotMatch(html, /(?:src|href)=["'](?:\.\/)?(?:\/src\/|https?:\/\/)/)
const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(m => m[1])
assert(assets.some(path => path.endsWith('.js')), 'Brak skryptu JS w dist/index.html')
assert(assets.some(path => path.endsWith('.css')), 'Brak CSS w dist/index.html')
for (const asset of assets) {
  const path = resolve(root, asset.replace(/^\//, ''))
  assert(path.startsWith(root + sep), `Ścieżka poza dist: ${asset}`)
  assert((await stat(path)).size > 0, `Brak zawartości: ${asset}`)
}
console.log(`Build OK: index.html i ${assets.length} pliki JS/CSS istnieją.`)
