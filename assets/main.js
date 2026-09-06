import {
  state, clone, uid, makeNode, currentProject, currentWorkflow, currentNode,
  canEdit, syncFiles, scanLineage, workflowSource
} from './state.js'
import { shell, pageContent } from './views.js'

const app = document.querySelector('#app')
let toastTimer
let drag = null

const route = name => { state.route = name; location.hash = name; render() }
const toast = message => { state.toast = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { state.toast = ''; renderToast() }, 1800); renderToast() }

function renderToast() {
  const el = document.querySelector('#toast')
  if (!el) return
  el.textContent = state.toast
  el.classList.toggle('show', Boolean(state.toast))
}

function render() {
  syncFiles(currentProject())
  const [title, content] = pageContent()
  app.innerHTML = shell(title, content)
  bind()
  renderToast()
}

function snapshot(workflow) {
  workflow._undo ||= []
  workflow._undo.push(JSON.stringify({nodes:workflow.nodes,edges:workflow.edges}))
  if (workflow._undo.length > 30) workflow._undo.shift()
}

function addTask(type) {
  if (!canEdit()) return
  const workflow = currentWorkflow(); snapshot(workflow)
  const node = makeNode(type, undefined, 160 + (workflow.nodes.length % 3) * 230, 110 + Math.floor(workflow.nodes.length / 3) * 150)
  workflow.nodes.push(node); state.selectedNodeId = node.id; syncFiles(); scanLineage(); render()
}

function saveNode() {
  const node = currentNode(); if (!node || !canEdit()) return
  const workflow = currentWorkflow(); snapshot(workflow)
  node.name = document.querySelector('#nodeName').value.trim().replace(/\W+/g,'_') || node.name
  node.retries = Number(document.querySelector('#nodeRetries').value) || 0
  node.timeout = Number(document.querySelector('#nodeTimeout').value) || 1
  node.fail = document.querySelector('#nodeFail').checked
  node.code = document.querySelector('#nodeCode').value
  const file = currentProject().files.find(f=>f.workflowId===workflow.id); if(file){file.text=workflowSource(workflow);file.dirty=false}
  scanLineage(); toast('Task zapisany'); render()
}

function connectTo(nodeId) {
  const workflow = currentWorkflow()
  if (!state.connectingFrom || state.connectingFrom === nodeId) return
  if (workflow.edges.some(e=>e.from===state.connectingFrom && e.to===nodeId)) { state.connectingFrom=null; return render() }
  snapshot(workflow)
  workflow.edges.push({ id: uid('edge'), from: state.connectingFrom, to: nodeId })
  state.connectingFrom = null; render()
}

function runWorkflow() {
  const workflow = currentWorkflow(); if (!workflow) return
  workflow.nodes.forEach(n=>n.status='Queued'); workflow.status='Running'; render()
  const run = { id: uid('run'), workflowId: workflow.id, status:'Running', started:'teraz', duration:'0s', logs:['queued'] }
  currentProject().runs.unshift(run); state.selectedRunId=run.id
  let i=0
  const step=()=>{
    if(i) workflow.nodes[i-1].status='Success'
    if(i>=workflow.nodes.length){workflow.status='Success';run.status='Success';run.duration=`${Math.max(1,workflow.nodes.length)}s`;run.logs.push('workflow success');render();return}
    const node=workflow.nodes[i]; node.status='Running';run.logs.push(`${node.name} running`);render()
    setTimeout(()=>{
      if(node.fail){node.status='Failed';workflow.status='Failed';run.status='Failed';run.logs.push(`${node.name} failed after ${node.retries} retries`);render();return}
      run.logs.push(`${node.name} success`);i++;step()
    },350)
  }
  step()
}

function parseWorkflowFile(file) {
  const workflow = currentProject().workflows.find(w=>w.id===file.workflowId)
  if (!workflow) return
  const taskRegex = /@task[^\n]*\ndef\s+([a-zA-Z_]\w*)[\s\S]*?(?=\n@task|$)/g
  const blocks = [...file.text.matchAll(taskRegex)]
  if (!blocks.length) return
  snapshot(workflow)
  workflow.nodes = blocks.map((m,i)=>{
    const old=workflow.nodes.find(n=>n.name===m[1]); const node=old||makeNode('python',m[1],120+i*240,140)
    node.code=m[0].trim(); return node
  })
  workflow.edges = workflow.edges.filter(e=>workflow.nodes.some(n=>n.id===e.from)&&workflow.nodes.some(n=>n.id===e.to))
  scanLineage()
}

function bind() {
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>route(el.dataset.route)))
  document.querySelector('#projectSelect')?.addEventListener('change',e=>{state.projectId=e.target.value;state.workflowId=currentProject().workflows[0]?.id;state.selectedNodeId=currentWorkflow()?.nodes[0]?.id;state.selectedFileId=currentProject().files[0]?.id;state.selectedRunId=currentProject().runs[0]?.id;scanLineage();render()})
  document.querySelectorAll('[data-open-workflow]').forEach(el=>el.addEventListener('click',()=>{state.workflowId=el.dataset.openWorkflow;state.selectedNodeId=currentWorkflow()?.nodes[0]?.id;route('designer')}))
  document.querySelectorAll('[data-open-run]').forEach(el=>el.addEventListener('click',()=>{state.selectedRunId=el.dataset.openRun;route('runs')}))
  document.querySelectorAll('[data-add-task]').forEach(el=>el.addEventListener('click',()=>addTask(el.dataset.addTask)))
  document.querySelectorAll('[data-resource]').forEach(el=>el.addEventListener('click',()=>{state.selectedResourceId=el.dataset.resource;render()}))
  document.querySelectorAll('[data-process]').forEach(el=>el.addEventListener('click',()=>{state.workflowId=el.dataset.process;state.selectedNodeId=currentWorkflow()?.nodes[0]?.id;route('designer')}))
  document.querySelectorAll('[data-file]').forEach(el=>el.addEventListener('click',()=>{state.selectedFileId=el.dataset.file;render()}))
  document.querySelectorAll('[data-run]').forEach(el=>el.addEventListener('click',()=>{state.selectedRunId=el.dataset.run;render()}))
  document.querySelectorAll('[data-port-out]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();state.connectingFrom=el.dataset.portOut;toast('Wybierz port wejściowy')}))
  document.querySelectorAll('[data-port-in]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();connectTo(el.dataset.portIn)}))
  document.querySelectorAll('.edges path').forEach(el=>el.addEventListener('click',()=>{state.selectedEdgeId=el.dataset.edge;state.selectedNodeId=null;render()}))
  document.querySelectorAll('.dag-node').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      if(e.target.matches('.port')||!canEdit()) return
      state.selectedNodeId=el.dataset.node;state.selectedEdgeId=null
      const node=currentWorkflow().nodes.find(n=>n.id===el.dataset.node)
      drag={id:node.id,startX:e.clientX,startY:e.clientY,x:node.x,y:node.y};el.setPointerCapture(e.pointerId)
    })
    el.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==el.dataset.node)return
      const node=currentWorkflow().nodes.find(n=>n.id===drag.id)
      node.x=Math.max(10,drag.x+(e.clientX-drag.startX)/state.zoom);node.y=Math.max(10,drag.y+(e.clientY-drag.startY)/state.zoom)
      el.style.left=`${node.x}px`;el.style.top=`${node.y}px`
    })
    el.addEventListener('pointerup',()=>{if(drag){drag=null;render()}})
    el.addEventListener('click',()=>{state.selectedNodeId=el.dataset.node;state.selectedEdgeId=null;render()})
  })

  document.querySelector('#workflowSearch')?.addEventListener('input',e=>document.querySelectorAll('#workflowRows tr').forEach(row=>row.hidden=!row.dataset.name.includes(e.target.value.toLowerCase())))
  document.querySelector('#taskSearch')?.addEventListener('input',e=>document.querySelectorAll('#taskList button').forEach(btn=>btn.hidden=!btn.textContent.toLowerCase().includes(e.target.value.toLowerCase())))
  document.querySelector('#resourceSearch')?.addEventListener('input',e=>document.querySelectorAll('#resourceRows button').forEach(btn=>btn.hidden=!btn.dataset.name.includes(e.target.value.toLowerCase())))
  document.querySelector('#processSelect')?.addEventListener('change',e=>{state.selectedProcessId=e.target.value;render()})
  document.querySelector('#fileEditor')?.addEventListener('input',e=>{const f=currentProject().files.find(f=>f.id===state.selectedFileId);if(f){f.text=e.target.value;f.dirty=true}})
  document.querySelectorAll('[data-role-user]').forEach(el=>el.addEventListener('change',()=>{const m=currentProject().members.find(m=>m.userId===el.dataset.roleUser);if(m)m.role=el.value;toast('Rola zmieniona')}))

  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>{
    const action=el.dataset.action
    if(action==='scan'){scanLineage();toast('Lineage odświeżony');render()}
    if(action==='run')runWorkflow()
    if(action==='save-node')saveNode()
    if(action==='delete-node'&&canEdit()){const w=currentWorkflow(),id=state.selectedNodeId;snapshot(w);w.nodes=w.nodes.filter(n=>n.id!==id);w.edges=w.edges.filter(e=>e.from!==id&&e.to!==id);state.selectedNodeId=w.nodes[0]?.id;syncFiles();scanLineage();render()}
    if(action==='zoom-in'){state.zoom=Math.min(1.6,state.zoom+.1);render()}
    if(action==='zoom-out'){state.zoom=Math.max(.5,state.zoom-.1);render()}
    if(action==='fit'){state.zoom=.85;state.pan={x:20,y:20};render()}
    if(action==='undo'){const w=currentWorkflow(),raw=w._undo?.pop();if(raw){const snap=JSON.parse(raw);w.nodes=snap.nodes;w.edges=snap.edges;state.selectedNodeId=w.nodes[0]?.id;render()}}
    if(action==='new-workflow'&&canEdit()){const p=currentProject(),w={id:uid('wf'),name:`workflow_${p.workflows.length+1}`,schedule:'@daily',status:'Idle',nodes:[],edges:[]};p.workflows.push(w);state.workflowId=w.id;syncFiles();route('designer')}
    if(action==='save-file'&&canEdit()){const f=currentProject().files.find(f=>f.id===state.selectedFileId);if(f){f.dirty=false;f.conflict=false;parseWorkflowFile(f);toast('Plik zapisany');render()}}
    if(action==='external-change'){const f=currentProject().files.find(f=>f.id===state.selectedFileId);if(f){f.external=f.text+'\n# external edit';if(f.dirty)f.conflict=true;else{f.text=f.external;f.external='';parseWorkflowFile(f)}render()}}
    if(action==='keep-local'){const f=currentProject().files.find(f=>f.id===state.selectedFileId);if(f){f.conflict=false;f.external='';f.dirty=true;render()}}
    if(action==='use-external'){const f=currentProject().files.find(f=>f.id===state.selectedFileId);if(f){f.text=f.external;f.external='';f.conflict=false;f.dirty=false;parseWorkflowFile(f);render()}}
    if(action==='save-project'&&canEdit()){const p=currentProject();p.name=document.querySelector('#projectName').value.trim()||p.name;p.description=document.querySelector('#projectDescription').value;p.visibility=document.querySelector('#projectVisibility').value;toast('Projekt zapisany');render()}
    if(action==='invite'){const p=currentProject(),missing=state.users.find(u=>!p.members.some(m=>m.userId===u.id));if(missing){p.members.push({userId:missing.id,role:'Viewer'});toast(`${missing.name} dodany`);render()}else toast('Wszyscy demo użytkownicy już są w projekcie')}
  }))

  document.querySelectorAll('[data-duplicate-workflow]').forEach(el=>el.addEventListener('click',()=>{if(!canEdit())return;const src=currentProject().workflows.find(w=>w.id===el.dataset.duplicateWorkflow),copy=clone(src);copy.id=uid('wf');copy.name=`${src.name}_copy`;copy.nodes.forEach(n=>n.id=uid('node'));copy.edges=[];currentProject().workflows.push(copy);syncFiles();render()}))
  document.querySelectorAll('[data-delete-workflow]').forEach(el=>el.addEventListener('click',()=>{if(!canEdit())return;const p=currentProject();p.workflows=p.workflows.filter(w=>w.id!==el.dataset.deleteWorkflow);if(state.workflowId===el.dataset.deleteWorkflow)state.workflowId=p.workflows[0]?.id;syncFiles();scanLineage();render()}))
}

addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(hash){state.route=hash;render()}})
addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(state.route==='ide')document.querySelector('[data-action="save-file"]')?.click();else if(state.route==='designer')document.querySelector('[data-action="save-node"]')?.click()}
  if(e.key==='Delete'&&state.route==='designer'&&canEdit()){
    const w=currentWorkflow()
    if(state.selectedEdgeId){w.edges=w.edges.filter(edge=>edge.id!==state.selectedEdgeId);state.selectedEdgeId=null;render()}
    else if(state.selectedNodeId)document.querySelector('[data-action="delete-node"]')?.click()
  }
})

state.route = location.hash.slice(1) || 'dashboard'
render()
