<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { s, project, canEdit, saveFile, externalChange, resolveFile } from '../store.js'
const file = computed(() => project.value.files.find(f => f.id === s.fileId) || project.value.files[0])
const editable = computed(() => canEdit.value && project.value.workflows.find(w => w.id === file.value?.workflowId)?.status !== 'Running')
function edit(event) { if (!editable.value || !file.value) return; file.value.text = event.target.value; file.value.dirty = true }
function keydown(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (editable.value && file.value) saveFile(file.value) } }
onMounted(() => window.addEventListener('keydown', keydown)); onUnmounted(() => window.removeEventListener('keydown', keydown))
</script>
<template>
  <section class="ide-layout"><aside class="file-tree"><h3>Pliki w RAM</h3><button v-for="f in project.files" :key="f.id" :class="{ selected: file?.id === f.id }" @click="s.fileId = f.id">{{ f.path }}{{ f.dirty ? ' *' : '' }}{{ f.external !== null ? ' [konflikt]' : '' }}</button></aside><div v-if="file" class="editor"><div class="editor-bar"><strong>{{ file.path }}</strong><div class="actions"><button :disabled="!editable" @click="externalChange(file)">Symuluj zmianę zewnętrzną</button><button class="primary" :disabled="!editable || file.external !== null" @click="saveFile(file)">Zapisz w RAM</button></div></div><div v-if="file.external !== null" class="conflict-banner" role="alert"><strong>Konflikt. Plik zmienił się poza tym edytorem.</strong><div class="actions"><button :disabled="!editable" @click="resolveFile(file, false)">Zachowaj lokalny</button><button :disabled="!editable" @click="resolveFile(file, true)">Użyj zewnętrznego</button></div><details><summary>Pokaż wersję zewnętrzną</summary><pre>{{ file.external }}</pre></details></div><textarea :value="file.text" aria-label="Edytor pliku" class="code-editor file-editor" :readonly="!editable" spellcheck="false" @input="edit"></textarea><p class="editor-foot">Ctrl+S zapisuje w pamięci. Rozpoznawane są proste bloki @task + def. Brak połączenia z plikami na dysku i zewnętrznym IDE.</p></div><p v-else class="empty">Brak plików.</p></section>
</template>
