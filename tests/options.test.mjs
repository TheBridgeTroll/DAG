import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import studioOptions from '../src/store.js'
import * as model from '../src/model.js'

// Pure method tests, not an emulation of Vue reactivity or rendering.
function instance(options, injection = {}) {
  const context = { ...injection }
  const chain = options.extends ? [options.extends, options] : [options]
  for (const item of chain) {
    for (const [key, method] of Object.entries(item.methods || {})) context[key] = method.bind(context)
    Object.assign(context, item.data?.call(context))
    for (const [key, getter] of Object.entries(item.computed || {})) Object.defineProperty(context, key, { configurable: true, get: getter.bind(context) })
  }
  return context
}
function studio(t) {
  const context = instance(studioOptions)
  context.notify = message => { context.s.toast = message }
  t.after(() => studioOptions.beforeUnmount.call(context))
  return context
}
async function component(path) {
  const fullPath = new URL(`../src/${path}`, import.meta.url)
  const text = await readFile(fullPath, 'utf8')
  const script = text.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
  assert(script, `${path}: missing plain script`)
  const executable = script.replace(/^import\s+(.+?)\s+from\s+['"](.+?)['"]\s*$/gm, (_, binding, specifier) => {
    if (specifier.endsWith('.vue')) return `const ${binding} = {}`
    return `import ${binding} from ${JSON.stringify(new URL(specifier, fullPath).href)}`
  })
  return (await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`)).default
}
async function sources(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sources(path))
    else files.push(path)
  }
  return files
}

test('all seven components and the state owner use Options API', async () => {
  const files = await sources(fileURLToPath(new URL('../src', import.meta.url)))
  assert.equal(files.filter(path => path.endsWith('.vue')).length, 7)
  for (const file of files.filter(path => /\.(vue|js)$/.test(path))) {
    const text = await readFile(file, 'utf8')
    assert.doesNotMatch(text, /<script\s+setup|\bsetup\s*\(|\b(?:ref|reactive|computed|watch|onMounted|onUnmounted)\s*\(/, file)
    if (file.endsWith('.vue')) assert.match(text, /export default\s*\{/, file)
  }
})
test('root owns independent state and provides its own instance', async t => {
  const first = studio(t), second = studio(t), App = await component('App.vue')
  first.project.name = 'Changed in test'
  assert.equal(second.project.name, 'Retail Analytics')
  assert.equal(App.provide.call(first).studio, first)
})
test('project switch resets workflow, node, file and DAG selection', t => {
  const app = studio(t)
  app.s.edgeId = 'old'; app.s.connecting = {}; app.s.zoom = 1.5
  app.selectProject('sandbox')
  assert.equal(app.project.id, 'sandbox'); assert.equal(app.workflow.id, 'demo')
  assert.equal(app.node.id, app.workflow.nodes[0].id)
  assert.equal(app.s.fileId, app.project.files[0].id)
  assert.equal(app.s.edgeId, null); assert.equal(app.s.connecting, null); assert.equal(app.s.zoom, 1)
})
test('add, undo and redo preserve the graph and RAM files', t => {
  const app = studio(t), before = app.workflow.nodes.length
  app.addNode('python'); const id = app.node.id
  assert.equal(app.workflow.nodes.length, before + 1)
  app.undo(); assert.equal(app.workflow.nodes.length, before)
  app.undo(true); assert.equal(app.workflow.nodes.length, before + 1)
  assert(app.workflow.nodes.some(node => node.id === id))
  assert(app.project.files[0].text.includes(app.node.code))
})
test('Viewer cannot mutate graph, environments or files', t => {
  const app = studio(t); app.s.userId = 'u3'
  const before = model.clone(app.project)
  assert.equal(app.canEdit, false)
  app.addNode('python'); app.removeSelected(); app.duplicate(app.workflow.id)
  app.addEnvironment(); app.saveFile(app.project.files[0], '')
  assert.deepEqual(app.project, before)
})
test('node save updates Python name, preserves current position and handles conflicts', t => {
  const app = studio(t), draft = model.clone(app.node), file = app.project.files[0]
  file.text += '\n# local edit'; file.dirty = true
  app.node.x = 777; draft.name = 'renamed_task'
  app.saveNode(draft)
  assert.equal(app.node.name, 'renamed_task'); assert.equal(app.node.x, 777)
  assert.match(app.node.code, /def renamed_task\(/)
  assert(file.text.endsWith('# local edit')); assert(file.external.includes('renamed_task'))
})
test('stale inspector draft cannot replace a different selected node', t => {
  const app = studio(t), draft = model.clone(app.node)
  app.s.nodeId = app.workflow.nodes[0].id
  const before = model.clone(app.workflow)
  app.saveNode(draft)
  assert.deepEqual(app.workflow, before)
})
test('connections reject cycles and delete supports undo', t => {
  const app = studio(t)
  app.addNode('python'); const first = app.node
  app.addNode('python'); const second = app.node
  app.s.connecting = { nodeId: first.id, portId: first.outputs[0].id }
  app.connect(second.id, second.inputs[0].id)
  const count = app.workflow.edges.length
  app.s.connecting = { nodeId: second.id, portId: second.outputs[0].id }
  app.connect(first.id, first.inputs[0].id)
  assert.equal(app.workflow.edges.length, count); assert.match(app.s.toast, /cykl/)
  app.s.edgeId = app.workflow.edges.at(-1).id; app.removeSelected()
  assert.equal(app.workflow.edges.length, count - 1)
  app.undo(); assert.equal(app.workflow.edges.length, count)
})
test('workflow environment is copied, never borrowed privately', t => {
  const app = studio(t)
  app.addEnvironment(true); const own = app.workflow.environmentId
  assert.equal(model.effectiveEnv(app.project, app.workflow).scope, 'workflow')
  app.duplicate(app.workflow.id)
  const copy = app.project.workflows.at(-1)
  assert.notEqual(copy.environmentId, own)
  assert.equal(model.effectiveEnv(app.project, copy).workflowId, copy.id)
})
test('IDE conflict resolution keeps selected local version', t => {
  const app = studio(t), file = app.project.files[0]
  file.text += '\n# local edit'; file.dirty = true; app.externalChange(file)
  assert.notEqual(file.external, null)
  app.resolveFile(file, false)
  assert(file.text.endsWith('# local edit')); assert.equal(file.external, null)
  assert.equal(file.dirty, false)
})
test('simulation logs progress and final status using Options methods', async t => {
  const app = studio(t)
  const running = app.runWorkflow()
  assert.equal(app.workflow.status, 'Running'); assert.equal(app.project.runs[0].status, 'Running')
  await running
  assert.equal(app.workflow.status, 'Success'); assert.equal(app.project.runs[0].status, 'Success')
  assert.equal(app.project.runs[0].logs.at(-1), 'Koniec symulacji: Success')
})
test('failed simulation records retries and skips downstream tasks', async t => {
  const app = studio(t); app.workflow.nodes[0].fail = true; app.workflow.nodes[0].retries = 1
  await app.runWorkflow()
  assert.equal(app.workflow.status, 'Failed')
  assert.equal(app.workflow.nodes[1].status, 'Skipped')
  assert(app.project.runs[0].logs.some(line => line.includes('ponowienie 1/1')))
})
test('inspector watch clones the node without watching position mutations deeply', async t => {
  const app = studio(t), Inspector = await component('components/NodeInspector.vue')
  const inspector = instance(Inspector, { studio: app })
  assert.equal(Inspector.watch.node.deep, undefined)
  Inspector.watch.node.handler.call(inspector, app.node)
  inspector.draft.code = 'unsaved draft'; app.node.x += 10
  assert.notEqual(app.node.code, inspector.draft.code)
  assert.equal(inspector.draft.code, 'unsaved draft')
  Inspector.watch.node.handler.call(inspector, null); assert.equal(inspector.draft, null)
})
test('DAG dragging snapshots once and fit uses the template ref', async t => {
  const app = studio(t), Designer = await component('views/Designer.vue')
  const view = instance(Designer, { studio: app, $refs: { viewport: { getBoundingClientRect: () => ({ width: 900, height: 600 }) } } })
  const node = app.node, start = node.x
  view.startNode({ button: 0, target: { closest: () => null }, currentTarget: { setPointerCapture() {} }, pointerId: 1, clientX: 10, clientY: 20 }, node)
  view.move({ pointerId: 1, clientX: 50, clientY: 20 }); view.move({ pointerId: 1, clientX: 60, clientY: 20 })
  assert.equal(node.x, start + 50); assert.equal(app.workflow._undo.length, 1)
  view.finish(); assert.equal(view.drag, null)
  view.fit(); assert(Number.isFinite(app.s.pan.x)); assert(app.s.zoom >= 0.25)
})
test('views register and remove the same keyboard handlers', async t => {
  for (const path of ['views/Ide.vue', 'components/NodeInspector.vue', 'views/Designer.vue']) {
    const app = studio(t), options = await component(path), view = instance(options, { studio: app })
    const calls = [], previous = globalThis.window
    globalThis.window = { addEventListener: (...args) => calls.push(['add', ...args]), removeEventListener: (...args) => calls.push(['remove', ...args]) }
    try { options.mounted.call(view); options.beforeUnmount.call(view) } finally { globalThis.window = previous }
    assert.equal(calls[0][2], calls[1][2]); assert.equal(calls[0][1], 'keydown')
  }
})
test('project watcher and lineage getters use the provided root state', async t => {
  const app = studio(t), Projects = await component('views/Projects.vue'), Lineage = await component('views/Lineage.vue')
  const view = instance(Projects, { studio: app }), lineage = instance(Lineage, { studio: app })
  Projects.watch.project.handler.call(view, app.project)
  view.draft.name = 'Renamed project'; view.saveProject()
  assert.equal(app.project.name, 'Renamed project')
  assert.equal(lineage.project, app.project); assert(lineage.resources.some(resource => resource.name === 'raw.sales_orders'))
})
