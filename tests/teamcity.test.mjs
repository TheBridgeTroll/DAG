import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, delimiter } from 'node:path'
import { spawnSync } from 'node:child_process'
const recipe = await readFile(new URL('../.teamcity/devgui.recipe.yaml', import.meta.url), 'utf8')
const match = recipe.match(/^    script: \|-\r?\n([\s\S]*)$/m)
assert(match, 'Missing TeamCity script block')
const script = match[1].split('\n').map(line => line.startsWith('      ') ? line.slice(6) : line).join('\n')
const skip = process.platform === 'win32' ? 'Shell-agent tests run inside the Linux development image.' : false
async function run(t, failure = '') {
  const directory = await mkdtemp(join(tmpdir(), 'dag-teamcity-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const log = join(directory, 'docker.log')
  await writeFile(join(directory, 'docker'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$DOCKER_LOG"\ncase "$*" in\n  *"config --quiet") [ "$FAIL_STEP" != config ] || exit 11;;\n  *"compose"*"build") [ "$FAIL_STEP" != build ] || exit 23;;\n  *"up -d"*) [ "$FAIL_STEP" != up ] || exit 31;;\n  "image prune"*) [ "$FAIL_STEP" != prune ] || exit 41;;\nesac\nexit 0\n`, { mode: 0o755 })
  const result = spawnSync('sh', ['-c', script], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH}`, DOCKER_LOG: log, FAIL_STEP: failure }
  })
  assert.ifError(result.error)
  return { status: result.status, lines: (await readFile(log, 'utf8')).trim().split('\n') }
}
const prune = 'image prune -f --filter label=pl.dag.component=devgui'
test('TeamCity builds, starts and prunes only labelled dangling images', { skip }, async t => {
  const result = await run(t)
  assert.equal(result.status, 0)
  assert.deepEqual(result.lines, [
    'compose -p dag-devgui -f compose.yaml config --quiet',
    'compose -p dag-devgui -f compose.yaml build',
    'compose -p dag-devgui -f compose.yaml up -d --wait --wait-timeout 120 --remove-orphans',
    'compose -p dag-devgui -f compose.yaml ps', prune
  ])
})
for (const [step, code] of [['config', 11], ['build', 23], ['up', 31]]) {
  test(`TeamCity preserves ${step} failure and still prunes`, { skip }, async t => {
    const result = await run(t, step)
    assert.equal(result.status, code)
    assert.equal(result.lines.at(-1), prune)
    assert(!result.lines.some(line => line.endsWith(' ps')))
  })
}
test('TeamCity does not turn a successful deployment into a prune failure', { skip }, async t => {
  const result = await run(t, 'prune')
  assert.equal(result.status, 0); assert.equal(result.lines.at(-1), prune)
})
