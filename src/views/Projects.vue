<script>
export default {
  name: 'ProjectsView',
  inject: ['studio'],
  data() { return { draft: {} } },
  computed: {
    s() { return this.studio.s },
    project() { return this.studio.project },
    canEdit() { return this.studio.canEdit },
    canManage() { return this.studio.canManage }
  },
  watch: {
    project: {
      immediate: true,
      handler(project) {
        this.draft = { name: project.name, description: project.description, visibility: project.visibility }
      }
    }
  },
  methods: {
    saveProject() {
      if (!this.canEdit) return
      if (!this.draft.name.trim()) return this.studio.notify('Podaj nazwę projektu.')
      Object.assign(this.project, { ...this.draft, name: this.draft.name.trim() })
      const file = this.project.files.find(file => file.path === 'config/project.json')
      const text = JSON.stringify({ name: this.project.name, visibility: this.project.visibility }, null, 2)
      if (file) {
        if (file.dirty) file.external = text
        else { file.text = file.saved = text; file.external = null }
      }
      this.studio.notify('Projekt zapisany w RAM.')
    },
    changeRole(member, event) {
      if (this.canManage && member.role !== 'Owner' && ['Admin', 'Editor', 'Viewer'].includes(event.target.value)) member.role = event.target.value
    },
    invite() {
      if (!this.canManage) return
      const user = this.s.users.find(user => !this.project.members.some(member => member.userId === user.id))
      if (user) {
        this.project.members.push({ userId: user.id, role: 'Viewer' })
        this.studio.notify(`Dodano przykładowego użytkownika: ${user.name}. Nie wysłano zaproszenia.`)
      } else this.studio.notify('Wszyscy przykładowi użytkownicy są już w projekcie.')
    },
    defaultEnv(event) {
      if (this.canEdit && this.project.environments.some(environment => environment.id === event.target.value && environment.scope === 'project')) this.project.environmentId = event.target.value
    }
  }
}
</script>
<template>
  <section class="page"><div class="grid project-grid"><form class="card" @submit.prevent="saveProject"><h2>Projekt</h2><fieldset :disabled="!canEdit"><label>Nazwa<input v-model="draft.name" aria-label="Nazwa projektu" required></label><label>Opis<textarea v-model="draft.description" aria-label="Opis projektu"></textarea></label><label>Widoczność<select v-model="draft.visibility" aria-label="Widoczność"><option>Private</option><option>Public</option></select></label><button type="submit" class="primary">Zapisz projekt</button></fieldset></form>
    <article class="card"><div class="card-head"><h2>Zespół</h2><button :disabled="!canManage" @click="invite">+ Dodaj użytkownika demo</button></div><div class="member-list"><div v-for="m in project.members" :key="m.userId"><strong>{{ s.users.find(u => u.id === m.userId)?.name }}</strong><select :value="m.role" :disabled="!canManage || m.role === 'Owner'" :aria-label="`Rola ${s.users.find(u => u.id === m.userId)?.name}`" @change="changeRole(m, $event)"><option v-if="m.role === 'Owner'">Owner</option><option>Admin</option><option>Editor</option><option>Viewer</option></select></div></div><p class="muted">To demonstracja przycisków zależnych od roli, nie logowanie ani ochrona danych. Wszystkie przykładowe projekty są w przeglądarce.</p></article>
    <article class="card env-card"><div class="card-head"><h2>Python / venv</h2><button :disabled="!canEdit" @click="studio.addEnvironment(false)">+ Venv projektu</button></div><label>Domyślne środowisko projektu<select :value="project.environmentId" :disabled="!canEdit" aria-label="Domyślne środowisko projektu" @change="defaultEnv"><option v-for="e in project.environments.filter(e => e.scope === 'project')" :key="e.id" :value="e.id">{{ e.name }} · Python {{ e.python }}</option></select></label><div class="env-list"><div v-for="e in project.environments" :key="e.id" class="env-row"><div><strong>{{ e.name }}</strong><small>{{ e.manager }} · Python {{ e.python }} · {{ e.path }}</small><small>{{ e.scope === 'project' ? 'projektowe' : `tylko workflow: ${project.workflows.find(w => w.id === e.workflowId)?.name}` }}</small></div><span class="pill" :class="e.status">{{ e.status === 'ready' ? 'Gotowe (demo)' : 'Synchronizacja (demo)' }}</span><button :disabled="!canEdit || e.status === 'syncing'" @click="studio.syncEnvironment(e)">Symuluj sync</button></div></div><p class="muted">Venv workflow nie jest dostępny dla innych workflowów ani jako domyślny venv projektu. Żaden venv nie jest tworzony na dysku.</p></article>
  </div></section>
</template>
