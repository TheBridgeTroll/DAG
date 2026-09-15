<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { s, project, workflow, role, canEdit, navigate, selectProject, runWorkflow, changed, notify } from './store.js'
import Overview from './views/Overview.vue'
import Designer from './views/Designer.vue'
import Lineage from './views/Lineage.vue'
import Ide from './views/Ide.vue'
import Projects from './views/Projects.vue'
const routes = [ ['dashboard', 'Pulpit', '▦'], ['workflows', 'Workflowy', '◇'], ['designer', 'Projektant DAG', '⌘'], ['lineage', 'Zależności danych', '⤳'], ['ide', 'IDE', '⌨'], ['runs', 'Uruchomienia', '▷'], ['projects', 'Projekty i zespół', '♙'] ]
const title = computed(() => routes.find(r => r[0] === s.route)?.[1] || 'Pulpit')
const view = computed(() => ({ designer: Designer, lineage: Lineage, ide: Ide, projects: Projects }[s.route] || Overview))
function readHash() { const route = location.hash.slice(1); s.route = routes.some(r => r[0] === route) ? route : 'dashboard' }
onMounted(() => { readHash(); window.addEventListener('hashchange', readHash) })
onUnmounted(() => window.removeEventListener('hashchange', readHash))
</script>
<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="logo">D</span><div><strong>DAG Studio</strong><small>Vue · devgui</small></div></div>
      <label>Projekt<select aria-label="Projekt" :value="s.projectId" @change="selectProject($event.target.value)"><option v-for="p in s.projects" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
      <nav aria-label="Nawigacja"><button v-for="[id, label, icon] in routes" :key="id" :class="{ active: s.route === id }" :aria-current="s.route === id ? 'page' : undefined" @click="navigate(id)"><span aria-hidden="true">{{ icon }}</span>{{ label }}</button></nav>
      <div class="sidebar-foot"><label>Użytkownik przykładowy<select v-model="s.userId" aria-label="Użytkownik przykładowy"><option v-for="u in s.users" :key="u.id" :value="u.id">{{ u.name }}</option></select></label><small>{{ role }} · rola symulowana</small></div>
    </aside>
    <main>
      <header class="topbar"><div><small>{{ project.name }} /</small><h1>{{ title }}</h1></div><div class="actions"><span class="pill">Tylko RAM</span><button @click="changed(); notify('Odświeżono skan kodu tasków.')">Skanuj kod</button><button class="primary" :disabled="!canEdit || !workflow || workflow.status === 'Running'" @click="runWorkflow">Symuluj uruchomienie</button></div></header>
      <div class="demo-notice">Wydmuszka developerska. Projekty są przykładowe. Odświeżenie strony usuwa zmiany. Python, SQL, venvy i harmonogramy nie są wykonywane.</div>
      <component :is="view" />
    </main>
    <div v-if="s.toast" class="toast" role="status">{{ s.toast }}</div>
  </div>
</template>
