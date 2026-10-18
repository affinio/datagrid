<template>
  <main class="persistence-demo">
    <header>
      <h2>Saved table preferences</h2>
      <p>Resize, reorder, pin or hide columns and set a filter. Reload the table to restore your view.</p>
      <div class="persistence-demo__controls">
        <label>Profile <select v-model="profile" data-testid="persistence-profile"><option>A</option><option>B</option></select></label>
        <label>Storage <select v-model="adapter"><option value="local">Local</option><option value="remote">Async demo (900 ms)</option></select></label>
        <button data-testid="persistence-remount" :disabled="status?.status === 'saving'" @click="instance += 1">Reload table</button>
        <button data-testid="persistence-reset" :disabled="status?.status === 'loading'" @click="grid?.resetPersistedState()">Reset preferences</button>
        <button :disabled="adapter !== 'remote'" @click="failNextSave = true">Fail next save</button>
        <label><input v-model="extraColumn" type="checkbox"> Add a new column</label>
        <output data-testid="persistence-status" aria-live="polite">{{ status?.status ?? 'loading' }} · {{ writes }} writes this session</output>
      </div>
      <p v-if="status?.status === 'error'" role="alert">Preferences could not be {{ status.operation === 'load' ? 'loaded' : 'saved' }}. Reload to retry loading; change a setting to retry saving.</p>
      <p v-if="failNextSave">The next async save will fail.</p>
      <small>The async demo uses local storage with a delay. Profiles have separate keys; try switching while loading or saving.</small>
    </header>
    <DataGrid
      :key="instance"
      ref="grid"
      :rows="rows"
      :columns="columns"
      :state-persistence="persistence"
      quick-filter
      column-menu
      column-layout
      grid-lines="all"
      @persistence-change="status = $event"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { DataGrid, useDataGridRef, type DataGridPersistenceChangeEvent, type DataGridStatePersistenceOptions } from "@affino/datagrid-vue-app"

const grid = useDataGridRef()
const profile = ref("A")
const adapter = ref("local")
const instance = ref(0)
const status = ref<DataGridPersistenceChangeEvent | null>(null)
const writes = ref(0)
const failNextSave = ref(false)
const extraColumn = ref(false)
const rows = Array.from({ length: 200 }, (_, index) => ({
  id: `saved-row-${index}`, name: `Order ${index + 1}`,
  owner: ["Mira", "Alex", "Sam"][index % 3],
  status: index % 2 === 0 ? "Ready" : "Pending", amount: index * 17, region: "EU",
}))
const columns = computed(() => [
  { key: "name", label: "Order", flex: 1, initialState: { width: 180 } },
  { key: "owner", label: "Owner", initialState: { width: 140 } },
  { key: "status", label: "Status", initialState: { width: 140 } },
  { key: "amount", label: "Amount", dataType: "number" as const, initialState: { width: 120 } },
  ...(extraColumn.value ? [{ key: "region", label: "Region", initialState: { width: 120 } }] : []),
])
const delay = () => new Promise<void>(resolve => setTimeout(resolve, 900))
const persistence = computed<DataGridStatePersistenceOptions>(() => ({
  key: `sandbox:preferences:v1:${adapter.value}:${profile.value}`,
  ...(adapter.value === "remote" ? {
    load: async ({ key }: { key: string }) => {
      await delay()
      return JSON.parse(localStorage.getItem(key) ?? "null")
    },
    save: async ({ key, state }: Parameters<NonNullable<DataGridStatePersistenceOptions["save"]>>[0]) => {
      await delay()
      if (failNextSave.value) {
        failNextSave.value = false
        throw new Error("Demo save failure")
      }
      localStorage.setItem(key, JSON.stringify(state))
      writes.value += 1
    },
  } : {
    storage: {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => { localStorage.setItem(key, value); writes.value += 1 },
      removeItem: (key: string) => localStorage.removeItem(key),
    },
  }),
}))
</script>

<style scoped>
.persistence-demo { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 16px; min-height: 0; height: 100%; padding: 16px; box-sizing: border-box; }
.persistence-demo h2, .persistence-demo p { margin: 0 0 10px; }
.persistence-demo__controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 10px; }
.persistence-demo__controls label { display: flex; align-items: center; gap: 6px; }
</style>
