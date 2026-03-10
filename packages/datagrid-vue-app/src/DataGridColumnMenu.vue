<template>
  <UiMenu ref="menuRef" :callbacks="menuCallbacks">
    <UiMenuTrigger as-child trigger="contextmenu">
      <slot
        :open="open"
        :toggle-from-button="toggleFromButton"
      />
    </UiMenuTrigger>

    <UiMenuContent
      class-name="ui-menu-content datagrid-column-menu__panel"
      align="start"
      :gutter="6"
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

      <UiSubMenu>
        <UiSubMenuTrigger
          class="datagrid-column-menu__item datagrid-column-menu__item--submenu"
          data-datagrid-column-menu-action="pin-submenu"
        >
          <span>Pin column</span>
        </UiSubMenuTrigger>

        <UiSubMenuContent class-name="ui-submenu-content datagrid-column-menu__submenu-panel">
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

      <template v-if="filterEnabled">
        <UiMenuSeparator />

        <section class="datagrid-column-menu__section" @mousedown.stop @click.stop>
          <div class="datagrid-column-menu__section-head">
            <span>Filter by value</span>
            <button
              type="button"
              class="datagrid-column-menu__link"
              data-datagrid-column-menu-action="clear-filter"
              :disabled="!filterActive"
              @click="handleClearFilter"
            >
              Clear
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

          <div class="datagrid-column-menu__summary">
            {{ draftSelectedTokens.length }} / {{ valueEntries.length }} selected
          </div>

          <button
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="select-all-values"
            :disabled="valueEntries.length === 0"
            @click="selectAllValues"
          >
            Select all
          </button>

          <div class="datagrid-column-menu__values">
            <label
              v-for="entry in visibleValues"
              :key="entry.token"
              class="datagrid-column-menu__value"
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

          <div v-if="hiddenMatchCount > 0" class="datagrid-column-menu__summary">
            Showing first {{ visibleValues.length }} matches
          </div>

          <div class="datagrid-column-menu__footer">
            <button
              type="button"
              class="datagrid-column-menu__apply"
              data-datagrid-column-menu-action="apply-filter"
              :disabled="!canApplyFilter"
              @click="handleApplyFilter"
            >
              Apply
            </button>
          </div>
        </section>
      </template>
    </UiMenuContent>
  </UiMenu>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
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
} from "@affino/menu-vue"

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
const open = ref(false)
const query = ref("")
const valueEntries = ref<readonly DataGridColumnMenuValueEntry[]>([])
const draftSelectedTokens = ref<readonly string[]>([])

const selectedTokenSet = computed(() => new Set(draftSelectedTokens.value))

const visibleValues = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const matched = normalizedQuery.length > 0
    ? valueEntries.value.filter(entry => entry.searchText.includes(normalizedQuery))
    : valueEntries.value
  return matched.slice(0, props.maxFilterValues)
})

const hiddenMatchCount = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const matchedCount = normalizedQuery.length > 0
    ? valueEntries.value.filter(entry => entry.searchText.includes(normalizedQuery)).length
    : valueEntries.value.length
  return Math.max(0, matchedCount - visibleValues.value.length)
})

const canApplyFilter = computed(() => (
  props.filterEnabled
  && valueEntries.value.length > 0
  && draftSelectedTokens.value.length > 0
))

const menuCallbacks: MenuCallbacks = {
  onOpen: () => {
    open.value = true
    resetFilterDraft()
  },
  onClose: () => {
    open.value = false
  },
}

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

function toggleFromButton(event: MouseEvent): void {
  const controller = menuRef.value?.controller
  if (!controller) {
    return
  }
  if (open.value) {
    controller.close("pointer")
    return
  }
  const target = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : null
  const rect = target?.getBoundingClientRect()
  controller.setAnchor(rect
    ? {
        x: rect.left,
        y: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    : {
        x: event.clientX,
        y: event.clientY,
        width: 0,
        height: 0,
      })
  controller.open("pointer")
}

function resetFilterDraft(): void {
  query.value = ""
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

function handleApplyFilter(): void {
  if (!canApplyFilter.value) {
    return
  }
  if (draftSelectedTokens.value.length === valueEntries.value.length) {
    emit("clear-filter")
  } else {
    emit("apply-filter", [...draftSelectedTokens.value])
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
