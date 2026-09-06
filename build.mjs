import { rm, mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const dist = join(root, 'dist')
const assets = join(dist, 'assets')
await rm(dist, { recursive: true, force: true })
await mkdir(assets, { recursive: true })
const sourceFiles = (await readdir(join(root, 'src'))).filter(name => name.endsWith('.js') || name.endsWith('.css'))
for (const name of sourceFiles) await copyFile(join(root, 'src', name), join(assets, name))
let html = await readFile(join(root, 'src', 'index.html'), 'utf8')
html = html.replaceAll('__ASSET_BASE__', './assets/')
await writeFile(join(dist, 'index.html'), html)
const files = await readdir(assets)
if (!files.includes('main.js') || !files.includes('views.js') || !files.includes('state.js') || !files.includes('style.css')) throw new Error('build incomplete')
console.log(`Built ${1 + files.length} files into dist/`)
