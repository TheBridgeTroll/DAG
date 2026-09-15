<script setup>
import { ref, watch } from 'vue'
import { s, project, canEdit, canManage, notify, addEnvironment, syncEnvironment } from '../store.js'
const draft = ref({})
watch(project, p => { draft.value = { name: p.name, description: p.description, visibility: p.visibility } }, { immediate: true })
function saveProject() {
  if (!canEdit.value) return
  if (!draft.value.name.trim()) return notify('Podaj nazwę projektu.')
  Object.assign(project.value, { ...draft.value, name: draft.value.name.trim() })
  const f = project.value.files.find(f => f.path === 'config/project.json'), text = JSON.stringify({ name: project.value.name, visibility: project.value.visibility }, null, 2)
  if (f) { if (f.dirty) f.external = text; else { f.text = f.saved = text; f.external = null } }
  notify('Projekt zapisany w RAM.')
}
function changeRole(member, event) { if (canManage.value && member.role !== 'Owner' && ['Admin', 'Editor', 'Viewer'].includes(event.target.value)) member.role = event.target.value }
function invite() { if (!canManage.value) return; const u = s.users.find(u => !project.value.members.some(m => m.userId === u.id)); if (u) { project.value.members.push({ userId: u.id, role: 'Viewer' }); notify(`Dodano przykładowego użytkownika: ${u.name}. Nie wysłano zaproszenia.`) } else notify('Wszyscy przykładowi użytkownicy są już w projekcie.') }
function defaultEnv(event) { if (canEdit.value && project.value.environments.some(e => e.id === event.target.value && e.scope === 'project')) project.value.environmentId = event.target.value }
</script>
<template>
  <section class="page"><div class="grid project-grid"><form class="card" @submit.prevent="saveProject"><h2>Projekt</h2><fieldset :disabled="!canEdit"><label>Nazwa<input v-model="draft.name" aria-label="Nazwa projektu" required></label><label>Opis<textarea v-model="draft.description" aria-label="Opis projektu"></textarea></label><label>Widoczność<select v-model="draft.visibility" aria-label="Widoczność"><option>Private</option><option>Public</option></select></label><button type="submit" class="primary">Zapisz projekt</button></fieldset></form>
    <article class="card"><div class="card-head"><h2>Zespół</h2><button :disabled="!canManage" @click="invite">+ Dodaj użytkownika demo</button></div><div class="member-list"><div v-for="m in project.members" :key="m.userId"><strong>{{ s.users.find(u => u.id === m.userId)?.name }}</strong><select :value="m.role" :disabled="!canManage || m.role === 'Owner'" :aria-label="`Rola ${s.users.find(u => u.id === m.userId)?.name}`" @change="changeRole(m, $event)"><option v-if="m.role === 'Owner'">Owner</option><option>Admin</option><option>Editor</option><option>Viewer</option></select></div></div><p class="muted">To demonstracja przycisków zależnych od roli, nie logowanie ani ochrona danych. Wszystkie przykładowe projekty są w przeglądarce.</p></article>
    <article class="card env-card"><div class="card-head"><h2>Python / venv</h2><button :disabled="!canEdit" @click="addEnvironment(false)">+ Venv projektu</button></div><label>Domyślne środowisko projektu<select :value="project.environmentId" :disabled="!canEdit" aria-label="Domyślne środowisko projektu" @change="defaultEnv"><option v-for="e in project.environments.filter(e => e.scope === 'project')" :key="e.id" :value="e.id">{{ e.name }} · Python {{ e.python }}</option></select></label><div class="env-list"><div v-for="e in project.environments" :key="e.id" class="env-row"><div><strong>{{ e.name }}</strong><small>{{ e.manager }} · Python {{ e.python }} · {{ e.path }}</small><small>{{ e.scope === 'project' ? 'projektowe' : `tylko workflow: ${project.workflows.find(w => w.id === e.workflowId)?.name}` }}</small></div><span class="pill" :class="e.status">{{ e.status === 'ready' ? 'Gotowe (demo)' : 'Synchronizacja (demo)' }}</span><button :disabled="!canEdit || e.status === 'syncing'" @click="syncEnvironment(e)">Symuluj sync</button></div></div><p class="muted">Venv workflow nie jest dostępny dla innych workflowów ani jako domyślny venv projektu. Żaden venv nie jest tworzony na dysku.</p></article>
  </div></section>
</template>
