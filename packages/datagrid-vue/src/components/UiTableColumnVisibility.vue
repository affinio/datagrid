<template>
  <UiModal :open="true" title="Columns" @close="emitClose">
    <div class="flex max-h-full flex-1 flex-col gap-4">
      <div class="flex items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
        <button
          type="button"
          class="rounded border border-neutral-300 bg-white px-3 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-blue-500 hover:text-blue-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
          data-testid="column-visibility-reset"
          @click="handleReset"
        >
          Reset to Default
        </button>
        <span class="font-medium">{{ visibleCount }} / {{ totalCount }} visible</span>
      </div>

      <div class="flex-1 overflow-y-auto pr-1 min-h-0">
        <DraggableList
          :items="internalColumns"
          :item-key="columnKey"
          class="w-full"
          @update:items="handleReorder"
        >
          <template #default="{ item }">
            <label
              :data-col-key="item.key"
              class="flex min-w-0 w-full items-center gap-2 rounded px-2 py-1 text-sm text-neutral-700 transition hover:bg-blue-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer accent-blue-500"
                :checked="item.visible"
                data-testid="column-visibility-checkbox"
                :data-col-key="item.key"
                :name="fieldName(item.key)"
                @change="event => handleToggle(item.key, Boolean((event.target as HTMLInputElement)?.checked))"
              />
              <span class="flex-1 truncate">{{ item.label }}</span>
            </label>
          </template>
        </DraggableList>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="ui-table__button ui-table__button--neutral"
        @click="emitClose"
      >
        Close
      </button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { createColumnStorageAccessor, type ColumnVisibilitySnapshot } from "../utils/columnStorage"
import type { UiTableColumn } from "@affino/datagrid-core/types"
import DraggableList from "./ui/DraggableList.vue"
import UiModal from "./UiModal.vue"

interface ColumnPanelState {
  key: string
  label: string
  visible: boolean
}

const props = defineProps<{
  columns: UiTableColumn[]
  storageKey: string
}>()

const emit = defineEmits<{
  (e: "update", payload: ColumnPanelState[]): void
  (e: "close"): void
  (e: "reset"): void
}>()

const internalColumns = ref<ColumnPanelState[]>([])
const columnKey = (column: ColumnPanelState) => column.key

const totalCount = computed(() => internalColumns.value.length)
const visibleCount = computed(() => internalColumns.value.filter(column => column.visible).length)
const storageSlug = computed(() => {
  const slug = props.storageKey?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  return slug || "columns"
})

function fieldName(key: string) {
  return `column-visibility-${storageSlug.value}-${key}`
}

function mapColumns(columns: UiTableColumn[]): ColumnPanelState[] {
  return columns.map(column => ({
    key: column.key,
    label: column.label,
    visible: column.visible !== false,
  }))
}

function persistState(state: ColumnPanelState[]) {
  const storage = createColumnStorageAccessor(props.storageKey)
  const snapshot: ColumnVisibilitySnapshot[] = state.map(column => ({
    key: column.key,
    label: column.label,
    visible: column.visible,
  }))
  storage.save(snapshot)
}

function emitUpdate(options: { persist?: boolean } = {}) {
  const persist = options.persist !== false
  const payload = internalColumns.value.map(column => ({ ...column }))
  if (persist) {
    persistState(payload)
  }
  emit("update", payload)
}

function handleReorder(columns: ColumnPanelState[]) {
  internalColumns.value = columns.map(column => ({ ...column }))
  emitUpdate()
}

function handleToggle(key: string, visible: boolean) {
  internalColumns.value = internalColumns.value.map(column =>
    column.key === key ? { ...column, visible } : column,
  )
  emitUpdate()
}

function handleReset() {
  internalColumns.value = internalColumns.value.map(column => ({ ...column, visible: true }))
  emit("reset")
  const storage = createColumnStorageAccessor(props.storageKey)
  storage.clear()
  emitUpdate({ persist: false })
}

function emitClose() {
  emit("close")
}

function loadStoredState(): ColumnVisibilitySnapshot[] | null {
  const storage = createColumnStorageAccessor(props.storageKey)
  return storage.load()
}

function applyStoredState(stored: ColumnVisibilitySnapshot[]) {
  const orderMap = new Map<string, { index: number; visible: boolean }>()
  stored.forEach((entry, index) => {
    orderMap.set(entry.key, { index, visible: Boolean(entry.visible) })
  })

  const nextColumns = internalColumns.value
    .map(column => ({ ...column }))
    .sort((a, b) => {
      const orderA = orderMap.get(a.key)?.index ?? Number.MAX_SAFE_INTEGER
      const orderB = orderMap.get(b.key)?.index ?? Number.MAX_SAFE_INTEGER
      return orderA - orderB
    })
    .map(column => {
      const storedEntry = orderMap.get(column.key)
      return storedEntry ? { ...column, visible: storedEntry.visible } : column
    })

  internalColumns.value = nextColumns
}

let hydrated = false

watch(
  () => props.columns,
  newColumns => {
    internalColumns.value = mapColumns(newColumns)
    const stored = loadStoredState()
    if (stored) {
      applyStoredState(stored)
    }
    if (!hydrated) {
      emitUpdate()
      hydrated = true
    }
  },
  { immediate: true, deep: true },
)
</script>
