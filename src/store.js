import {
  createState, uid, clone, makeNode, makeEdge, connectionError, topologicalOrder,
  pruneEdges, syncFiles, scanLineage, workflowSource, effectiveEnv,
  duplicateWorkflow, parseTasks
} from './model.js'

const capture = workflow => JSON.stringify({
  name: workflow.name, schedule: workflow.schedule, nodes: workflow.nodes,
  edges: workflow.edges, environmentId: workflow.environmentId
})

// App owns this state. Descendants inject that same instance.
export default {
  data() {
    return { s: createState(), toastTimer: null, environmentTimers: [] }
  },
  computed: {
    project() { return this.s.projects.find(project => project.id === this.s.projectId) },
    workflow() { return this.project.workflows.find(workflow => workflow.id === this.s.workflowId) },
    node() { return this.workflow?.nodes.find(node => node.id === this.s.nodeId) },
    role() { return this.project.members.find(member => member.userId === this.s.userId)?.role || 'Viewer' },
    canEdit() { return ['Owner', 'Admin', 'Editor'].includes(this.role) },
    canManage() { return ['Owner', 'Admin'].includes(this.role) },
    editable() { return this.canEdit && this.workflow?.status !== 'Running' }
  },
  beforeUnmount() {
    clearTimeout(this.toastTimer)
    this.environmentTimers.forEach(clearTimeout)
  },
  methods: {
    notify(text) {
      this.s.toast = text
      clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.s.toast = '' }, 4000)
    },
    navigate(route) {
      this.s.route = route
      window.location.hash = route
    },
    selectWorkflow(id, open = false) {
      this.s.workflowId = id
      this.s.nodeId = this.workflow?.nodes[0]?.id || null
      this.s.edgeId = null
      this.s.connecting = null
      this.s.zoom = 1
      this.s.pan = { x: 0, y: 0 }
      if (open) this.navigate('designer')
    },
    selectProject(id) {
      this.s.projectId = id
      this.selectWorkflow(this.project.workflows[0]?.id)
      this.s.fileId = this.project.files[0]?.id
      this.s.runId = null
      this.s.resourceId = null
    },
    snapshot(workflow = this.workflow) {
      if (!workflow) return
      workflow._undo ||= []
      workflow._undo.push(capture(workflow))
      if (workflow._undo.length > 40) workflow._undo.shift()
      workflow._redo = []
    },
    changed() {
      syncFiles(this.project)
      scanLineage(this.project)
    },
    undo(redo = false) {
      if (!this.editable || !this.workflow) return
      const workflow = this.workflow
      const from = redo ? '_redo' : '_undo', to = redo ? '_undo' : '_redo'
      const raw = workflow[from]?.pop()
      if (!raw) return
      workflow[to] ||= []
      workflow[to].push(capture(workflow))
      Object.assign(workflow, JSON.parse(raw))
      this.s.nodeId = workflow.nodes[0]?.id
      this.s.edgeId = null
      this.s.connecting = null
      this.changed()
    },
    addNode(type) {
      if (!this.editable || !this.workflow) return
      const workflow = this.workflow
      this.snapshot()
      const node = makeNode(type, undefined, 100 + (workflow.nodes.length % 3) * 260, 100 + Math.floor(workflow.nodes.length / 3) * 200)
      const base = node.name
      let suffix = 2
      while (workflow.nodes.some(old => old.name === node.name)) node.name = `${base}_${suffix++}`
      node.code = node.code.replace(/def\s+\w+/, `def ${node.name}`)
      workflow.nodes.push(node)
      this.s.nodeId = node.id
      this.s.edgeId = null
      this.changed()
    },
    saveNode(draft) {
      if (!this.editable || !this.node || draft.id !== this.node.id) return
      if (!/^[A-Za-z_]\w*$/.test(draft.name)) return this.notify('Nazwa taska musi być poprawną nazwą funkcji Python.')
      if (this.workflow.nodes.some(node => node.id !== draft.id && node.name === draft.name)) return this.notify('Taka nazwa taska już istnieje.')
      if (!Number.isInteger(draft.retries) || draft.retries < 0 || draft.retries > 10 || !Number.isFinite(draft.timeout) || draft.timeout < 1) return this.notify('Ponowienia: 0–10. Limit czasu: przynajmniej 1 sekunda.')
      for (const ports of [draft.inputs, draft.outputs]) {
        if (ports.some(port => !port.name.trim()) || new Set(ports.map(port => port.name.trim())).size !== ports.length) return this.notify('Porty jednego kierunku muszą mieć różne, niepuste nazwy.')
      }
      this.snapshot()
      const workflow = this.workflow, index = workflow.nodes.findIndex(node => node.id === draft.id), old = workflow.nodes[index]
      const copy = clone(draft)
      copy.x = old.x
      copy.y = old.y
      if (copy.name !== old.name) copy.code = copy.code.replace(new RegExp(`(def\\s+)${old.name}(?=\\s*\\()`), `$1${copy.name}`)
      workflow.nodes[index] = copy
      const count = workflow.edges.length
      pruneEdges(workflow)
      this.s.connecting = null
      this.changed()
      this.notify(`Zapisano w RAM.${count !== workflow.edges.length ? ` Usunięto ${count - workflow.edges.length} niezgodnych połączeń.` : ''}`)
    },
    removeSelected() {
      if (!this.editable || !this.workflow || (!this.s.nodeId && !this.s.edgeId)) return
      this.snapshot()
      const workflow = this.workflow
      if (this.s.edgeId) workflow.edges = workflow.edges.filter(edge => edge.id !== this.s.edgeId)
      else {
        workflow.nodes = workflow.nodes.filter(node => node.id !== this.s.nodeId)
        pruneEdges(workflow)
      }
      this.s.edgeId = null
      this.s.nodeId = null
      this.s.connecting = null
      this.changed()
    },
    connect(target, port) {
      if (!this.editable || !this.s.connecting) return
      const workflow = this.workflow
      const from = workflow.nodes.find(node => node.id === this.s.connecting.nodeId), to = workflow.nodes.find(node => node.id === target)
      if (!from || !to) { this.s.connecting = null; return }
      const edge = makeEdge(from, to, this.s.connecting.portId, port), error = connectionError(workflow, edge)
      this.s.connecting = null
      if (error) return this.notify(error)
      this.snapshot()
      workflow.edges.push(edge)
      this.s.edgeId = edge.id
      this.s.nodeId = null
      this.notify('Połączono porty.')
    },
    newWorkflow() {
      if (!this.canEdit) return
      const id = uid('wf')
      let name = `workflow_${this.project.workflows.length + 1}`
      while (this.project.workflows.some(workflow => workflow.name === name)) name += '_new'
      this.project.workflows.push({ id, name, schedule: '@daily', environmentId: null, status: 'Idle', nodes: [], edges: [] })
      this.changed()
      this.selectWorkflow(id, true)
    },
    duplicate(id) {
      if (!this.canEdit) return
      const source = this.project.workflows.find(workflow => workflow.id === id)
      if (!source) return
      this.project.workflows.push(duplicateWorkflow(this.project, source))
      this.changed()
      this.notify('Utworzono kopię workflow.')
    },
    removeWorkflow(id) {
      if (!this.canEdit) return
      const project = this.project, workflow = project.workflows.find(workflow => workflow.id === id)
      if (!workflow || workflow.status === 'Running') return
      if (!window.confirm(`Usunąć workflow ${workflow.name} z pamięci?`)) return
      project.workflows = project.workflows.filter(workflow => workflow.id !== id)
      project.environments = project.environments.filter(environment => environment.workflowId !== id)
      if (this.s.workflowId === id) this.selectWorkflow(project.workflows[0]?.id)
      this.changed()
    },
    async runWorkflow() {
      const project = this.project, workflow = this.workflow
      if (!this.canEdit || !workflow || workflow.status === 'Running') return
      if (!workflow.nodes.length) return this.notify('Dodaj przynajmniej jeden task.')
      let order
      try { order = topologicalOrder(workflow) } catch (error) { return this.notify(error.message) }
      const environment = effectiveEnv(project, workflow)
      if (!environment || environment.status !== 'ready') return this.notify('Wybrane środowisko nie jest gotowe w symulacji.')
      project.runs.unshift({ id: uid('run'), workflowId: workflow.id, name: workflow.name, status: 'Running', started: new Date().toLocaleString('pl-PL'), duration: '', environment: environment.name, logs: ['SYMULACJA. Python nie jest wykonywany.', `venv: ${environment.name}`] })
      // Read back through reactive data, not through the raw inserted object.
      const run = project.runs[0]
      this.s.runId = run.id
      workflow.status = 'Running'
      workflow.nodes.forEach(node => { node.status = 'Queued' })
      const start = performance.now(), pause = () => new Promise(resolve => setTimeout(resolve, 250))
      try {
        for (const id of order) {
          const node = workflow.nodes.find(node => node.id === id)
          node.status = 'Running'
          run.logs.push(`${node.name}: Running`)
          for (let attempt = 0; attempt <= node.retries; attempt++) {
            await pause()
            if (!node.fail) break
            if (attempt < node.retries) run.logs.push(`${node.name}: ponowienie ${attempt + 1}/${node.retries}`)
          }
          if (node.fail) { node.status = 'Failed'; throw new Error(`${node.name}: symulowany błąd`) }
          node.status = 'Success'
          run.logs.push(`${node.name}: Success`)
        }
        workflow.status = run.status = 'Success'
      } catch (error) {
        workflow.status = run.status = 'Failed'
        run.logs.push(error.message)
        workflow.nodes.filter(node => node.status === 'Queued').forEach(node => { node.status = 'Skipped' })
      } finally {
        run.duration = `${((performance.now() - start) / 1000).toFixed(2)} s`
        run.logs.push(`Koniec symulacji: ${run.status}`)
      }
    },
    saveFile(file, text = file?.text) {
      if (!this.canEdit || !file || file.external !== null) return this.notify('Najpierw rozstrzygnij konflikt pliku.')
      const workflow = this.project.workflows.find(workflow => workflow.id === file.workflowId)
      if (workflow?.status === 'Running') return this.notify('Poczekaj na koniec symulacji tego workflow.')
      try {
        if (workflow) {
          const nodes = parseTasks(text, workflow)
          this.snapshot(workflow)
          workflow.nodes = nodes
          pruneEdges(workflow)
          file.saved = workflowSource(workflow)
          scanLineage(this.project)
        } else {
          const config = JSON.parse(text)
          if (typeof config.name !== 'string' || !config.name.trim() || !['Public', 'Private'].includes(config.visibility)) throw new Error('JSON wymaga name oraz visibility: Public albo Private.')
          this.project.name = config.name.trim()
          this.project.visibility = config.visibility
          file.saved = text
        }
        file.text = text
        file.dirty = false
        file.external = null
        this.notify('Zapisano w RAM.')
      } catch (error) { this.notify(error.message) }
    },
    externalChange(file) {
      if (!this.canEdit || !file) return
      const text = `${file.saved}\n${file.workflowId ? '# external edit' : ' '}`
      if (file.dirty) file.external = text
      else this.saveFile(file, text)
    },
    resolveFile(file, external) {
      if (!this.canEdit || !file) return
      const text = external ? file.external : file.text
      if (text === null) return
      file.external = null
      file.text = text
      file.dirty = true
      this.saveFile(file)
    },
    addEnvironment(own = false) {
      if (!this.canEdit || (own && (!this.workflow || !this.editable))) return
      const project = this.project, workflow = this.workflow, base = effectiveEnv(project, workflow), id = uid('env')
      const environment = { id, scope: own ? 'workflow' : 'project', workflowId: own ? workflow.id : null, name: own ? `${workflow.name}-venv-${id}` : `venv-${id}`, path: `.venv-${id}`, python: base?.python || '3.12', manager: 'uv', status: 'ready' }
      project.environments.push(environment)
      if (own) { this.snapshot(); workflow.environmentId = id }
    },
    syncEnvironment(environment) {
      if (!this.canEdit || environment.status === 'syncing') return
      environment.status = 'syncing'
      const timer = setTimeout(() => {
        environment.status = 'ready'
        this.environmentTimers = this.environmentTimers.filter(handle => handle !== timer)
        this.notify('Symulacja synchronizacji zakończona. Nie utworzono prawdziwego venva.')
      }, 650)
      this.environmentTimers.push(timer)
    }
  }
}
