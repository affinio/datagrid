<template>
  <div
    class="spreadsheet-formula-shell"
    :class="{
      'spreadsheet-formula-shell--focused': props.isFocused,
      'spreadsheet-formula-shell--reference-mode': props.isReferenceMode,
      'spreadsheet-formula-shell--readonly': props.isReadonly,
    }"
  >
    <div class="spreadsheet-formula-address">
      <div class="spreadsheet-formula-address__copy">
        <span class="spreadsheet-formula-address__label">Active cell</span>
        <strong>{{ props.activeCellBadge }}</strong>
      </div>
      <span class="spreadsheet-formula-address__badge">{{ props.formulaModeLabel }}</span>
    </div>

    <UiMenu ref="formulaAutocompleteMenuRef" :callbacks="props.menuCallbacks" :options="props.menuOptions">
      <UiMenuTrigger as-child trigger="both">
        <div class="spreadsheet-formula-main">
          <div class="spreadsheet-formula-toolbar">
            <div class="spreadsheet-formula-toolbar__copy">
              <span class="spreadsheet-formula-toolbar__fx">fx</span>
              <div class="spreadsheet-formula-toolbar__text">
                <strong>{{ props.formulaModeLabel }}</strong>
                <span>{{ props.formulaModeHint }}</span>
              </div>
            </div>

            <div v-if="!props.isReadonly" class="spreadsheet-formula-toolbar__actions">
              <button
                type="button"
                class="spreadsheet-action spreadsheet-action--subtle"
                @mousedown.prevent
                @click="emit('cancel')"
              >
                Cancel
              </button>
              <button
                type="button"
                class="spreadsheet-action spreadsheet-action--primary"
                @mousedown.prevent
                @click="emit('commit')"
              >
                Apply
              </button>
            </div>
          </div>

          <textarea
            ref="formulaInputRef"
            class="spreadsheet-formula-input"
            :value="props.editorRawInput"
            :readonly="props.isReadonly"
            spellcheck="false"
            :placeholder="props.formulaInputPlaceholder"
            @focus="emit('focus')"
            @blur="emit('blur')"
            @input="emit('input', $event)"
            @select="emit('selection-change')"
            @click="emit('selection-change')"
            @keyup="emit('selection-change')"
            @keydown="emit('keydown', $event)"
          />

          <div class="spreadsheet-formula-preview" aria-hidden="true">
            <template v-for="segment in props.previewSegments" :key="segment.key">
              <span
                v-if="segment.kind === 'reference'"
                class="spreadsheet-formula-token spreadsheet-formula-token--reference"
                :class="{ 'spreadsheet-formula-token--active': segment.active }"
                :style="segment.style"
                @mouseenter="emit('reference-enter', segment.referenceKey)"
                @mouseleave="emit('reference-leave')"
              >
                {{ segment.text }}
              </span>
              <span v-else class="spreadsheet-formula-token">{{ segment.text }}</span>
            </template>
          </div>

          <div v-if="props.isReferenceMode" class="spreadsheet-formula-caption">
            <span class="spreadsheet-formula-caption__label">Selection</span>
            <span>{{ props.formulaSelectionSummary }}</span>
          </div>
        </div>
      </UiMenuTrigger>

      <UiMenuContent
        v-if="props.autocompleteVisible"
        class-name="ui-menu-content spreadsheet-formula-autocomplete"
        align="start"
        :gutter="8"
        data-affino-menu-root
        data-spreadsheet-formula-autocomplete="true"
      >
        <UiMenuLabel class="spreadsheet-formula-autocomplete__label">
          Formula functions
        </UiMenuLabel>
        <UiMenuSeparator />

        <UiMenuItem
          v-for="(item, index) in props.autocompleteSuggestions"
          :key="item.name"
          class="spreadsheet-formula-autocomplete__item"
          :class="{ 'spreadsheet-formula-autocomplete__item--active': index === props.autocompleteActiveIndex }"
          :data-formula-autocomplete-item="item.name"
          :data-formula-autocomplete-active="index === props.autocompleteActiveIndex ? 'true' : 'false'"
          @mouseenter="emit('autocomplete-hover', index)"
          @select="emit('autocomplete-select', item)"
        >
          <div class="spreadsheet-formula-autocomplete__item-copy">
            <div class="spreadsheet-formula-autocomplete__item-head">
              <span class="spreadsheet-formula-autocomplete__item-name">{{ item.name }}</span>
              <span class="spreadsheet-formula-autocomplete__item-arity">{{ item.arityLabel }}</span>
            </div>
            <div class="spreadsheet-formula-autocomplete__item-detail">
              {{ item.detail }}
            </div>
          </div>
        </UiMenuItem>
      </UiMenuContent>
    </UiMenu>

    <div class="spreadsheet-formula-state">
      <div v-if="props.isReadonly" class="spreadsheet-formula-readonly">
        Derived view from <strong>{{ props.activeSheetViewSourceLabel }}</strong>. Edit the source sheet to recompute.
      </div>
      <div class="spreadsheet-formula-value">
        <span class="spreadsheet-formula-state__label">Display</span>
        <span>{{ props.activeCellDisplayLabel }}</span>
      </div>
      <div class="spreadsheet-formula-value">
        <span class="spreadsheet-formula-state__label">Mode</span>
        <span>{{ props.formulaStateSummary }}</span>
      </div>
      <div class="spreadsheet-formula-value">
        <span class="spreadsheet-formula-state__label">Refs</span>
        <span>{{ props.formulaReferenceSummary }}</span>
      </div>
      <div
        v-if="props.activeDiagnosticMessage"
        class="spreadsheet-formula-error"
        :title="props.activeDiagnosticMessage"
      >
        {{ props.activeDiagnosticMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import {
  UiMenu,
  UiMenuContent,
  UiMenuItem,
  UiMenuLabel,
  UiMenuSeparator,
  UiMenuTrigger,
  type MenuCallbacks,
  type MenuOptions,
} from "@affino/menu-vue"

interface FormulaPreviewSegmentPlain {
  key: string
  kind: "plain"
  text: string
}

interface FormulaPreviewSegmentReference {
  key: string
  kind: "reference"
  referenceKey: string
  text: string
  active: boolean
  style: Readonly<Record<string, string>>
}

type FormulaPreviewSegment = FormulaPreviewSegmentPlain | FormulaPreviewSegmentReference

interface FormulaAutocompleteSuggestion {
  name: string
  arityLabel: string
  detail: string
}

interface UiMenuRef {
  controller?: {
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
  }
}

const props = withDefaults(defineProps<{
  activeCellBadge: string
  formulaModeLabel: string
  formulaModeHint: string
  formulaInputPlaceholder: string
  activeCellDisplayLabel: string
  formulaStateSummary: string
  formulaReferenceSummary: string
  formulaSelectionSummary: string
  activeSheetViewSourceLabel: string
  editorRawInput: string
  isFocused?: boolean
  isReferenceMode?: boolean
  isReadonly?: boolean
  activeDiagnosticMessage?: string | null
  previewSegments?: readonly FormulaPreviewSegment[]
  autocompleteSuggestions?: readonly FormulaAutocompleteSuggestion[]
  autocompleteActiveIndex?: number
  autocompleteVisible?: boolean
  menuOptions?: MenuOptions
  menuCallbacks?: MenuCallbacks
}>(), {
  isFocused: false,
  isReferenceMode: false,
  isReadonly: false,
  activeDiagnosticMessage: null,
  previewSegments: () => [],
  autocompleteSuggestions: () => [],
  autocompleteActiveIndex: 0,
  autocompleteVisible: false,
  menuOptions: undefined,
  menuCallbacks: undefined,
})

const emit = defineEmits<{
  blur: []
  cancel: []
  commit: []
  focus: []
  input: [event: Event]
  keydown: [event: KeyboardEvent]
  "selection-change": []
  "reference-enter": [referenceKey: string]
  "reference-leave": []
  "autocomplete-hover": [index: number]
  "autocomplete-select": [item: FormulaAutocompleteSuggestion]
}>()

const formulaInputRef = ref<HTMLTextAreaElement | null>(null)
const formulaAutocompleteMenuRef = ref<UiMenuRef | null>(null)

function getInputElement(): HTMLTextAreaElement | null {
  return formulaInputRef.value
}

function getMenuController(): UiMenuRef["controller"] | null {
  return formulaAutocompleteMenuRef.value?.controller ?? null
}

function focus(options?: FocusOptions): void {
  formulaInputRef.value?.focus(options)
}

function blur(): void {
  formulaInputRef.value?.blur()
}

function setSelectionRange(start: number, end: number): void {
  formulaInputRef.value?.setSelectionRange(start, end)
}

defineExpose({
  blur,
  focus,
  getInputElement,
  getMenuController,
  setSelectionRange,
})
</script>

<style scoped>
.spreadsheet-action {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 10px;
  background: rgb(255 255 255 / 0.76);
  color: var(--datagrid-text-color);
  cursor: pointer;
}

.spreadsheet-action--subtle {
  background: rgb(255 255 255 / 0.86);
}

.spreadsheet-action--primary {
  border-color: rgb(37 99 235 / 0.36);
  background: linear-gradient(135deg, rgb(15 23 42 / 0.96), rgb(37 99 235 / 0.92));
  color: #f8fafc;
}

.spreadsheet-action:disabled {
  opacity: 0.45;
  cursor: default;
}

.spreadsheet-formula-shell {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 220px;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 18px;
  background: linear-gradient(135deg, rgb(255 255 255 / 0.96), rgb(248 250 252 / 0.9));
}

.spreadsheet-formula-shell--focused {
  box-shadow: 0 0 0 1px rgb(37 99 235 / 0.28);
}

.spreadsheet-formula-shell--reference-mode {
  border-color: rgb(37 99 235 / 0.34);
  box-shadow: 0 0 0 1px rgb(37 99 235 / 0.18), 0 18px 38px rgb(37 99 235 / 0.08);
}

.spreadsheet-formula-shell--readonly {
  background: linear-gradient(135deg, rgb(248 250 252 / 0.98), rgb(241 245 249 / 0.96));
}

.spreadsheet-formula-address {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 12px;
  border-radius: 12px;
  background: rgb(15 23 42 / 0.06);
  color: var(--spreadsheet-accent);
}

.spreadsheet-formula-address__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spreadsheet-formula-address__copy strong {
  font-size: 16px;
  line-height: 1.2;
}

.spreadsheet-formula-address__label {
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-address__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgb(37 99 235 / 0.1);
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.spreadsheet-formula-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.spreadsheet-formula-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.spreadsheet-formula-toolbar__copy {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.spreadsheet-formula-toolbar__fx {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgb(15 23 42 / 0.96), rgb(30 64 175 / 0.9));
  color: #f8fafc;
  font: 700 14px/1.1 "IBM Plex Sans", "Segoe UI", sans-serif;
  letter-spacing: 0.02em;
}

.spreadsheet-formula-toolbar__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.spreadsheet-formula-toolbar__text strong {
  font-size: 13px;
  color: var(--spreadsheet-accent);
}

.spreadsheet-formula-toolbar__text span {
  font-size: 12px;
  line-height: 1.45;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-formula-input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: rgb(255 255 255 / 0.84);
  color: var(--datagrid-text-color);
  font: 500 13px/1.5 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.spreadsheet-formula-input[readonly] {
  background: rgb(248 250 252 / 0.9);
  color: var(--spreadsheet-ink-soft);
  cursor: default;
}

.spreadsheet-formula-preview {
  min-height: 24px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgb(15 23 42 / 0.04);
  color: var(--spreadsheet-ink-soft);
  font: 500 12px/1.5 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.spreadsheet-formula-caption {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-caption__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.spreadsheet-formula-autocomplete {
  min-width: min(460px, calc(100vw - 32px));
  max-width: min(560px, calc(100vw - 32px));
  --ui-menu-bg: rgb(255 255 255 / 0.98);
  --ui-menu-border: color-mix(in srgb, var(--spreadsheet-border) 82%, rgb(37 99 235 / 0.18));
  --ui-menu-hover-bg: rgb(37 99 235 / 0.08);
  --ui-menu-text: var(--datagrid-text-color);
  --ui-menu-muted: var(--spreadsheet-ink-soft);
  --ui-menu-focus-ring: 0 0 0 2px rgb(37 99 235 / 0.16);
  --ui-menu-shadow: 0 22px 48px rgb(15 23 42 / 0.16);
}

.spreadsheet-formula-autocomplete__label {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.spreadsheet-formula-autocomplete__item {
  align-items: stretch;
  padding: 0;
}

.spreadsheet-formula-autocomplete__item-copy {
  display: grid;
  gap: 4px;
  width: 100%;
}

.spreadsheet-formula-autocomplete__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.spreadsheet-formula-autocomplete__item-name {
  font: 700 12px/1.4 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  color: #0f172a;
}

.spreadsheet-formula-autocomplete__item-arity,
.spreadsheet-formula-autocomplete__item-detail {
  font-size: 11px;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-token--reference {
  border-radius: 6px;
  padding: 0 2px;
}

.spreadsheet-formula-token--active {
  font-weight: 700;
}

.spreadsheet-formula-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.spreadsheet-formula-value {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spreadsheet-formula-readonly {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgb(37 99 235 / 0.08);
  color: #1d4ed8;
  font-size: 12px;
  line-height: 1.45;
}

.spreadsheet-formula-state__label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-formula-error {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgb(239 68 68 / 0.12);
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 1200px) {
  .spreadsheet-formula-shell {
    grid-template-columns: 1fr;
  }

  .spreadsheet-formula-toolbar {
    flex-direction: column;
  }

  .spreadsheet-formula-toolbar__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>