<template>
  <UiMenu ref="menuRef">
    <UiMenuContent
      v-if="menuApi && activeColumnKey"
      class="data-grid-column-menu"
      aria-label="Column menu"
    >
      <UiMenuLabel class="data-grid-column-menu-title">
        {{ activeColumnKey }}
      </UiMenuLabel>

      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="sortAsc"
      >
        Sort Asc
      </UiMenuItem>
      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="sortDesc"
      >
        Sort Desc
      </UiMenuItem>
      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="clearSort"
      >
        Clear Sort
      </UiMenuItem>

      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="pinLeft"
      >
        Pin Left
      </UiMenuItem>
      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="pinRight"
      >
        Pin Right
      </UiMenuItem>
      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="clearPin"
      >
        Clear Pin
      </UiMenuItem>

      <UiMenuItem
        class="data-grid-column-menu-action"
        @select="autosizeColumn"
      >
        Autosize
      </UiMenuItem>
      <UiMenuItem
        v-if="isColumnVisible"
        class="data-grid-column-menu-action"
        @select="hideColumn"
      >
        Hide Column
      </UiMenuItem>

      <footer class="data-grid-column-menu-meta">
        <span>Sort: {{ activeSortDirection ?? "none" }}</span>
        <span>Pin: {{ activePin }}</span>
      </footer>
    </UiMenuContent>
  </UiMenu>
</template>

<script setup lang="ts">
import type { DataGridColumnPin } from "@affino/datagrid-core"
import { UiMenu, UiMenuContent, UiMenuItem, UiMenuLabel } from "@affino/menu-vue"
import { computed, ref, watch } from "vue"
import { useFeature } from "../composables/useDataGridFeature"
import type {
  DataGridColumnAutosizeFeatureApi,
  DataGridColumnMenuFeatureApi,
  DataGridColumnPinningFeatureApi,
  DataGridColumnVisibilityFeatureApi,
  DataGridSortingFeatureApi,
} from "../composables/useDataGridFeatureRegistry"
import { useDataGridViewContext } from "../composables/useDataGridViewContext"

const { viewModel } = useDataGridViewContext()

interface UiMenuExposed {
  controller: {
    state: {
      value: {
        open: boolean
      }
    }
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
  }
}

const menuRef = ref<UiMenuExposed | null>(null)

const menuApi = useFeature<DataGridColumnMenuFeatureApi>("columnMenu")
const sortingApi = useFeature<DataGridSortingFeatureApi>("sorting")
const pinningApi = useFeature<DataGridColumnPinningFeatureApi>("columnPinning")
const visibilityApi = useFeature<DataGridColumnVisibilityFeatureApi>("columnVisibility")
const autosizeApi = useFeature<DataGridColumnAutosizeFeatureApi>("columnAutosize")

const activeColumnKey = computed<string | null>(() => {
  const state = menuApi.value?.state.value
  if (!state?.open || !state.columnKey) {
    return null
  }
  return state.columnKey
})

const activeSortDirection = computed<"asc" | "desc" | null>(() => {
  const columnKey = activeColumnKey.value
  if (!columnKey) {
    return null
  }
  const entry = viewModel.rowSnapshot.value.sortModel.find(item => item.key === columnKey)
  return entry?.direction ?? null
})

const activePin = computed<DataGridColumnPin>(() => {
  const columnKey = activeColumnKey.value
  if (!columnKey || !pinningApi.value) {
    return "none"
  }
  return pinningApi.value.getPin(columnKey)
})

const isColumnVisible = computed<boolean>(() => {
  const columnKey = activeColumnKey.value
  if (!columnKey || !visibilityApi.value) {
    return true
  }
  return visibilityApi.value.isVisible(columnKey)
})

function closeMenu(): void {
  menuRef.value?.controller.close("programmatic")
  menuApi.value?.close()
}

function sortAsc(): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !sortingApi.value) {
    return
  }
  sortingApi.value.setSortModel([{ key: columnKey, direction: "asc" }])
  closeMenu()
}

function sortDesc(): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !sortingApi.value) {
    return
  }
  sortingApi.value.setSortModel([{ key: columnKey, direction: "desc" }])
  closeMenu()
}

function clearSort(): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !sortingApi.value) {
    return
  }
  const nextModel = sortingApi.value.getSortModel().filter(entry => entry.key !== columnKey)
  sortingApi.value.setSortModel(nextModel)
  closeMenu()
}

function setPin(pin: DataGridColumnPin): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !pinningApi.value) {
    return
  }
  pinningApi.value.setPin(columnKey, pin)
  closeMenu()
}

function pinLeft(): void {
  setPin("left")
}

function pinRight(): void {
  setPin("right")
}

function clearPin(): void {
  setPin("none")
}

function hideColumn(): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !visibilityApi.value) {
    return
  }
  visibilityApi.value.setVisible(columnKey, false)
  closeMenu()
}

function autosizeColumn(): void {
  const columnKey = activeColumnKey.value
  if (!columnKey || !autosizeApi.value) {
    return
  }
  autosizeApi.value.autosizeColumn(columnKey)
  closeMenu()
}

watch(
  () => menuApi.value?.state.value,
  (state) => {
    const controller = menuRef.value?.controller
    if (!controller) {
      return
    }
    if (!state) {
      controller.close("programmatic")
      return
    }
    if (!state.open || !state.columnKey) {
      controller.close("programmatic")
      return
    }
    if (state.anchor) {
      controller.setAnchor({
        x: state.anchor.x,
        y: state.anchor.y,
        width: 0,
        height: 0,
      })
    } else {
      controller.setAnchor(null)
    }
    controller.open("programmatic")
  },
  { immediate: true, deep: true },
)

watch(
  () => menuRef.value?.controller.state.value.open,
  (open) => {
    if (open === false && menuApi.value?.state.value.open) {
      menuApi.value.close()
    }
  },
)
</script>

<style scoped>
.data-grid-column-menu {
  position: fixed;
  z-index: 60;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--dg-border-color, #d7dde5);
  border-radius: 8px;
  background: var(--dg-bg, #ffffff);
  color: var(--dg-fg, #1f2933);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.16);
}

.data-grid-column-menu-title {
  font-size: 12px;
  font-weight: 700;
  padding: 2px 4px 6px;
  border-bottom: 1px solid var(--dg-border-color, #d7dde5);
}

.data-grid-column-menu-action {
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  text-align: left;
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
}

.data-grid-column-menu-action:hover {
  border-color: var(--dg-border-color, #d7dde5);
  background: color-mix(in srgb, var(--dg-bg, #ffffff) 88%, #d9e2ef 12%);
}

.data-grid-column-menu-meta {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--dg-border-color, #d7dde5);
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  opacity: 0.8;
}
</style>
