<script setup>
import { computed, ref } from 'vue'
import { s, project, canEdit, navigate, selectWorkflow, newWorkflow, duplicate, removeWorkflow } from '../store.js'
const search = ref('')
const filtered = computed(() => project.value.workflows.filter(w => w.name.toLowerCase().includes(search.value.toLowerCase())))
const selectedRun = computed(() => project.value.runs.find(r => r.id === s.runId) || project.value.runs[0])
function openRun(id) { s.runId = id; navigate('runs') }
</script>
<template>
  <section class="page">
    <template v-if="s.route === 'runs'">
      <div class="grid runs-grid"><article class="card"><h2>Historia symulacji</h2><p v-if="!project.runs.length" class="empty">Brak uruchomień w tej sesji.</p><div class="item-list"><button v-for="r in project.runs" :key="r.id" :class="{ selected: selectedRun?.id === r.id }" @click="s.runId = r.id"><strong>{{ r.name }}</strong><small>{{ r.started }} · {{ r.duration || 'w toku' }}</small><span class="pill" :class="r.status.toLowerCase()">{{ r.status }}</span></button></div></article>
      <article class="card"><template v-if="selectedRun"><div class="card-head"><h2>{{ selectedRun.name }}</h2><span class="pill" :class="selectedRun.status.toLowerCase()">{{ selectedRun.status }}</span></div><p>Venv: {{ selectedRun.environment }} · {{ selectedRun.duration || 'w toku' }}</p><pre class="logs">{{ selectedRun.logs.join('\n') }}</pre></template><p v-else class="empty">Uruchom symulację workflow, aby zobaczyć logi.</p></article></div>
    </template>
    <template v-else>
      <div v-if="s.route === 'dashboard'" class="metrics"><article><small>Workflowy</small><strong>{{ project.workflows.length }}</strong></article><article><small>Symulacje w sesji</small><strong>{{ project.runs.length }}</strong></article><article><small>Nieudane symulacje</small><strong>{{ project.runs.filter(r => r.status === 'Failed').length }}</strong></article><article><small>Wykryte zasoby</small><strong>{{ project.resources.length }}</strong></article></div>
      <div class="toolbar"><input v-model="search" aria-label="Szukaj workflow" placeholder="Szukaj workflow…"><button class="primary" :disabled="!canEdit" @click="newWorkflow">+ Nowy workflow</button></div>
      <article class="card"><div class="table-wrap"><table><thead><tr><th>Workflow</th><th>Status symulacji</th><th>Harmonogram</th><th>Taski</th><th>Akcje</th></tr></thead><tbody><tr v-for="w in filtered" :key="w.id"><td><button class="text-button" @click="selectWorkflow(w.id, true)">{{ w.name }}</button></td><td><span class="pill" :class="w.status.toLowerCase()">{{ w.status }}</span></td><td><code>{{ w.schedule }}</code></td><td>{{ w.nodes.length }}</td><td><div class="actions"><button :disabled="!canEdit" @click="duplicate(w.id)">Duplikuj</button><button class="danger" :disabled="!canEdit || w.status === 'Running'" @click="removeWorkflow(w.id)">Usuń</button></div></td></tr></tbody></table></div><p v-if="!filtered.length" class="empty">Brak workflowów pasujących do wyszukiwania.</p></article>
      <article v-if="s.route === 'dashboard'" class="card"><div class="card-head"><h2>Ostatnie symulacje</h2><button @click="navigate('runs')">Historia</button></div><p v-if="!project.runs.length" class="empty">Brak uruchomień. Nie pokazujemy zmyślonej historii.</p><div class="item-list"><button v-for="r in project.runs.slice(0, 5)" :key="r.id" @click="openRun(r.id)"><strong>{{ r.name }}</strong><small>{{ r.started }} · {{ r.status }}</small></button></div></article>
    </template>
  </section>
</template>
