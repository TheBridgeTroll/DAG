<script>
import { clone, uid, PORT_TYPES, effectiveEnv } from '../model.js'

export default {
  name: 'NodeInspector',
  inject: ['studio'],
  data() { return { draft: null } },
  computed: {
    s() { return this.studio.s },
    project() { return this.studio.project },
    workflow() { return this.studio.workflow },
    node() { return this.studio.node },
    editable() { return this.studio.editable },
    portTypes() { return PORT_TYPES },
    environments() {
      return this.project.environments.filter(environment => environment.scope === 'project' || environment.workflowId === this.workflow?.id)
    },
    activeEnv() { return effectiveEnv(this.project, this.workflow) }
  },
  watch: {
    node: {
      immediate: true,
      handler(node) { this.draft = node ? clone(node) : null }
    }
  },
  mounted() { window.addEventListener('keydown', this.keydown) },
  beforeUnmount() { window.removeEventListener('keydown', this.keydown) },
  methods: {
    changeEnv(event) {
      if (!this.editable) return
      this.studio.snapshot()
      this.workflow.environmentId = event.target.value || null
    },
    addPort(key) {
      if (!this.editable || !this.draft) return
      const ports = this.draft[key]
      ports.push({ id: uid('port'), name: `${key === 'inputs' ? 'in' : 'out'}${ports.length + 1}`, type: 'DataFrame' })
    },
    keydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (this.draft) this.studio.saveNode(this.draft)
      }
    }
  }
}
</script>
<template>
  <aside class="inspector">
    <section class="workflow-env"><h3>Środowisko workflow</h3><label>Venv<select aria-label="Venv workflow" :value="workflow.environmentId || ''" :disabled="!editable" @change="changeEnv"><option value="">Dziedzicz z projektu</option><option v-for="e in environments" :key="e.id" :value="e.id">{{ e.name }} · {{ e.scope === 'workflow' ? 'własny' : 'projektowy' }}</option></select></label><small>{{ activeEnv?.name || 'Brak środowiska' }} · Python {{ activeEnv?.python }} · {{ activeEnv?.path }}</small><button :disabled="!editable" @click="studio.addEnvironment(true)">+ Własny venv</button></section>
    <form v-if="draft" class="node-form" @submit.prevent="studio.saveNode(draft)"><div class="card-head"><h3>Task</h3><button type="button" class="danger" :disabled="!editable" @click="studio.removeSelected">Usuń task</button></div><fieldset :disabled="!editable"><label>Nazwa funkcji<input v-model="draft.name" aria-label="Nazwa taska" required></label><div class="form-row"><label>Ponowienia<input v-model.number="draft.retries" type="number" min="0" max="10" step="1" required></label><label>Limit czasu (s)<input v-model.number="draft.timeout" type="number" min="1" required></label></div><label class="check"><input v-model="draft.fail" type="checkbox">Symuluj błąd taska</label>
      <section v-for="[key, label] in [['inputs', 'Inputy'], ['outputs', 'Outputy']]" :key="key" class="ports-editor"><div class="card-head"><h4>{{ label }}</h4><button type="button" @click="addPort(key)">+ Port</button></div><div v-for="p in draft[key]" :key="p.id" class="port-editor-row"><input v-model="p.name" :aria-label="`${label}: nazwa portu`" required><select v-model="p.type" :aria-label="`${label}: typ portu`"><option v-for="kind in portTypes" :key="kind">{{ kind }}</option></select><button type="button" class="danger" :aria-label="`Usuń port ${p.name}`" @click="draft[key] = draft[key].filter(old => old.id !== p.id)">×</button></div></section>
      <label>Mikroedytor Python<textarea v-model="draft.code" class="code-editor micro" aria-label="Kod taska" spellcheck="false"></textarea></label><button class="primary full" type="submit">Zastosuj w RAM</button><small>Limit czasu jest tylko ustawieniem. Symulacja nie uruchamia Pythona.</small></fieldset></form>
    <p v-else class="empty">{{ s.edgeId ? 'Wybrane połączenie. Delete usuwa je z DAG-a.' : 'Wybierz task, aby edytować kod i porty.' }}</p>
  </aside>
</template>
