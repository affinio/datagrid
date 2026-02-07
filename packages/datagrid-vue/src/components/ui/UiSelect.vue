<template>
  <div class="affino-ui-select w-full" @focusout="onRootFocusOut">
    <button
      ref="triggerRef"
      v-bind="triggerAttrs"
      type="button"
      :disabled="isDisabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="listboxId"
      :aria-activedescendant="activeOptionId"
      @click="onTriggerClick"
      @keydown="onTriggerKeydown"
    >
      <span :data-placeholder-visible="displayPlaceholder ? 'true' : 'false'">
        {{ displayLabel }}
      </span>
      <span aria-hidden="true" class="affino-ui-select__icon">▾</span>
    </button>

    <teleport v-if="teleportTarget" :to="teleportTarget">
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="isOpen"
          :id="listboxId"
          ref="contentRef"
          :style="popoverStyle"
          class="affino-ui-select__surface"
          role="listbox"
          @mousedown.prevent
        >
          <div
            v-for="(option, index) in normalizedOptions"
            :id="optionId(index)"
            :key="option.key"
            class="affino-ui-select__option"
            :class="{
              'is-active': listboxState.activeIndex === index,
              'is-selected': isSelectedIndex(index),
              'is-disabled': option.disabled,
            }"
            role="option"
            :aria-selected="isSelectedIndex(index) ? 'true' : 'false'"
            :aria-disabled="option.disabled ? 'true' : undefined"
            @mouseenter="setActiveIndex(index)"
            @click="onOptionClick(index)"
          >
            {{ option.label }}
          </div>
        </div>
      </Transition>
    </teleport>

    <input
      v-if="inputName"
      type="hidden"
      :name="inputName"
      :value="hiddenInputValue"
    />
  </div>
</template>

<script setup lang="ts">
import {
  activateListboxIndex,
  createListboxState,
  moveListboxFocus,
  type ListboxContext,
  type ListboxState,
} from "@affino/listbox-core"
import { useFloatingPopover, usePopoverController } from "@affino/popover-vue"
import { computed, nextTick, ref, useAttrs, watch } from "vue"

interface UiSelectOption {
  label: string
  value: unknown
  disabled?: boolean
}

interface NormalizedOption {
  key: string
  label: string
  value: string | number | null
  disabled: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string | number | null
  options?: UiSelectOption[]
  placeholder?: string
}>(), {
  options: () => [],
  placeholder: "",
})

const emit = defineEmits<{
  (event: "update:modelValue", payload: string | number | null): void
  (event: "blur", payload: FocusEvent): void
}>()

const attrs = useAttrs()

const popoverController = usePopoverController({
  id: `datagrid-cell-select-${Math.random().toString(36).slice(2, 10)}`,
  role: "listbox",
  modal: false,
  closeOnEscape: true,
  closeOnInteractOutside: true,
})

const floatingPopover = useFloatingPopover(popoverController, {
  placement: "bottom",
  align: "start",
  gutter: 4,
  viewportPadding: 8,
  teleportTo: "body",
  zIndex: 220,
  returnFocus: false,
  lockScroll: false,
})

const triggerRef = floatingPopover.triggerRef
const contentRef = floatingPopover.contentRef

const normalizedOptions = computed<NormalizedOption[]>(() => {
  return props.options.map((option, index) => ({
    key: `${String(option.value ?? "")}-${index}`,
    label: String(option.label ?? option.value ?? ""),
    value: normalizeModelValue(option.value),
    disabled: option.disabled === true,
  }))
})

const listboxState = ref<ListboxState>(createListboxState())

const listboxId = `affino-ui-select-${Math.random().toString(36).slice(2, 10)}`

const isOpen = computed(() => popoverController.state.value.open)
const popoverStyle = computed(() => floatingPopover.contentStyle.value)
const teleportTarget = computed(() => floatingPopover.teleportTarget.value)

const selectedIndex = computed(() => {
  const model = normalizeModelValue(props.modelValue)
  return normalizedOptions.value.findIndex(option => isSameValue(option.value, model))
})

const displayPlaceholder = computed(() => selectedIndex.value === -1)
const displayLabel = computed(() => {
  if (selectedIndex.value >= 0) {
    return normalizedOptions.value[selectedIndex.value]?.label ?? ""
  }
  return props.placeholder || ""
})

const activeOptionId = computed(() => {
  const index = listboxState.value.activeIndex
  if (index < 0) {
    return undefined
  }
  return optionId(index)
})

const hiddenInputValue = computed(() => {
  const value = normalizeModelValue(props.modelValue)
  return value == null ? "" : String(value)
})

const inputName = computed(() => {
  const raw = attrs.name
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})

const isDisabled = computed(() => {
  if (normalizedOptions.value.length === 0) {
    return true
  }
  const raw = attrs.disabled
  if (raw === "" || raw === true) {
    return true
  }
  if (typeof raw === "string") {
    return raw.toLowerCase() !== "false"
  }
  return false
})

const triggerAttrs = computed(() => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "modelValue" || key === "options" || key === "placeholder" || key === "name" || key === "disabled") {
      continue
    }
    result[key] = value
  }
  return result
})

function getContext(): ListboxContext {
  return {
    optionCount: normalizedOptions.value.length,
    isDisabled: index => normalizedOptions.value[index]?.disabled ?? false,
  }
}

function optionId(index: number): string {
  return `${listboxId}-option-${index + 1}`
}

function normalizeModelValue(value: unknown): string | number | null {
  if (value == null) {
    return null
  }
  if (typeof value === "string" || typeof value === "number") {
    return value
  }
  return String(value)
}

function isSameValue(left: string | number | null, right: string | number | null): boolean {
  return String(left ?? "") === String(right ?? "")
}

function syncStateFromModelValue() {
  const index = selectedIndex.value
  if (index < 0) {
    listboxState.value = createListboxState()
    return
  }
  const next = activateListboxIndex({
    state: createListboxState({ activeIndex: index }),
    context: getContext(),
    index,
  })
  listboxState.value = next
}

function firstEnabledIndex(): number {
  for (let index = 0; index < normalizedOptions.value.length; index += 1) {
    if (!normalizedOptions.value[index]?.disabled) {
      return index
    }
  }
  return -1
}

function lastEnabledIndex(): number {
  for (let index = normalizedOptions.value.length - 1; index >= 0; index -= 1) {
    if (!normalizedOptions.value[index]?.disabled) {
      return index
    }
  }
  return -1
}

function setActiveIndex(index: number) {
  if (normalizedOptions.value[index]?.disabled) {
    return
  }
  listboxState.value = {
    selection: listboxState.value.selection,
    activeIndex: index,
  }
}

function ensureActiveIndexOnOpen() {
  if (selectedIndex.value >= 0) {
    setActiveIndex(selectedIndex.value)
    return
  }
  const index = firstEnabledIndex()
  if (index >= 0) {
    setActiveIndex(index)
  }
}

function commitIndex(index: number) {
  const option = normalizedOptions.value[index]
  if (!option || option.disabled) {
    return
  }
  emit("update:modelValue", option.value)
  close()
}

function onTriggerClick() {
  if (isDisabled.value) {
    return
  }
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

function moveActive(delta: number) {
  const next = moveListboxFocus({
    state: listboxState.value,
    context: getContext(),
    delta,
    loop: true,
  })
  listboxState.value = next
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (isDisabled.value) {
    return
  }

  if (event.key === "ArrowDown") {
    event.preventDefault()
    if (!isOpen.value) {
      open()
      return
    }
    moveActive(1)
    return
  }

  if (event.key === "ArrowUp") {
    event.preventDefault()
    if (!isOpen.value) {
      open()
      return
    }
    moveActive(-1)
    return
  }

  if (event.key === "Home" && isOpen.value) {
    event.preventDefault()
    const index = firstEnabledIndex()
    if (index >= 0) {
      setActiveIndex(index)
    }
    return
  }

  if (event.key === "End" && isOpen.value) {
    event.preventDefault()
    const index = lastEnabledIndex()
    if (index >= 0) {
      setActiveIndex(index)
    }
    return
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    if (!isOpen.value) {
      open()
      return
    }
    const index = listboxState.value.activeIndex
    if (index >= 0) {
      commitIndex(index)
    }
    return
  }

  if (event.key === "Escape" && isOpen.value) {
    close()
  }
}

function onOptionClick(index: number) {
  commitIndex(index)
}

function isSelectedIndex(index: number): boolean {
  return selectedIndex.value === index
}

function onRootFocusOut(event: FocusEvent) {
  const target = event.relatedTarget as Node | null
  if (target && (triggerRef.value?.contains(target) || contentRef.value?.contains(target))) {
    return
  }
  emit("blur", event)
}

function open() {
  if (isDisabled.value) {
    return
  }
  if (isOpen.value) {
    return
  }
  popoverController.open("programmatic")
}

function close() {
  if (!isOpen.value) {
    return
  }
  void popoverController.close("programmatic")
}

function focus() {
  triggerRef.value?.focus({ preventScroll: true })
}

watch(
  [normalizedOptions, () => props.modelValue],
  () => {
    syncStateFromModelValue()
  },
  { immediate: true },
)

watch(
  () => popoverController.state.value.open,
  openState => {
    if (openState) {
      ensureActiveIndexOnOpen()
      void nextTick(() => floatingPopover.updatePosition())
      return
    }
    syncStateFromModelValue()
  },
)

defineExpose({
  focus,
  open,
})
</script>

<style scoped>
.affino-ui-select {
  position: relative;
}

.affino-ui-select__icon {
  margin-left: auto;
  font-size: 11px;
  line-height: 1;
  opacity: 0.75;
}

.affino-ui-select__surface {
  position: fixed;
  min-width: 10rem;
  max-height: 14rem;
  overflow-y: auto;
  border: 1px solid var(--ui-table-cell-border-color, #d4d4d8);
  border-radius: 0.375rem;
  background: var(--ui-table-surface-color, #ffffff);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
}

.affino-ui-select__option {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
}

.affino-ui-select__option.is-active {
  background: rgba(59, 130, 246, 0.12);
}

.affino-ui-select__option.is-selected {
  font-weight: 600;
}

.affino-ui-select__option.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
