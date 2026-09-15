<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { clone, uid, PORT_TYPES, effectiveEnv } from '../model.js'
import { s, project, workflow, node, editable, saveNode, removeSelected, addEnvironment, snapshot } from '../store.js'
const draft = ref(null)
watch(node, value => { draft.value = value ? clone(value) : null }, { immediate: true })
const environments = computed(() => project.value.environments.filter(e => e.scope === 'project' || e.workflowId === workflow.value?.id))
const activeEnv = computed(() => effectiveEnv(project.value, workflow.value))
function changeEnv(event) { if (!editable.value) return; snapshot(); workflow.value.environmentId = event.target.value || null }
function addPort(key) { const ports = draft.value[key]; ports.push({ id: uid('port'), name: `${key === 'inputs' ? 'in' : 'out'}${ports.length + 1}`, type: 'DataFrame' }) }
function keydown(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (draft.value) saveNode(draft.value) } }
onMounted(() => window.addEventListener('keydown', keydown))
onUnmounted(() => window.removeEventListener('keydown', keydown))
</script>
<template>
  <aside class="inspector">
    <section class="workflow-env"><h3>Środowisko workflow</h3><label>Venv<select aria-label="Venv workflow" :value="workflow.environmentId || ''" :disabled="!editable" @change="changeEnv"><option value="">Dziedzicz z projektu</option><option v-for="e in environments" :key="e.id" :value="e.id">{{ e.name }} · {{ e.scope === 'workflow' ? 'własny' : 'projektowy' }}</option></select></label><small>{{ activeEnv?.name || 'Brak środowiska' }} · Python {{ activeEnv?.python }} · {{ activeEnv?.path }}</small><button :disabled="!editable" @click="addEnvironment(true)">+ Własny venv</button></section>
    <form v-if="draft" class="node-form" @submit.prevent="saveNode(draft)"><div class="card-head"><h3>Task</h3><button type="button" class="danger" :disabled="!editable" @click="removeSelected">Usuń task</button></div><fieldset :disabled="!editable"><label>Nazwa funkcji<input v-model="draft.name" aria-label="Nazwa taska" required></label><div class="form-row"><label>Ponowienia<input v-model.number="draft.retries" type="number" min="0" max="10" step="1" required></label><label>Limit czasu (s)<input v-model.number="draft.timeout" type="number" min="1" required></label></div><label class="check"><input v-model="draft.fail" type="checkbox">Symuluj błąd taska</label>
      <section v-for="[key, label] in [['inputs', 'Inputy'], ['outputs', 'Outputy']]" :key="key" class="ports-editor"><div class="card-head"><h4>{{ label }}</h4><button type="button" @click="addPort(key)">+ Port</button></div><div v-for="p in draft[key]" :key="p.id" class="port-editor-row"><input v-model="p.name" :aria-label="`${label}: nazwa portu`" required><select v-model="p.type" :aria-label="`${label}: typ portu`"><option v-for="kind in PORT_TYPES" :key="kind">{{ kind }}</option></select><button type="button" class="danger" :aria-label="`Usuń port ${p.name}`" @click="draft[key] = draft[key].filter(old => old.id !== p.id)">×</button></div></section>
      <label>Mikroedytor Python<textarea v-model="draft.code" class="code-editor micro" aria-label="Kod taska" spellcheck="false"></textarea></label><button class="primary full" type="submit">Zastosuj w RAM</button><small>Limit czasu jest tylko ustawieniem. Symulacja nie uruchamia Pythona.</small></fieldset></form>
    <p v-else class="empty">{{ s.edgeId ? 'Wybrane połączenie. Delete usuwa je z DAG-a.' : 'Wybierz task, aby edytować kod i porty.' }}</p>
  </aside>
</template>
