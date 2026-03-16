<template>
  <UiMenu ref="menuRef" :callbacks="menuCallbacks" :options="rootMenuOptions">
    <UiMenuTrigger as-child trigger="both">
      <slot
        :open="open"
      />
    </UiMenuTrigger>

    <UiMenuContent
      class-name="ui-menu-content datagrid-column-menu__panel"
      align="start"
      :gutter="6"
      :style="menuThemeVars"
      data-affino-menu-root
      data-datagrid-column-menu-panel="true"
    >
      <UiMenuLabel class="datagrid-column-menu__title">
        {{ columnLabel }}
      </UiMenuLabel>
      <UiMenuSeparator />

      <UiMenuItem
        class="datagrid-column-menu__item"
        data-datagrid-column-menu-action="sort-asc"
        :disabled="!sortEnabled"
        @select="$emit('sort', 'asc')"
      >
        <span>Sort ascending</span>
        <span v-if="sortDirection === 'asc'" class="datagrid-column-menu__state">Active</span>
      </UiMenuItem>

      <UiMenuItem
        class="datagrid-column-menu__item"
        data-datagrid-column-menu-action="sort-desc"
        :disabled="!sortEnabled"
        @select="$emit('sort', 'desc')"
      >
        <span>Sort descending</span>
        <span v-if="sortDirection === 'desc'" class="datagrid-column-menu__state">Active</span>
      </UiMenuItem>

      <UiMenuItem
        class="datagrid-column-menu__item"
        data-datagrid-column-menu-action="sort-clear"
        :disabled="!sortEnabled || sortDirection === null"
        @select="$emit('sort', null)"
      >
        Clear sort
      </UiMenuItem>

      <UiMenuSeparator />

      <UiSubMenu :options="submenuOptions">
        <UiSubMenuTrigger
          class="datagrid-column-menu__item datagrid-column-menu__item--submenu"
          data-datagrid-column-menu-action="pin-submenu"
        >
          <span>Pin column</span>
        </UiSubMenuTrigger>

        <UiSubMenuContent
          class-name="ui-submenu-content datagrid-column-menu__submenu-panel"
          :style="menuThemeVars"
        >
          <UiMenuItem
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="pin-left"
            @select="$emit('pin', 'left')"
          >
            <span>Pin left</span>
            <span v-if="pin === 'left'" class="datagrid-column-menu__state">Active</span>
          </UiMenuItem>

          <UiMenuItem
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="pin-right"
            @select="$emit('pin', 'right')"
          >
            <span>Pin right</span>
            <span v-if="pin === 'right'" class="datagrid-column-menu__state">Active</span>
          </UiMenuItem>

          <UiMenuItem
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="pin-none"
            :disabled="pin === 'none'"
            @select="$emit('pin', 'none')"
          >
            Unpin
          </UiMenuItem>
        </UiSubMenuContent>
      </UiSubMenu>

      <UiMenuSeparator v-if="filterEnabled" />

      <section
        v-if="filterEnabled"
        class="datagrid-column-menu__section datagrid-column-menu__section--filter"
        @mousedown.stop
        @click.stop
      >
        <div class="datagrid-column-menu__section-head">
          <span class="datagrid-column-menu__section-title">Filter by value</span>
          <button
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="clear-filter"
            :disabled="!filterActive"
            @click="handleClearFilter"
          >
            Clear filter
          </button>
        </div>

        <input
          v-model="query"
          class="datagrid-column-menu__search"
          type="search"
          placeholder="Search values"
          @mousedown.stop
          @click.stop
          @keydown.stop
        />

        <label
          v-if="hasSearchQuery"
          class="datagrid-column-menu__merge-toggle"
          data-datagrid-column-menu-action="add-current-selection"
        >
          <input
            type="checkbox"
            :checked="addCurrentSelectionToFilter"
            @change="toggleAddCurrentSelectionToFilter"
          />
          <span>Add current selection to filter</span>
        </label>

        <UiMenuSeparator class="datagrid-column-menu__section-separator" />

        <div class="datagrid-column-menu__toolbar">
          <button
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="select-all-values"
            :disabled="valueEntries.length === 0 || isAllValuesSelected"
            @click="selectAllValues"
          >
            Select all
          </button>
          <button
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="clear-all-values"
            :disabled="draftSelectedTokens.length === 0"
            @click="clearAllValues"
          >
            Clear all
          </button>
          <div class="datagrid-column-menu__summary">
            {{ appliedSelectedCount }} / {{ appliedSelectableCount }} selected
          </div>
        </div>

        <div class="datagrid-column-menu__values">
          <div
            class="datagrid-column-menu__values-list"
            role="listbox"
            aria-multiselectable="true"
            :aria-label="`Filter values for ${columnLabel}`"
          >
            <label
              v-for="entry in visibleValues"
              :key="entry.token"
              class="datagrid-column-menu__value"
              role="option"
              :aria-selected="selectedTokenSet.has(entry.token)"
            >
              <input
                type="checkbox"
                :checked="selectedTokenSet.has(entry.token)"
                @change="toggleFilterValue(entry.token)"
              />
              <span class="datagrid-column-menu__value-label">{{ entry.label }}</span>
              <span class="datagrid-column-menu__value-count">{{ entry.count }}</span>
            </label>

            <div v-if="visibleValues.length === 0" class="datagrid-column-menu__empty">
              No matching values
            </div>
          </div>
        </div>

        <div v-if="hiddenMatchCount > 0" class="datagrid-column-menu__summary">
          Showing first {{ visibleValues.length }} values. Use search to filter all {{ matchedValues.length }}.
        </div>

        <div v-if="appliedFilterTokens.length === 0" class="datagrid-column-menu__hint">
          Select at least one value to apply the filter.
        </div>

        <UiMenuSeparator class="datagrid-column-menu__section-separator" />

        <div class="datagrid-column-menu__footer">
          <button
            type="button"
            class="datagrid-column-menu__button datagrid-column-menu__button--secondary"
            data-datagrid-column-menu-action="cancel-filter"
            @click="closeMenu"
          >
            Cancel
          </button>
          <button
            type="button"
            class="datagrid-column-menu__button datagrid-column-menu__button--primary"
            data-datagrid-column-menu-action="apply-filter"
            :disabled="!canApplyFilter"
            @click="handleApplyFilter"
          >
            Apply
          </button>
        </div>
      </section>
    </UiMenuContent>
  </UiMenu>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue"
import { serializeColumnValueToToken } from "@affino/datagrid-vue"
import {
  UiMenu,
  UiMenuContent,
  UiMenuItem,
  UiMenuLabel,
  UiMenuSeparator,
  UiMenuTrigger,
  UiSubMenu,
  UiSubMenuContent,
  UiSubMenuTrigger,
  type MenuCallbacks,
  type MenuOptions,
} from "@affino/menu-vue"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

type DataGridColumnPin = "left" | "right" | "none"

interface DataGridColumnMenuValueEntry {
  token: string
  label: string
  count: number
  searchText: string
}

interface UiMenuRef {
  controller?: {
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
  }
}

const props = defineProps<{
  rows: readonly Record<string, unknown>[]
  columnKey: string
  columnLabel: string
  sortDirection: "asc" | "desc" | null
  sortEnabled: boolean
  pin: DataGridColumnPin
  filterEnabled: boolean
  filterActive: boolean
  selectedFilterTokens: readonly string[]
  maxFilterValues: number
}>()

const emit = defineEmits<{
  (event: "sort", direction: "asc" | "desc" | null): void
  (event: "pin", pin: DataGridColumnPin): void
  (event: "apply-filter", tokens: readonly string[]): void
  (event: "clear-filter"): void
}>()

const menuRef = ref<UiMenuRef | null>(null)
const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const open = ref(false)
const query = ref("")
const addCurrentSelectionToFilter = ref(false)
const valueEntries = ref<readonly DataGridColumnMenuValueEntry[]>([])
const draftSelectedTokens = ref<readonly string[]>([])
const menuThemeVars = ref<Record<string, string>>({})

const selectedTokenSet = computed(() => new Set(draftSelectedTokens.value))
const hasSearchQuery = computed(() => query.value.trim().length > 0)

const matchedValues = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return normalizedQuery.length > 0
    ? valueEntries.value.filter(entry => entry.searchText.includes(normalizedQuery))
    : valueEntries.value
})

const visibleValues = computed(() => {
  if (hasSearchQuery.value) {
    return matchedValues.value
  }
  return matchedValues.value.slice(0, props.maxFilterValues)
})

const hiddenMatchCount = computed(() => {
  if (hasSearchQuery.value) {
    return 0
  }
  return Math.max(0, matchedValues.value.length - visibleValues.value.length)
})

const appliedFilterTokens = computed(() => {
  if (hasSearchQuery.value && !addCurrentSelectionToFilter.value) {
    const visibleTokenSet = new Set(visibleValues.value.map(entry => entry.token))
    return draftSelectedTokens.value.filter(token => visibleTokenSet.has(token))
  }
  return draftSelectedTokens.value
})

const appliedSelectableCount = computed(() => (
  hasSearchQuery.value
    ? addCurrentSelectionToFilter.value
      ? valueEntries.value.length
      : visibleValues.value.length
    : valueEntries.value.length
))

const appliedSelectedCount = computed(() => appliedFilterTokens.value.length)

const isAllValuesSelected = computed(() => (
  valueEntries.value.length > 0
  && draftSelectedTokens.value.length === valueEntries.value.length
))

const canApplyFilter = computed(() => (
  props.filterEnabled
  && valueEntries.value.length > 0
  && appliedFilterTokens.value.length > 0
))

const rootMenuOptions: MenuOptions = {
  mousePrediction: {},
  loopFocus: true,
  closeOnSelect: true,
  openDelay: 0,
  closeDelay: 90,
}

const submenuOptions: MenuOptions = {
  mousePrediction: {},
  loopFocus: true,
  closeOnSelect: true,
  openDelay: 0,
  closeDelay: 120,
}

const menuCallbacks: MenuCallbacks = {
  onOpen: () => {
    open.value = true
    syncMenuThemeVars()
    resetFilterDraft()
  },
  onClose: () => {
    open.value = false
  },
}

watch(hasSearchQuery, value => {
  if (!value) {
    addCurrentSelectionToFilter.value = false
  }
})

watch(rootElementRef, () => {
  if (open.value) {
    syncMenuThemeVars()
  }
})

function normalizeColumnMenuToken(token: string): string {
  return token.startsWith("string:")
    ? `string:${token.slice("string:".length).toLowerCase()}`
    : token
}

function formatColumnMenuValueLabel(value: unknown): string {
  if (value == null) {
    return "(Blanks)"
  }
  const text = String(value)
  return text.length > 0 ? text : "(Blanks)"
}

function collectColumnMenuValueEntries(
  rows: readonly Record<string, unknown>[],
  columnKey: string,
): readonly DataGridColumnMenuValueEntry[] {
  const counts = new Map<string, DataGridColumnMenuValueEntry>()
  for (const row of rows) {
    const token = normalizeColumnMenuToken(serializeColumnValueToToken(row[columnKey]))
    const existing = counts.get(token)
    if (existing) {
      existing.count += 1
      continue
    }
    const label = formatColumnMenuValueLabel(row[columnKey])
    counts.set(token, {
      token,
      label,
      count: 1,
      searchText: label.toLowerCase(),
    })
  }
  return Array.from(counts.values()).sort((left, right) => (
    left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  ))
}

function closeMenu(): void {
  menuRef.value?.controller?.close("programmatic")
}

function syncMenuThemeVars(): void {
  menuThemeVars.value = readDataGridOverlayThemeVars(rootElementRef.value)
}

function resetFilterDraft(): void {
  query.value = ""
  addCurrentSelectionToFilter.value = false
  if (!props.filterEnabled) {
    valueEntries.value = []
    draftSelectedTokens.value = []
    return
  }
  const entries = collectColumnMenuValueEntries(props.rows, props.columnKey)
  valueEntries.value = entries
  const activeTokens = Array.from(new Set(
    props.selectedFilterTokens
      .map(token => normalizeColumnMenuToken(String(token ?? "")))
      .filter(token => entries.some(entry => entry.token === token)),
  ))
  draftSelectedTokens.value = activeTokens.length > 0
    ? activeTokens
    : entries.map(entry => entry.token)
}

function toggleFilterValue(token: string): void {
  const next = new Set(draftSelectedTokens.value)
  if (next.has(token)) {
    next.delete(token)
  } else {
    next.add(token)
  }
  draftSelectedTokens.value = [...next]
}

function selectAllValues(): void {
  draftSelectedTokens.value = valueEntries.value.map(entry => entry.token)
}

function clearAllValues(): void {
  draftSelectedTokens.value = []
}

function toggleAddCurrentSelectionToFilter(event: Event): void {
  addCurrentSelectionToFilter.value = (event.target as HTMLInputElement).checked
}

function handleApplyFilter(): void {
  if (!canApplyFilter.value) {
    return
  }
  if (appliedFilterTokens.value.length === valueEntries.value.length) {
    emit("clear-filter")
  } else {
    emit("apply-filter", [...appliedFilterTokens.value])
  }
  closeMenu()
}

function handleClearFilter(): void {
  if (!props.filterActive) {
    return
  }
  emit("clear-filter")
  closeMenu()
}
</script>
