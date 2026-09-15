<script setup>
import { computed, ref } from 'vue'
import { s, project, selectWorkflow, changed } from '../store.js'
const search = ref(''), processId = ref('')
const resources = computed(() => project.value.resources.filter(r => r.name.toLowerCase().includes(search.value.toLowerCase())))
const selected = computed(() => resources.value.find(r => r.id === s.resourceId) || resources.value[0])
const process = computed(() => project.value.workflows.find(w => w.id === processId.value) || project.value.workflows[0])
const processResources = computed(() => project.value.resources.filter(r => r.ops.some(op => op.workflowId === process.value?.id)))
const workflowName = id => project.value.workflows.find(w => w.id === id)?.name || id
const nodeName = op => project.value.workflows.find(w => w.id === op.workflowId)?.nodes.find(n => n.id === op.nodeId)?.name || op.nodeId
function openTask(op) { selectWorkflow(op.workflowId, true); s.nodeId = op.nodeId }
</script>
<template>
  <section class="page"><p class="muted">Skan rozpoznaje stałe nazwy w db.read/write/update, read_csv i write_file. To prosty skan tekstu, nie pełna analiza Python/SQL.</p>
    <div class="grid lineage-grid"><article class="card"><div class="card-head"><h2>Tabele i pliki</h2><button @click="changed">Skanuj</button></div><input v-model="search" aria-label="Szukaj zasobu" placeholder="Tabela lub plik…"><div class="item-list"><button v-for="r in resources" :key="r.id" :class="{ selected: selected?.id === r.id }" @click="s.resourceId = r.id"><strong>{{ r.name }}</strong><small>{{ r.type }} · procesy: {{ new Set(r.ops.map(o => o.workflowId)).size }}</small></button></div><p v-if="!resources.length" class="empty">Brak wykrytych zasobów.</p></article>
    <article class="card"><template v-if="selected"><div class="card-head"><h2>{{ selected.name }}</h2><span class="pill">{{ selected.type }}</span></div><div class="lineage-flow"><strong class="resource-box">{{ selected.name }}</strong><span aria-hidden="true">→</span><div class="process-stack"><button v-for="id in [...new Set(selected.ops.map(o => o.workflowId))]" :key="id" @click="selectWorkflow(id, true)">{{ workflowName(id) }}</button></div></div><h3>Procesy korzystające z zasobu</h3><div class="table-wrap"><table><thead><tr><th>Proces</th><th>Task</th><th>Operacja</th></tr></thead><tbody><tr v-for="op in selected.ops" :key="`${op.workflowId}:${op.nodeId}:${op.op}`"><td>{{ workflowName(op.workflowId) }}</td><td><button class="text-button" @click="openTask(op)">{{ nodeName(op) }}</button></td><td>{{ op.op }}</td></tr></tbody></table></div></template><p v-else class="empty">Brak zasobu do wyświetlenia.</p></article></div>
    <article class="card"><div class="card-head"><h2>Proces → zasoby</h2><select aria-label="Proces" :value="process?.id" @change="processId = $event.target.value"><option v-for="w in project.workflows" :key="w.id" :value="w.id">{{ w.name }}</option></select></div><div class="resource-chips"><button v-for="r in processResources" :key="r.id" @click="s.resourceId = r.id; search = ''"><strong>{{ r.name }}</strong><small>{{ [...new Set(r.ops.filter(o => o.workflowId === process?.id).map(o => o.op))].join(' / ') }}</small></button></div><p v-if="!processResources.length" class="empty">Nie wykryto zależności.</p></article>
  </section>
</template>
