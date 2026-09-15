// Data and operations are browser-memory only. No Python or SQL is executed.
let sequence = 0
export const uid = prefix => `${prefix}_${++sequence}`
export const clone = value => JSON.parse(JSON.stringify(value))
export const PORT_TYPES = ['DataFrame', 'String', 'Number', 'Boolean', 'File', 'Table', 'Any']
export const TASK_TYPES = [
  { type: 'read-sql', label: 'Read SQL', group: 'Źródła', inputs: [], outputs: ['DataFrame'] },
  { type: 'read-csv', label: 'Read CSV', group: 'Źródła', inputs: [], outputs: ['DataFrame'] },
  { type: 'python', label: 'Python', group: 'Transformacje', inputs: ['DataFrame'], outputs: ['DataFrame'] },
  { type: 'filter', label: 'Filter', group: 'Transformacje', inputs: ['DataFrame'], outputs: ['DataFrame'] },
  { type: 'join', label: 'Join', group: 'Transformacje', inputs: ['DataFrame', 'DataFrame'], outputs: ['DataFrame'] },
  { type: 'write-sql', label: 'Write SQL', group: 'Wyjścia', inputs: ['DataFrame'], outputs: [] },
  { type: 'write-file', label: 'Write file', group: 'Wyjścia', inputs: ['DataFrame'], outputs: [] }
]
export function makeNode(type = 'python', name, x = 100, y = 100) {
  const def = TASK_TYPES.find(t => t.type === type) || TASK_TYPES[2]
  const safe = (name || def.label.toLowerCase()).replace(/\W+/g, '_')
  const bodies = {
    'read-sql': '    return db.read("raw.sales_orders")',
    'read-csv': '    return read_csv("customers.csv")',
    'write-sql': '    db.write("warehouse.output", df)',
    'write-file': '    write_file("exports/output.csv", df)',
    python: '    return df', filter: '    return df[df["active"]]', join: '    return left.merge(right)'
  }
  const args = def.inputs.length === 2 ? 'left, right' : def.inputs.length ? 'df' : ''
  return { id: uid('node'), type: def.type, name: safe, x, y, status: 'Idle', retries: 2, timeout: 10, fail: false,
    code: `@task\ndef ${safe}(${args}):\n${bodies[def.type]}`,
    inputs: def.inputs.map((kind, i) => ({ id: uid('in'), name: i ? `in${i + 1}` : 'df', type: kind })),
    outputs: def.outputs.map((kind, i) => ({ id: uid('out'), name: i ? `out${i + 1}` : 'out', type: kind })) }
}
export const makeEdge = (a, b, fromPort = a.outputs[0]?.id, toPort = b.inputs[0]?.id) =>
  ({ id: uid('edge'), fromNode: a.id, fromPort, toNode: b.id, toPort })
export function endpoints(w, edge) {
  const from = w.nodes.find(n => n.id === edge.fromNode), to = w.nodes.find(n => n.id === edge.toNode)
  return { from, to, output: from?.outputs.find(p => p.id === edge.fromPort), input: to?.inputs.find(p => p.id === edge.toPort) }
}
export const compatible = (a, b) => Boolean(a && b && (a.type === b.type || a.type === 'Any' || b.type === 'Any'))
export function topologicalOrder(w) {
  const incoming = new Map(w.nodes.map(n => [n.id, 0])), next = new Map(w.nodes.map(n => [n.id, []]))
  for (const e of w.edges) {
    if (!incoming.has(e.toNode) || !next.has(e.fromNode)) throw new Error('Połączenie wskazuje brakujący task.')
    incoming.set(e.toNode, incoming.get(e.toNode) + 1); next.get(e.fromNode).push(e.toNode)
  }
  const queue = w.nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id), order = []
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; order.push(id)
    for (const child of next.get(id)) { incoming.set(child, incoming.get(child) - 1); if (!incoming.get(child)) queue.push(child) }
  }
  if (order.length !== w.nodes.length) throw new Error('Połączenie tworzy cykl. DAG nie może mieć pętli.')
  return order
}
export function connectionError(w, e) {
  const { from, to, output, input } = endpoints(w, e)
  if (!from || !to || !output || !input) return 'Brak taska lub portu.'
  if (from.id === to.id) return 'Nie można połączyć taska z nim samym.'
  if (!compatible(output, input)) return `Typy portów nie pasują: ${output.type} → ${input.type}.`
  if (w.edges.some(old => old.toNode === e.toNode && old.toPort === e.toPort)) return 'Ten input ma już połączenie.'
  try { topologicalOrder({ nodes: w.nodes, edges: [...w.edges, e] }) } catch (error) { return error.message }
  return ''
}
export function pruneEdges(w) {
  w.edges = w.edges.filter(e => { const { output, input } = endpoints(w, e); return compatible(output, input) })
}
export function workflowSource(w) {
  return `# workflow ${w.name}\n# schedule ${w.schedule}\n\n${w.nodes.map(n => n.code).join('\n\n')}`
}
export function syncFiles(project) {
  project.files = project.files.filter(f => !f.workflowId || project.workflows.some(w => w.id === f.workflowId))
  for (const w of project.workflows) {
    const text = workflowSource(w), path = `workflows/${w.name}.py`
    let file = project.files.find(f => f.workflowId === w.id)
    if (!file) { file = { id: uid('file'), workflowId: w.id, path, text, saved: text, dirty: false, external: null }; project.files.push(file) }
    file.path = path
    if (file.dirty) { if (text !== file.saved) file.external = text }
    else if (text !== file.saved) { file.text = text; file.saved = text; file.external = null }
  }
}
export function parseTasks(text, w) {
  const blocks = [...text.matchAll(/^@task[^\n]*\r?\n(?:async\s+)?def\s+([A-Za-z_]\w*)[^\n]*[\s\S]*?(?=^@task|$(?![\s\S]))/gm)]
  if (!blocks.length && text.trim()) throw new Error('Edytor rozpoznaje tylko bloki @task + def. Nie zmieniono DAG-a.')
  if (new Set(blocks.map(m => m[1])).size !== blocks.length) throw new Error('Nazwy funkcji @task muszą być różne.')
  return blocks.map((m, i) => {
    const old = w.nodes.find(n => n.name === m[1])
    const node = old ? clone(old) : makeNode('python', m[1], 80 + (i % 3) * 260, 90 + Math.floor(i / 3) * 180)
    node.code = m[0].trim(); return node
  })
}
export function scanLineage(project) {
  const found = new Map()
  const patterns = [ [/db\.read\(\s*["']([^"']+)/g, 'Tabela', 'READ'], [/db\.write\(\s*["']([^"']+)/g, 'Tabela', 'WRITE'],
    [/db\.update\(\s*["']([^"']+)/g, 'Tabela', 'MODIFY'], [/read_csv\(\s*["']([^"']+)/g, 'Plik', 'READ'], [/write_file\(\s*["']([^"']+)/g, 'Plik', 'WRITE'] ]
  for (const w of project.workflows) for (const n of w.nodes) for (const [pattern, type, op] of patterns) {
    for (const m of n.code.matchAll(pattern)) {
      const id = `${type}:${m[1]}`
      if (!found.has(id)) found.set(id, { id, name: m[1], type, ops: [] })
      const resource = found.get(id)
      if (!resource.ops.some(o => o.nodeId === n.id && o.workflowId === w.id && o.op === op)) resource.ops.push({ workflowId: w.id, nodeId: n.id, op })
    }
  }
  project.resources = [...found.values()]; return project.resources
}
export function effectiveEnv(project, w) {
  const id = w?.environmentId || project.environmentId
  return project.environments.find(e => e.id === id && (e.scope === 'project' || e.workflowId === w?.id))
}
export function duplicateWorkflow(project, source) {
  const w = clone(source), nodes = new Map(), ports = new Map()
  w.id = uid('wf'); w.name = `${source.name}_copy`
  while (project.workflows.some(other => other.name === w.name)) w.name += '_copy'
  w.status = 'Idle'; delete w._undo; delete w._redo
  for (const n of w.nodes) {
    const id = uid('node'); nodes.set(n.id, id); n.id = id; n.status = 'Idle'
    for (const p of [...n.inputs, ...n.outputs]) { const id = uid('port'); ports.set(p.id, id); p.id = id }
  }
  w.edges = w.edges.map(e => ({ id: uid('edge'), fromNode: nodes.get(e.fromNode), fromPort: ports.get(e.fromPort), toNode: nodes.get(e.toNode), toPort: ports.get(e.toPort) }))
  for (const old of project.environments.filter(e => e.scope === 'workflow' && e.workflowId === source.id)) {
    const envId = uid('env')
    const copy = { ...old, id: envId, workflowId: w.id, name: `${w.name}-venv-${envId}`, path: `.venv-${w.id}-${envId}`, status: 'ready' }
    project.environments.push(copy)
    if (w.environmentId === old.id) w.environmentId = copy.id
  }
  return w
}
export function createState() {
  // Fixtures retained from the wydmuszka branch, not records of real jobs or users.
  const load = makeNode('read-sql', 'load_orders', 80, 130), clean = makeNode('python', 'clean_orders', 360, 130), save = makeNode('write-sql', 'save_daily', 640, 130)
  clean.code = '@task(retries=2)\ndef clean_orders(df):\n    return df.dropna()'
  save.code = '@task\ndef save_daily(df):\n    db.write("warehouse.sales_daily", df)'
  const customer = makeNode('read-csv', 'load_customers', 100, 150), segment = makeNode('python', 'segment', 390, 150)
  segment.code = '@task\ndef segment(df):\n    return model.predict(df)'
  const projects = [
    { id: 'retail', name: 'Retail Analytics', visibility: 'Private', description: 'Workflowy analityczne',
      members: [{ userId: 'u1', role: 'Owner' }, { userId: 'u2', role: 'Editor' }, { userId: 'u3', role: 'Viewer' }, { userId: 'u4', role: 'Admin' }],
      workflows: [ { id: 'sales', name: 'daily_sales_pipeline', schedule: '0 6 * * *', status: 'Idle', nodes: [load, clean, save], edges: [makeEdge(load, clean), makeEdge(clean, save)] },
        { id: 'segments', name: 'customer_segmentation', schedule: '0 2 * * 1', status: 'Idle', nodes: [customer, segment], edges: [makeEdge(customer, segment)] } ] },
    { id: 'sandbox', name: 'Sandbox ETL', visibility: 'Public', description: 'Projekt testowy',
      members: [{ userId: 'u1', role: 'Editor' }, { userId: 'u2', role: 'Owner' }, { userId: 'u3', role: 'Viewer' }],
      workflows: [{ id: 'demo', name: 'demo_pipeline', schedule: '@daily', status: 'Idle', nodes: [makeNode('read-csv', 'start', 120, 140), makeNode('write-file', 'finish', 430, 140)], edges: [] }] }
  ]
  for (const p of projects) {
    p.files = []; p.runs = []; p.resources = []
    p.environments = [{ id: uid('env'), name: 'project-default', python: '3.12', path: '.venv', manager: 'uv', status: 'ready', scope: 'project' },
      { id: uid('env'), name: 'etl-legacy', python: '3.11', path: '.venv-etl', manager: 'uv', status: 'ready', scope: 'project' }]
    p.environmentId = p.environments[0].id
    p.workflows.forEach(w => { w.environmentId = null })
    syncFiles(p); scanLineage(p)
    const text = JSON.stringify({ name: p.name, visibility: p.visibility }, null, 2)
    p.files.push({ id: uid('file'), path: 'config/project.json', text, saved: text, dirty: false, external: null })
  }
  return { route: 'dashboard', projectId: 'retail', workflowId: 'sales', nodeId: clean.id, edgeId: null, userId: 'u1',
    fileId: projects[0].files[0].id, runId: null, resourceId: null, connecting: null, toast: '', zoom: 1, pan: { x: 0, y: 0 },
    users: [{ id: 'u1', name: 'Michał' }, { id: 'u2', name: 'Anna' }, { id: 'u3', name: 'Robert' }, { id: 'u4', name: 'Kasia' }], projects }
}
