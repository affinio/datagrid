<template>
  <UiMenu ref="menuRef" :callbacks="menuCallbacks" :options="rootMenuOptions">
    <UiMenuTrigger v-if="contextMenuEnabled" as-child trigger="contextmenu">
      <slot
        :open="open"
        :toggle-menu-from-element="toggleMenuFromElement"
      />
    </UiMenuTrigger>
    <slot
      v-else
      :open="open"
      :toggle-menu-from-element="toggleMenuFromElement"
    />

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
      <UiMenuSeparator v-if="menuEntries.length > 0" />

      <template v-for="(entry, index) in menuEntries" :key="entry.key">
        <UiMenuSeparator v-if="index > 0" />

        <template v-if="entry.kind === 'section' && entry.key === 'sort'">
          <UiMenuItem
            v-if="isActionVisible('sortAsc')"
            class="datagrid-column-menu__item"
            data-datagrid-column-menu-action="sort-asc"
            :data-disabled-reason="resolveActionDisabledTitle('sortAsc', sortSectionDisabled || !sortEnabled, 'sort')"
            :disabled="isActionDisabled('sortAsc', sortSectionDisabled || !sortEnabled)"
            :title="resolveActionDisabledTitle('sortAsc', sortSectionDisabled || !sortEnabled, 'sort')"
            @select="handleSortSelect('asc')"
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
            @select="handleSortSelect('desc')"
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
            @select="handleSortSelect(null)"
          >
            <span :title="resolveActionDisabledTitle('clearSort', sortSectionDisabled || !sortEnabled || sortDirection === null, 'sort')">{{ clearSortLabel }}</span>
          </UiMenuItem>
        </template>

        <UiMenuItem
          v-else-if="entry.kind === 'section' && entry.key === 'group' && isActionVisible('toggleGroup')"
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

        <UiSubMenu v-else-if="entry.kind === 'section' && entry.key === 'pin' && showPinSection" :options="submenuOptions">
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
          v-else-if="entry.kind === 'section' && entry.key === 'filter'"
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
          :name="`datagrid-column-menu-text-filter-${columnKey}`"
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
          :name="`datagrid-column-menu-value-search-${columnKey}`"
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
            :name="`datagrid-column-menu-add-selection-${columnKey}`"
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
            :data-disabled-reason="resolveActionDisabledTitle('selectAllValues', filterSectionDisabled || valueEntriesBusy || valueEntries.length === 0 || isAllValuesSelected, 'filter')"
            :disabled="isActionDisabled('selectAllValues', filterSectionDisabled || valueEntriesBusy || valueEntries.length === 0 || isAllValuesSelected)"
            :title="resolveActionDisabledTitle('selectAllValues', filterSectionDisabled || valueEntriesBusy || valueEntries.length === 0 || isAllValuesSelected, 'filter')"
            @click="selectAllValues"
          >
            {{ selectAllValuesLabel }}
          </button>
          <button
            v-if="isActionVisible('clearAllValues')"
            type="button"
            class="datagrid-column-menu__link"
            data-datagrid-column-menu-action="clear-all-values"
            :data-disabled-reason="resolveActionDisabledTitle('clearAllValues', filterSectionDisabled || valueEntriesBusy || draftSelectedTokens.length === 0, 'filter')"
            :disabled="isActionDisabled('clearAllValues', filterSectionDisabled || valueEntriesBusy || draftSelectedTokens.length === 0)"
            :title="resolveActionDisabledTitle('clearAllValues', filterSectionDisabled || valueEntriesBusy || draftSelectedTokens.length === 0, 'filter')"
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
            ref="valuesListRef"
            class="datagrid-column-menu__values-list"
            role="listbox"
            aria-multiselectable="true"
            :aria-label="`Filter values for ${columnLabel}`"
            @scroll.passive="handleValuesListScroll"
          >
            <div v-if="valueEntriesLoading" class="datagrid-column-menu__empty">
              Loading values...
            </div>

            <div v-else-if="valueEntriesError" class="datagrid-column-menu__empty">
              Unable to load values
            </div>

            <template v-else>
              <label
                v-for="entry in visibleValues"
                :key="entry.token"
                class="datagrid-column-menu__value"
                role="option"
                :aria-selected="selectedTokenSet.has(entry.token)"
              >
                <input
                  :name="`datagrid-column-menu-value-${columnKey}-${entry.token}`"
                  type="checkbox"
                  :checked="selectedTokenSet.has(entry.token)"
                  :disabled="filterSectionDisabled"
                  :title="resolveSectionDisabledTitle('filter', filterSectionDisabled)"
                  @change="toggleFilterValue(entry.token)"
                />
                <span class="datagrid-column-menu__value-label">{{ entry.label }}</span>
                <span class="datagrid-column-menu__value-count">{{ entry.count }}</span>
              </label>
            </template>

            <div v-if="!valueEntriesLoading && !valueEntriesError && visibleValues.length === 0" class="datagrid-column-menu__empty">
              {{ hasSearchQuery ? 'No matching values' : 'No values' }}
            </div>
          </div>
        </div>

        <div v-if="effectiveValueFilterEnabled && hiddenMatchCount > 0" class="datagrid-column-menu__summary">
          Showing {{ visibleValues.length }} of {{ matchedValues.length }} values. Scroll to load more or search.
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
            :data-disabled-reason="resolveActionDisabledTitle('applyFilter', filterSectionDisabled || valueEntriesBusy || !canApplyFilter, 'filter')"
            :disabled="isActionDisabled('applyFilter', filterSectionDisabled || valueEntriesBusy || !canApplyFilter)"
            :title="resolveActionDisabledTitle('applyFilter', filterSectionDisabled || valueEntriesBusy || !canApplyFilter, 'filter')"
            @click="handleApplyFilter"
          >
            {{ applyFilterLabel }}
          </button>
        </div>
        </section>

        <DataGridColumnMenuCustomEntry
          v-else-if="entry.kind === 'custom'"
          :item="entry.item"
          :menu-theme-vars="menuThemeVars"
          :submenu-options="submenuOptions"
          @select="handleCustomItemSelect"
        />
      </template>
    </UiMenuContent>
  </UiMenu>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue"
import type { DataGridColumnHistogramEntry } from "@affino/datagrid-vue"
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
import DataGridColumnMenuCustomEntry from "./DataGridColumnMenuCustomEntry.vue"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import type {
  DataGridColumnMenuActionKey,
  DataGridColumnMenuActionOptions,
  DataGridColumnMenuCustomItem,
  DataGridColumnMenuCustomLeafItem,
  DataGridColumnMenuDisabledReasons,
  DataGridColumnMenuItemKey,
  DataGridColumnMenuItemLabels,
  DataGridColumnMenuTriggerMode,
} from "./dataGridColumnMenu"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"

type DataGridColumnPin = "left" | "right" | "none"

interface DataGridColumnMenuValueEntry {
  token: string
  label: string
  count: number
  searchText: string
}

type DataGridColumnMenuRenderableEntry =
  | { kind: "section"; key: DataGridColumnMenuItemKey }
  | { kind: "custom"; key: string; item: DataGridColumnMenuCustomItem }

type DataGridColumnMenuValueEntriesResult =
  | readonly DataGridColumnHistogramEntry[]
  | Promise<readonly DataGridColumnHistogramEntry[]>

interface UiMenuRef {
  controller?: {
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
  }
}

const DATAGRID_COLUMN_MENU_VALUE_FILTER_HARD_ROW_LIMIT = 100_000
const DATAGRID_COLUMN_MENU_DEFER_VALUE_LOAD_ROW_THRESHOLD = 10_000

const props = defineProps<{
  rowCount: number
  resolveValueEntries?: ((search?: string) => DataGridColumnMenuValueEntriesResult) | undefined
  items: readonly DataGridColumnMenuItemKey[]
  disabledItems: readonly DataGridColumnMenuItemKey[]
  disabledReasons: DataGridColumnMenuDisabledReasons
  labels: DataGridColumnMenuItemLabels
  actionOptions: DataGridColumnMenuActionOptions
  customItems: readonly DataGridColumnMenuCustomItem[]
  triggerMode: DataGridColumnMenuTriggerMode
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
const valuesListRef = ref<HTMLElement | null>(null)
const valueEntries = ref<readonly DataGridColumnMenuValueEntry[]>([])
const valueEntriesLoading = ref(false)
const valueEntriesError = ref<string | null>(null)
const draftSelectedTokens = ref<readonly string[]>([])
const renderedValueCount = ref(0)
const menuThemeVars = ref<Record<string, string>>({})
const includeNewValueEntriesByDefault = ref(false)
let valueEntriesRequestId = 0
let suppressNextQueryReload = false
let deferredValueEntriesLoadCancel: (() => void) | null = null
const sortLabels = computed(() => resolveColumnMenuSortLabels(props.columnDataType))
const disabledItems = computed(() => new Set(props.disabledItems))
const contextMenuEnabled = computed(() => props.triggerMode !== "button")
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
const valueRenderBatchSize = computed(() => {
  return Number.isFinite(props.maxFilterValues) && props.maxFilterValues > 0
    ? Math.max(20, Math.trunc(props.maxFilterValues))
    : 120
})
const effectiveValueFilterEnabled = computed(() => {
  if (!props.filterEnabled) {
    return false
  }
  return props.rowCount <= resolvedValueFilterRowLimit.value
})
const shouldDeferInitialValueEntriesLoad = computed(() => (
  props.rowCount >= DATAGRID_COLUMN_MENU_DEFER_VALUE_LOAD_ROW_THRESHOLD
))
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
const menuEntries = computed<readonly DataGridColumnMenuRenderableEntry[]>(() => {
  return createColumnMenuEntries(visibleSections.value, props.customItems)
})
const sortSectionDisabled = computed(() => disabledItems.value.has("sort"))
const groupSectionDisabled = computed(() => disabledItems.value.has("group"))
const pinSectionDisabled = computed(() => disabledItems.value.has("pin"))
const filterSectionDisabled = computed(() => disabledItems.value.has("filter"))
const selectedTokenSet = computed(() => new Set(draftSelectedTokens.value))
const hasAnyFilterControls = computed(() => effectiveValueFilterEnabled.value || props.textFilterEnabled)
const showTextFilterInput = computed(() => props.textFilterEnabled && !effectiveValueFilterEnabled.value)
const hasSearchQuery = computed(() => query.value.trim().length > 0)
const valueEntriesBusy = computed(() => valueEntriesLoading.value || valueEntriesError.value !== null)
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
  return matchedValues.value.slice(0, renderedValueCount.value)
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
  && !valueEntriesBusy.value
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
    cancelDeferredValueEntriesLoad()
  },
}

watch(query, value => {
  resetValuesListScroll()
  if (value.trim().length === 0) {
    addCurrentSelectionToFilter.value = false
    resetRenderedValueCount()
  }
  if (suppressNextQueryReload) {
    suppressNextQueryReload = false
    return
  }
  if (open.value && effectiveValueFilterEnabled.value) {
    startValueEntriesLoad(false)
  }
})

watch(rootElementRef, () => {
  if (open.value) {
    syncMenuThemeVars()
  }
})

watch(
  () => [
    props.filterEnabled,
    props.valueFilterRowLimit,
    props.columnKey,
    props.rowCount,
    props.selectedFilterTokens.length,
  ] as const,
  () => {
    if (!open.value) {
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

function isCustomItemDisabled(item: DataGridColumnMenuCustomItem): boolean {
  return item.disabled === true
}

function formatColumnMenuValueLabel(value: unknown, fallbackText?: string): string {
  if (value == null) {
    return "(Blanks)"
  }
  const text = typeof fallbackText === "string" && fallbackText.length > 0
    ? fallbackText
    : String(value)
  return text.length > 0 ? text : "(Blanks)"
}

function collectColumnMenuValueEntries(
  entries: readonly DataGridColumnHistogramEntry[],
): readonly DataGridColumnMenuValueEntry[] {
  const normalizedEntries: DataGridColumnMenuValueEntry[] = []
  for (const entry of entries) {
    const token = normalizeColumnMenuToken(String(entry.token ?? ""))
    if (!token) {
      continue
    }
    const label = formatColumnMenuValueLabel(entry.value, entry.text)
    normalizedEntries.push({
      token,
      label,
      count: Math.max(0, Math.trunc(entry.count)),
      searchText: label.toLowerCase(),
    })
  }
  return normalizedEntries.sort((left, right) => (
    left.label.localeCompare(right.label, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  ))
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return typeof (value as { then?: unknown })?.then === "function"
}

function closeMenu(): void {
  menuRef.value?.controller?.close("programmatic")
}

function handleSortSelect(direction: "asc" | "desc" | null): void {
  closeMenu()
  emit("sort", direction)
}

async function handleCustomItemSelect(item: DataGridColumnMenuCustomLeafItem): Promise<void> {
  if (isCustomItemDisabled(item)) {
    return
  }
  await item.onSelect?.({
    columnKey: props.columnKey,
    columnLabel: props.columnLabel,
    closeMenu,
  })
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
  if (query.value !== "") {
    suppressNextQueryReload = true
    query.value = ""
  }
  addCurrentSelectionToFilter.value = false
  resetRenderedValueCount()
  resetValuesListScroll()
  cancelDeferredValueEntriesLoad()
  if (!effectiveValueFilterEnabled.value) {
    valueEntries.value = []
    valueEntriesLoading.value = false
    valueEntriesError.value = null
    draftSelectedTokens.value = []
    includeNewValueEntriesByDefault.value = false
    return
  }
  startValueEntriesLoad(true, { defer: shouldDeferInitialValueEntriesLoad.value })
}

function cancelDeferredValueEntriesLoad(): void {
  deferredValueEntriesLoadCancel?.()
  deferredValueEntriesLoadCancel = null
}

function scheduleValueEntriesLoadFrame(callback: () => void): void {
  if (
    typeof window !== "undefined"
    && typeof window.requestAnimationFrame === "function"
    && typeof window.cancelAnimationFrame === "function"
  ) {
    const frameId = window.requestAnimationFrame(() => {
      deferredValueEntriesLoadCancel = null
      callback()
    })
    deferredValueEntriesLoadCancel = () => window.cancelAnimationFrame(frameId)
    return
  }

  const timeoutId = globalThis.setTimeout(() => {
    deferredValueEntriesLoadCancel = null
    callback()
  }, 0)
  deferredValueEntriesLoadCancel = () => globalThis.clearTimeout(timeoutId)
}

function startValueEntriesLoad(resetSelection: boolean, options: { defer?: boolean } = {}): void {
  cancelDeferredValueEntriesLoad()
  const requestId = valueEntriesRequestId + 1
  valueEntriesRequestId = requestId
  valueEntriesLoading.value = true
  valueEntriesError.value = null

  if (!options.defer) {
    void loadValueEntriesForRequest(requestId, resetSelection)
    return
  }

  let frameCount = 0
  const runAfterMenuPaint = () => {
    if (!open.value || requestId !== valueEntriesRequestId || !effectiveValueFilterEnabled.value) {
      return
    }
    frameCount += 1
    if (frameCount < 3) {
      scheduleValueEntriesLoadFrame(runAfterMenuPaint)
      return
    }
    void loadValueEntriesForRequest(requestId, resetSelection)
  }

  // Let the menu paint before expensive local histograms run.
  scheduleValueEntriesLoadFrame(runAfterMenuPaint)
}

async function loadValueEntriesForRequest(requestId: number, resetSelection: boolean): Promise<void> {
  try {
    const result = props.resolveValueEntries?.(query.value.trim()) ?? []
    const rawEntries = isPromiseLike(result) ? await result : result
    if (requestId !== valueEntriesRequestId) {
      return
    }
    const entries = collectColumnMenuValueEntries(rawEntries)
    valueEntries.value = entries
    syncDraftSelectedTokens(entries, resetSelection)
  } catch (error) {
    if (requestId !== valueEntriesRequestId) {
      return
    }
    valueEntries.value = []
    valueEntriesError.value = error instanceof Error ? error.message : String(error)
    draftSelectedTokens.value = []
    includeNewValueEntriesByDefault.value = false
  } finally {
    if (requestId === valueEntriesRequestId) {
      valueEntriesLoading.value = false
    }
  }
}

function syncDraftSelectedTokens(
  entries: readonly DataGridColumnMenuValueEntry[],
  resetSelection: boolean,
): void {
  const activeTokens = Array.from(new Set(
    props.selectedFilterTokens
      .map(token => normalizeColumnMenuToken(String(token ?? "")))
      .filter(Boolean),
  ))
  if (resetSelection) {
    const entryTokenSet = new Set(entries.map(entry => entry.token))
    const visibleActiveTokens = activeTokens.filter(token => entryTokenSet.has(token))
    includeNewValueEntriesByDefault.value = activeTokens.length === 0
    draftSelectedTokens.value = visibleActiveTokens.length > 0
      ? visibleActiveTokens
      : entries.map(entry => entry.token)
    return
  }

  const nextTokens = new Set(draftSelectedTokens.value.map(token => normalizeColumnMenuToken(String(token ?? ""))).filter(Boolean))
  for (const token of activeTokens) {
    nextTokens.add(token)
  }
  if (includeNewValueEntriesByDefault.value) {
    for (const entry of entries) {
      nextTokens.add(entry.token)
    }
  }
  if (nextTokens.size === 0 && activeTokens.length === 0) {
    for (const entry of entries) {
      nextTokens.add(entry.token)
    }
    includeNewValueEntriesByDefault.value = true
  }
  draftSelectedTokens.value = Array.from(nextTokens)
}

function resetRenderedValueCount(): void {
  renderedValueCount.value = valueRenderBatchSize.value
}

function resetValuesListScroll(): void {
  if (valuesListRef.value) {
    valuesListRef.value.scrollTop = 0
  }
}

function handleValuesListScroll(event: Event): void {
  if (hasSearchQuery.value) {
    return
  }
  if (renderedValueCount.value >= matchedValues.value.length) {
    return
  }
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }
  const remaining = target.scrollHeight - (target.scrollTop + target.clientHeight)
  if (remaining > 24) {
    return
  }
  renderedValueCount.value = Math.min(
    matchedValues.value.length,
    renderedValueCount.value + valueRenderBatchSize.value,
  )
}

function toggleFilterValue(token: string): void {
  if (filterSectionDisabled.value) {
    return
  }
  includeNewValueEntriesByDefault.value = false
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
  includeNewValueEntriesByDefault.value = true
  draftSelectedTokens.value = valueEntries.value.map(entry => entry.token)
}

function clearAllValues(): void {
  if (filterSectionDisabled.value) {
    return
  }
  includeNewValueEntriesByDefault.value = false
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
  if (!hasSearchQuery.value && appliedFilterTokens.value.length === valueEntries.value.length) {
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

function createColumnMenuEntries(
  sections: readonly DataGridColumnMenuItemKey[],
  customItems: readonly DataGridColumnMenuCustomItem[],
): readonly DataGridColumnMenuRenderableEntry[] {
  const startEntries: DataGridColumnMenuRenderableEntry[] = []
  const endEntries: DataGridColumnMenuRenderableEntry[] = []
  const beforeEntries = new Map<DataGridColumnMenuItemKey, DataGridColumnMenuRenderableEntry[]>()
  const afterEntries = new Map<DataGridColumnMenuItemKey, DataGridColumnMenuRenderableEntry[]>()
  const visibleSectionsSet = new Set(sections)

  for (const item of customItems) {
    if (item.hidden === true) {
      continue
    }
    const entry: DataGridColumnMenuRenderableEntry = {
      kind: "custom",
      key: item.key,
      item,
    }
    const placement = item.placement ?? "end"
    if (placement === "start") {
      startEntries.push(entry)
      continue
    }
    if (placement === "end") {
      endEntries.push(entry)
      continue
    }
    const [position, section] = placement.split(":") as ["before" | "after", DataGridColumnMenuItemKey]
    if (!visibleSectionsSet.has(section)) {
      endEntries.push(entry)
      continue
    }
    const targetEntries = position === "before" ? beforeEntries : afterEntries
    const bucket = targetEntries.get(section)
    if (bucket) {
      bucket.push(entry)
    } else {
      targetEntries.set(section, [entry])
    }
  }

  const entries: DataGridColumnMenuRenderableEntry[] = [...startEntries]
  for (const section of sections) {
    entries.push(...(beforeEntries.get(section) ?? []))
    entries.push({ kind: "section", key: section })
    entries.push(...(afterEntries.get(section) ?? []))
  }
  entries.push(...endEntries)
  return Object.freeze(entries)
}
</script>
