<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { TASK_TYPES, endpoints } from '../model.js'
import { s, project, workflow, editable, selectWorkflow, addNode, connect, snapshot, undo, removeSelected, changed, notify } from '../store.js'
import NodeInspector from '../components/NodeInspector.vue'
const search = ref(''), viewport = ref(null)
const tasks = computed(() => TASK_TYPES.filter(t => t.label.toLowerCase().includes(search.value.toLowerCase())))
let drag = null
function startNode(event, n) {
  if (event.button !== 0 || event.target.closest('button')) return
  s.nodeId = n.id; s.edgeId = null
  if (!editable.value) return
  drag = { kind: 'node', id: n.id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: n.x, y: n.y, saved: false, workflow: workflow.value }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function startPan(event) {
  if (event.button !== 0 || event.target.closest('.dag-node, .edge')) return
  drag = { kind: 'pan', pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: s.pan.x, y: s.pan.y }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function move(event) {
  if (!drag || drag.pointer !== event.pointerId) return
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY
  if (drag.kind === 'pan') { s.pan = { x: drag.x + dx, y: drag.y + dy }; return }
  if (!editable.value || drag.workflow !== workflow.value) { drag = null; return }
  if (!drag.saved && Math.abs(dx) + Math.abs(dy) > 2) { snapshot(); drag.saved = true }
  if (!drag.saved) return
  const n = workflow.value.nodes.find(n => n.id === drag.id)
  if (n) { n.x = Math.min(3750, Math.max(0, drag.x + dx / s.zoom)); n.y = Math.min(2200, Math.max(0, drag.y + dy / s.zoom)) }
}
function finish() { drag = null }
function edgePath(e) {
  const { from, to, output, input } = endpoints(workflow.value, e); if (!output || !input) return ''
  const a = { x: from.x + 208, y: from.y + 68 + from.outputs.indexOf(output) * 28 }, b = { x: to.x, y: to.y + 68 + to.inputs.indexOf(input) * 28 }, bend = Math.max(65, Math.abs(b.x - a.x) / 2)
  return `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`
}
function startConnection(n, p) {
  if (!editable.value) return
  s.connecting = s.connecting?.portId === p.id ? null : { nodeId: n.id, portId: p.id }; s.nodeId = n.id; s.edgeId = null
  if (s.connecting) notify('Wybierz input docelowego taska. Escape anuluje.')
}
function fit() {
  const nodes = workflow.value.nodes, bounds = viewport.value?.getBoundingClientRect(); if (!nodes.length || !bounds) return
  const minX = Math.min(...nodes.map(n => n.x)), minY = Math.min(...nodes.map(n => n.y)), maxX = Math.max(...nodes.map(n => n.x + 208)), maxY = Math.max(...nodes.map(n => n.y + Math.max(130, 108 + Math.max(n.inputs.length, n.outputs.length) * 28)))
  s.zoom = Math.max(0.25, Math.min(1.25, (bounds.width - 60) / (maxX - minX), (bounds.height - 60) / (maxY - minY)))
  s.pan = { x: 30 - minX * s.zoom, y: 30 - minY * s.zoom }
}
function zoom(amount) { s.zoom = Math.max(0.25, Math.min(1.75, s.zoom + amount)) }
function keydown(event) {
  if (event.key === 'Escape') { s.connecting = null; return }
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'Delete') { event.preventDefault(); removeSelected() }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey) }
}
function changeSchedule(event) { if (!editable.value) return; snapshot(); workflow.value.schedule = event.target.value.trim() || '@daily'; changed() }
onMounted(() => window.addEventListener('keydown', keydown))
onUnmounted(() => { drag = null; window.removeEventListener('keydown', keydown) })
</script>
<template>
  <section v-if="workflow" class="designer">
    <aside class="task-library"><h3>Biblioteka tasków</h3><input v-model="search" aria-label="Szukaj taska" placeholder="Szukaj taska…"><div class="task-list"><button v-for="t in tasks" :key="t.type" :data-task-type="t.type" :disabled="!editable" @click="addNode(t.type)"><small>{{ t.group }}</small><strong>+ {{ t.label }}</strong></button></div></aside>
    <div class="canvas-wrap"><div class="canvas-bar"><label>Workflow<select aria-label="Workflow" :value="s.workflowId" @change="selectWorkflow($event.target.value)"><option v-for="w in project.workflows" :key="w.id" :value="w.id">{{ w.name }}</option></select></label><div class="canvas-tools"><button aria-label="Cofnij" :disabled="!editable || !workflow._undo?.length" @click="undo()">↶</button><button aria-label="Ponów" :disabled="!editable || !workflow._redo?.length" @click="undo(true)">↷</button><button @click="fit">Dopasuj</button><button aria-label="Oddal" @click="zoom(-0.1)">−</button><span>{{ Math.round(s.zoom * 100) }}%</span><button aria-label="Przybliż" @click="zoom(0.1)">+</button></div></div>
      <label class="schedule-field">Harmonogram (tylko ustawienie)<input aria-label="Harmonogram" :value="workflow.schedule" :disabled="!editable" @change="changeSchedule"></label>
      <div ref="viewport" class="dag-viewport" data-testid="dag-viewport" @pointerdown="startPan" @pointermove="move" @pointerup="finish" @pointercancel="finish" @wheel.ctrl.prevent="zoom($event.deltaY > 0 ? -0.05 : 0.05)">
        <div class="dag-canvas" :style="{ transform: `translate(${s.pan.x}px, ${s.pan.y}px) scale(${s.zoom})` }">
          <svg class="edges" width="4000" height="2500" aria-label="Połączenia portów"><path v-for="edge in workflow.edges" :key="edge.id" class="edge" :class="{ selected: s.edgeId === edge.id }" :d="edgePath(edge)" tabindex="0" role="button" aria-label="Wybierz połączenie" @click.stop="s.edgeId = edge.id; s.nodeId = null" @keydown.enter="s.edgeId = edge.id; s.nodeId = null" /></svg>
          <article v-for="n in workflow.nodes" :key="n.id" class="dag-node" :data-node-id="n.id" :class="{ selected: s.nodeId === n.id }" :style="{ left: `${n.x}px`, top: `${n.y}px`, height: `${Math.max(138, 108 + Math.max(n.inputs.length, n.outputs.length) * 28)}px` }" tabindex="0" :aria-label="`Task ${n.name}`" @pointerdown.stop="startNode($event, n)" @keydown.enter="s.nodeId = n.id; s.edgeId = null">
            <small>{{ TASK_TYPES.find(t => t.type === n.type)?.label }}</small><strong class="node-name">{{ n.name }}</strong>
            <button v-for="(p, index) in n.inputs" :key="p.id" class="port-row in" :style="{ top: `${54 + index * 28}px` }" :disabled="!editable" :aria-label="`Input ${n.name}.${p.name}: ${p.type}`" :title="p.type" @pointerdown.stop @click.stop="connect(n.id, p.id)"><i></i>{{ p.name }}</button>
            <button v-for="(p, index) in n.outputs" :key="p.id" class="port-row out" :class="{ connecting: s.connecting?.portId === p.id }" :style="{ top: `${54 + index * 28}px` }" :disabled="!editable" :aria-label="`Output ${n.name}.${p.name}: ${p.type}`" :title="p.type" @pointerdown.stop @click.stop="startConnection(n, p)">{{ p.name }}<i></i></button>
            <span class="node-status" :class="n.status.toLowerCase()">{{ n.status }}</span>
          </article>
        </div>
        <p v-if="!workflow.nodes.length" class="canvas-empty">Dodaj pierwszy task z biblioteki.</p>
      </div>
      <div class="canvas-hint">{{ s.connecting ? 'Wybierz input docelowego taska. Escape anuluje.' : 'Przeciągaj taski lub tło. Połącz output z inputem. Delete usuwa zaznaczenie z DAG-a.' }}<button v-if="s.edgeId" class="danger" :disabled="!editable" @click="removeSelected">Usuń połączenie</button></div>
    </div><NodeInspector />
  </section><section v-else class="page empty">Brak workflow. Utwórz go w zakładce Workflowy.</section>
</template>
