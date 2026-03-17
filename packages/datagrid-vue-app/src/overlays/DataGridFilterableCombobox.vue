<template>
  <div ref="rootEl" class="datagrid-cell-combobox">
    <input
      ref="inputEl"
      v-bind="inputAttrs"
      :class="inputClassName"
      :style="inputStyleValue"
      type="text"
      role="combobox"
      :value="inputText"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="panelId"
      aria-autocomplete="list"
      :aria-activedescendant="activeOptionId"
      @focus="handleInputFocus"
      @click.stop="handleInputClick"
      @input="handleInput"
      @keydown.stop="handleKeydown"
      @blur="handleInputBlur"
    />

    <Teleport :to="teleportTarget" :disabled="inlinePanel">
      <div
        v-if="isOpen"
        :id="panelId"
        ref="panelEl"
        class="datagrid-cell-combobox__panel"
        :class="{ 'datagrid-cell-combobox__panel--inline': inlinePanel }"
        :data-affino-popover-sticky="stickyPopoverId || undefined"
        :style="[overlayThemeVars, panelStyle]"
        role="listbox"
        @mousedown.prevent
      >
        <div v-if="isLoading" class="datagrid-cell-combobox__empty">Loading options...</div>

        <template v-else>
          <button
            v-for="(option, optionIndex) in displayedOptions"
            :id="optionId(optionIndex)"
            :key="`${option.value}-${optionIndex}`"
            type="button"
            class="datagrid-cell-combobox__option"
            :class="{
              'datagrid-cell-combobox__option--active': optionIndex === activeIndex,
              'datagrid-cell-combobox__option--selected': option.value === value,
            }"
            role="option"
            :aria-selected="option.value === value ? 'true' : 'false'"
            :data-option-index="optionIndex"
            @mousemove="setActiveIndex(optionIndex)"
            @click.stop="commitOption(option.value)"
          >
            <span class="datagrid-cell-combobox__option-label">{{ option.label }}</span>
            <span
              v-if="option.value === value"
              class="datagrid-cell-combobox__option-state"
              aria-hidden="true"
            >
              Selected
            </span>
          </button>

          <div v-if="displayedOptions.length === 0" class="datagrid-cell-combobox__empty">
            No matching options
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch, type StyleValue } from "vue"
import { dataGridAppRootElementKey } from "../dataGridAppContext"
import { readDataGridOverlayThemeVars } from "./dataGridOverlayThemeVars"
import {
  activateDataGridCellComboboxIndex,
  createDataGridCellComboboxState,
  moveDataGridCellComboboxFocus,
  setDataGridCellComboboxFilter,
  setDataGridCellComboboxOpen,
} from "./dataGridCellComboboxState"
import {
  rankDataGridFilterableComboboxOptions,
  type DataGridFilterableComboboxOption,
} from "./dataGridFilterableCombobox"

type CommitTarget = "stay" | "next" | "previous"

const props = withDefaults(defineProps<{
  value: string
  options?: ReadonlyArray<DataGridFilterableComboboxOption>
  loadOptions?: (query: string) => Promise<ReadonlyArray<DataGridFilterableComboboxOption>>
  placeholder?: string
  disabled?: boolean
  openOnMount?: boolean
  initialFilter?: string
  openOnFocus?: boolean
  inlinePanel?: boolean
  stickyPopoverId?: string
}>(), {
  options: () => [],
  placeholder: "Type to filter",
  disabled: false,
  openOnMount: true,
  initialFilter: "",
  openOnFocus: true,
  inlinePanel: false,
})

const emit = defineEmits<{
  (event: "commit", value: string, target?: CommitTarget): void
  (event: "cancel"): void
  (event: "optionsResolved", options: ReadonlyArray<DataGridFilterableComboboxOption>): void
}>()

const rootElementRef = inject(dataGridAppRootElementKey, ref<HTMLElement | null>(null))
const attrs = useAttrs()
const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const overlayThemeVars = ref<Record<string, string>>({})
const panelStyle = ref<Record<string, string>>({})
const inputText = ref("")
const isLoading = ref(false)
const remoteOptions = ref<ReadonlyArray<DataGridFilterableComboboxOption>>([])
const state = ref(createDataGridCellComboboxState({ open: false }))
const panelId = `datagrid-filterable-combobox-${Math.random().toString(36).slice(2, 10)}`
let requestId = 0

const inputAttrs = computed(() => {
  const {
    class: _className,
    style: _styleValue,
    type: _type,
    value: _value,
    placeholder: _placeholder,
    disabled: _disabled,
    onInput: _onInput,
    onFocus: _onFocus,
    onBlur: _onBlur,
    onKeydown: _onKeydown,
    onClick: _onClick,
    ...rest
  } = attrs
  return rest
})

const inputClassName = computed(() => [
  "cell-editor-control",
  "datagrid-cell-combobox__input",
  attrs.class,
])

const inputStyleValue = computed<StyleValue>(() => attrs.style as StyleValue)

const teleportTarget = computed(() => {
  if (props.inlinePanel) {
    return undefined
  }
  return "body"
})

const selectedOption = computed(() => {
  return allOptions.value.find(option => option.value === props.value) ?? null
})

const allOptions = computed(() => {
  if (!props.loadOptions) {
    return props.options
  }
  return remoteOptions.value.length > 0 ? remoteOptions.value : props.options
})

const displayedOptions = computed(() => {
  return rankDataGridFilterableComboboxOptions(allOptions.value, state.value.filter)
})

const activeIndex = computed(() => state.value.activeIndex)
const activeOption = computed(() => {
  return activeIndex.value >= 0 ? (displayedOptions.value[activeIndex.value] ?? null) : null
})
const activeOptionId = computed(() => {
  return activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined
})
const isOpen = computed(() => state.value.open)

function optionId(optionIndex: number): string {
  return `${panelId}-option-${optionIndex}`
}

function syncThemeVars(): void {
  overlayThemeVars.value = readDataGridOverlayThemeVars(rootElementRef.value)
}

function syncInputTextFromValue(): void {
  inputText.value = selectedOption.value?.label ?? props.value
}

function syncInputTextFromInitialFilter(): void {
  inputText.value = props.initialFilter
}

function syncActiveIndex(preferSelected: boolean): void {
  const options = displayedOptions.value
  if (options.length === 0) {
    state.value = {
      ...state.value,
      activeIndex: -1,
    }
    return
  }
  let nextIndex = 0
  if (preferSelected && selectedOption.value) {
    const selectedIndex = options.findIndex(option => option.value === selectedOption.value?.value)
    if (selectedIndex >= 0) {
      nextIndex = selectedIndex
    }
  }
  state.value = activateDataGridCellComboboxIndex(state.value, nextIndex, options.length)
}

async function refreshRemoteOptions(query: string): Promise<void> {
  if (!props.loadOptions) {
    return
  }
  const currentRequestId = requestId + 1
  requestId = currentRequestId
  isLoading.value = true
  try {
    const loaded = await props.loadOptions(query)
    if (currentRequestId !== requestId) {
      return
    }
    remoteOptions.value = loaded
    emit("optionsResolved", loaded)
    syncActiveIndex(true)
    void nextTick(() => {
      updatePanelPosition()
      scrollActiveOptionIntoView()
    })
  } finally {
    if (currentRequestId === requestId) {
      isLoading.value = false
    }
  }
}

function updatePanelPosition(): void {
  if (props.inlinePanel) {
    panelStyle.value = {
      position: "absolute",
      top: "calc(100% + 6px)",
      left: "0px",
      width: "100%",
      maxHeight: "260px",
      zIndex: "4",
    }
    return
  }
  if (typeof window === "undefined" || !inputEl.value) {
    return
  }
  const rect = inputEl.value.getBoundingClientRect()
  const width = Math.max(rect.width, 220)
  const panelHeight = Math.min(panelEl.value?.offsetHeight ?? 220, 260)
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const placeAbove = spaceBelow < Math.min(180, panelHeight) && rect.top > panelHeight + 12
  const top = placeAbove
    ? Math.max(8, rect.top - panelHeight - 6)
    : Math.min(window.innerHeight - panelHeight - 8, rect.bottom + 6)
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - width - 8),
  )
  panelStyle.value = {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: "260px",
    zIndex: "240",
  }
}

function scrollActiveOptionIntoView(): void {
  if (!panelEl.value || activeIndex.value < 0) {
    return
  }
  const activeElement = panelEl.value.querySelector<HTMLElement>(`[data-option-index="${activeIndex.value}"]`)
  activeElement?.scrollIntoView({ block: "nearest" })
}

function openCombobox(): void {
  if (props.disabled) {
    return
  }
  state.value = setDataGridCellComboboxOpen(state.value, true)
  syncActiveIndex(true)
  void nextTick(() => {
    updatePanelPosition()
    scrollActiveOptionIntoView()
    inputEl.value?.focus({ preventScroll: true })
    if (!inputEl.value) {
      return
    }
    if (state.value.filter.length > 0) {
      const caretPosition = inputEl.value.value.length
      inputEl.value.setSelectionRange(caretPosition, caretPosition)
      return
    }
    inputEl.value.select()
  })
  if (props.loadOptions) {
    void refreshRemoteOptions(state.value.filter)
  }
}

function closeCombobox(): void {
  state.value = setDataGridCellComboboxOpen(state.value, false)
}

function isWithinCombobox(target: EventTarget | null): boolean {
  return target instanceof Node
    && (rootEl.value?.contains(target) === true || panelEl.value?.contains(target) === true)
}

function commitCurrentValue(target: CommitTarget = "stay"): void {
  closeCombobox()
  emit("commit", props.value, target)
}

function commitOption(value: string, target: CommitTarget = "stay"): void {
  closeCombobox()
  emit("commit", value, target)
}

function setActiveIndex(optionIndex: number): void {
  state.value = activateDataGridCellComboboxIndex(state.value, optionIndex, displayedOptions.value.length)
  void nextTick(scrollActiveOptionIntoView)
}

function handleInputFocus(): void {
  if (props.openOnFocus) {
    openCombobox()
  }
}

function handleInputClick(): void {
  openCombobox()
}

function handleInput(event: Event): void {
  if (props.disabled) {
    return
  }
  const nextValue = (event.target as HTMLInputElement).value
  inputText.value = nextValue
  state.value = setDataGridCellComboboxFilter(state.value, nextValue)
  state.value = setDataGridCellComboboxOpen(state.value, true)
  syncActiveIndex(false)
  void nextTick(() => {
    updatePanelPosition()
    scrollActiveOptionIntoView()
  })
  if (props.loadOptions) {
    void refreshRemoteOptions(nextValue)
  }
}

function handleInputBlur(): void {
  void nextTick(() => {
    if (isWithinCombobox(document.activeElement)) {
      return
    }
    commitCurrentValue("stay")
  })
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.disabled) {
    return
  }
  if (event.key === "ArrowDown") {
    event.preventDefault()
    state.value = setDataGridCellComboboxOpen(state.value, true)
    state.value = moveDataGridCellComboboxFocus(state.value, 1, displayedOptions.value.length, true)
    void nextTick(scrollActiveOptionIntoView)
    return
  }
  if (event.key === "ArrowUp") {
    event.preventDefault()
    state.value = setDataGridCellComboboxOpen(state.value, true)
    state.value = moveDataGridCellComboboxFocus(state.value, -1, displayedOptions.value.length, true)
    void nextTick(scrollActiveOptionIntoView)
    return
  }
  if (event.key === "Home") {
    event.preventDefault()
    setActiveIndex(0)
    return
  }
  if (event.key === "End") {
    event.preventDefault()
    setActiveIndex(Math.max(0, displayedOptions.value.length - 1))
    return
  }
  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault()
    if (activeOption.value) {
      commitOption(activeOption.value.value, event.shiftKey ? "previous" : "next")
      return
    }
    commitCurrentValue(event.shiftKey ? "previous" : "next")
    return
  }
  if (event.key === "Escape") {
    event.preventDefault()
    closeCombobox()
    emit("cancel")
  }
}

function handleViewportChange(): void {
  if (!isOpen.value) {
    return
  }
  updatePanelPosition()
}

watch(() => props.options, () => {
  if (!props.loadOptions) {
    syncActiveIndex(true)
    void nextTick(updatePanelPosition)
  }
}, { immediate: true })

watch(() => props.value, () => {
  syncInputTextFromValue()
})

watch(() => props.disabled, disabled => {
  if (disabled) {
    closeCombobox()
  }
})

onMounted(() => {
  syncThemeVars()
  if (props.initialFilter.length > 0) {
    state.value = setDataGridCellComboboxFilter(state.value, props.initialFilter)
    syncInputTextFromInitialFilter()
  } else {
    syncInputTextFromValue()
  }
  if (props.openOnMount) {
    openCombobox()
  }
  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("scroll", handleViewportChange, true)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", handleViewportChange)
    window.removeEventListener("scroll", handleViewportChange, true)
  }
})
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>