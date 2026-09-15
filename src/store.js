import { computed, reactive } from 'vue'
import { createState, uid, clone, makeNode, makeEdge, connectionError, topologicalOrder, pruneEdges, syncFiles, scanLineage, workflowSource, effectiveEnv, duplicateWorkflow, parseTasks } from './model.js'
export const s = reactive(createState())
export const project = computed(() => s.projects.find(p => p.id === s.projectId))
export const workflow = computed(() => project.value.workflows.find(w => w.id === s.workflowId))
export const node = computed(() => workflow.value?.nodes.find(n => n.id === s.nodeId))
export const role = computed(() => project.value.members.find(m => m.userId === s.userId)?.role || 'Viewer')
export const canEdit = computed(() => ['Owner', 'Admin', 'Editor'].includes(role.value))
export const canManage = computed(() => ['Owner', 'Admin'].includes(role.value))
export const editable = computed(() => canEdit.value && workflow.value?.status !== 'Running')
let toastTimer
export function notify(text) { s.toast = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => { s.toast = '' }, 4000) }
export function navigate(route) { s.route = route; window.location.hash = route }
export function selectWorkflow(id, open = false) {
  s.workflowId = id; s.nodeId = workflow.value?.nodes[0]?.id || null; s.edgeId = null; s.connecting = null; s.zoom = 1; s.pan = { x: 0, y: 0 }
  if (open) navigate('designer')
}
export function selectProject(id) { s.projectId = id; selectWorkflow(project.value.workflows[0]?.id); s.fileId = project.value.files[0]?.id; s.runId = null; s.resourceId = null }
const capture = w => JSON.stringify({ name: w.name, schedule: w.schedule, nodes: w.nodes, edges: w.edges, environmentId: w.environmentId })
export function snapshot(w = workflow.value) {
  if (!w) return
  w._undo ||= []; w._undo.push(capture(w)); if (w._undo.length > 40) w._undo.shift(); w._redo = []
}
export function changed() { syncFiles(project.value); scanLineage(project.value) }
export function undo(redo = false) {
  if (!editable.value || !workflow.value) return
  const w = workflow.value, from = redo ? '_redo' : '_undo', to = redo ? '_undo' : '_redo', raw = w[from]?.pop()
  if (!raw) return
  w[to] ||= []; w[to].push(capture(w)); Object.assign(w, JSON.parse(raw)); s.nodeId = w.nodes[0]?.id; s.edgeId = null; s.connecting = null; changed()
}
export function addNode(type) {
  if (!editable.value || !workflow.value) return
  const w = workflow.value; snapshot()
  const n = makeNode(type, undefined, 100 + (w.nodes.length % 3) * 260, 100 + Math.floor(w.nodes.length / 3) * 200)
  const base = n.name; let suffix = 2
  while (w.nodes.some(old => old.name === n.name)) n.name = `${base}_${suffix++}`
  n.code = n.code.replace(/def\s+\w+/, `def ${n.name}`); w.nodes.push(n); s.nodeId = n.id; s.edgeId = null; changed()
}
export function saveNode(draft) {
  if (!editable.value || !node.value) return
  if (!/^[A-Za-z_]\w*$/.test(draft.name)) return notify('Nazwa taska musi być poprawną nazwą funkcji Python.')
  if (workflow.value.nodes.some(n => n.id !== draft.id && n.name === draft.name)) return notify('Taka nazwa taska już istnieje.')
  if (!Number.isInteger(draft.retries) || draft.retries < 0 || draft.retries > 10 || !Number.isFinite(draft.timeout) || draft.timeout < 1) return notify('Ponowienia: 0–10. Limit czasu: przynajmniej 1 sekunda.')
  for (const ports of [draft.inputs, draft.outputs]) {
    if (ports.some(p => !p.name.trim()) || new Set(ports.map(p => p.name.trim())).size !== ports.length) return notify('Porty jednego kierunku muszą mieć różne, niepuste nazwy.')
  }
  snapshot(); const w = workflow.value, index = w.nodes.findIndex(n => n.id === draft.id), old = w.nodes[index]
  const copy = clone(draft); copy.x = old.x; copy.y = old.y
  if (copy.name !== old.name) copy.code = copy.code.replace(new RegExp(`(def\\s+)${old.name}(?=\\s*\\()`), `$1${copy.name}`)
  w.nodes[index] = copy
  const count = w.edges.length; pruneEdges(w); s.connecting = null; changed()
  notify(`Zapisano w RAM.${count !== w.edges.length ? ` Usunięto ${count - w.edges.length} niezgodnych połączeń.` : ''}`)
}
export function removeSelected() {
  if (!editable.value || !workflow.value || (!s.nodeId && !s.edgeId)) return
  snapshot(); const w = workflow.value
  if (s.edgeId) w.edges = w.edges.filter(e => e.id !== s.edgeId)
  else { w.nodes = w.nodes.filter(n => n.id !== s.nodeId); pruneEdges(w) }
  s.edgeId = null; s.nodeId = null; s.connecting = null; changed()
}
export function connect(target, port) {
  if (!editable.value || !s.connecting) return
  const w = workflow.value, from = w.nodes.find(n => n.id === s.connecting.nodeId), to = w.nodes.find(n => n.id === target)
  if (!from || !to) { s.connecting = null; return }
  const edge = makeEdge(from, to, s.connecting.portId, port), error = connectionError(w, edge)
  s.connecting = null
  if (error) return notify(error)
  snapshot(); w.edges.push(edge); s.edgeId = edge.id; s.nodeId = null; notify('Połączono porty.')
}
export function newWorkflow() {
  if (!canEdit.value) return
  const id = uid('wf'); let name = `workflow_${project.value.workflows.length + 1}`
  while (project.value.workflows.some(w => w.name === name)) name += '_new'
  project.value.workflows.push({ id, name, schedule: '@daily', environmentId: null, status: 'Idle', nodes: [], edges: [] }); changed(); selectWorkflow(id, true)
}
export function duplicate(id) {
  if (!canEdit.value) return
  const source = project.value.workflows.find(w => w.id === id); if (!source) return
  const copy = duplicateWorkflow(project.value, source); project.value.workflows.push(copy); changed(); notify('Utworzono kopię workflow.')
}
export function removeWorkflow(id) {
  if (!canEdit.value) return
  const p = project.value, w = p.workflows.find(w => w.id === id)
  if (!w || w.status === 'Running') return
  if (!window.confirm(`Usunąć workflow ${w.name} z pamięci?`)) return
  p.workflows = p.workflows.filter(w => w.id !== id); p.environments = p.environments.filter(e => e.workflowId !== id)
  if (s.workflowId === id) selectWorkflow(p.workflows[0]?.id)
  changed()
}
export async function runWorkflow() {
  const p = project.value, w = workflow.value
  if (!canEdit.value || !w || w.status === 'Running') return
  if (!w.nodes.length) return notify('Dodaj przynajmniej jeden task.')
  let order
  try { order = topologicalOrder(w) } catch (error) { return notify(error.message) }
  const env = effectiveEnv(p, w); if (!env || env.status !== 'ready') return notify('Wybrane środowisko nie jest gotowe w symulacji.')
  const run = reactive({ id: uid('run'), workflowId: w.id, name: w.name, status: 'Running', started: new Date().toLocaleString('pl-PL'), duration: '', environment: env.name, logs: ['SYMULACJA. Python nie jest wykonywany.', `venv: ${env.name}`] })
  p.runs.unshift(run); s.runId = run.id; w.status = 'Running'; w.nodes.forEach(n => { n.status = 'Queued' })
  const start = performance.now()
  const pause = () => new Promise(resolve => setTimeout(resolve, 250))
  try {
    for (const id of order) {
      const n = w.nodes.find(n => n.id === id); n.status = 'Running'; run.logs.push(`${n.name}: Running`)
      for (let attempt = 0; attempt <= n.retries; attempt++) {
        await pause()
        if (!n.fail) break
        if (attempt < n.retries) run.logs.push(`${n.name}: ponowienie ${attempt + 1}/${n.retries}`)
      }
      if (n.fail) { n.status = 'Failed'; throw new Error(`${n.name}: symulowany błąd`) }
      n.status = 'Success'; run.logs.push(`${n.name}: Success`)
    }
    w.status = run.status = 'Success'
  } catch (error) { w.status = run.status = 'Failed'; run.logs.push(error.message); w.nodes.filter(n => n.status === 'Queued').forEach(n => { n.status = 'Skipped' }) }
  finally { run.duration = `${((performance.now() - start) / 1000).toFixed(2)} s`; run.logs.push(`Koniec symulacji: ${run.status}`) }
}
export function saveFile(file, text = file.text) {
  if (!canEdit.value || !file || file.external !== null) return notify('Najpierw rozstrzygnij konflikt pliku.')
  const w = project.value.workflows.find(w => w.id === file.workflowId)
  if (w?.status === 'Running') return notify('Poczekaj na koniec symulacji tego workflow.')
  try {
    if (w) { const nodes = parseTasks(text, w); snapshot(w); w.nodes = nodes; pruneEdges(w); file.saved = workflowSource(w); scanLineage(project.value) }
    else {
      const config = JSON.parse(text)
      if (typeof config.name !== 'string' || !config.name.trim() || !['Public', 'Private'].includes(config.visibility)) throw new Error('JSON wymaga name oraz visibility: Public albo Private.')
      project.value.name = config.name.trim(); project.value.visibility = config.visibility; file.saved = text
    }
    file.text = text; file.dirty = false; file.external = null; notify('Zapisano w RAM.')
  } catch (error) { notify(error.message) }
}
export function externalChange(file) {
  if (!canEdit.value || !file) return
  const text = `${file.saved}\n${file.workflowId ? '# external edit' : ' '}`
  if (file.dirty) file.external = text
  else saveFile(file, text)
}
export function resolveFile(file, external) {
  const text = external ? file.external : file.text
  if (!canEdit.value || text === null) return
  file.external = null; file.text = text; file.dirty = true; saveFile(file)
}
export function addEnvironment(own = false) {
  if (!canEdit.value || (own && (!workflow.value || !editable.value))) return
  const p = project.value, w = workflow.value, base = effectiveEnv(p, w), id = uid('env')
  const env = { id, scope: own ? 'workflow' : 'project', workflowId: own ? w.id : null, name: own ? `${w.name}-venv-${id}` : `venv-${id}`, path: `.venv-${id}`, python: base?.python || '3.12', manager: 'uv', status: 'ready' }
  p.environments.push(env); if (own) { snapshot(); w.environmentId = id }
}
export function syncEnvironment(env) {
  if (!canEdit.value || env.status === 'syncing') return
  env.status = 'syncing'; setTimeout(() => { env.status = 'ready'; notify('Symulacja synchronizacji zakończona. Nie utworzono prawdziwego venva.') }, 650)
}
