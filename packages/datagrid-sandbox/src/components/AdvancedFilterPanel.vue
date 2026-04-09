<template>
  <button
    :ref="floating.triggerRef"
    type="button"
    class="advanced-filter-panel-trigger"
    :style="themeVars"
    v-bind="triggerProps"
  >
    {{ buttonLabel }}
  </button>

  <Teleport :to="popoverTeleportTarget">
    <section
      v-if="popoverOpen"
      :ref="floating.contentRef"
      class="advanced-filter-popover"
      :style="[popoverContentStyle, themeVars]"
      v-bind="contentProps"
    >
      <header class="advanced-filter-popover__header">
        <div>
          <div class="advanced-filter-popover__eyebrow">Advanced filter</div>
          <h3 class="advanced-filter-popover__title">Build clause-based filter</h3>
        </div>
        <button type="button" class="advanced-filter-popover__ghost" @click="emit('cancel')">
          Close
        </button>
      </header>

      <div class="advanced-filter-popover__rows">
        <div
          v-for="(clause, clauseIndex) in clauses"
          :key="clause.id"
          class="advanced-filter-popover__row"
        >
          <label class="advanced-filter-popover__field advanced-filter-popover__field--join">
            <span class="advanced-filter-popover__label">Join</span>
            <select
              :value="clause.join"
              :disabled="clauseIndex === 0"
              aria-label="Join operator"
              @change="updateClause(clause.id, 'join', ($event.target as HTMLSelectElement).value)"
            >
              <option value="and">AND</option>
              <option value="or">OR</option>
            </select>
          </label>

          <label class="advanced-filter-popover__field">
            <span class="advanced-filter-popover__label">Column</span>
            <select
              :value="clause.columnKey"
              :data-advanced-filter-autofocus="clauseIndex === 0 ? 'true' : null"
              aria-label="Column"
              @change="updateClause(clause.id, 'columnKey', ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="column in columns"
                :key="`advanced-filter-column-${column.key}`"
                :value="column.key"
              >
                {{ column.label }}
              </option>
            </select>
          </label>

          <label class="advanced-filter-popover__field">
            <span class="advanced-filter-popover__label">Operator</span>
            <select
              :value="clause.operator"
              aria-label="Condition operator"
              @change="updateClause(clause.id, 'operator', ($event.target as HTMLSelectElement).value)"
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="not-equals">Not equals</option>
              <option value="starts-with">Starts with</option>
              <option value="ends-with">Ends with</option>
              <option value="gt">&gt;</option>
              <option value="gte">&gt;=</option>
              <option value="lt">&lt;</option>
              <option value="lte">&lt;=</option>
            </select>
          </label>

          <label class="advanced-filter-popover__field advanced-filter-popover__field--value">
            <span class="advanced-filter-popover__label">Value</span>
            <input
              :value="clause.value"
              type="text"
              placeholder="Value"
              aria-label="Condition value"
              @input="updateClause(clause.id, 'value', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <div class="advanced-filter-popover__row-actions">
            <button
              type="button"
              class="advanced-filter-popover__ghost advanced-filter-popover__ghost--danger"
              :disabled="clauses.length <= 1"
              @click="emit('remove', clause.id)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <footer class="advanced-filter-popover__footer">
        <button type="button" class="advanced-filter-popover__secondary" @click="emit('add')">
          Add clause
        </button>
        <div class="advanced-filter-popover__footer-actions">
          <button type="button" class="advanced-filter-popover__secondary" @click="emit('cancel')">
            Cancel
          </button>
          <button type="button" class="advanced-filter-popover__primary" @click="emit('apply')">
            Apply
          </button>
        </div>
      </footer>
    </section>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from "vue"
import type { DataGridThemeTokens } from "@affino/datagrid-theme"
import {
  useFloatingPopover,
  usePopoverController,
} from "@affino/popover-vue"
import type {
  DataGridAppAdvancedFilterClauseDraft,
  DataGridAppAdvancedFilterClausePatch,
  DataGridAppAdvancedFilterColumnOption,
} from "@affino/datagrid-vue/app"

const props = withDefaults(defineProps<{
  isOpen: boolean
  clauses: readonly DataGridAppAdvancedFilterClauseDraft[]
  columns: readonly DataGridAppAdvancedFilterColumnOption[]
  buttonLabel?: string
  themeTokens?: DataGridThemeTokens | null
}>(), {
  buttonLabel: "Advanced filter",
  themeTokens: null,
})

const emit = defineEmits<{
  open: []
  add: []
  remove: [clauseId: number]
  apply: []
  cancel: []
  "update-clause": [payload: DataGridAppAdvancedFilterClausePatch]
}>()

const controller = usePopoverController(
  {
    id: "advanced-filter",
    role: "dialog",
    closeOnEscape: true,
    closeOnInteractOutside: true,
  },
  {
    onOpen: () => {
      if (!props.isOpen) {
        emit("open")
      }
    },
    onClose: () => {
      if (props.isOpen) {
        emit("cancel")
      }
    },
  },
)

const floating = useFloatingPopover(controller, {
  placement: "bottom",
  align: "start",
  gutter: 10,
  viewportPadding: 12,
  zIndex: 180,
  lockScroll: false,
  returnFocus: true,
})

const triggerProps = computed(() => controller.getTriggerProps({ role: "dialog" }))
const contentProps = computed(() => controller.getContentProps({ role: "dialog", tabIndex: -1 }))
const popoverOpen = computed(() => controller.state.value.open)
const popoverContentStyle = computed(() => floating.contentStyle.value)
const popoverTeleportTarget = computed(() => floating.teleportTarget.value)

const themeVars = computed<Record<string, string>>(() => {
  const tokens = props.themeTokens
  return {
    "--advanced-filter-bg": tokens?.gridColumnMenuBackgroundColor ?? "#ffffff",
    "--advanced-filter-border": tokens?.gridColumnMenuBorderColor ?? "#d1d5db",
    "--advanced-filter-shadow": tokens?.gridColumnMenuShadowColor ?? "rgba(15, 23, 42, 0.18)",
    "--advanced-filter-hover": tokens?.gridColumnMenuItemHoverBackgroundColor ?? "rgba(59, 130, 246, 0.12)",
    "--advanced-filter-text": tokens?.gridTextPrimary ?? "#111827",
    "--advanced-filter-muted": tokens?.gridColumnMenuMutedTextColor ?? tokens?.gridTextMuted ?? "#6b7280",
    "--advanced-filter-soft": tokens?.gridTextSoft ?? "#6b7280",
    "--advanced-filter-accent": tokens?.gridAccentStrong ?? "#2563eb",
    "--advanced-filter-input-border": tokens?.gridColumnMenuSearchBorderColor ?? tokens?.gridEditorBorderColor ?? "#cbd5e1",
    "--advanced-filter-input-bg": tokens?.gridColumnMenuSearchBackgroundColor ?? tokens?.gridEditorBackgroundColor ?? "#ffffff",
    "--advanced-filter-focus-ring": tokens?.gridColumnMenuFocusRingColor ?? tokens?.gridEditorFocusRingColor ?? "rgba(37, 99, 235, 0.2)",
  }
})

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      if (!controller.state.value.open) {
        controller.open("programmatic")
      }
      await nextTick()
      const firstField = floating.contentRef.value?.querySelector<HTMLElement>('[data-advanced-filter-autofocus="true"]')
      firstField?.focus({ preventScroll: true })
      await floating.updatePosition()
      return
    }
    if (controller.state.value.open) {
      controller.close("programmatic")
    }
  },
  { immediate: true },
)

watch(
  () => props.clauses.length,
  async () => {
    if (!controller.state.value.open) {
      return
    }
    await nextTick()
    await floating.updatePosition()
  },
)

const updateClause = (
  clauseId: number,
  field: DataGridAppAdvancedFilterClausePatch["field"],
  value: string,
): void => {
  emit("update-clause", { clauseId, field, value })
}
</script>

<style scoped>
.advanced-filter-panel-trigger {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--advanced-filter-input-border);
  border-radius: 8px;
  background: var(--advanced-filter-input-bg);
  color: var(--advanced-filter-text);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.advanced-filter-panel-trigger:hover {
  background: var(--advanced-filter-hover);
}

.advanced-filter-popover {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(720px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 24px));
  padding: 14px;
  border: 1px solid var(--advanced-filter-border);
  border-radius: 14px;
  background: var(--advanced-filter-bg);
  box-shadow: 0 18px 40px var(--advanced-filter-shadow);
  color: var(--advanced-filter-text);
  overflow: hidden;
}

.advanced-filter-popover__header,
.advanced-filter-popover__footer,
.advanced-filter-popover__footer-actions,
.advanced-filter-popover__row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.advanced-filter-popover__eyebrow {
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--advanced-filter-muted);
}

.advanced-filter-popover__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.advanced-filter-popover__rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding-right: 2px;
}

.advanced-filter-popover__row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: 10px;
  align-items: end;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--advanced-filter-border) 72%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--advanced-filter-hover) 45%, transparent);
}

.advanced-filter-popover__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.advanced-filter-popover__field--join {
  min-width: 88px;
}

.advanced-filter-popover__field--value {
  min-width: 0;
}

.advanced-filter-popover__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--advanced-filter-muted);
}

.advanced-filter-popover__field select,
.advanced-filter-popover__field input,
.advanced-filter-popover__primary,
.advanced-filter-popover__secondary,
.advanced-filter-popover__ghost {
  height: 34px;
  border: 1px solid var(--advanced-filter-input-border);
  border-radius: 8px;
  background: var(--advanced-filter-input-bg);
  color: var(--advanced-filter-text);
  font: inherit;
}

.advanced-filter-popover__field select,
.advanced-filter-popover__field input {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
}

.advanced-filter-popover__field input::placeholder {
  color: var(--advanced-filter-muted);
  opacity: 1;
}

.advanced-filter-popover__field select:focus,
.advanced-filter-popover__field input:focus,
.advanced-filter-popover__field select:focus-visible,
.advanced-filter-popover__field input:focus-visible,
.advanced-filter-popover__primary:focus,
.advanced-filter-popover__primary:focus-visible,
.advanced-filter-popover__secondary:focus,
.advanced-filter-popover__secondary:focus-visible,
.advanced-filter-popover__ghost:focus,
.advanced-filter-popover__ghost:focus-visible,
.advanced-filter-panel-trigger:focus,
.advanced-filter-panel-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--advanced-filter-focus-ring);
}

.advanced-filter-popover__ghost,
.advanced-filter-popover__secondary,
.advanced-filter-popover__primary {
  padding: 0 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}

.advanced-filter-popover__ghost,
.advanced-filter-popover__secondary {
  background: transparent;
}

.advanced-filter-popover__ghost:hover,
.advanced-filter-popover__secondary:hover,
.advanced-filter-panel-trigger:hover {
  background: var(--advanced-filter-hover);
}

.advanced-filter-popover__primary {
  border-color: color-mix(in srgb, var(--advanced-filter-accent) 48%, var(--advanced-filter-input-border));
  background: color-mix(in srgb, var(--advanced-filter-accent) 18%, transparent);
}

.advanced-filter-popover__primary:hover {
  background: color-mix(in srgb, var(--advanced-filter-accent) 26%, transparent);
}

.advanced-filter-popover__ghost--danger {
  color: color-mix(in srgb, #ef4444 70%, var(--advanced-filter-text));
}

.advanced-filter-popover__ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .advanced-filter-popover {
    width: min(560px, calc(100vw - 24px));
  }

  .advanced-filter-popover__row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .advanced-filter-popover__row-actions {
    justify-content: flex-end;
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .advanced-filter-popover {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    padding: 12px;
  }

  .advanced-filter-popover__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .advanced-filter-popover__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .advanced-filter-popover__footer-actions {
    width: 100%;
  }

  .advanced-filter-popover__footer-actions > button,
  .advanced-filter-popover__footer > button {
    flex: 1 1 auto;
  }
}
</style>
