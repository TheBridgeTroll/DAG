import { state, TASK_TYPES, PORT_TYPES, currentProject, currentWorkflow, currentNode, currentRole, canEdit } from './state.js'

const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))
const roleClass = role => role.toLowerCase().replaceAll(' ', '-')
const statusClass = status => status.toLowerCase()
const workflowName = id => currentProject().workflows.find(w => w.id === id)?.name || 'workflow'

function nav() {
  const items = [
    ['dashboard','Pulpit','▦'], ['workflows','Workflowy','◇'], ['designer','DAG','⌘'],
    ['lineage','Lineage','⤳'], ['ide','IDE','⌨'], ['runs','Runy','▶'], ['projects','Projekty','♙']
  ]
  return `<aside class="sidebar"><div class="brand"><div class="logo">D</div><div><b>DAG Studio</b><small>RAM prototype</small></div></div><label class="project-select"><span>Projekt</span><select id="projectSelect">${state.projects.map(p=>`<option value="${p.id}" ${p.id===state.projectId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><nav>${items.map(([id,label,icon])=>`<button data-route="${id}" class="${state.route===id?'active':''}"><i>${icon}</i><span>${label}</span></button>`).join('')}</nav><div class="sidebar-foot"><span class="avatar">MC</span><div><b>Michał</b><small>${esc(currentRole())}</small></div></div></aside>`
}

function header(title) {
  return `<header class="topbar"><div><small>${esc(currentProject().name)} /</small><h1>${esc(title)}</h1></div><div class="top-actions"><span class="live">● RAM only</span><button data-action="scan">↻ Skanuj</button><button class="primary" data-action="run">▶ Uruchom</button></div></header>`
}

function shell(title, content) {
  return `<div class="shell">${nav()}<main>${header(title)}${content}</main><div id="toast" class="toast"></div></div>`
}

function dashboard() {
  const project = currentProject()
  const runsToday = project.runs.length
  const failed = project.runs.filter(r=>r.status==='Failed').length
  return `<section class="page"><div class="metrics"><article><small>Workflowy</small><b>${project.workflows.length}</b><span>${project.workflows.filter(w=>w.status!=='Idle').length} aktywnych</span></article><article><small>Runy</small><b>${runsToday}</b><span>historia w RAM</span></article><article><small>Błędy</small><b>${failed}</b><span class="bad">${failed?'wymagają uwagi':'brak'}</span></article><article><small>Zasoby</small><b>${project.resources.length}</b><span>ze skanu kodu</span></article></div><div class="grid two"><article class="card"><div class="card-head"><h2>Workflowy</h2><button data-route="workflows">Wszystkie →</button></div><div class="table-wrap"><table><thead><tr><th>Nazwa</th><th>Status</th><th>Taski</th><th>Schedule</th></tr></thead><tbody>${project.workflows.map(w=>`<tr data-open-workflow="${w.id}"><td><b>${esc(w.name)}</b></td><td><span class="pill ${statusClass(w.status)}">${w.status}</span></td><td>${w.nodes.length}</td><td><code>${esc(w.schedule)}</code></td></tr>`).join('')}</tbody></table></div></article><article class="card"><div class="card-head"><h2>Ostatnie runy</h2><button data-route="runs">Historia →</button></div><div class="activity">${project.runs.map(run=>`<button data-open-run="${run.id}"><span class="dot ${statusClass(run.status)}"></span><div><b>${esc(workflowName(run.workflowId))}</b><small>${esc(run.started)} · ${esc(run.duration)}</small></div><em>${run.status}</em></button>`).join('')}</div></article></div></section>`
}

function workflows() {
  const project = currentProject()
  return `<section class="page"><div class="toolbar"><input id="workflowSearch" placeholder="Szukaj workflow..."><button class="primary" data-action="new-workflow" ${canEdit()?'':'disabled'}>+ Nowy workflow</button></div><article class="card"><div class="table-wrap"><table><thead><tr><th>Nazwa</th><th>Status</th><th>Schedule</th><th>Taski</th><th></th></tr></thead><tbody id="workflowRows">${project.workflows.map(w=>`<tr data-name="${esc(w.name.toLowerCase())}"><td data-open-workflow="${w.id}"><b>${esc(w.name)}</b><small class="block">Python + GUI</small></td><td><span class="pill ${statusClass(w.status)}">${w.status}</span></td><td><code>${esc(w.schedule)}</code></td><td>${w.nodes.length}</td><td class="row-actions"><button data-duplicate-workflow="${w.id}" ${canEdit()?'':'disabled'}>Duplikuj</button><button data-delete-workflow="${w.id}" class="danger" ${canEdit()?'':'disabled'}>Usuń</button></td></tr>`).join('')}</tbody></table></div></article></section>`
}

function portTop(index) { return 54 + index * 24 }
function portCenter(node, portId, direction) {
  const list = direction === 'out' ? node.outputs : node.inputs
  const index = Math.max(0, list.findIndex(port => port.id === portId))
  return { x: node.x + (direction === 'out' ? 190 : 0), y: node.y + portTop(index) + 6 }
}

function nodeCard(node) {
  const selected = node.id === state.selectedNodeId
  const def = TASK_TYPES.find(t=>t.type===node.type)
  const rows = Math.max(1, node.inputs.length, node.outputs.length)
  const height = Math.max(104, 82 + rows * 24)
  return `<div class="dag-node ${selected?'selected':''}" data-node="${node.id}" style="left:${node.x}px;top:${node.y}px;min-height:${height}px"><small>${esc(def?.label || node.type)}</small><b>${esc(node.name)}</b>${node.inputs.map((port,index)=>`<div class="port-row in-row" style="top:${portTop(index)}px"><button class="port in" data-port-in="${node.id}" data-port-id="${port.id}" title="${esc(port.name)} · ${esc(port.type)}"></button><span>${esc(port.name)}</span></div>`).join('')}${node.outputs.map((port,index)=>`<div class="port-row out-row" style="top:${portTop(index)}px"><button class="port out ${state.connectingFrom?.portId===port.id?'connecting':''}" data-port-out="${node.id}" data-port-id="${port.id}" title="${esc(port.name)} · ${esc(port.type)}"></button><span>${esc(port.name)}</span></div>`).join('')}<span class="node-status ${statusClass(node.status)}">${node.status}</span></div>`
}

function edgeSvg(workflow) {
  const paths = workflow.edges.map(edge => {
    const from = workflow.nodes.find(node=>node.id===(edge.fromNode || edge.from))
    const to = workflow.nodes.find(node=>node.id===(edge.toNode || edge.to))
    if (!from || !to) return ''
    const fromPort = edge.fromPort || from.outputs[0]?.id
    const toPort = edge.toPort || to.inputs[0]?.id
    if (!from.outputs.some(port=>port.id===fromPort) || !to.inputs.some(port=>port.id===toPort)) return ''
    const a = portCenter(from, fromPort, 'out'), b = portCenter(to, toPort, 'in')
    const distance = Math.max(70, Math.abs(b.x - a.x) * .5)
    const c1 = a.x + distance, c2 = b.x - distance
    return `<path data-edge="${edge.id}" class="${state.selectedEdgeId===edge.id?'selected':''}" d="M${a.x} ${a.y} C${c1} ${a.y},${c2} ${b.y},${b.x} ${b.y}"/>`
  }).join('')
  return `<svg class="edges" viewBox="0 0 1100 650" preserveAspectRatio="none">${paths}</svg>`
}

function portEditor(direction, ports) {
  const label = direction === 'input' ? 'Inputy' : 'Outputy'
  return `<div class="port-editor-group"><div class="port-editor-head"><b>${label}</b><button data-action="add-port" data-direction="${direction}" ${canEdit()?'':'disabled'}>+ ${direction === 'input' ? 'Input' : 'Output'}</button></div><div class="port-editor-list">${ports.map(port=>`<div class="port-editor-row"><input data-port-name="${port.id}" data-direction="${direction}" value="${esc(port.name)}" ${canEdit()?'':'disabled'}><select data-port-type="${port.id}" data-direction="${direction}" ${canEdit()?'':'disabled'}>${PORT_TYPES.map(type=>`<option ${type===port.type?'selected':''}>${type}</option>`).join('')}</select><button class="icon danger" data-delete-port="${port.id}" data-direction="${direction}" title="Usuń port" ${canEdit()?'':'disabled'}>×</button></div>`).join('') || '<small class="muted">Brak portów.</small>'}</div></div>`
}

function inspector() {
  const node = currentNode()
  if (!node) return `<aside class="inspector"><p class="muted">Wybierz task.</p></aside>`
  return `<aside class="inspector"><div class="panel-title"><h3>${esc(node.name)}</h3><button data-action="delete-node" class="icon danger" ${canEdit()?'':'disabled'}>×</button></div><label>Nazwa<input id="nodeName" value="${esc(node.name)}" ${canEdit()?'':'disabled'}></label><div class="form-row"><label>Retries<input id="nodeRetries" type="number" min="0" value="${node.retries}" ${canEdit()?'':'disabled'}></label><label>Timeout<input id="nodeTimeout" type="number" min="1" value="${node.timeout}" ${canEdit()?'':'disabled'}></label></div><label class="check"><input id="nodeFail" type="checkbox" ${node.fail?'checked':''} ${canEdit()?'':'disabled'}> Symuluj błąd</label><div class="ports-editor"><h4>Porty</h4>${portEditor('input', node.inputs)}${portEditor('output', node.outputs)}</div><h4>Mikroedytor</h4><textarea id="nodeCode" spellcheck="false" ${canEdit()?'':'disabled'}>${esc(node.code)}</textarea><button class="primary full" data-action="save-node" ${canEdit()?'':'disabled'}>Zastosuj</button><small class="hint">Porty mają własne nazwy i typy. Krawędzie łączą konkretny output z konkretnym inputem.</small></aside>`
}

function designer() {
  const workflow = currentWorkflow()
  if (!workflow) return `<section class="page"><div class="empty">Brak workflowów.</div></section>`
  const connecting = state.connectingFrom ? ' · wybierz input docelowego klocka' : ''
  return `<section class="designer"><aside class="task-library"><h3>Biblioteka tasków</h3><input id="taskSearch" placeholder="Szukaj taska..."><div id="taskList">${['Źródła','Transformacje','Wyjścia'].map(group=>`<small>${group.toUpperCase()}</small>${TASK_TYPES.filter(t=>t.group===group).map(t=>`<button data-add-task="${t.type}" ${canEdit()?'':'disabled'}>${esc(t.label)}</button>`).join('')}`).join('')}</div></aside><div class="canvas-wrap"><div class="canvas-bar"><div><b>${esc(workflow.name)}</b><span>${esc(workflow.schedule)}</span></div><div class="canvas-tools"><button data-action="undo">↶</button><button data-action="fit">Fit</button><button data-action="zoom-out">−</button><span>${Math.round(state.zoom*100)}%</span><button data-action="zoom-in">+</button></div></div><div class="dag-viewport" id="dagViewport"><div class="dag-canvas" id="dagCanvas" style="transform:translate(${state.pan.x}px,${state.pan.y}px) scale(${state.zoom})">${edgeSvg(workflow)}${workflow.nodes.map(nodeCard).join('')}</div></div><div class="canvas-hint">Kliknij output, potem input${connecting}. Typy portów muszą być zgodne. Delete usuwa zaznaczoną krawędź lub task.</div></div>${inspector()}</section>`
}

function lineage() {
  const project = currentProject()
  const resource = project.resources.find(r=>r.id===state.selectedResourceId) || project.resources[0]
  const processId = state.selectedProcessId || currentWorkflow()?.id
  const process = project.workflows.find(w=>w.id===processId)
  const processResources = project.resources.filter(r=>r.ops.some(op=>op.workflowId===process?.id))
  return `<section class="page lineage-page"><div class="lineage-tabs"><button class="active">Zasób → procesy</button><button data-action="show-process-lineage">Proces → zasoby</button></div><div class="grid lineage-grid"><article class="card resource-list"><div class="card-head"><h2>Zasoby</h2><button data-action="scan">↻ Skan</button></div><input id="resourceSearch" placeholder="Tabela, plik..."><div id="resourceRows">${project.resources.map(r=>`<button data-resource="${r.id}" data-name="${esc(r.name.toLowerCase())}" class="${resource?.id===r.id?'selected':''}"><span><b>${esc(r.name)}</b><small>${r.type}</small></span><em>${r.ops.length}</em></button>`).join('')}</div></article><article class="card lineage-detail">${resource?`<div class="card-head"><div><small>LINEAGE DLA</small><h2>${esc(resource.name)}</h2></div><span class="pill">${resource.type}</span></div><div class="lineage-flow"><div class="resource-box">▦<b>${esc(resource.name)}</b></div><div class="arrow">→</div><div class="process-stack">${resource.ops.map(op=>`<button data-process="${op.workflowId}"><b>${esc(workflowName(op.workflowId))}</b><small>${op.op}</small></button>`).join('')}</div></div><h3>Procesy korzystające z zasobu</h3><div class="table-wrap"><table><thead><tr><th>Proces</th><th>Operacja</th><th>Task</th></tr></thead><tbody>${resource.ops.map(op=>`<tr><td>${esc(workflowName(op.workflowId))}</td><td><code>${op.op}</code></td><td>${esc(project.workflows.find(w=>w.id===op.workflowId)?.nodes.find(n=>n.id===op.nodeId)?.name||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Brak wykrytych zasobów.</div>'}</article></div><article class="card process-lineage"><div class="card-head"><h2>Wejścia / wyjścia procesu</h2><select id="processSelect">${project.workflows.map(w=>`<option value="${w.id}" ${w.id===process?.id?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div><div class="resource-chips">${processResources.map(r=>{const ops=r.ops.filter(o=>o.workflowId===process?.id);return `<button data-resource="${r.id}"><b>${esc(r.name)}</b><small>${[...new Set(ops.map(o=>o.op))].join(' / ')}</small></button>`}).join('')||'<span class="muted">Brak zależności.</span>'}</div></article></section>`
}

function ide() {
  const project = currentProject()
  const file = project.files.find(f=>f.id===state.selectedFileId) || project.files[0]
  return `<section class="ide-layout"><aside class="file-tree"><div class="panel-title"><h3>Pliki</h3><button data-action="external-change">⚡</button></div>${project.files.map(f=>`<button data-file="${f.id}" class="${file?.id===f.id?'selected':''} ${f.conflict?'conflict':''}">${esc(f.path)}${f.dirty?' *':''}</button>`).join('')}</aside><div class="editor"><div class="editor-bar"><b>${esc(file?.path||'')}</b><div><button data-action="external-change">Symuluj zmianę zewnętrzną</button><button class="primary" data-action="save-file" ${canEdit()?'':'disabled'}>Zapisz</button></div></div>${file?.conflict?`<div class="conflict-banner"><b>Konflikt z zewnętrzną zmianą.</b><button data-action="keep-local">Zachowaj lokalne</button><button data-action="use-external">Użyj zewnętrznego</button></div>`:''}<textarea id="fileEditor" spellcheck="false" ${canEdit()?'':'disabled'}>${esc(file?.text||'')}</textarea></div></section>`
}

function runs() {
  const project = currentProject()
  const run = project.runs.find(r=>r.id===state.selectedRunId) || project.runs[0]
  return `<section class="page"><div class="grid runs-grid"><article class="card"><div class="card-head"><h2>Historia</h2><button data-action="run">▶ Nowy run</button></div><div class="run-list">${project.runs.map(r=>`<button data-run="${r.id}" class="${run?.id===r.id?'selected':''}"><span class="dot ${statusClass(r.status)}"></span><div><b>${esc(workflowName(r.workflowId))}</b><small>${esc(r.started)} · ${esc(r.duration)}</small></div><em>${r.status}</em></button>`).join('')}</div></article><article class="card run-detail">${run?`<div class="card-head"><div><small>RUN</small><h2>${esc(workflowName(run.workflowId))}</h2></div><span class="pill ${statusClass(run.status)}">${run.status}</span></div><pre>${esc(run.logs.join('\n'))}</pre>`:'<div class="empty">Brak runów.</div>'}</article></div></section>`
}

function projects() {
  const project = currentProject()
  return `<section class="page"><div class="grid project-grid"><article class="card"><div class="card-head"><h2>Projekt</h2><span class="pill">${esc(project.visibility)}</span></div><label>Nazwa<input id="projectName" value="${esc(project.name)}" ${canEdit()?'':'disabled'}></label><label>Opis<textarea id="projectDescription" ${canEdit()?'':'disabled'}>${esc(project.description)}</textarea></label><label>Widoczność<select id="projectVisibility" ${canEdit()?'':'disabled'}><option ${project.visibility==='Private'?'selected':''}>Private</option><option ${project.visibility==='Public'?'selected':''}>Public</option></select></label><button class="primary" data-action="save-project" ${canEdit()?'':'disabled'}>Zapisz projekt</button></article><article class="card"><div class="card-head"><h2>Zespół</h2><button data-action="invite" ${['Owner','Admin'].includes(currentRole())?'':'disabled'}>+ Zaproś</button></div><div class="member-list">${project.members.map(m=>{const u=state.users.find(u=>u.id===m.userId);return `<div><span class="avatar">${esc((u?.name||'?').slice(0,2).toUpperCase())}</span><b>${esc(u?.name||'')}</b><select data-role-user="${m.userId}" ${['Owner','Admin'].includes(currentRole())&&m.role!=='Owner'?'':'disabled'}><option ${m.role==='Owner'?'selected':''}>Owner</option><option ${m.role==='Admin'?'selected':''}>Admin</option><option ${m.role==='Editor'?'selected':''}>Editor</option><option ${m.role==='Viewer'?'selected':''}>Viewer</option></select></div>`}).join('')}</div></article></div></section>`
}

function pageContent() {
  switch (state.route) {
    case 'workflows': return ['Workflowy', workflows()]
    case 'designer': return ['Projektant DAG', designer()]
    case 'lineage': return ['Lineage', lineage()]
    case 'ide': return ['IDE', ide()]
    case 'runs': return ['Uruchomienia', runs()]
    case 'projects': return ['Projekty i zespół', projects()]
    default: return ['Pulpit', dashboard()]
  }
}

export { shell, pageContent }