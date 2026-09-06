const { createApp, ref, computed } = Vue

const workflows = [
  {id:1,name:'daily_sales_pipeline',status:'Running',schedule:'0 6 * * *',tasks:5,last:'2 min temu'},
  {id:2,name:'customer_segmentation',status:'Success',schedule:'0 2 * * 1',tasks:4,last:'1 h temu'},
  {id:3,name:'finance_export',status:'Failed',schedule:'0 7 * * 1-5',tasks:3,last:'18 min temu'},
]
const resources = [
  {name:'raw.sales_orders',type:'Tabela',mode:'R/W',processes:['daily_sales_pipeline','finance_export']},
  {name:'warehouse.sales_daily',type:'Tabela',mode:'W',processes:['daily_sales_pipeline']},
  {name:'customers.csv',type:'Plik',mode:'R',processes:['customer_segmentation']},
  {name:'analytics.customer_segments',type:'Widok',mode:'W',processes:['customer_segmentation']},
  {name:'exports/finance.xlsx',type:'Plik',mode:'W',processes:['finance_export']},
]
const members=[['Michał','Owner'],['Anna','Editor'],['Robert','Viewer'],['Kasia','Admin']]
const files=['workflows/sales.py','workflows/segments.py','tasks/io.py','tasks/transforms.py','config/project.json']
const snippets={
  'workflows/sales.py':`from dag import task\n\n@task\ndef load_orders() -> DataFrame:\n    return db.read("raw.sales_orders")\n\n@task(retries=2)\ndef clean_orders(df: DataFrame) -> DataFrame:\n    return df.dropna()\n\n@task\ndef save_daily(df: DataFrame):\n    db.write("warehouse.sales_daily", df)`,
  'workflows/segments.py':`@task\ndef load_customers():\n    return read_csv("customers.csv")\n\n@task\ndef segment(df):\n    return model.predict(df)`,
  'tasks/io.py':`def read_csv(path):\n    ...\n\ndef write_table(name, df):\n    ...`,
  'tasks/transforms.py':`def normalize(df):\n    return df.fillna(0)`,
  'config/project.json':`{\n  "name": "Retail Analytics",\n  "sync": "live",\n  "defaultRetries": 2\n}`
}

const App={setup(){
  const route=ref(location.hash.slice(1)||'dashboard'); addEventListener('hashchange',()=>route.value=location.hash.slice(1)||'dashboard')
  const project=ref('Retail Analytics'); const selectedWorkflow=ref(workflows[0]); const selectedResource=ref(resources[0]); const selectedFile=ref(files[0]);
  const code=ref(snippets[selectedFile.value]); const dirty=ref(false); const toast=ref(''); const runState=ref('Idle'); const selectedNode=ref('clean_orders');
  const nav=r=>{location.hash=r}; const flash=t=>{toast.value=t;setTimeout(()=>toast.value='',2200)}
  const pickFile=f=>{selectedFile.value=f;code.value=snippets[f];dirty.value=false}
  const save=()=>{snippets[selectedFile.value]=code.value;dirty.value=false;flash('Zapisano zmiany lokalnie (demo)')}
  const run=()=>{runState.value='Running';flash('Uruchomiono workflow (symulacja)');setTimeout(()=>runState.value='Success',1400)}
  const title=computed(()=>({dashboard:'Pulpit',workflows:'Workflowy',designer:'Projektant DAG',resources:'Zasoby i lineage',ide:'IDE',projects:'Projekt i zespół',runs:'Uruchomienia'}[route.value]||'DAG Studio'))
  return {route,nav,title,project,workflows,resources,members,files,selectedWorkflow,selectedResource,selectedFile,selectedNode,code,dirty,toast,runState,pickFile,save,run,flash}
},template:`
<div class="shell">
  <aside class="sidebar">
    <div class="brand"><div class="logo">D</div><div><b>DAG Studio</b><small>workflow platform</small></div></div>
    <div class="project">{{project}} <span>⌄</span></div>
    <nav>
      <button :class="{active:route==='dashboard'}" @click="nav('dashboard')">◫ <span>Pulpit</span></button>
      <button :class="{active:route==='workflows'}" @click="nav('workflows')">⌘ <span>Workflowy</span></button>
      <button :class="{active:route==='designer'}" @click="nav('designer')">◇ <span>Projektant DAG</span></button>
      <button :class="{active:route==='resources'}" @click="nav('resources')">▦ <span>Zasoby / lineage</span></button>
      <button :class="{active:route==='ide'}" @click="nav('ide')">⌨ <span>IDE</span></button>
      <button :class="{active:route==='runs'}" @click="nav('runs')">▶ <span>Uruchomienia</span></button>
      <button :class="{active:route==='projects'}" @click="nav('projects')">♙ <span>Projekt i zespół</span></button>
    </nav>
    <div class="user"><div class="avatar">MC</div><div><b>Michał</b><small>Owner</small></div><span>⋮</span></div>
  </aside>
  <main>
    <header><div><small>Retail Analytics /</small><h1>{{title}}</h1></div><div class="actions"><span class="sync">● Live sync</span><button class="ghost" @click="flash('Brak konfliktów. Wszystko zsynchronizowane.')">↻ Sync</button><button class="primary" @click="run">▶ Uruchom</button></div></header>

    <section v-if="route==='dashboard'" class="page">
      <div class="metrics"><div><small>Workflowy</small><b>12</b><span>9 aktywnych</span></div><div><small>Uruchomienia dziś</small><b>47</b><span class="ok">44 poprawne</span></div><div><small>Błędy</small><b>3</b><span class="bad">wymagają uwagi</span></div><div><small>Zasoby danych</small><b>28</b><span>ostatni skan 2m</span></div></div>
      <div class="grid2"><article class="card"><div class="cardhead"><h2>Ostatnie workflowy</h2><button @click="nav('workflows')">Wszystkie →</button></div><table><tr><th>Nazwa</th><th>Status</th><th>Taski</th><th>Ostatnio</th></tr><tr v-for="w in workflows" @click="selectedWorkflow=w;nav('designer')"><td><b>{{w.name}}</b></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td>{{w.tasks}}</td><td>{{w.last}}</td></tr></table></article>
      <article class="card"><div class="cardhead"><h2>Aktywność</h2></div><div class="activity"><p><span class="dot okbg"></span><b>daily_sales_pipeline</b> zakończony poprawnie</p><small>2 min temu · 41s</small><p><span class="dot warnbg"></span><b>finance_export</b> ponowienie taska write_xlsx</p><small>18 min temu · retry 2/3</small><p><span class="dot"></span><b>Anna</b> zmieniła workflows/segments.py</p><small>34 min temu · wykryto live</small></div></article></div>
    </section>

    <section v-if="route==='workflows'" class="page"><div class="toolbar"><input placeholder="Szukaj workflow..."><button class="primary" @click="nav('designer')">+ Nowy workflow</button></div><div class="card"><table><tr><th>Nazwa</th><th>Status</th><th>Harmonogram</th><th>Taski</th><th>Ostatnie uruchomienie</th></tr><tr v-for="w in workflows" @click="selectedWorkflow=w;nav('designer')"><td><b>{{w.name}}</b><small class="block">Python + GUI</small></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td><code>{{w.schedule}}</code></td><td>{{w.tasks}}</td><td>{{w.last}}</td></tr></table></div></section>

    <section v-if="route==='designer'" class="designer">
      <div class="tasklib"><h3>Biblioteka tasków</h3><input placeholder="Szukaj taska"><small>ŹRÓDŁA</small><button>▣ Read SQL table</button><button>▤ Read CSV</button><small>TRANSFORMACJE</small><button>⌁ Python task</button><button>◫ Filter rows</button><button>⤨ Join</button><small>WYJŚCIA</small><button>▣ Write SQL table</button><button>▤ Write file</button></div>
      <div class="canvas"><div class="canvasbar"><b>{{selectedWorkflow.name}}</b><span>Saved</span><div><button>−</button><button>100%</button><button>+</button></div></div><div class="nodes">
        <div class="node n1" @click="selectedNode='load_orders'"><small>PYTHON TASK</small><b>load_orders</b><p><i></i> out <span>DataFrame</span></p></div>
        <div class="edge e1"></div><div class="node n2" :class="{chosen:selectedNode==='clean_orders'}" @click="selectedNode='clean_orders'"><small>PYTHON TASK</small><b>clean_orders</b><p><i></i> df <span>DataFrame</span></p><p><i class="out"></i> out <span>DataFrame</span></p></div>
        <div class="edge e2"></div><div class="node n3" @click="selectedNode='aggregate_daily'"><small>PYTHON TASK</small><b>aggregate_daily</b><p><i></i> df <span>DataFrame</span></p><p><i class="out"></i> out <span>DataFrame</span></p></div>
        <div class="edge e3"></div><div class="node n4" @click="selectedNode='save_daily'"><small>SQL OUTPUT</small><b>save_daily</b><p><i></i> df <span>DataFrame</span></p></div>
      </div></div>
      <div class="inspector"><h3>{{selectedNode}}</h3><label>Nazwa taska<input :value="selectedNode"></label><label>Retries<input value="2"></label><label>Timeout<input value="10 min"></label><h4>Mikroedytor</h4><textarea spellcheck="false">@task(retries=2)\ndef clean_orders(df):\n    return df.dropna()</textarea><button class="primary" @click="flash('Zmiana taska zapisana (demo)')">Zastosuj</button><small class="hint">Ten sam kod jest widoczny w IDE.</small></div>
    </section>

    <section v-if="route==='resources'" class="page resources"><div class="split"><div class="card resourceList"><div class="cardhead"><h2>Zasoby danych</h2><button @click="flash('Skan zakończony: 28 zasobów, 42 zależności')">↻ Skanuj</button></div><input placeholder="Tabela, plik, widok..."><button v-for="r in resources" :class="{selected:selectedResource.name===r.name}" @click="selectedResource=r"><span><b>{{r.name}}</b><small>{{r.type}}</small></span><em>{{r.processes.length}} procesy</em></button></div><div class="card lineage"><div class="cardhead"><div><small>LINEAGE DLA</small><h2>{{selectedResource.name}}</h2></div><span class="pill success">{{selectedResource.mode}}</span></div><div class="lineageGraph"><div class="resourceNode">▦<b>{{selectedResource.name}}</b><small>{{selectedResource.type}}</small></div><div class="arrow">→</div><div><div class="processNode" v-for="p in selectedResource.processes" @click="selectedWorkflow=workflows.find(w=>w.name===p)||workflows[0];nav('designer')">◇ <b>{{p}}</b><small>Czyta / zapisuje · kliknij</small></div></div></div><h3>Procesy korzystające z zasobu</h3><table><tr><th>Proces</th><th>Operacja</th><th>Plik źródłowy</th></tr><tr v-for="(p,i) in selectedResource.processes"><td><b>{{p}}</b></td><td>{{i?'WRITE':'READ'}}</td><td><code>workflows/{{p}}.py</code></td></tr></table></div></div></section>

    <section v-if="route==='ide'" class="ide"><div class="files"><h3>EXPLORER</h3><b>RETAIL ANALYTICS</b><button v-for="f in files" :class="{selected:selectedFile===f}" @click="pickFile(f)">⌁ {{f}}</button></div><div class="editor"><div class="tabs"><span>{{selectedFile}} <i v-if="dirty">●</i></span><button @click="save">Ctrl+S Zapisz</button></div><textarea v-model="code" @input="dirty=true" spellcheck="false"></textarea><div class="statusbar"><span>Python 3.12</span><span>{{dirty?'Niezapisane zmiany':'Zsynchronizowano'}} · UTF-8</span></div></div><div class="sidepanel"><h3>Synchronizacja</h3><p class="ok">● Pliki są aktualne</p><small>Zmiany z zewnętrznego IDE pojawią się tutaj automatycznie.</small><hr><h3>Powiązany DAG</h3><button @click="nav('designer')">◇ daily_sales_pipeline →</button><hr><h3>Problemy</h3><p>Brak błędów składni.</p></div></section>

    <section v-if="route==='runs'" class="page"><div class="card"><div class="cardhead"><h2>Uruchomienia</h2><span class="pill" :class="runState.toLowerCase()">{{runState}}</span></div><table><tr><th>Workflow</th><th>Status</th><th>Start</th><th>Czas</th></tr><tr v-for="w in workflows"><td><b>{{w.name}}</b></td><td><span class="pill" :class="w.status.toLowerCase()">{{w.status}}</span></td><td>{{w.last}}</td><td>{{w.status==='Running'?'2m 14s':'41s'}}</td></tr></table><div class="logs"><b>Logi: daily_sales_pipeline</b><pre>06:00:01  load_orders      SUCCESS  4.2s\n06:00:06  clean_orders     SUCCESS  8.7s\n06:00:15  aggregate_daily  SUCCESS  19.1s\n06:00:35  save_daily       SUCCESS  5.4s</pre></div></div></section>

    <section v-if="route==='projects'" class="page"><div class="grid2"><div class="card"><div class="cardhead"><h2>Projekt</h2><span class="pill success">Private</span></div><label>Nazwa<input value="Retail Analytics"></label><label>Opis<textarea>Workflowy analityczne zespołu Retail.</textarea></label><label>Widoczność<select><option>Prywatny</option><option>Publiczny</option></select></label><button class="primary" @click="flash('Ustawienia zapisane (demo)')">Zapisz</button></div><div class="card"><div class="cardhead"><h2>Zespół</h2><button>+ Zaproś</button></div><div class="member" v-for="m in members"><div class="avatar">{{m[0].slice(0,2).toUpperCase()}}</div><span><b>{{m[0]}}</b><small>{{m[1]==='Owner'?'Pełny dostęp':'Dostęp do projektu'}}</small></span><select :value="m[1]"><option>Owner</option><option>Admin</option><option>Editor</option><option>Viewer</option></select></div></div></div></section>
  </main>
  <div v-if="toast" class="toast">{{toast}}</div>
</div>`}
createApp(App).mount('#app')
