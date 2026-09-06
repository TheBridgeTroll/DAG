export const clone = value => structuredClone(value)
export const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

export const TASK_TYPES = [
  { type: 'read-sql', label: 'Read SQL', group: 'Źródła', inputs: [], outputs: ['DataFrame'] },
  { type: 'read-csv', label: 'Read CSV', group: 'Źródła', inputs: [], outputs: ['DataFrame'] },
  { type: 'python', label: 'Python', group: 'Transformacje', inputs: ['DataFrame'], outputs: ['DataFrame'] },
  { type: 'filter', label: 'Filter', group: 'Transformacje', inputs: ['DataFrame'], outputs: ['DataFrame'] },
  { type: 'join', label: 'Join', group: 'Transformacje', inputs: ['DataFrame', 'DataFrame'], outputs: ['DataFrame'] },
  { type: 'write-sql', label: 'Write SQL', group: 'Wyjścia', inputs: ['DataFrame'], outputs: [] },
  { type: 'write-file', label: 'Write file', group: 'Wyjścia', inputs: ['DataFrame'], outputs: [] }
]

export function makeNode(type = 'python', name, x = 140, y = 120) {
  const def = TASK_TYPES.find(item => item.type === type) || TASK_TYPES[2]
  const safe = (name || def.label.toLowerCase().replace(/\W+/g, '_')).replace(/[^a-zA-Z0-9_]/g, '_')
  const examples = {
    'read-sql': `@task\ndef ${safe}():\n    return db.read("raw.sales_orders")`,
    'read-csv': `@task\ndef ${safe}():\n    return read_csv("customers.csv")`,
    'write-sql': `@task\ndef ${safe}(df):\n    db.write("warehouse.output", df)`,
    'write-file': `@task\ndef ${safe}(df):\n    write_file("exports/output.csv", df)`,
    python: `@task\ndef ${safe}(df):\n    return df`,
    filter: `@task\ndef ${safe}(df):\n    return df[df["active"]]`,
    join: `@task\ndef ${safe}(left, right):\n    return left.merge(right)`
  }
  return {
    id: uid('node'), type, name: safe, x, y, status: 'Idle', retries: 2, timeout: 10,
    code: examples[type] || examples.python,
    inputs: def.inputs.map((kind, i) => ({ id: uid('in'), name: i ? `in${i + 1}` : 'df', type: kind })),
    outputs: def.outputs.map((kind, i) => ({ id: uid('out'), name: i ? `out${i + 1}` : 'out', type: kind }))
  }
}

const load = makeNode('read-sql', 'load_orders', 90, 130)
const clean = makeNode('python', 'clean_orders', 360, 130)
const save = makeNode('write-sql', 'save_daily', 630, 130)
load.code = '@task\ndef load_orders():\n    return db.read("raw.sales_orders")'
clean.code = '@task(retries=2)\ndef clean_orders(df):\n    return df.dropna()'
save.code = '@task\ndef save_daily(df):\n    db.write("warehouse.sales_daily", df)'

const customerRead = makeNode('read-csv', 'load_customers', 110, 150)
const segment = makeNode('python', 'segment', 400, 150)
customerRead.code = '@task\ndef load_customers():\n    return read_csv("customers.csv")'
segment.code = '@task\ndef segment(df):\n    return model.predict(df)'

export const state = {
  route: 'dashboard', projectId: 'retail', workflowId: 'sales', selectedNodeId: clean.id,
  selectedResourceId: null, selectedRunId: null, selectedFileId: null, selectedEdgeId: null,
  connectingFrom: null, clipboard: null, toast: '', zoom: 1, pan: { x: 0, y: 0 },
  users: [
    { id: 'u1', name: 'Michał' }, { id: 'u2', name: 'Anna' },
    { id: 'u3', name: 'Robert' }, { id: 'u4', name: 'Kasia' }
  ],
  projects: [
    {
      id: 'retail', name: 'Retail Analytics', visibility: 'Private', description: 'Workflowy analityczne',
      members: [{ userId: 'u1', role: 'Owner' }, { userId: 'u2', role: 'Editor' }, { userId: 'u3', role: 'Viewer' }, { userId: 'u4', role: 'Admin' }],
      workflows: [
        {
          id: 'sales', name: 'daily_sales_pipeline', schedule: '0 6 * * *', status: 'Success', nodes: [load, clean, save],
          edges: [
            { id: uid('edge'), from: load.id, to: clean.id },
            { id: uid('edge'), from: clean.id, to: save.id }
          ]
        },
        { id: 'segments', name: 'customer_segmentation', schedule: '0 2 * * 1', status: 'Idle', nodes: [customerRead, segment], edges: [{ id: uid('edge'), from: customerRead.id, to: segment.id }] }
      ],
      files: [], resources: [], runs: []
    },
    {
      id: 'sandbox', name: 'Sandbox ETL', visibility: 'Public', description: 'Projekt testowy',
      members: [{ userId: 'u1', role: 'Editor' }, { userId: 'u2', role: 'Owner' }, { userId: 'u3', role: 'Viewer' }],
      workflows: [{ id: 'demo', name: 'demo_pipeline', schedule: '@daily', status: 'Idle', nodes: [makeNode('read-csv', 'start', 120, 140), makeNode('write-file', 'finish', 430, 140)], edges: [] }],
      files: [], resources: [], runs: []
    }
  ]
}

export const currentProject = () => state.projects.find(p => p.id === state.projectId) || state.projects[0]
export const currentWorkflow = () => currentProject().workflows.find(w => w.id === state.workflowId) || currentProject().workflows[0]
export const currentNode = () => currentWorkflow()?.nodes.find(n => n.id === state.selectedNodeId) || null
export const currentRole = () => currentProject().members.find(m => m.userId === 'u1')?.role || 'Viewer'
export const canEdit = () => ['Owner', 'Admin', 'Editor'].includes(currentRole())

export function workflowSource(workflow) {
  return `# workflow ${workflow.name}\n# schedule ${workflow.schedule}\n\n${workflow.nodes.map(node => node.code).join('\n\n')}`
}

export function syncFiles(project = currentProject()) {
  for (const workflow of project.workflows) {
    let file = project.files.find(f => f.workflowId === workflow.id)
    if (!file) {
      file = { id: uid('file'), workflowId: workflow.id, path: `workflows/${workflow.name}.py`, text: '', dirty: false, conflict: false, external: '' }
      project.files.push(file)
    }
    if (!file.dirty) file.text = workflowSource(workflow)
  }
  if (!project.files.some(f => f.path === 'config/project.json')) {
    project.files.push({ id: uid('file'), path: 'config/project.json', text: JSON.stringify({ name: project.name, visibility: project.visibility }, null, 2), dirty: false, conflict: false, external: '' })
  }
}

export function scanLineage(project = currentProject()) {
  const resources = new Map()
  const patterns = [
    { re: /db\.read\(["']([^"']+)/g, type: 'Tabela', op: 'READ' },
    { re: /db\.write\(["']([^"']+)/g, type: 'Tabela', op: 'WRITE' },
    { re: /db\.update\(["']([^"']+)/g, type: 'Tabela', op: 'MODIFY' },
    { re: /read_csv\(["']([^"']+)/g, type: 'Plik', op: 'READ' },
    { re: /write_file\(["']([^"']+)/g, type: 'Plik', op: 'WRITE' }
  ]
  for (const workflow of project.workflows) {
    for (const node of workflow.nodes) {
      for (const pattern of patterns) {
        pattern.re.lastIndex = 0
        let match
        while ((match = pattern.re.exec(node.code))) {
          const key = `${pattern.type}:${match[1]}`
          if (!resources.has(key)) resources.set(key, { id: uid('resource'), name: match[1], type: pattern.type, ops: [] })
          resources.get(key).ops.push({ workflowId: workflow.id, nodeId: node.id, op: pattern.op })
        }
      }
    }
  }
  project.resources = [...resources.values()]
  if (!project.resources.some(r => r.id === state.selectedResourceId)) state.selectedResourceId = project.resources[0]?.id || null
  return project.resources
}

export function seedRuns(project = currentProject()) {
  if (project.runs.length) return
  project.runs.push(
    { id: uid('run'), workflowId: project.workflows[0]?.id, status: 'Success', started: 'dzisiaj 06:00', duration: '41s', logs: ['queued', 'load_orders success', 'clean_orders success', 'save_daily success'] },
    { id: uid('run'), workflowId: project.workflows[0]?.id, status: 'Failed', started: 'wczoraj 06:00', duration: '18s', logs: ['queued', 'load_orders success', 'clean_orders retry 1/2', 'clean_orders failed'] }
  )
}

for (const project of state.projects) { syncFiles(project); scanLineage(project); seedRuns(project) }
state.selectedFileId = currentProject().files[0]?.id || null
state.selectedRunId = currentProject().runs[0]?.id || null
