const { createApp, ref, reactive, computed } = Vue

const initialWorkflows = [
  {id:1,name:'daily_sales_pipeline',status:'Running',schedule:'0 6 * * *',last:'2 min temu'},
  {id:2,name:'customer_segmentation',status:'Success',schedule:'0 2 * * 1',last:'1 h temu'},
  {id:3,name:'finance_export',status:'Failed',schedule:'0 7 * * 1-5',last:'18 min temu'},
]
const resources = [
  {name:'raw.sales_orders',type:'Tabela',mode:'R/W',processes:['daily_sales_pipeline','finance_export']},
  {name:'warehouse.sales_daily',type:'Tabela',mode:'W',processes:['daily_sales_pipeline']},
  {name:'customers.csv',type:'Plik',mode:'R',processes:['customer_segmentation']},
  {name:'analytics.customer_segments',type:'Widok',mode:'W',processes:['customer_segmentation']},
  {name:'exports/finance.xlsx',type:'Plik',mode:'W',processes:['finance_export']},
]
const library = [
  {kind:'read_sql',label:'Read SQL table',icon:'▣',group:'ŹRÓDŁA'},
  {kind:'read_csv',label:'Read CSV',icon:'▤',group:'ŹRÓDŁA'},
  {kind:'python',label:'Python task',icon:'⌁',group:'TRANSFORMACJE'},
  {kind:'filter',label:'Filter rows',icon:'◫',group:'TRANSFORMACJE'},
  {kind:'join',label:'Join',icon:'⤨',group:'TRANSFORMACJE'},
  {kind:'write_sql',label:'Write SQL table',icon:'▣',group:'WYJŚCIA'},
  {kind:'write_file',label:'Write file',icon:'▤',group:'WYJŚCIA'},
]
const files = ['workflows/sales.py','workflows/segments.py','tasks/io.py','tasks/transforms.py','config/project.json']
const snippets = reactive({
  'workflows/sales.py':`from dag import task\n\n@task\ndef load_orders() -> DataFrame:\n    return db.read("raw.sales_orders")\n\n@task(retries=2)\ndef clean_orders(df: DataFrame) -> DataFrame:\n    return df.dropna()\n\n@task\ndef save_daily(df: DataFrame):\n    db.write("warehouse.sales_daily", df)`,
  'workflows/segments.py':`@task\ndef load_customers():\n    return read_csv("customers.csv")\n\n@task\ndef segment(df):\n    return model.predict(df)`,
  'tasks/io.py':`def read_csv(path):\n    ...\n\ndef write_table(name, df):\n    ...`,
  'tasks/transforms.py':`def normalize(df):\n    return df.fillna(0)`,
  'config/project.json':`{\n  "name": "Retail Analytics",\n  "sync": "live",\n  "defaultRetries": 2\n}`
})

const App = {
  setup(){
    const route = ref(location.hash.slice(1) || 'dashboard')
    addEventListener('hashchange', () => route.value = location.hash.slice(1) || 'dashboard')
    const nav = r => { location.hash = r }
    const toast = ref('')
    let toastTimer
    const flash = text => { clearTimeout(toastTimer); toast.value = text; toastTimer = setTimeout(() => toast.value = '', 2200) }

    const workflows = reactive(initialWorkflows.map(w => ({...w})))
    const selectedWorkflow = ref(workflows[0])
    const selectedResource = ref(resources[0])
    const members = reactive([
      {name:'Michał',role:'Owner'},{name:'Anna',role:'Editor'},{name:'Robert',role:'Viewer'},{name:'Kasia',role:'Admin'}
    ])
    const project = reactive({name:'Retail Analytics',description:'Workflowy analityczne zespołu Retail.',visibility:'Prywatny'})
    const selectedFile = ref(files[0])
    const code = ref(snippets[selectedFile.value])
    const dirty = ref(false)
    const runState = ref('Idle')
    const scanLabel = ref('ostatni skan 2m')

    const nodes = reactive([
      {id:1,kind:'read_sql',name:'load_orders',x:70,y:180,retries:1,timeout:'10 min',code:'@task\ndef load_orders():\n    return db.read("raw.sales_orders")'},
      {id:2,kind:'python',name:'clean_orders',x:310,y:180,retries:2,timeout:'10 min',code:'@task(retries=2)\ndef clean_orders(df):\n    return df.dropna()'},
      {id:3,kind:'python',name:'aggregate_daily',x:550,y:180,retries:1,timeout:'10 min',code:'@task\ndef aggregate_daily(df):\n    return aggregate(df)'},
      {id:4,kind:'write_sql',name:'save_daily',x:790,y:180,retries:1,timeout:'10 min',code:'@task\ndef save_daily(df):\n    db.write("warehouse.sales_daily", df)'}
    ])
    const edges = reactive([{from:1,to:2},{from:2,to:3},{from:3,to:4}])
    const selectedNodeId = ref(2)
    const selectedNode = computed(() => nodes.find(n => n.id === selectedNodeId.value) || null)
    const zoom = ref(1)
    const drag = reactive({active:false,id:null,dx:0,dy:0})
    const connectFrom = ref(null)

    const title = computed(() => ({dashboard:'Pulpit',workflows:'Workflowy',designer:'Projektant DAG',resources:'Zasoby i lineage',ide:'IDE',projects:'Projekt i zespół',runs:'Uruchomienia'}[route.value] || 'DAG Studio'))
    const workflowTaskCount = computed(() => nodes.length)
    const groupedLibrary = computed(() => ['ŹRÓDŁA','TRANSFORMACJE','WYJŚCIA'].map(group => ({group,items:library.filter(i=>i.group===group)})))

    const pickFile = f => { selectedFile.value = f; code.value = snippets[f]; dirty.value = false }
    const save = () => { snippets[selectedFile.value] = code.value; dirty.value = false; flash('Zmiana została w RAM-ie tej karty') }
    const run = () => { runState.value = 'Running'; flash('Uruchomiono workflow (symulacja)'); setTimeout(() => runState.value = 'Success', 1300) }
    const addWorkflow = () => {
      const id = Date.now()
      const w = {id,name:`workflow_${workflows.length+1}`,status:'Draft',schedule:'manual',last:'nigdy'}
      workflows.unshift(w); selectedWorkflow.value = w; nav('designer'); flash('Nowy workflow utworzony w RAM-ie')
    }
    const addMember = () => { members.push({name:`User ${members.length+1}`,role:'Viewer'}); flash('Użytkownik dodany w RAM-ie') }
    const scan = () => { scanLabel.value = 'ostatni skan teraz'; flash('Skan demo: 28 zasobów, 42 zależności') }

    const kindLabel = kind => ({read_sql:'SQL INPUT',read_csv:'FILE INPUT',python:'PYTHON TASK',filter:'FILTER',join:'JOIN',write_sql:'SQL OUTPUT',write_file:'FILE OUTPUT'}[kind] || 'TASK')
    const addNode = item => {
      const id = Date.now() + Math.floor(Math.random()*1000)
      const n = {id,kind:item.kind,name:item.kind+'_'+(nodes.length+1),x:120+((nodes.length*45)%360),y:100+((nodes.length*70)%300),retries:1,timeout:'10 min',code:`@task\ndef ${item.kind}_${nodes.length+1}():\n    pass`}
      nodes.push(n); selectedNodeId.value = id; flash(`${item.label} dodany w RAM-ie`)
    }
    const duplicateNode = () => {
      const n = selectedNode.value; if(!n) return
      const id = Date.now()+Math.floor(Math.random()*1000)
      nodes.push({...n,id,name:n.name+'_copy',x:n.x+35,y:n.y+35}); selectedNodeId.value=id; flash('Klocek skopiowany')
    }
    const deleteNode = () => {
      const id = selectedNodeId.value; if(!id) return
      const idx = nodes.findIndex(n=>n.id===id); if(idx>=0) nodes.splice(idx,1)
      for(let i=edges.length-1;i>=0;i--) if(edges[i].from===id||edges[i].to===id) edges.splice(i,1)
      selectedNodeId.value = nodes[0]?.id || null; flash('Klocek usunięty z RAM-u')
    }
    const beginDrag = (e,n) => {
      selectedNodeId.value = n.id
      const canvas = e.currentTarget.closest('.canvas')
      const rect = canvas.getBoundingClientRect()
      drag.active=true; drag.id=n.id
      drag.dx=(e.clientX-rect.left+canvas.scrollLeft)/zoom.value-n.x
      drag.dy=(e.clientY-rect.top+canvas.scrollTop-46)/zoom.value-n.y
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const moveDrag = e => {
      if(!drag.active) return
      const canvas = e.currentTarget
      const rect = canvas.getBoundingClientRect()
      const n = nodes.find(x=>x.id===drag.id); if(!n) return
      n.x=Math.max(12,Math.round(((e.clientX-rect.left+canvas.scrollLeft)/zoom.value-drag.dx)/10)*10)
      n.y=Math.max(12,Math.round(((e.clientY-rect.top+canvas.scrollTop-46)/zoom.value-drag.dy)/10)*10)
    }
    const endDrag = () => { drag.active=false; drag.id=null }
    const nodeCenter = id => {
      const n = nodes.find(x=>x.id===id)
      return n ? {x:n.x+95,y:n.y+55} : {x:0,y:0}
    }
    const startConnect = (e,n) => { e.stopPropagation(); connectFrom.value=n.id; flash('Wybierz port wejściowy drugiego klocka') }
    const finishConnect = (e,n) => {
      e.stopPropagation()
      if(!connectFrom.value || connectFrom.value===n.id) return
      if(!edges.some(x=>x.from===connectFrom.value&&x.to===n.id)) edges.push({from:connectFrom.value,to:n.id})
      connectFrom.value=null; flash('Połączenie dodane w RAM-ie')
    }
    const setZoom = delta => { zoom.value = Math.min(1.5,Math.max(.6,Math.round((zoom.value+delta)*10)/10)) }

    return {route,nav,title,toast,flash,workflows,selectedWorkflow,resources,selectedResource,members,project,files,selectedFile,code,dirty,runState,scanLabel,nodes,edges,selectedNodeId,selectedNode,zoom,connectFrom,workflowTaskCount,groupedLibrary,pickFile,save,run,addWorkflow,addMember,scan,kindLabel,addNode,duplicateNode,deleteNode,beginDrag,moveDrag,endDrag,nodeCenter,startConnect,finishConnect,setZoom}
  },
  template:`
<div class="shell">
  <aside class="sidebar">
    <div class="brand"><div class="logo">D</div><div class="brandText"><b>DAG Studio</b><small>workflow platform</small></div></div>
    <div class="projectPicker">{{project.name}} <span>⌄</span></div>
    <nav>
      <button :class="{active:route==='dashboard'}" @click="nav('dashboard')">◫ <span>Pulpit</span></button>
      <button :class="{active:route==='workflows'}" @click="nav('workflows')">⌘ <span>Workflowy</span></button>
      <button :class="{active:route==='designer'}" @click="nav('designer')">◇ <span>Projektant DAG</span></button>
      <button :class="{active:route==='resources'}" @click="nav('resources')">▦ <span>Zasoby / lineage</span></button>
      <button :class="{active:route==='ide'}" @click="nav('ide')">⌨ <span>IDE</span></button>
      <button :class="{active:route==='runs'}" @click="nav('runs')">▶ <span>Uruchomienia</span></button>
      <button :class="{active:route==='projects'}" @click="nav('projects')">♙ <span>Projekt i zespół</span></button>
    </nav>
    <div class="ramBadge">RAM ONLY<br><small>odświeżenie zeruje zmiany</small></div>
    <div class="user"><div class="avatar">MC</div><div class="userText"><b>Michał</b><small>Owner</small></div></div>
  </aside>

  <main>
    <header><div><small>{{project.name}} /</small><h1>{{title}}</h1></div><div class="actions"><span class="sync">● RAM live</span><button class="ghost" @click="flash('Stan istnieje tylko w RAM-ie tej karty')">↻ Stan</button><button class="primary" @click="run">▶ Uruchom</button></div></header>

    <section v-if="route==='dashboard'" class="page">
      <div class="metrics"><div><small>Workflowy</small><b>{{workflows.length}}</b><span>wersja demonstracyjna</span></div><div><small>Uruchomienia dziś</small><b>47</b><span class="ok">44 poprawne</span></div><div><small>Błędy</small><b>3</b><span class="bad">wymagają uwagi</span></div><div><small>Zasoby danych</small><b>{{resources.length}}</b><span>{{scanLabel}}</span></div></div>
      <div class="grid2"><article class="card tableWrap"><div class="cardhead"><h2>Workflowy</h2><button @click="nav('workflows')">Wszystkie →</button></div><table><tr><th>Nazwa</th><th>Status</th><th>Ostatnio</th></tr><tr v-for="w in workflows" :key="w.id" @click="selectedWorkflow=w;nav('designer')"><td><b>{{w.name}}</b></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td>{{w.last}}</td></tr></table></article>
      <article class="card"><div class="cardhead"><h2>Aktywność</h2></div><div class="activity"><p><span class="dot okbg"></span><b>daily_sales_pipeline</b> zakończony poprawnie</p><small>2 min temu · 41s</small><p><span class="dot warnbg"></span><b>finance_export</b> ponowienie taska</p><small>18 min temu · retry 2/3</small><p><span class="dot"></span><b>Anna</b> zmieniła workflows/segments.py</p><small>34 min temu · demo</small></div></article></div>
    </section>

    <section v-if="route==='workflows'" class="page"><div class="toolbar"><input placeholder="Szukaj workflow..."><button class="primary" @click="addWorkflow">+ Nowy workflow</button></div><div class="card tableWrap"><table><tr><th>Nazwa</th><th>Status</th><th>Harmonogram</th><th>Ostatnio</th></tr><tr v-for="w in workflows" :key="w.id" @click="selectedWorkflow=w;nav('designer')"><td><b>{{w.name}}</b><small class="block">Python + GUI</small></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td><code>{{w.schedule}}</code></td><td>{{w.last}}</td></tr></table></div></section>

    <section v-if="route==='designer'" class="designer">
      <div class="tasklib"><h3>Biblioteka tasków</h3><small class="ramNote">Kliknij, żeby dodać do RAM-u</small><template v-for="g in groupedLibrary" :key="g.group"><small>{{g.group}}</small><button v-for="item in g.items" :key="item.kind" @click="addNode(item)">{{item.icon}} {{item.label}} <b>＋</b></button></template></div>
      <div class="canvas" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
        <div class="canvasbar"><b>{{selectedWorkflow.name}}</b><span>{{workflowTaskCount}} tasków · RAM</span><div><button @click="setZoom(-.1)">−</button><button>{{Math.round(zoom*100)}}%</button><button @click="setZoom(.1)">+</button></div></div>
        <div class="nodes" :style="{transform:'scale('+zoom+')'}">
          <svg class="edges" width="1400" height="850"><line v-for="(e,i) in edges" :key="i" :x1="nodeCenter(e.from).x" :y1="nodeCenter(e.from).y" :x2="nodeCenter(e.to).x" :y2="nodeCenter(e.to).y" /></svg>
          <div v-for="n in nodes" :key="n.id" class="node" :class="{chosen:selectedNodeId===n.id,connecting:connectFrom===n.id}" :style="{left:n.x+'px',top:n.y+'px'}" @pointerdown="beginDrag($event,n)" @click.stop="selectedNodeId=n.id">
            <small>{{kindLabel(n.kind)}}</small><b>{{n.name}}</b><p><button class="port in" title="Połącz tutaj" @pointerdown.stop @click="finishConnect($event,n)"></button> in <span>DataFrame</span></p><p>out <span>DataFrame</span><button class="port out" title="Zacznij połączenie" @pointerdown.stop @click="startConnect($event,n)"></button></p>
          </div>
        </div>
      </div>
      <div class="inspector" v-if="selectedNode"><div class="inspectorHead"><h3>Klocek</h3><button @click="deleteNode">✕</button></div><label>Nazwa taska<input v-model="selectedNode.name"></label><label>Retries<input type="number" min="0" v-model.number="selectedNode.retries"></label><label>Timeout<input v-model="selectedNode.timeout"></label><h4>Mikroedytor</h4><textarea v-model="selectedNode.code" spellcheck="false"></textarea><div class="rowBtns"><button @click="duplicateNode">Duplikuj</button><button class="primary" @click="flash('Zmiana jest już w RAM-ie')">Zastosuj</button></div><small class="hint">Przeciągaj klocki. Port zielony → niebieski tworzy połączenie.</small></div>
    </section>

    <section v-if="route==='resources'" class="page resources"><div class="split"><div class="card resourceList"><div class="cardhead"><h2>Zasoby danych</h2><button @click="scan">↻ Skanuj</button></div><input placeholder="Tabela, plik, widok..."><button v-for="r in resources" :key="r.name" :class="{selected:selectedResource.name===r.name}" @click="selectedResource=r"><span><b>{{r.name}}</b><small>{{r.type}}</small></span><em>{{r.processes.length}} proc.</em></button></div><div class="card lineage"><div class="cardhead"><div><small>LINEAGE DLA</small><h2>{{selectedResource.name}}</h2></div><span class="pill success">{{selectedResource.mode}}</span></div><div class="lineageGraph"><div class="resourceNode">▦<b>{{selectedResource.name}}</b><small>{{selectedResource.type}}</small></div><div class="arrow">→</div><div><div class="processNode" v-for="p in selectedResource.processes" :key="p" @click="selectedWorkflow=workflows.find(w=>w.name===p)||workflows[0];nav('designer')">◇ <b>{{p}}</b><small>kliknij, by otworzyć DAG</small></div></div></div><div class="tableWrap"><table><tr><th>Proces</th><th>Operacja</th><th>Źródło</th></tr><tr v-for="(p,i) in selectedResource.processes" :key="p"><td><b>{{p}}</b></td><td>{{i?'WRITE':'READ'}}</td><td><code>workflows/{{p}}.py</code></td></tr></table></div></div></div></section>

    <section v-if="route==='ide'" class="ide"><div class="files"><h3>EXPLORER</h3><b>RETAIL ANALYTICS</b><button v-for="f in files" :key="f" :class="{selected:selectedFile===f}" @click="pickFile(f)">⌁ {{f}}</button></div><div class="editor"><div class="tabs"><span>{{selectedFile}} <i v-if="dirty">●</i></span><button @click="save">Ctrl+S → RAM</button></div><textarea v-model="code" @input="dirty=true" spellcheck="false"></textarea><div class="statusbar"><span>Python 3.12</span><span>{{dirty?'Niezapisane w RAM':'RAM aktualny'}} · UTF-8</span></div></div><div class="sidepanel"><h3>Stan</h3><p class="ok">● RAM only</p><small>Odświeżenie strony przywróci dane startowe.</small><hr><h3>Powiązany DAG</h3><button @click="nav('designer')">◇ daily_sales_pipeline →</button></div></section>

    <section v-if="route==='runs'" class="page"><div class="card tableWrap"><div class="cardhead"><h2>Uruchomienia</h2><span class="pill" :class="runState.toLowerCase()">{{runState}}</span></div><table><tr><th>Workflow</th><th>Status</th><th>Start</th></tr><tr v-for="w in workflows" :key="w.id"><td><b>{{w.name}}</b></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td>{{w.last}}</td></tr></table><div class="logs"><b>Logi: daily_sales_pipeline</b><pre>06:00:01  load_orders      SUCCESS  4.2s\n06:00:06  clean_orders     SUCCESS  8.7s\n06:00:15  aggregate_daily  SUCCESS  19.1s\n06:00:35  save_daily       SUCCESS  5.4s</pre></div></div></section>

    <section v-if="route==='projects'" class="page"><div class="grid2"><div class="card"><div class="cardhead"><h2>Projekt</h2><span class="pill success">RAM</span></div><label>Nazwa<input v-model="project.name"></label><label>Opis<textarea v-model="project.description"></textarea></label><label>Widoczność<select v-model="project.visibility"><option>Prywatny</option><option>Publiczny</option></select></label><button class="primary" @click="flash('Ustawienia są w RAM-ie')">Zastosuj</button></div><div class="card"><div class="cardhead"><h2>Zespół</h2><button @click="addMember">+ Dodaj</button></div><div class="member" v-for="(m,i) in members" :key="i"><div class="avatar">{{m.name.slice(0,2).toUpperCase()}}</div><span><input class="memberName" v-model="m.name"><small>Dostęp do projektu</small></span><select v-model="m.role"><option>Owner</option><option>Admin</option><option>Editor</option><option>Viewer</option></select></div></div></div></section>
  </main>
  <div v-if="toast" class="toast">{{toast}}</div>
</div>`
}

createApp(App).mount('#app')
