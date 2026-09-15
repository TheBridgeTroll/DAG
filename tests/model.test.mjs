import test from 'node:test'
import assert from 'node:assert/strict'
import { createState, makeNode, makeEdge, connectionError, compatible, topologicalOrder, endpoints, pruneEdges, scanLineage, syncFiles, workflowSource, parseTasks, duplicateWorkflow, effectiveEnv, clone } from '../src/model.js'
const fixture = () => { const s = createState(); return { s, p: s.projects[0], w: s.projects[0].workflows[0] } }
test('fixtures remain independent and no invented run history is loaded', () => {
  const { s, p } = fixture(), other = createState(); p.name = 'changed'
  assert.equal(other.projects[0].name, 'Retail Analytics'); assert(s.projects.every(p => p.runs.length === 0))
})
test('all fixture nodes, ports and edges have distinct IDs', () => {
  const ids = createState().projects.flatMap(p => p.workflows.flatMap(w => [...w.nodes.flatMap(n => [n.id, ...n.inputs.map(p => p.id), ...n.outputs.map(p => p.id)]), ...w.edges.map(e => e.id)]))
  assert.equal(ids.length, new Set(ids).size)
})
test('run order follows connections rather than array order', () => {
  const { w } = fixture(), expected = w.nodes.map(n => n.id); w.nodes.reverse(); assert.deepEqual(topologicalOrder(w), expected)
})
test('accepts compatible new connection', () => {
  const a = makeNode('read-csv'), b = makeNode('python'), w = { nodes: [a, b], edges: [] }
  assert.equal(connectionError(w, makeEdge(a, b)), '')
})
test('rejects mismatched ports', () => {
  const a = makeNode('read-csv'), b = makeNode('python'); b.inputs[0].type = 'Number'
  assert.match(connectionError({ nodes: [a, b], edges: [] }, makeEdge(a, b)), /Typy/)
})
test('Any is compatible and missing ports are not', () => {
  assert(compatible({ type: 'Any' }, { type: 'String' })); assert(!compatible(undefined, { type: 'Any' }))
})
test('rejects occupied input and duplicate edge', () => {
  const { w } = fixture(); assert.match(connectionError(w, clone(w.edges[0])), /już połączenie/)
})
test('rejects self connection', () => {
  const n = makeNode(); assert.match(connectionError({ nodes: [n], edges: [] }, makeEdge(n, n)), /samym/)
})
test('rejects directed cycle before adding edge', () => {
  const a = makeNode(), b = makeNode(), c = makeNode(), w = { nodes: [a, b, c], edges: [makeEdge(a, b), makeEdge(b, c)] }
  assert.match(connectionError(w, makeEdge(c, a)), /cykl/)
  assert.throws(() => topologicalOrder({ ...w, edges: [...w.edges, makeEdge(c, a)] }), /cykl/)
})
test('rejects nonexistent node and nonexistent port', () => {
  const { w } = fixture(); assert.match(connectionError(w, { ...w.edges[0], toPort: 'absent' }), /Brak/)
  assert.throws(() => topologicalOrder({ nodes: [], edges: w.edges }), /brakujący/)
})
test('prunes edges attached to deleted node or incompatible changed port', () => {
  const { w } = fixture(); w.nodes[1].inputs[0].type = 'Number'; pruneEdges(w); assert.equal(w.edges.length, 1)
  w.nodes.pop(); pruneEdges(w); assert.equal(w.edges.length, 0)
})
test('lineage reuses stable resource IDs and does not duplicate operations', () => {
  const { p, w } = fixture(), initial = scanLineage(p).map(r => r.id); w.nodes[0].code += '\n    db.read("raw.sales_orders")'
  assert.deepEqual(scanLineage(p).map(r => r.id), initial)
  assert.equal(p.resources.find(r => r.name === 'raw.sales_orders').ops.length, 1)
  assert(p.resources.some(r => r.name === 'warehouse.sales_daily' && r.ops[0].op === 'WRITE'))
})
test('lineage distinguishes same-name file from table', () => {
  const { p, w } = fixture(); w.nodes[0].code = 'db.read("same")\nread_csv("same")'
  assert.equal(scanLineage(p).filter(r => r.name === 'same').length, 2)
})
test('code edit updates clean RAM file', () => {
  const { p, w } = fixture(); w.nodes[0].code += '\n# edit'; syncFiles(p)
  assert.equal(p.files.find(f => f.workflowId === w.id).text, workflowSource(w))
})
test('DAG change does not overwrite dirty IDE buffer and records external conflict', () => {
  const { p, w } = fixture(), f = p.files.find(f => f.workflowId === w.id); f.text = 'local draft'; f.dirty = true
  w.nodes[0].code += '\n# DAG edit'; syncFiles(p)
  assert.equal(f.text, 'local draft'); assert.equal(f.external, workflowSource(w)); assert(f.dirty)
})
test('file sync removes deleted workflow file and preserves config file', () => {
  const { p, w } = fixture(); p.workflows = p.workflows.filter(other => other.id !== w.id); syncFiles(p)
  assert(!p.files.some(f => f.workflowId === w.id)); assert(p.files.some(f => f.path === 'config/project.json'))
})
test('parser keeps node and port IDs when editing existing functions', () => {
  const { w } = fixture(), nodes = parseTasks(workflowSource(w), w)
  assert.deepEqual(nodes.map(n => n.id), w.nodes.map(n => n.id)); assert.deepEqual(nodes[1].inputs, w.nodes[1].inputs)
  assert(nodes[2].code.includes('warehouse.sales_daily'))
})
test('parser rejects unsupported source and duplicate task names without mutating graph', () => {
  const { w } = fixture(), before = clone(w)
  assert.throws(() => parseTasks('print("not a task")', w), /@task/)
  assert.throws(() => parseTasks('@task\ndef same():\n    pass\n\n@task\ndef same():\n    pass', w), /różne/)
  assert.deepEqual(w, before)
})
test('parser accepts CRLF and explicitly empty source', () => {
  const { w } = fixture(); assert.equal(parseTasks(workflowSource(w).replaceAll('\n', '\r\n'), w).length, 3)
  assert.deepEqual(parseTasks('', w), [])
})
test('duplicate remaps nodes, ports and edges without changing source', () => {
  const { p, w } = fixture(), before = clone(w), copy = duplicateWorkflow(p, w)
  assert.notEqual(copy.id, w.id); assert.notEqual(copy.nodes[0].id, w.nodes[0].id); assert.equal(copy.edges.length, w.edges.length)
  assert(copy.edges.every(e => { const { output, input } = endpoints(copy, e); return compatible(output, input) }))
  assert.deepEqual(w, before); assert.equal(copy.status, 'Idle')
})
test('private workflow environment is copied instead of borrowed', () => {
  const { p, w } = fixture(); const env = { ...p.environments[0], id: 'own', scope: 'workflow', workflowId: w.id }; p.environments.push(env); w.environmentId = 'own'
  const copy = duplicateWorkflow(p, w); assert.notEqual(copy.environmentId, 'own'); assert.equal(effectiveEnv(p, copy).workflowId, copy.id)
})
test('another workflow cannot use a private environment', () => {
  const { p, w } = fixture(); p.environments.push({ id: 'private', scope: 'workflow', workflowId: 'somebody-else' }); w.environmentId = 'private'
  assert.equal(effectiveEnv(p, w), undefined); w.environmentId = null; assert.equal(effectiveEnv(p, w).id, p.environmentId)
})
