<template>
  <UiMenu ref="menuRef" :callbacks="menuCallbacks" :options="rootMenuOptions">
    <UiMenuTrigger as-child trigger="contextmenu">
      <slot
        :open="open"
        :toggle-menu-from-element="toggleMenuFromElement"
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
      <UiMenuSeparator v-if="visibleSections.length > 0" />

      <template v-for="(section, index) in visibleSections" :key="section">
        <UiMenuSeparator v-if="index > 0" />

        <template v-if="section === 'sort'">
          <UiMenuItem
            v-if="isActionVisible('sortAsc')"
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="sort-asc"
            :data-disabled-reason="resolveActionDisabledTitle('sortAsc', sortSectionDisabled || !sortEnabled, 'sort')"
            :disabled="isActionDisabled('sortAsc', sortSectionDisabled || !sortEnabled)"
            :title="resolveActionDisabledTitle('sortAsc', sortSectionDisabled || !sortEnabled, 'sort')"
            @select="$emit('sort', 'asc')"
          >
            <span :title="resolveActionDisabledTitle('sortAsc', sortSectionDisabled || !sortEnabled, 'sort')">{{ sortAscLabel }}</span>
            <span v-if="sortDirection === 'asc'" class="datagrid-column-menu__state">Active</span>
          </UiMenuItem>

          <UiMenuItem
            v-if="isActionVisible('sortDesc')"
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="sort-desc"
            :data-disabled-reason="resolveActionDisabledTitle('sortDesc', sortSectionDisabled || !sortEnabled, 'sort')"
            :disabled="isActionDisabled('sortDesc', sortSectionDisabled || !sortEnabled)"
            :title="resolveActionDisabledTitle('sortDesc', sortSectionDisabled || !sortEnabled, 'sort')"
            @select="$emit('sort', 'desc')"
          >
            <span :title="resolveActionDisabledTitle('sortDesc', sortSectionDisabled || !sortEnabled, 'sort')">{{ sortDescLabel }}</span>
            <span v-if="sortDirection === 'desc'" class="datagrid-column-menu__state">Active</span>
          </UiMenuItem>

          <UiMenuItem
            v-if="isActionVisible('clearSort')"
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="sort-clear"
            :data-disabled-reason="resolveActionDisabledTitle('clearSort', sortSectionDisabled || !sortEnabled || sortDirection === null, 'sort')"
            :disabled="isActionDisabled('clearSort', sortSectionDisabled || !sortEnabled || sortDirection === null)"
            :title="resolveActionDisabledTitle('clearSort', sortSectionDisabled || !sortEnabled || sortDirection === null, 'sort')"
            @select="$emit('sort', null)"
          >
            <span :title="resolveActionDisabledTitle('clearSort', sortSectionDisabled || !sortEnabled || sortDirection === null, 'sort')">{{ clearSortLabel }}</span>
          </UiMenuItem>
        </template>

        <UiMenuItem
          v-else-if="section === 'group' && isActionVisible('toggleGroup')"
          class="datagrid-column-menu__item"
          data-datagrid-column-menu-action="toggle-group"
          :data-disabled-reason="resolveActionDisabledTitle('toggleGroup', groupSectionDisabled || !groupEnabled, 'group')"
          :disabled="isActionDisabled('toggleGroup', groupSectionDisabled || !groupEnabled)"
          :title="resolveActionDisabledTitle('toggleGroup', groupSectionDisabled || !groupEnabled, 'group')"
          @select="handleToggleGroup"
        >
          <span :title="resolveActionDisabledTitle('toggleGroup', groupSectionDisabled || !groupEnabled, 'group')">{{ groupActionLabel }}</span>
          <span v-if="grouped && groupOrderLabel" class="datagrid-column-menu__state">{{ groupOrderLabel }}</span>
        </UiMenuItem>

        <UiSubMenu v-else-if="section === 'pin' && showPinSection" :options="submenuOptions">
          <UiSubMenuTrigger
            class="datagrid-column-menu__item datagrid-column-menu__item--submenu"
            data-datagrid-column-menu-action="pin-submenu"
            :data-disabled-reason="resolveActionDisabledTitle('pinMenu', pinSectionDisabled, 'pin')"
            :aria-disabled="isActionDisabled('pinMenu', pinSectionDisabled) ? 'true' : undefined"
            :disabled="isActionDisabled('pinMenu', pinSectionDisabled)"
            :title="resolveActionDisabledTitle('pinMenu', pinSectionDisabled, 'pin')"
          >
            <span>{{ pinMenuLabel }}</span>
          </UiSubMenuTrigger>

          <UiSubMenuContent
            class-name="ui-submenu-content datagrid-column-menu__submenu-panel"
            :style="menuThemeVars"
          >
            <UiMenuItem
              v-if="isActionVisible('pinLeft')"
              class="datagrid-column-menu__item"
              data-datagrid-column-menu-action="pin-left"
              :data-disabled-reason="resolveActionDisabledTitle('pinLeft', pinSectionDisabled, 'pin')"
              :disabled="isActionDisabled('pinLeft', pinSectionDisabled)"
              :title="resolveActionDisabledTitle('pinLeft', pinSectionDisabled, 'pin')"
              @select="$emit('pin', 'left')"
            >
              <span :title="resolveActionDisabledTitle('pinLeft', pinSectionDisabled, 'pin')">{{ pinLeftLabel }}</span>
              <span v-if="pin === 'left'" class="datagrid-column-menu__state">Active</span>
            </UiMenuItem>

            <UiMenuItem
              v-if="isActionVisible('pinRight')"
              class="datagrid-column-menu__item"
              data-datagrid-column-menu-action="pin-right"
              :data-disabled-reason="resolveActionDisabledTitle('pinRight', pinSectionDisabled, 'pin')"
              :disabled="isActionDisabled('pinRight', pinSectionDisabled)"
              :title="resolveActionDisabledTitle('pinRight', pinSectionDisabled, 'pin')"
              @select="$emit('pin', 'right')"
            >
              <span :title="resolveActionDisabledTitle('pinRight', pinSectionDisabled, 'pin')">{{ pinRightLabel }}</span>
              <span v-if="pin === 'right'" class="datagrid-column-menu__state">Active</span>
            </UiMenuItem>

            <UiMenuItem
              v-if="isActionVisible('unpin')"
              class="datagrid-column-menu__item"
              data-datagrid-column-menu-action="pin-none"
              :data-disabled-reason="resolveActionDisabledTitle('unpin', pinSectionDisabled || pin === 'none', 'pin')"
              :disabled="isActionDisabled('unpin', pinSectionDisabled || pin === 'none')"
              :title="resolveActionDisabledTitle('unpin', pinSectionDisabled || pin === 'none', 'pin')"
              @select="$emit('pin', 'none')"
            >
              <span :title="resolveActionDisabledTitle('unpin', pinSectionDisabled || pin === 'none', 'pin')">{{ unpinLabel }}</span>
            </UiMenuItem>
          </UiSubMenuContent>
        </UiSubMenu>

        <section
          v-else-if="section === 'filter'"
          :class="[
            'datagrid-column-menu__section',
            'datagrid-column-menu__section--filter',
            {
              'datagrid-column-menu__section--with-values': effectiveValueFilterEnabled,
            },
          ]"
          @mousedown.stop
          @click.stop
        >
        <div class="datagrid-column-menu__section-head">
          <span class="datagrid-column-menu__section-title">
            {{ filterSectionLabel }}
          </span>
          <button
            v-if="isActionVisible('clearFilter')"
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="clear-filter"
            :data-disabled-reason="resolveActionDisabledTitle('clearFilter', filterSectionDisabled || !filterActive, 'filter')"
            :disabled="isActionDisabled('clearFilter', filterSectionDisabled || !filterActive)"
            :title="resolveActionDisabledTitle('clearFilter', filterSectionDisabled || !filterActive, 'filter')"
            @click="handleClearFilter"
          >
            {{ clearFilterLabel }}
          </button>
        </div>

        <input
          v-if="showTextFilterInput"
          :value="textFilterValue"
          class="datagrid-column-menu__search"
          type="search"
          placeholder="Type to filter rows"
          :disabled="filterSectionDisabled"
          :title="resolveSectionDisabledTitle('filter', filterSectionDisabled)"
          @mousedown.stop
          @click.stop
          @keydown.stop
          @input="handleTextFilterInput"
        />

        <div
          v-if="textFilterEnabled && !effectiveValueFilterEnabled"
          class="datagrid-column-menu__hint"
        >
          {{ valueFilterDisabledByRowLimit
            ? 'Value filter is disabled for this dataset size. Use text filter instead.'
            : 'Value filter is unavailable here. Use text filter instead.' }}
        </div>

        <input
          v-if="effectiveValueFilterEnabled"
          v-model="query"
          class="datagrid-column-menu__search"
          type="search"
          placeholder="Search values"
          :disabled="filterSectionDisabled"
          :title="resolveSectionDisabledTitle('filter', filterSectionDisabled)"
          @mousedown.stop
          @click.stop
          @keydown.stop
        />

        <label
          v-if="effectiveValueFilterEnabled && hasSearchQuery && isActionVisible('addCurrentSelectionToFilter')"
          class="datagrid-column-menu__merge-toggle"
          data-datagrid-column-menu-action="add-current-selection"
        >
          <input
            type="checkbox"
            :checked="addCurrentSelectionToFilter"
            :disabled="isActionDisabled('addCurrentSelectionToFilter', filterSectionDisabled)"
            :title="resolveActionDisabledTitle('addCurrentSelectionToFilter', filterSectionDisabled, 'filter')"
            @change="toggleAddCurrentSelectionToFilter"
          />
          <span>{{ addCurrentSelectionToFilterLabel }}</span>
        </label>

        <UiMenuSeparator v-if="effectiveValueFilterEnabled" class="datagrid-column-menu__section-separator" />

        <div v-if="effectiveValueFilterEnabled" class="datagrid-column-menu__toolbar">
          <button
            v-if="isActionVisible('selectAllValues')"
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="select-all-values"
            :data-disabled-reason="resolveActionDisabledTitle('selectAllValues', filterSectionDisabled || valueEntries.length === 0 || isAllValuesSelected, 'filter')"
            :disabled="isActionDisabled('selectAllValues', filterSectionDisabled || valueEntries.length === 0 || isAllValuesSelected)"
            :title="resolveActionDisabledTitle('selectAllValues', filterSectionDisabled || valueEntries.length === 0 || isAllValuesSelected, 'filter')"
            @click="selectAllValues"
          >
            {{ selectAllValuesLabel }}
          </button>
          <button
            v-if="isActionVisible('clearAllValues')"
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="clear-all-values"
            :data-disabled-reason="resolveActionDisabledTitle('clearAllValues', filterSectionDisabled || draftSelectedTokens.length === 0, 'filter')"
            :disabled="isActionDisabled('clearAllValues', filterSectionDisabled || draftSelectedTokens.length === 0)"
            :title="resolveActionDisabledTitle('clearAllValues', filterSectionDisabled || draftSelectedTokens.length === 0, 'filter')"
            @click="clearAllValues"
          >
            {{ clearAllValuesLabel }}
          </button>
          <div class="datagrid-column-menu__summary">
            {{ appliedSelectedCount }} / {{ appliedSelectableCount }} selected
          </div>
        </div>

        <div v-if="effectiveValueFilterEnabled" class="datagrid-column-menu__values">
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
                :disabled="filterSectionDisabled"
                :title="resolveSectionDisabledTitle('filter', filterSectionDisabled)"
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

        <div v-if="effectiveValueFilterEnabled && hiddenMatchCount > 0" class="datagrid-column-menu__summary">
          Showing first {{ visibleValues.length }} values. Use search to filter all {{ matchedValues.length }}.
        </div>

        <div v-if="effectiveValueFilterEnabled && appliedFilterTokens.length === 0" class="datagrid-column-menu__hint">
          Select at least one value to apply the filter.
        </div>

        <UiMenuSeparator v-if="effectiveValueFilterEnabled" class="datagrid-column-menu__section-separator" />

        <div v-if="effectiveValueFilterEnabled" class="datagrid-column-menu__footer">
          <button
            v-if="isActionVisible('cancelFilter')"
            type="button"
            class="datagrid-column-menu__button datagrid-column-menu__button--secondary"
            data-datagrid-column-menu-action="cancel-filter"
            @click="closeMenu"
          >
            {{ cancelFilterLabel }}
          </button>
          <button
            v-if="isActionVisible('applyFilter')"
            type="button"
            class="datagrid-column-menu__button datagrid-column-menu__button--primary"
            data-datagrid-column-menu-action="apply-filter"
            :data-disabled-reason="resolveActionDisabledTitle('applyFilter', filterSectionDisabled || !canApplyFilter, 'filter')"
            :disabled="isActionDisabled('applyFilter', filterSectionDisabled || !canApplyFilter)"
            :title="resolveActionDisabledTitle('applyFilter', filterSectionDisabled || !canApplyFilter, 'filter')"
            @click="handleApplyFilter"
          >
            {{ applyFilterLabel }}
          </button>
        </div>
        </section>
      </template>
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
import type {
  DataGridColumnMenuActionKey,
  DataGridColumnMenuActionOptions,
  DataGridColumnMenuDisabledReasons,
  DataGridColumnMenuItemKey,
  DataGridColumnMenuItemLabels,
} from "./dataGridColumnMenu"
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

const DATAGRID_COLUMN_MENU_VALUE_FILTER_HARD_ROW_LIMIT = 100_000

const props = defineProps<{
  rows: readonly Record<string, unknown>[]
  items: readonly DataGridColumnMenuItemKey[]
  disabledItems: readonly DataGridColumnMenuItemKey[]
  disabledReasons: DataGridColumnMenuDisabledReasons
  labels: DataGridColumnMenuItemLabels
  actionOptions: DataGridColumnMenuActionOptions
  columnKey: string
  columnLabel: string
  columnDataType?: string
  sortDirection: "asc" | "desc" | null
  sortEnabled: boolean
  pin: DataGridColumnPin
  grouped: boolean
  groupOrder: number | null
  groupEnabled: boolean
  filterEnabled: boolean
  valueFilterRowLimit: number
  textFilterEnabled: boolean
  textFilterValue: string
  filterActive: boolean
  selectedFilterTokens: readonly string[]
  maxFilterValues: number
}>()

const emit = defineEmits<{
  (event: "sort", direction: "asc" | "desc" | null): void
  (event: "pin", pin: DataGridColumnPin): void
  (event: "group", grouped: boolean): void
  (event: "apply-filter", tokens: readonly string[]): void
  (event: "clear-filter"): void
  (event: "update-text-filter", value: string): void
}>()

const menuRef = ref<UiMenuRef | null>(null)
const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const open = ref(false)
const query = ref("")
const addCurrentSelectionToFilter = ref(false)
const valueEntries = ref<readonly DataGridColumnMenuValueEntry[]>([])
const draftSelectedTokens = ref<readonly string[]>([])
const menuThemeVars = ref<Record<string, string>>({})
const sortLabels = computed(() => resolveColumnMenuSortLabels(props.columnDataType))
const disabledItems = computed(() => new Set(props.disabledItems))
const groupOrderLabel = computed(() => {
  if (!props.grouped || !Number.isFinite(props.groupOrder)) {
    return null
  }
  return `Level ${Number(props.groupOrder) + 1}`
})

const resolvedValueFilterRowLimit = computed(() => {
  const configuredLimit = Number.isFinite(props.valueFilterRowLimit) && props.valueFilterRowLimit >= 0
    ? props.valueFilterRowLimit
    : Number.POSITIVE_INFINITY
  return Math.min(configuredLimit, DATAGRID_COLUMN_MENU_VALUE_FILTER_HARD_ROW_LIMIT)
})
const effectiveValueFilterEnabled = computed(() => {
  if (!props.filterEnabled) {
    return false
  }
  return props.rows.length <= resolvedValueFilterRowLimit.value
})
const valueFilterDisabledByRowLimit = computed(() => (
  props.filterEnabled && !effectiveValueFilterEnabled.value
))
const visibleSections = computed<readonly DataGridColumnMenuItemKey[]>(() => {
  return props.items.filter(section => {
    if (section === "sort") {
      return isActionVisible("sortAsc") || isActionVisible("sortDesc") || isActionVisible("clearSort")
    }
    if (section === "group") {
      return isActionVisible("toggleGroup")
    }
    if (section === "pin") {
      return showPinSection.value
    }
    if (section === "filter") {
      return hasAnyFilterControls.value
    }
    return true
  })
})
const sortSectionDisabled = computed(() => disabledItems.value.has("sort"))
const groupSectionDisabled = computed(() => disabledItems.value.has("group"))
const pinSectionDisabled = computed(() => disabledItems.value.has("pin"))
const filterSectionDisabled = computed(() => disabledItems.value.has("filter"))
const selectedTokenSet = computed(() => new Set(draftSelectedTokens.value))
const hasAnyFilterControls = computed(() => effectiveValueFilterEnabled.value || props.textFilterEnabled)
const showTextFilterInput = computed(() => props.textFilterEnabled && !effectiveValueFilterEnabled.value)
const hasSearchQuery = computed(() => query.value.trim().length > 0)
const showPinSection = computed(() => (
  isActionVisible("pinMenu")
  && (isActionVisible("pinLeft") || isActionVisible("pinRight") || isActionVisible("unpin"))
))
const groupActionLabel = computed(() => resolveActionLabel(
  "toggleGroup",
  props.labels.group ?? (props.grouped ? "Ungroup column" : "Group by this column"),
))
const pinMenuLabel = computed(() => resolveActionLabel("pinMenu", props.labels.pin ?? "Pin column"))
const filterSectionLabel = computed(() => props.labels.filter ?? (effectiveValueFilterEnabled.value ? "Filter" : "Filter by text"))
const sortAscLabel = computed(() => resolveActionLabel("sortAsc", sortLabels.value.asc))
const sortDescLabel = computed(() => resolveActionLabel("sortDesc", sortLabels.value.desc))
const clearSortLabel = computed(() => resolveActionLabel("clearSort", "Clear sort"))
const pinLeftLabel = computed(() => resolveActionLabel("pinLeft", "Pin left"))
const pinRightLabel = computed(() => resolveActionLabel("pinRight", "Pin right"))
const unpinLabel = computed(() => resolveActionLabel("unpin", "Unpin"))
const clearFilterLabel = computed(() => resolveActionLabel("clearFilter", "Clear filter"))
const addCurrentSelectionToFilterLabel = computed(() => resolveActionLabel(
  "addCurrentSelectionToFilter",
  "Add current selection to filter",
))
const selectAllValuesLabel = computed(() => resolveActionLabel("selectAllValues", "Select all"))
const clearAllValuesLabel = computed(() => resolveActionLabel("clearAllValues", "Clear all"))
const cancelFilterLabel = computed(() => resolveActionLabel("cancelFilter", "Cancel"))
const applyFilterLabel = computed(() => resolveActionLabel("applyFilter", "Apply"))

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
  effectiveValueFilterEnabled.value
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

watch(
  () => [
    open.value,
    props.filterEnabled,
    props.valueFilterRowLimit,
    props.columnKey,
    props.rows.length,
    props.selectedFilterTokens.length,
  ] as const,
  ([isOpen]) => {
    if (!isOpen) {
      return
    }
    resetFilterDraft()
  },
)

function normalizeColumnMenuToken(token: string): string {
  return token.startsWith("string:")
    ? `string:${token.slice("string:".length).toLowerCase()}`
    : token
}

function isActionVisible(actionKey: DataGridColumnMenuActionKey): boolean {
  return props.actionOptions[actionKey]?.hidden !== true
}

function isActionDisabled(actionKey: DataGridColumnMenuActionKey, fallback = false): boolean {
  return fallback || props.actionOptions[actionKey]?.disabled === true
}

function resolveActionLabel(actionKey: DataGridColumnMenuActionKey, fallback: string): string {
  return props.actionOptions[actionKey]?.label ?? fallback
}

function resolveSectionDisabledReason(sectionKey: DataGridColumnMenuItemKey): string {
  return props.disabledReasons[sectionKey] ?? ""
}

function resolveSectionDisabledTitle(sectionKey: DataGridColumnMenuItemKey, disabled: boolean): string | undefined {
  if (!disabled) {
    return undefined
  }
  const reason = resolveSectionDisabledReason(sectionKey)
  return reason.length > 0 ? reason : undefined
}

function resolveActionDisabledTitle(
  actionKey: DataGridColumnMenuActionKey,
  fallbackDisabled = false,
  sectionKey?: DataGridColumnMenuItemKey,
): string | undefined {
  const disabled = isActionDisabled(actionKey, fallbackDisabled)
  if (!disabled) {
    return undefined
  }
  const actionReason = props.actionOptions[actionKey]?.disabledReason?.trim() ?? ""
  if (actionReason.length > 0) {
    return actionReason
  }
  if (sectionKey) {
    return resolveSectionDisabledTitle(sectionKey, true)
  }
  return undefined
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

function openMenuFromElement(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  const controller = menuRef.value?.controller
  if (!controller) {
    return
  }
  const rect = element.getBoundingClientRect()
  controller.setAnchor({
    x: rect.left,
    y: rect.bottom,
    width: rect.width,
    height: 0,
  })
  controller.open("programmatic")
}

function toggleMenuFromElement(element: HTMLElement | null): void {
  if (open.value) {
    closeMenu()
    return
  }
  openMenuFromElement(element)
}

function syncMenuThemeVars(): void {
  menuThemeVars.value = readDataGridOverlayThemeVars(rootElementRef.value)
}

function resetFilterDraft(): void {
  query.value = ""
  addCurrentSelectionToFilter.value = false
  if (!effectiveValueFilterEnabled.value) {
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
  if (filterSectionDisabled.value) {
    return
  }
  const next = new Set(draftSelectedTokens.value)
  if (next.has(token)) {
    next.delete(token)
  } else {
    next.add(token)
  }
  draftSelectedTokens.value = [...next]
}

function selectAllValues(): void {
  if (filterSectionDisabled.value) {
    return
  }
  draftSelectedTokens.value = valueEntries.value.map(entry => entry.token)
}

function clearAllValues(): void {
  if (filterSectionDisabled.value) {
    return
  }
  draftSelectedTokens.value = []
}

function toggleAddCurrentSelectionToFilter(event: Event): void {
  if (filterSectionDisabled.value) {
    return
  }
  addCurrentSelectionToFilter.value = (event.target as HTMLInputElement).checked
}

function handleApplyFilter(): void {
  if (filterSectionDisabled.value || !canApplyFilter.value) {
    return
  }
  if (appliedFilterTokens.value.length === valueEntries.value.length) {
    emit("clear-filter")
  } else {
    emit("apply-filter", [...appliedFilterTokens.value])
  }
  closeMenu()
}

function handleTextFilterInput(event: Event): void {
  if (filterSectionDisabled.value) {
    return
  }
  emit("update-text-filter", (event.target as HTMLInputElement).value)
}

function handleClearFilter(): void {
  if (filterSectionDisabled.value || !props.filterActive) {
    return
  }
  emit("clear-filter")
  closeMenu()
}

function handleToggleGroup(): void {
  if (isActionDisabled("toggleGroup", groupSectionDisabled.value || !props.groupEnabled)) {
    return
  }
  emit("group", !props.grouped)
  closeMenu()
}

function resolveColumnMenuSortLabels(
  dataType: string | undefined,
): { asc: string; desc: string } {
  switch (dataType) {
    case "date":
    case "datetime":
      return {
        asc: "Sort oldest to newest",
        desc: "Sort newest to oldest",
      }
    case "number":
    case "currency":
    case "percent":
      return {
        asc: "Sort smallest to largest",
        desc: "Sort largest to smallest",
      }
    case "boolean":
      return {
        asc: "Sort false to true",
        desc: "Sort true to false",
      }
    default:
      return {
        asc: "Sort A to Z",
        desc: "Sort Z to A",
      }
  }
}
</script>
