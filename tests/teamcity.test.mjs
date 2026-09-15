import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
// A fake Docker executable checks shell control flow, not Docker/Compose behavior.
function invoke(fail = '') {
  const dir = mkdtempSync(join(tmpdir(), 'dag-ci-')), log = join(dir, 'calls')
  try {
    writeFileSync(join(dir, 'docker'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_LOG"\nif [ -n "$FAIL_COMMAND" ] && [ "$*" = "$FAIL_COMMAND" ]; then exit 31; fi\n', { mode: 0o755 })
    const result = spawnSync('sh', [resolve('scripts/teamcity.sh')], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, DOCKER_LOG: log, FAIL_COMMAND: fail }, encoding: 'utf8' })
    return { status: result.status, calls: readFileSync(log, 'utf8').trim().split('\n') }
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
const compose = 'compose -p dag-devgui -f compose.yaml'
const prune = 'image prune -f --filter label=pl.dag.component=devgui'
test('TeamCity script builds, starts, checks and prunes only labelled images (mock CLI)', { skip: process.platform === 'win32' }, () => {
  const result = invoke()
  assert.equal(result.status, 0)
  assert.deepEqual(result.calls, [`${compose} config --quiet`, `${compose} build`, `${compose} up -d --wait --wait-timeout 120 --remove-orphans`, `${compose} exec -T gui node scripts/healthcheck.mjs`, `${compose} ps`, prune])
})
test('TeamCity script preserves build failure and still prunes (mock CLI)', { skip: process.platform === 'win32' }, () => {
  const result = invoke(`${compose} build`)
  assert.equal(result.status, 31)
  assert.deepEqual(result.calls, [`${compose} config --quiet`, `${compose} build`, prune])
})
