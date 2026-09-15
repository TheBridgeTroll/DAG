<script>
export default {
  name: 'IdeView',
  inject: ['studio'],
  computed: {
    s() { return this.studio.s },
    project() { return this.studio.project },
    file() { return this.project.files.find(file => file.id === this.s.fileId) || this.project.files[0] },
    editable() {
      return this.studio.canEdit && this.project.workflows.find(workflow => workflow.id === this.file?.workflowId)?.status !== 'Running'
    }
  },
  mounted() { window.addEventListener('keydown', this.keydown) },
  beforeUnmount() { window.removeEventListener('keydown', this.keydown) },
  methods: {
    edit(event) {
      if (!this.editable || !this.file) return
      this.file.text = event.target.value
      this.file.dirty = true
    },
    keydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (this.editable && this.file) this.studio.saveFile(this.file)
      }
    }
  }
}
</script>
<template>
  <section class="ide-layout"><aside class="file-tree"><h3>Pliki w RAM</h3><button v-for="f in project.files" :key="f.id" :class="{ selected: file?.id === f.id }" @click="s.fileId = f.id">{{ f.path }}{{ f.dirty ? ' *' : '' }}{{ f.external !== null ? ' [konflikt]' : '' }}</button></aside><div v-if="file" class="editor"><div class="editor-bar"><strong>{{ file.path }}</strong><div class="actions"><button :disabled="!editable" @click="studio.externalChange(file)">Symuluj zmianę zewnętrzną</button><button class="primary" :disabled="!editable || file.external !== null" @click="studio.saveFile(file)">Zapisz w RAM</button></div></div><div v-if="file.external !== null" class="conflict-banner" role="alert"><strong>Konflikt. Plik zmienił się poza tym edytorem.</strong><div class="actions"><button :disabled="!editable" @click="studio.resolveFile(file, false)">Zachowaj lokalny</button><button :disabled="!editable" @click="studio.resolveFile(file, true)">Użyj zewnętrznego</button></div><details><summary>Pokaż wersję zewnętrzną</summary><pre>{{ file.external }}</pre></details></div><textarea :value="file.text" aria-label="Edytor pliku" class="code-editor file-editor" :readonly="!editable" spellcheck="false" @input="edit"></textarea><p class="editor-foot">Ctrl+S zapisuje w pamięci. Rozpoznawane są proste bloki @task + def. Brak połączenia z plikami na dysku i zewnętrznym IDE.</p></div><p v-else class="empty">Brak plików.</p></section>
</template>
