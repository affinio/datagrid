<template>
  <div
    v-if="hasFeaturePanels"
    class="data-grid-feature-shells"
    role="region"
    aria-label="DataGrid feature panels"
  >
    <div class="data-grid-feature-toolbar">
      <UiMenu
        v-if="groupPanelApi"
        ref="groupMenuRef"
        placement="bottom"
        align="start"
      >
        <UiMenuTrigger as-child>
          <button
            type="button"
            class="data-grid-feature-button"
            :data-state="groupPanelApi.state.value.open ? 'open' : 'closed'"
          >
            Group Panel
          </button>
        </UiMenuTrigger>
        <UiMenuContent
          class="data-grid-feature-panel"
          aria-label="Group panel"
        >
          <UiMenuLabel class="data-grid-feature-panel-title">Group Columns</UiMenuLabel>
          <div class="data-grid-feature-list">
            <label
              v-for="column in visibleColumns"
              :key="column.key"
              class="data-grid-feature-option"
            >
              <input
                type="checkbox"
                :checked="isGroupColumn(column.key)"
                @change="toggleGroupColumn(column.key, $event)"
                @keydown.stop
              >
              <span>{{ column.label }}</span>
            </label>
          </div>
        </UiMenuContent>
      </UiMenu>

      <UiMenu
        v-if="pivotPanelApi"
        ref="pivotMenuRef"
        placement="bottom"
        align="start"
      >
        <UiMenuTrigger as-child>
          <button
            type="button"
            class="data-grid-feature-button"
            :data-state="pivotPanelApi.state.value.open ? 'open' : 'closed'"
          >
            Pivot Panel
          </button>
        </UiMenuTrigger>
        <UiMenuContent
          class="data-grid-feature-panel"
          aria-label="Pivot panel"
        >
          <UiMenuLabel class="data-grid-feature-panel-title">Pivot Layout</UiMenuLabel>
          <label class="data-grid-feature-field">
            <span>Rows (comma-separated keys)</span>
            <input
              v-model="pivotRowsInput"
              type="text"
              @keydown.stop
            >
          </label>
          <label class="data-grid-feature-field">
            <span>Columns (comma-separated keys)</span>
            <input
              v-model="pivotColumnsInput"
              type="text"
              @keydown.stop
            >
          </label>
          <label class="data-grid-feature-field">
            <span>Values (`field:agg`, comma-separated)</span>
            <input
              v-model="pivotValuesInput"
              type="text"
              placeholder="amount:sum, count:count"
              @keydown.stop
            >
          </label>
          <div class="data-grid-feature-actions">
            <button
              type="button"
              class="data-grid-feature-button"
              @click="applyPivotInputs"
            >
              Apply
            </button>
            <button
              type="button"
              class="data-grid-feature-button"
              @click="pivotPanelApi.close()"
            >
              Close
            </button>
          </div>
        </UiMenuContent>
      </UiMenu>

      <UiMenu
        v-if="filterBuilderApi"
        ref="filterMenuRef"
        placement="bottom"
        align="start"
      >
        <UiMenuTrigger as-child>
          <button
            type="button"
            class="data-grid-feature-button"
            :data-state="filterBuilderApi.state.value.open ? 'open' : 'closed'"
          >
            Filter Builder
          </button>
        </UiMenuTrigger>
        <UiMenuContent
          class="data-grid-feature-panel"
          aria-label="Filter builder panel"
        >
          <UiMenuLabel class="data-grid-feature-panel-title">Filter Builder (JSON)</UiMenuLabel>
          <label class="data-grid-feature-field">
            <span>Draft filter snapshot</span>
            <textarea
              v-model="filterDraftText"
              rows="6"
              spellcheck="false"
              @keydown.stop
            />
          </label>
          <p
            v-if="filterDraftError"
            class="data-grid-feature-error"
          >
            {{ filterDraftError }}
          </p>
          <div class="data-grid-feature-actions">
            <button
              type="button"
              class="data-grid-feature-button"
              @click="applyFilterDraftText"
            >
              Apply
            </button>
            <button
              type="button"
              class="data-grid-feature-button"
              @click="filterBuilderApi.clear()"
            >
              Clear
            </button>
            <button
              type="button"
              class="data-grid-feature-button"
              @click="filterBuilderApi.close()"
            >
              Close
            </button>
          </div>
        </UiMenuContent>
      </UiMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DataGridAggOp, DataGridFilterSnapshot, DataGridPivotValueSpec } from "@affino/datagrid-core"
import { UiMenu, UiMenuContent, UiMenuLabel, UiMenuTrigger } from "@affino/menu-vue"
import { computed, ref, watch, type ComputedRef, type Ref } from "vue"
import { useFeature } from "../composables/useDataGridFeature"
import type {
  DataGridFilterBuilderUiFeatureApi,
  DataGridGroupPanelFeatureApi,
  DataGridPivotPanelFeatureApi,
} from "../composables/useDataGridFeatureRegistry"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"

const { visibleColumns } = useDataGridViewContext()

const groupPanelApi = useFeature<DataGridGroupPanelFeatureApi>("groupPanel")
const pivotPanelApi = useFeature<DataGridPivotPanelFeatureApi>("pivotPanel")
const filterBuilderApi = useFeature<DataGridFilterBuilderUiFeatureApi>("filterBuilderUI")

interface UiMenuExposed {
  controller: {
    state: {
      value: {
        open: boolean
      }
    }
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
  }
}

interface DataGridOpenFeatureApi {
  state: {
    value: {
      open: boolean
    }
  }
  open: () => void
  close: () => void
}

const groupMenuRef = ref<UiMenuExposed | null>(null)
const pivotMenuRef = ref<UiMenuExposed | null>(null)
const filterMenuRef = ref<UiMenuExposed | null>(null)

const hasFeaturePanels = computed<boolean>(() => {
  return Boolean(groupPanelApi.value || pivotPanelApi.value || filterBuilderApi.value)
})

const pivotRowsInput = ref("")
const pivotColumnsInput = ref("")
const pivotValuesInput = ref("")
const filterDraftText = ref("")
const filterDraftError = ref("")

const allowedAggOps: ReadonlySet<DataGridAggOp> = new Set<DataGridAggOp>([
  "sum",
  "avg",
  "min",
  "max",
  "count",
  "countNonNull",
  "first",
  "last",
  "custom",
])

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
}

function parsePivotValues(value: string): DataGridPivotValueSpec[] {
  const tokens = parseCommaSeparatedList(value)
  const values: DataGridPivotValueSpec[] = []
  for (const token of tokens) {
    const [field, aggRaw] = token.split(":").map(entry => entry.trim())
    if (!field || !aggRaw || !allowedAggOps.has(aggRaw as DataGridAggOp)) {
      continue
    }
    values.push({
      field,
      agg: aggRaw as DataGridAggOp,
    })
  }
  return values
}

function isGroupColumn(columnKey: string): boolean {
  return groupPanelApi.value?.state.value.columns.includes(columnKey) ?? false
}

function toggleGroupColumn(columnKey: string, event: Event): void {
  const target = event.target as HTMLInputElement | null
  if (!target || !groupPanelApi.value) {
    return
  }
  const next = new Set(groupPanelApi.value.state.value.columns)
  if (target.checked) {
    next.add(columnKey)
  } else {
    next.delete(columnKey)
  }
  groupPanelApi.value.setColumns([...next])
}

function applyPivotInputs(): void {
  if (!pivotPanelApi.value) {
    return
  }
  pivotPanelApi.value.setRows(parseCommaSeparatedList(pivotRowsInput.value))
  pivotPanelApi.value.setColumns(parseCommaSeparatedList(pivotColumnsInput.value))
  pivotPanelApi.value.setValues(parsePivotValues(pivotValuesInput.value))
}

function applyFilterDraftText(): void {
  if (!filterBuilderApi.value) {
    return
  }
  const raw = filterDraftText.value.trim()
  if (raw.length === 0) {
    filterBuilderApi.value.setDraft(null)
    filterBuilderApi.value.apply()
    filterDraftError.value = ""
    return
  }
  try {
    const parsed = JSON.parse(raw) as DataGridFilterSnapshot | null
    filterBuilderApi.value.setDraft(parsed)
    filterBuilderApi.value.apply()
    filterDraftError.value = ""
  } catch {
    filterDraftError.value = "Invalid JSON. Provide a valid DataGridFilterSnapshot payload."
  }
}

function bridgeFeatureMenu(
  menuRef: Ref<UiMenuExposed | null>,
  featureApi: ComputedRef<DataGridOpenFeatureApi | null>,
): void {
  watch(
    () => featureApi.value?.state.value.open,
    (isOpen) => {
      const controller = menuRef.value?.controller
      if (!controller) {
        return
      }
      if (isOpen === true) {
        controller.open("programmatic")
        return
      }
      controller.close("programmatic")
    },
    { immediate: true },
  )

  watch(
    () => menuRef.value?.controller.state.value.open,
    (isOpen) => {
      const feature = featureApi.value
      if (!feature) {
        return
      }
      if (isOpen === true && !feature.state.value.open) {
        feature.open()
        return
      }
      if (isOpen === false && feature.state.value.open) {
        feature.close()
      }
    },
  )
}

bridgeFeatureMenu(groupMenuRef, groupPanelApi)
bridgeFeatureMenu(pivotMenuRef, pivotPanelApi)
bridgeFeatureMenu(filterMenuRef, filterBuilderApi)

watch(
  () => pivotPanelApi.value?.state.value,
  (state) => {
    if (!state) {
      return
    }
    pivotRowsInput.value = state.rows.join(", ")
    pivotColumnsInput.value = state.columns.join(", ")
    pivotValuesInput.value = state.values.map(value => `${value.field}:${value.agg}`).join(", ")
  },
  { immediate: true, deep: true },
)

watch(
  () => filterBuilderApi.value?.state.value.draft,
  (draft) => {
    filterDraftText.value = draft == null
      ? ""
      : JSON.stringify(draft, null, 2)
    filterDraftError.value = ""
  },
  { immediate: true, deep: true },
)
</script>

<style scoped>
.data-grid-feature-shells {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--dg-border-color, #d7dde5);
  background: color-mix(in srgb, var(--dg-bg, #ffffff) 94%, #d9e2ef 6%);
}

.data-grid-feature-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.data-grid-feature-button {
  border: 1px solid var(--dg-border-color, #d7dde5);
  background: var(--dg-bg, #ffffff);
  color: var(--dg-fg, #1f2933);
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}

.data-grid-feature-button[data-state="open"] {
  border-color: color-mix(in srgb, var(--dg-border-color, #d7dde5) 35%, #0b63ce 65%);
  background: color-mix(in srgb, var(--dg-bg, #ffffff) 88%, #d8e8fb 12%);
}

.data-grid-feature-panel {
  border: 1px solid var(--dg-border-color, #d7dde5);
  background: var(--dg-bg, #ffffff);
  border-radius: 8px;
  min-width: 300px;
  max-width: min(92vw, 460px);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.16);
}

.data-grid-feature-panel-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.data-grid-feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.data-grid-feature-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.data-grid-feature-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.data-grid-feature-field input,
.data-grid-feature-field textarea {
  border: 1px solid var(--dg-border-color, #d7dde5);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--dg-bg, #ffffff);
  color: var(--dg-fg, #1f2933);
  font: inherit;
}

.data-grid-feature-field textarea {
  resize: vertical;
}

.data-grid-feature-actions {
  display: flex;
  gap: 8px;
}

.data-grid-feature-error {
  margin: 0;
  color: #b42318;
  font-size: 12px;
}
</style>
