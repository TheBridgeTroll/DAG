import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
const execute = promisify(execFile)
const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
function inlineScript(marker) {
  const match = dockerfile.match(new RegExp(`^COPY <<'${marker}' [^\\n]+\\n([\\s\\S]*?)^${marker}$`, 'm'))
  assert(match, `Missing Dockerfile script: ${marker}`)
  return match[1]
}
async function buildFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dag-build-check-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'dist/assets'), { recursive: true })
  await writeFile(join(root, 'dist/index.html'), '<div id="app"></div><script src="/assets/app.js"></script><link href="/assets/app.css">')
  await writeFile(join(root, 'dist/assets/app.js'), '/* build-check fixture */')
  await writeFile(join(root, 'dist/assets/app.css'), '/* build-check fixture */')
  return root
}
function checkBuild(root) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', inlineScript('CHECK_BUILD')], { cwd: root, encoding: 'utf8' })
}
test('Dockerfile owns tests, build verification, healthcheck and dev startup', async () => {
  assert.match(dockerfile, /RUN npm test && npm run build && node \/usr\/local\/lib\/devgui\/check-build\.mjs/)
  assert.match(dockerfile, /HEALTHCHECK .+\["node", "\/usr\/local\/lib\/devgui\/healthcheck\.mjs"\]/)
  assert.match(dockerfile, /CMD \["node", "node_modules\/vite\/bin\/vite\.js"/)
  assert.match(dockerfile, /^USER node$/m)
  assert.doesNotMatch(dockerfile, /docker\.sock|docker image prune|scripts\//)
  const compose = await readFile(new URL('../compose.yaml', import.meta.url), 'utf8')
  assert.doesNotMatch(compose, /^\s*(command|entrypoint|healthcheck|script|post_start|pre_stop|privileged|exec):/m)
  assert.doesNotMatch(compose, /docker\.sock|sync\+exec/)
  assert.match(compose, /action: rebuild\s+path: \./)
})
test('inline build check accepts existing JS and CSS fixture files', async t => {
  assert.equal(checkBuild(await buildFixture(t)).status, 0)
})
test('inline build check rejects missing asset', async t => {
  const root = await buildFixture(t); await rm(join(root, 'dist/assets/app.js'))
  assert.notEqual(checkBuild(root).status, 0)
})
test('inline build check rejects source entry instead of built bundle', async t => {
  const root = await buildFixture(t)
  await writeFile(join(root, 'dist/index.html'), '<div id="app"></div><script src="/src/main.js"></script><link href="/assets/app.css">')
  assert.notEqual(checkBuild(root).status, 0)
})
test('inline build check rejects an asset outside dist', async t => {
  const root = await buildFixture(t)
  await writeFile(join(root, 'dist/index.html'), '<div id="app"></div><script src="../outside.js"></script><link href="/assets/app.css">')
  assert.notEqual(checkBuild(root).status, 0)
})
for (const [name, failPath] of [['working HTTP fixture', null], ['missing main module', '/src/main.js'], ['broken component compilation', '/src/App.vue']]) {
  test(`inline healthcheck: ${name}`, async t => {
    const server = createServer((request, response) => {
      if (request.url === failPath) { response.writeHead(500); response.end('test failure'); return }
      response.end(request.url === '/' ? '<div id="app"></div>' : request.url === '/src/main.js' ? 'createApp(App)' : 'export default {}')
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
    const action = execute(process.execPath, ['--input-type=module', '-e', inlineScript('CHECK_HTTP')], {
      env: { ...process.env, CHECK_URL: `http://127.0.0.1:${server.address().port}` }, timeout: 6000
    })
    if (failPath) await assert.rejects(action)
    else await action
  })
}
