import { state, currentProject, currentWorkflow, canEdit, uid } from './state.js'

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))

function ensureEnvironments(project = currentProject()) {
  project.environments ||= [
    { id: uid('env'), name: 'project-default', python: '3.12', path: '.venv', status: 'ready', manager: 'uv', scope: 'project' },
    { id: uid('env'), name: 'etl-legacy', python: '3.11', path: '.venv-etl', status: 'ready', manager: 'uv', scope: 'project' }
  ]
  for (const env of project.environments) env.scope ||= 'project'
  const shared = project.environments.filter(env => env.scope !== 'workflow')
  project.environmentId ||= shared[0]?.id || null
  for (const workflow of project.workflows) if (workflow.environmentId === undefined) workflow.environmentId = null
}

const sharedEnvs = project => project.environments.filter(env => env.scope !== 'workflow')
const workflowEnvs = (project, workflow) => project.environments.filter(env => env.scope === 'workflow' && env.workflowId === workflow?.id)

function effectiveEnv(workflow = currentWorkflow(), project = currentProject()) {
  ensureEnvironments(project)
  const id = workflow?.environmentId || project.environmentId
  return project.environments.find(env => env.id === id) || sharedEnvs(project)[0]
}

function statusLabel(status) {
  return status === 'ready' ? 'Gotowe' : status === 'syncing' ? 'Synchronizacja' : 'Błąd'
}

function ownerLabel(env, project) {
  if (env.scope !== 'workflow') return 'projektowe'
  return `tylko workflow: ${project.workflows.find(w => w.id === env.workflowId)?.name || env.workflowId}`
}

function projectPanel() {
  const project = currentProject(); ensureEnvironments(project)
  const shared = sharedEnvs(project)
  return `<article class="card env-card"><div class="card-head"><div><h2>Python / venv</h2><small>Domyślne środowisko projektu i środowiska workflow</small></div><button data-env-action="add" ${canEdit()?'':'disabled'}>+ Nowy venv projektu</button></div><label>Domyślne środowisko<select id="projectEnvironment" ${canEdit()?'':'disabled'}>${shared.map(env=>`<option value="${env.id}" ${env.id===project.environmentId?'selected':''}>${esc(env.name)} · Python ${esc(env.python)}</option>`).join('')}</select></label><div class="env-list">${project.environments.map(env=>`<div class="env-row ${env.id===project.environmentId?'default':''}"><div><b>${esc(env.name)}</b><small>${esc(env.manager)} · Python ${esc(env.python)} · ${esc(env.path)}</small><small class="env-scope">${esc(ownerLabel(env, project))}</small></div><span class="env-status ${env.status}">${statusLabel(env.status)}</span><button data-env-sync="${env.id}" ${canEdit()?'':'disabled'}>↻ Sync</button></div>`).join('')}</div><small class="hint">Venv workflow nie może zostać domyślnym venvem całego projektu.</small></article>`
}

function workflowSelector() {
  const project = currentProject(), workflow = currentWorkflow(); if (!workflow) return ''
  ensureEnvironments(project)
  const active = effectiveEnv(workflow, project)
  const inherited = project.environments.find(env => env.id === project.environmentId)
  const own = workflowEnvs(project, workflow)
  const shared = sharedEnvs(project)
  return `<div class="workflow-env"><span>Venv workflow</span><select id="workflowEnvironment" ${canEdit()?'':'disabled'}><option value="" ${workflow.environmentId?'':'selected'}>Dziedzicz z projektu · ${esc(inherited?.name || '')}</option><optgroup label="Projektowe">${shared.map(env=>`<option value="${env.id}" ${workflow.environmentId===env.id?'selected':''}>${esc(env.name)} · Python ${esc(env.python)}</option>`).join('')}</optgroup>${own.length?`<optgroup label="Tylko ten workflow">${own.map(env=>`<option value="${env.id}" ${workflow.environmentId===env.id?'selected':''}>${esc(env.name)} · Python ${esc(env.python)}</option>`).join('')}</optgroup>`:''}</select><button data-env-action="add-workflow" ${canEdit()?'':'disabled'} title="Utwórz osobny venv używany tylko przez ten workflow">+ Własny venv</button><i class="env-dot ${active?.status || 'broken'}" title="${esc(statusLabel(active?.status || 'broken'))}"></i></div>`
}

function inject() {
  const project = currentProject(); ensureEnvironments(project)
  if (state.route === 'projects') {
    const grid = document.querySelector('.project-grid')
    if (grid && !grid.querySelector('.env-card')) grid.insertAdjacentHTML('beforeend', projectPanel())
  }
  if (state.route === 'designer') {
    const bar = document.querySelector('.canvas-bar')
    if (bar && !bar.querySelector('.workflow-env')) {
      const tools = bar.querySelector('.canvas-tools')
      tools?.insertAdjacentHTML('beforebegin', workflowSelector())
    }
  }
  bindEnv()
}

function refreshEnvUI() {
  document.querySelector('.env-card')?.remove()
  document.querySelector('.workflow-env')?.remove()
  inject()
}

function bindEnv() {
  const project = currentProject(); ensureEnvironments(project)
  const p = document.querySelector('#projectEnvironment')
  if (p && !p.dataset.bound) { p.dataset.bound='1'; p.addEventListener('change',()=>{project.environmentId=p.value;refreshEnvUI()}) }
  const w = document.querySelector('#workflowEnvironment')
  if (w && !w.dataset.bound) { w.dataset.bound='1'; w.addEventListener('change',()=>{const workflow=currentWorkflow();if(workflow)workflow.environmentId=w.value||null;refreshEnvUI()}) }
  document.querySelectorAll('[data-env-sync]').forEach(button=>{
    if(button.dataset.bound)return
    button.dataset.bound='1'
    button.addEventListener('click',()=>{const env=project.environments.find(item=>item.id===button.dataset.envSync);if(!env||!canEdit())return;env.status='syncing';refreshEnvUI();setTimeout(()=>{env.status='ready';refreshEnvUI()},650)})
  })
  const add=document.querySelector('[data-env-action="add"]')
  if(add&&!add.dataset.bound){add.dataset.bound='1';add.addEventListener('click',()=>{if(!canEdit())return;const n=sharedEnvs(project).length+1;project.environments.push({id:uid('env'),name:`venv-${n}`,python:'3.12',path:`.venv-${n}`,status:'ready',manager:'uv',scope:'project'});refreshEnvUI()})}
  const addWorkflow=document.querySelector('[data-env-action="add-workflow"]')
  if(addWorkflow&&!addWorkflow.dataset.bound){addWorkflow.dataset.bound='1';addWorkflow.addEventListener('click',()=>{if(!canEdit())return;const workflow=currentWorkflow();if(!workflow)return;const base=effectiveEnv(workflow,project);const n=workflowEnvs(project,workflow).length+1;const suffix=n===1?'':`-${n}`;const env={id:uid('env'),name:`${workflow.name}-venv${suffix}`,python:base?.python||'3.12',path:`.venv-${workflow.id}${suffix}`,status:'ready',manager:'uv',scope:'workflow',workflowId:workflow.id};project.environments.push(env);workflow.environmentId=env.id;refreshEnvUI()})}
}

const css=`.env-card{grid-column:1/-1}.env-card .card-head small{display:block;margin-top:3px}.env-list{display:grid;gap:8px;margin-top:14px}.env-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--border,#26324a);border-radius:10px}.env-row.default{outline:1px solid rgba(99,102,241,.55)}.env-row small{display:block;margin-top:3px}.env-scope{opacity:.65}.env-status{font-size:12px;font-weight:700}.env-status.ready{color:#49c77d}.env-status.syncing{color:#f0b84b}.env-status.broken{color:#f06b6b}.workflow-env{display:flex;align-items:center;gap:7px;margin-left:auto;margin-right:10px;padding:5px 8px;border:1px solid var(--border,#26324a);border-radius:9px}.workflow-env>span{font-size:11px;opacity:.65}.workflow-env select{max-width:260px;padding:5px 7px}.workflow-env button{white-space:nowrap}.env-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}.env-dot.ready{background:#49c77d}.env-dot.syncing{background:#f0b84b}.env-dot.broken{background:#f06b6b}@media(max-width:1100px){.workflow-env{order:3;width:100%;margin:6px 0 0}.workflow-env select{max-width:none;flex:1}}@media(max-width:900px){.env-row{grid-template-columns:1fr auto}.env-row button{grid-column:1/-1}}`
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style)
let queued=false
const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;inject()})})
observer.observe(document.querySelector('#app'),{childList:true,subtree:true})
inject()
