<template>
  <article ref="cardRootRef" class="affino-datagrid-app-root spreadsheet-card">
    <header class="spreadsheet-card__header">
      <div class="card__title-row">
        <div class="spreadsheet-card__title-copy">
          <h2>{{ props.title }}</h2>
          <p v-if="props.subtitle" class="spreadsheet-card__subtitle">{{ props.subtitle }}</p>
        </div>
        <div v-if="props.badgeLabel" class="mode-badge">{{ props.badgeLabel }}</div>
      </div>

      <div class="spreadsheet-toolbar">
        <div class="spreadsheet-tabs" role="tablist" aria-label="Workbook sheets">
          <button
            v-for="sheet in workbookSnapshot.sheets"
            :key="sheet.id"
            type="button"
            class="spreadsheet-tab"
            :class="{
              'spreadsheet-tab--active': sheet.id === workbookSnapshot.activeSheetId,
              'spreadsheet-tab--readonly': sheet.readOnly,
              'spreadsheet-tab--reference-target': formulaReferenceTargetSheetId === sheet.id,
            }"
            :style="formulaReferenceTargetSheetId === sheet.id ? formulaReferenceTargetSheetStyle : undefined"
            :aria-pressed="sheet.id === workbookSnapshot.activeSheetId"
            :data-reference-target="formulaReferenceTargetSheetId === sheet.id ? 'true' : 'false'"
            @click="openSheet(sheet.id)"
          >
            <span class="spreadsheet-tab__name">{{ sheet.name }}</span>
            <span class="spreadsheet-tab__meta">
              {{ sheet.kind === "view" ? "view" : `${sheet.formulaCellCount} fx` }}
            </span>
          </button>
        </div>

        <div class="spreadsheet-toolbar__actions">
          <div v-if="props.styleActions" class="spreadsheet-style-actions">
            <button type="button" class="spreadsheet-action" :disabled="activeSheetReadOnly" @click="void applyStylePreset('ocean')">
              Accent
            </button>
            <button type="button" class="spreadsheet-action" :disabled="activeSheetReadOnly" @click="void applyStylePreset('mint')">
              Success
            </button>
            <button type="button" class="spreadsheet-action" :disabled="activeSheetReadOnly" @click="void applyStylePreset('amber')">
              Highlight
            </button>
            <button type="button" class="spreadsheet-action" :disabled="activeSheetReadOnly" @click="void clearSelectedStyles()">
              Clear style
            </button>
            <button type="button" class="spreadsheet-action" @click="copyStyleFromActiveCell">
              Copy style
            </button>
            <button
              type="button"
              class="spreadsheet-action"
              :disabled="copiedStyle == null || activeSheetReadOnly"
              @click="void pasteStyleToSelection()"
            >
              Paste style
            </button>
          </div>
          <div class="spreadsheet-history-actions">
            <button
              type="button"
              class="spreadsheet-action"
              :disabled="!canUndoWorkbookHistory"
              @click="void handleWorkbookHistoryAction('undo')"
            >
              Undo
            </button>
            <button
              type="button"
              class="spreadsheet-action"
              :disabled="!canRedoWorkbookHistory"
              @click="void handleWorkbookHistoryAction('redo')"
            >
              Redo
            </button>
          </div>
          <slot name="header-actions" />
        </div>
      </div>

      <div
        class="spreadsheet-formula-shell"
        :class="{
          'spreadsheet-formula-shell--focused': isFormulaBarFocused,
          'spreadsheet-formula-shell--reference-mode': isFormulaReferenceMode,
          'spreadsheet-formula-shell--readonly': activeSheetReadOnly,
        }"
      >
        <div class="spreadsheet-formula-address">
          <div class="spreadsheet-formula-address__copy">
            <span class="spreadsheet-formula-address__label">Active cell</span>
            <strong>{{ activeCellBadge }}</strong>
          </div>
          <span class="spreadsheet-formula-address__badge">{{ formulaModeLabel }}</span>
        </div>

        <UiMenu ref="formulaAutocompleteMenuRef" :callbacks="formulaAutocompleteMenuCallbacks" :options="formulaAutocompleteMenuOptions">
          <UiMenuTrigger as-child trigger="both">
            <div class="spreadsheet-formula-main">
              <div class="spreadsheet-formula-toolbar">
                <div class="spreadsheet-formula-toolbar__copy">
                  <span class="spreadsheet-formula-toolbar__fx">fx</span>
                  <div class="spreadsheet-formula-toolbar__text">
                    <strong>{{ formulaModeLabel }}</strong>
                    <span>{{ formulaModeHint }}</span>
                  </div>
                </div>

                <div v-if="!activeSheetReadOnly" class="spreadsheet-formula-toolbar__actions">
                  <button
                    type="button"
                    class="spreadsheet-action spreadsheet-action--subtle"
                    @mousedown.prevent
                    @click="handleFormulaCancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="spreadsheet-action spreadsheet-action--primary"
                    @mousedown.prevent
                    @click="handleFormulaCommit"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <textarea
                ref="formulaInputRef"
                class="spreadsheet-formula-input"
                :value="editorSnapshot.rawInput"
                :readonly="activeSheetReadOnly"
                spellcheck="false"
                :placeholder="formulaInputPlaceholder"
                @focus="handleFormulaFocus"
                @blur="handleFormulaBlur"
                @input="handleFormulaInput"
                @select="syncFormulaSelectionFromDom"
                @click="syncFormulaSelectionFromDom"
                @keyup="syncFormulaSelectionFromDom"
                @keydown="handleFormulaKeydown"
              />

              <div class="spreadsheet-formula-preview" aria-hidden="true">
                <template v-for="segment in formulaPreviewSegments" :key="segment.key">
                  <span
                    v-if="segment.kind === 'reference'"
                    class="spreadsheet-formula-token spreadsheet-formula-token--reference"
                    :class="{ 'spreadsheet-formula-token--active': segment.active }"
                    :style="segment.style"
                    @mouseenter="setHoveredFormulaReferenceKey(segment.referenceKey)"
                    @mouseleave="clearHoveredFormulaReferenceKey"
                  >
                    {{ segment.text }}
                  </span>
                  <span v-else class="spreadsheet-formula-token">{{ segment.text }}</span>
                </template>
              </div>

              <div v-if="isFormulaReferenceMode" class="spreadsheet-formula-caption">
                <span class="spreadsheet-formula-caption__label">Selection</span>
                <span>{{ formulaSelectionSummary }}</span>
              </div>
            </div>
          </UiMenuTrigger>

          <UiMenuContent
            v-if="isFormulaAutocompleteVisible"
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
              v-for="(item, index) in formulaAutocompleteSuggestions"
              :key="item.name"
              class="spreadsheet-formula-autocomplete__item"
              :class="{ 'spreadsheet-formula-autocomplete__item--active': index === formulaAutocompleteActiveIndex }"
              :data-formula-autocomplete-item="item.name"
              :data-formula-autocomplete-active="index === formulaAutocompleteActiveIndex ? 'true' : 'false'"
              @mouseenter="formulaAutocompleteActiveIndex = index"
              @select="applyFormulaAutocomplete(item)"
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
          <div v-if="activeSheetReadOnly" class="spreadsheet-formula-readonly">
            Derived view from <strong>{{ activeSheetViewSourceLabel }}</strong>. Edit the source sheet to recompute.
          </div>
          <div class="spreadsheet-formula-value">
            <span class="spreadsheet-formula-state__label">Display</span>
            <span>{{ activeCellDisplayLabel }}</span>
          </div>
          <div class="spreadsheet-formula-value">
            <span class="spreadsheet-formula-state__label">Mode</span>
            <span>{{ formulaStateSummary }}</span>
          </div>
          <div class="spreadsheet-formula-value">
            <span class="spreadsheet-formula-state__label">Refs</span>
            <span>{{ formulaReferenceSummary }}</span>
          </div>
          <div
            v-if="activeDiagnosticMessage"
            class="spreadsheet-formula-error"
            :title="activeDiagnosticMessage"
          >
            {{ activeDiagnosticMessage }}
          </div>
        </div>
      </div>

      <div v-if="props.workbookStats" class="meta">
        <span>Workbook sheets: {{ workbookSnapshot.sheets.length }}</span>
        <span>Active rows: {{ activeSheetStats?.rowCount ?? 0 }}</span>
        <span>Columns: {{ activeSheetStats?.columnCount ?? 0 }}</span>
        <span>Formulas: {{ activeSheetStats?.formulaCellCount ?? 0 }}</span>
        <span>Errors: {{ activeSheetStats?.errorCellCount ?? 0 }}</span>
      </div>

      <div v-if="props.syncStats" class="meta">
        <span>Sync passes: {{ workbookSnapshot.sync.passCount }}</span>
        <span>Converged: {{ workbookSnapshot.sync.converged ? "yes" : "no" }}</span>
        <span>Style clipboard: {{ copiedStyle == null ? "empty" : "ready" }}</span>
        <span>Editor mode: {{ editorSnapshot.analysis.kind }}</span>
      </div>
    </header>

    <section class="spreadsheet-layout">
      <aside class="spreadsheet-sidebar">
        <slot name="sidebar-top" />

        <section class="spreadsheet-panel">
          <h3>Reference map</h3>
          <div v-if="referenceLegend.length === 0" class="spreadsheet-empty-state">
            No parsed cell refs for the current input.
          </div>
          <div v-else class="spreadsheet-reference-list">
            <button
              v-for="reference in referenceLegend"
              :key="reference.key"
              type="button"
              class="spreadsheet-reference-chip"
              :class="{ 'spreadsheet-reference-chip--active': reference.active }"
              :style="reference.style"
              @mouseenter="setHoveredFormulaReferenceKey(reference.key)"
              @mouseleave="clearHoveredFormulaReferenceKey"
              @click="moveCaretToReference(reference.key)"
            >
              <span>{{ reference.text }}</span>
              <span>{{ reference.targetsLabel }}</span>
            </button>
          </div>
        </section>

        <section class="spreadsheet-panel">
          <h3>Selected range</h3>
          <div class="spreadsheet-selection-summary">
            {{ selectedRangeLabel }}
          </div>
          <div class="spreadsheet-selection-hint">
            {{ selectionHintMessage }}
          </div>
        </section>

        <slot name="sidebar-bottom" />
      </aside>

      <section class="spreadsheet-grid-shell">
        <div class="spreadsheet-grid-toolbar">
          <div class="datagrid-app-toolbar">
            <div class="datagrid-app-toolbar__group">
              <DataGridAdvancedFilterPopover
                v-if="props.advancedFilter"
                :is-open="isAdvancedFilterPanelOpen"
                :clauses="advancedFilterDraftClauses"
                :columns="advancedFilterColumns"
                :applied-filter-summary-items="activeFilterSummaryItems"
                :has-any-filters="hasActiveFilters"
                :active="hasActiveFilters"
                button-label="Advanced filter"
                @open="openAdvancedFilterPanel"
                @add="addAdvancedFilterClause"
                @remove="removeAdvancedFilterClause"
                @update-clause="updateAdvancedFilterClause"
                @apply="applyAdvancedFilterPanel"
                @cancel="cancelAdvancedFilterPanel"
                @reset-all="resetAllFilters"
              />
              <button
                v-if="props.diagnostics"
                type="button"
                class="datagrid-app-toolbar__button"
                :class="{ 'datagrid-app-toolbar__button--active': isDiagnosticsPanelOpen }"
                @click="isDiagnosticsPanelOpen = !isDiagnosticsPanelOpen"
              >
                Formula diagnostics
              </button>
              <slot name="toolbar-actions" />
            </div>
          </div>
        </div>

        <div class="spreadsheet-grid-stage">
          <section
            ref="gridHostRef"
            class="grid-host spreadsheet-grid-host"
            @mousedown.capture="handleGridPointerDownCapture"
            @mousemove.capture="handleFormulaReferenceDragMove"
          >
            <DataGridTableStageLoose v-bind="tableStagePropsForView" :stage-context="tableStageContextForView" />
          </section>

          <div
            v-if="formulaReferenceOverlayMetrics"
            class="spreadsheet-formula-reference-overlay"
            :class="{ 'spreadsheet-formula-reference-overlay--dragging': formulaReferenceDragState != null }"
            :style="formulaReferenceOverlayStyle"
            aria-hidden="true"
          >
            <button
              v-for="corner in FORMULA_REFERENCE_HANDLE_CORNERS"
              :key="corner"
              type="button"
              class="spreadsheet-formula-reference-handle"
              :class="`spreadsheet-formula-reference-handle--${corner}`"
              tabindex="-1"
              @mousedown.stop.prevent="startFormulaReferenceDrag(corner)"
            />
          </div>

          <aside
            v-if="props.diagnostics"
            class="spreadsheet-diagnostics-drawer"
            :class="{ 'spreadsheet-diagnostics-drawer--open': isDiagnosticsPanelOpen }"
            aria-label="Formula diagnostics"
          >
            <div class="spreadsheet-diagnostics-drawer__header">
              <div>
                <div class="spreadsheet-diagnostic-label">Formula diagnostics</div>
                <h3>Spreadsheet runtime</h3>
              </div>
              <button
                type="button"
                class="spreadsheet-action"
                @click="isDiagnosticsPanelOpen = false"
              >
                Close
              </button>
            </div>

            <div class="spreadsheet-diagnostics-drawer__body">
              <div class="spreadsheet-diagnostic-metrics">
                <div class="spreadsheet-diagnostic-metric">
                  <span>Last recalc</span>
                  <strong>{{ lastSpreadsheetOperationLabel }}</strong>
                  <small>{{ lastSpreadsheetOperationDurationLabel }}</small>
                </div>
                <div class="spreadsheet-diagnostic-metric">
                  <span>Workbook sync</span>
                  <strong>{{ workbookSyncSummary.passCount }} pass{{ workbookSyncSummary.passCount === 1 ? "" : "es" }}</strong>
                  <small>{{ workbookSyncSummary.converged ? "converged" : "not converged" }}</small>
                </div>
                <div class="spreadsheet-diagnostic-metric">
                  <span>Formula cells</span>
                  <strong>{{ workbookFormulaTotals.formulaCells }}</strong>
                  <small>{{ workbookFormulaTotals.errorCells }} errors across workbook</small>
                </div>
                <div class="spreadsheet-diagnostic-metric">
                  <span>Workbook issues</span>
                  <strong>{{ workbookDiagnostics.length }}</strong>
                  <small>{{ workbookWarningDiagnostics.length }} warnings across workbook</small>
                </div>
                <div class="spreadsheet-diagnostic-metric">
                  <span>Active formula</span>
                  <strong>{{ activeFormulaSummary.referenceCount }} refs</strong>
                  <small>{{ activeFormulaSummary.crossSheetReferenceCount }} cross-sheet · {{ activeFormulaSummary.diagnosticCount }} diagnostics</small>
                </div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">Active cell</span>
                <div class="spreadsheet-selection-hint">
                  {{ activeFormulaSummary.cellLabel }} · {{ activeFormulaSummary.kindLabel }} · {{ activeFormulaSummary.validityLabel }}
                </div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">Sheet runtime</span>
                <div class="spreadsheet-diagnostic-chip-list">
                  <span class="spreadsheet-diagnostic-chip">Rows {{ activeSheetStats?.rowCount ?? 0 }}</span>
                  <span class="spreadsheet-diagnostic-chip">Cols {{ activeSheetStats?.columnCount ?? 0 }}</span>
                  <span class="spreadsheet-diagnostic-chip">Formulas {{ activeSheetStats?.formulaCellCount ?? 0 }}</span>
                  <span class="spreadsheet-diagnostic-chip">Errors {{ activeSheetStats?.errorCellCount ?? 0 }}</span>
                  <span class="spreadsheet-diagnostic-chip">Revision {{ activeSheetStats?.revision ?? 0 }}</span>
                </div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">Formula references</span>
                <div v-if="activeFormulaReferenceItems.length > 0" class="spreadsheet-diagnostic-chip-list">
                  <span
                    v-for="item in activeFormulaReferenceItems"
                    :key="item"
                    class="spreadsheet-diagnostic-chip"
                  >
                    {{ item }}
                  </span>
                </div>
                <div v-else class="spreadsheet-empty-state">No parsed references in the active formula</div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">Formula issues</span>
                <div v-if="activeFormulaDiagnosticItems.length > 0" class="spreadsheet-diagnostic-list">
                  <div
                    v-for="item in activeFormulaDiagnosticItems"
                    :key="item"
                    class="spreadsheet-diagnostic-list__item"
                  >
                    {{ item }}
                  </div>
                </div>
                <div v-else class="spreadsheet-empty-state">No formula diagnostics</div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">Workbook issues</span>
                <div v-if="workbookDiagnosticItems.length > 0" class="spreadsheet-diagnostic-list">
                  <div
                    v-for="item in workbookDiagnosticItems"
                    :key="item"
                    class="spreadsheet-diagnostic-list__item"
                  >
                    {{ item }}
                  </div>
                </div>
                <div v-else class="spreadsheet-empty-state">No workbook diagnostics</div>
              </div>

              <div class="spreadsheet-diagnostic-block">
                <span class="spreadsheet-diagnostic-label">View state</span>
                <div class="spreadsheet-diagnostic-chip-list">
                  <span class="spreadsheet-diagnostic-chip">Visible rows {{ totalRows }}</span>
                  <span class="spreadsheet-diagnostic-chip">Filters {{ activeFilterSummaryItems.length }}</span>
                  <span class="spreadsheet-diagnostic-chip">Sort keys {{ sortSummaryItems.length }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section v-if="$slots.gridActions" class="spreadsheet-grid-actions">
          <slot
            name="gridActions"
            :workbook-model="workbook"
            :active-sheet="activeSheetHandle"
            :active-sheet-read-only="activeSheetReadOnly"
            :measure-operation="measureSpreadsheetOperation"
            :run-workbook-intent="runWorkbookIntent"
          />
        </section>
      </section>
    </section>

    <footer v-if="$slots.footer || props.footerText" class="card__footer">
      <slot name="footer">
        {{ props.footerText }}
      </slot>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch, watchEffect, type Ref } from "vue"
import {
  DATAGRID_DEFAULT_FORMULA_FUNCTIONS,
  type DataGridFormulaFunctionRegistry,
} from "@affino/datagrid-formula-engine"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
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
import {
  createDataGridSpreadsheetFormulaEditorModel,
  rewriteDataGridSpreadsheetFormulaReferences,
  type DataGridApi,
  type DataGridColumnInput,
  type DataGridColumnModelSnapshot,
  type DataGridFilterSnapshot,
  type DataGridRowNode,
  type DataGridRowId,
  type DataGridRowModel,
  type DataGridSelectionSnapshot,
  type DataGridSpreadsheetCellAddress,
  type DataGridSpreadsheetCellSnapshot,
  type DataGridSpreadsheetStyle,
  type DataGridSpreadsheetWorkbookModel,
  type DataGridSpreadsheetWorkbookSheetHandle,
  type DataGridSpreadsheetWorkbookState,
} from "@affino/datagrid-core"
import { createGridSelectionRange, type GridSelectionContext, type GridSelectionPointLike } from "@affino/datagrid-core/advanced"
import type { DataGridCopyRange } from "@affino/datagrid-vue/advanced"
import {
  cloneDataGridFilterSnapshot,
  useDataGridRuntime,
  type DataGridColumnSnapshot,
  type DataGridSortState,
  type UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppRowSelection,
  useDataGridAppSelection,
} from "@affino/datagrid-vue/app"
import {
  DataGridAdvancedFilterPopover,
  DataGridTableStage,
  createDataGridTableStageContext,
  dataGridAppRootElementKey,
  useDataGridTableStageRuntime,
} from "@affino/datagrid-vue-app/internal"
import type { DataGridTableStageProps } from "@affino/datagrid-vue-app/internal"
import { useDataGridSpreadsheetWorkbookHistory } from "./useDataGridSpreadsheetWorkbookHistory"

const DataGridTableStageLoose = DataGridTableStage as unknown as new () => {
  $props: Record<string, unknown>
}

export interface DataGridSpreadsheetWorkbookAppProps {
  workbookModel: DataGridSpreadsheetWorkbookModel
  title?: string
  subtitle?: string | null
  badgeLabel?: string | null
  formulaPlaceholder?: string
  clipboardCopyMode?: "formula" | "display" | "smart"
  footerText?: string | null
  styleActions?: boolean
  advancedFilter?: boolean
  diagnostics?: boolean
  workbookStats?: boolean
  syncStats?: boolean
}

const props = withDefaults(defineProps<DataGridSpreadsheetWorkbookAppProps>(), {
  title: "Spreadsheet Workbook",
  subtitle: null,
  badgeLabel: "Spreadsheet",
  formulaPlaceholder: "Type a value or formula. Try = [qty]@row * [price]@row and click cells.",
  clipboardCopyMode: "smart",
  footerText: null,
  styleActions: true,
  advancedFilter: true,
  diagnostics: true,
  workbookStats: true,
  syncStats: true,
})

type SpreadsheetGridRow = {
  id: DataGridRowId
  __rowIndex: number
  [key: string]: unknown
}

type SpreadsheetStylePresetId = "ocean" | "mint" | "amber"

type SpreadsheetWorkbookIntentDescriptor = {
  intent: string
  label: string
  affectedRange?: DataGridCopyRange | null
}

type FormulaPreviewSegment =
  | {
      key: string
      kind: "plain"
      text: string
    }
  | {
      key: string
      kind: "reference"
      referenceKey: string
      text: string
      active: boolean
      style: Readonly<Record<string, string>>
    }

type ReferenceLegendEntry = {
  key: string
  text: string
  active: boolean
  targetsLabel: string
  style: Readonly<Record<string, string>>
}

type FormulaAutocompleteSuggestion = {
  name: string
  arityLabel: string
  detail: string
}

type FormulaAutocompleteMatch = {
  query: string
  replacementStart: number
  replacementEnd: number
}

type FormulaReferenceOverlayMetrics = {
  top: number
  left: number
  width: number
  height: number
  color: string
  borderColor: string
  backgroundColor: string
}

type FormulaReferenceHandleCorner = typeof FORMULA_REFERENCE_HANDLE_CORNERS[number]

type FormulaReferenceDragState = {
  mode: "move" | "resize-range"
  handleCorner: FormulaReferenceHandleCorner
  anchorCell: DataGridSpreadsheetCellAddress | null
  lastTargetCellKey: string | null
}

interface UiMenuRef {
  controller?: {
    open: (reason?: "pointer" | "keyboard" | "programmatic") => void
    close: (reason?: "pointer" | "keyboard" | "programmatic") => void
    setAnchor: (rect: { x: number; y: number; width: number; height: number } | null) => void
  }
}

interface SortToggleState {
  key: string
  direction: "asc" | "desc"
}

type DataGridColumnFilterEntry = DataGridFilterSnapshot["columnFilters"][string]
type DataGridAdvancedExpressionEntry = NonNullable<DataGridFilterSnapshot["advancedExpression"]>

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
  allowSheetQualifiedReferences: true as const,
}

const REFERENCE_PALETTE = [
  {
    text: "#0f4c81",
    border: "#3b82f6",
    soft: "rgba(59, 130, 246, 0.16)",
    solid: "rgba(59, 130, 246, 0.3)",
  },
  {
    text: "#0f766e",
    border: "#14b8a6",
    soft: "rgba(20, 184, 166, 0.16)",
    solid: "rgba(20, 184, 166, 0.3)",
  },
  {
    text: "#b45309",
    border: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.18)",
    solid: "rgba(245, 158, 11, 0.32)",
  },
  {
    text: "#9333ea",
    border: "#a855f7",
    soft: "rgba(168, 85, 247, 0.18)",
    solid: "rgba(168, 85, 247, 0.32)",
  },
  {
    text: "#be123c",
    border: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.18)",
    solid: "rgba(244, 63, 94, 0.32)",
  },
  {
    text: "#166534",
    border: "#22c55e",
    soft: "rgba(34, 197, 94, 0.18)",
    solid: "rgba(34, 197, 94, 0.32)",
  },
] as const

const STYLE_PRESETS: Record<SpreadsheetStylePresetId, DataGridSpreadsheetStyle> = {
  ocean: Object.freeze({
    background: "rgba(59, 130, 246, 0.12)",
    borderColor: "#2563eb",
    color: "#1d4ed8",
    fontWeight: 600,
  }),
  mint: Object.freeze({
    background: "rgba(16, 185, 129, 0.14)",
    borderColor: "#10b981",
    color: "#047857",
    fontWeight: 600,
  }),
  amber: Object.freeze({
    background: "rgba(245, 158, 11, 0.16)",
    borderColor: "#f59e0b",
    color: "#92400e",
    fontWeight: 600,
  }),
}

const formulaAutocompleteMenuOptions: MenuOptions = {
  mousePrediction: {},
  loopFocus: true,
  closeOnSelect: true,
  openDelay: 0,
  closeDelay: 60,
}

const FORMULA_REFERENCE_HANDLE_CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const

const cardRootRef = ref<HTMLElement | null>(null)
const formulaInputRef = ref<HTMLTextAreaElement | null>(null)
const formulaAutocompleteMenuRef = ref<UiMenuRef | null>(null)
const gridHostRef = ref<HTMLElement | null>(null)
const sandboxThemeTokens = resolveGridThemeTokens(industrialNeutralTheme)

provide(dataGridAppRootElementKey, cardRootRef)

watchEffect(() => {
  if (!cardRootRef.value) {
    return
  }
  applyGridTheme(cardRootRef.value, sandboxThemeTokens)
})

function cloneRowData<TRow,>(row: TRow): TRow {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(row)
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

function createEmptyFilterModel(): DataGridFilterSnapshot {
  return {
    columnFilters: {},
    advancedFilters: {},
    advancedExpression: null,
  }
}

function cloneFilterModelState(
  filterModel: DataGridFilterSnapshot | null | undefined,
): DataGridFilterSnapshot {
  return cloneDataGridFilterSnapshot(filterModel ?? createEmptyFilterModel()) ?? createEmptyFilterModel()
}

function normalizeColumnMenuToken(token: string): string {
  return token.startsWith("string:")
    ? `string:${token.slice("string:".length).toLowerCase()}`
    : token
}

function resolveInitialFilterTexts(filterModel: DataGridFilterSnapshot | null | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const columnFilters = filterModel?.columnFilters ?? {}
  for (const [columnKey, filter] of Object.entries(columnFilters)) {
    if (filter?.kind === "predicate" && typeof filter.value === "string") {
      result[columnKey] = filter.value
    }
  }
  return result
}

function formatFilterDisplayValue(value: unknown): string {
  if (value == null) {
    return "blank"
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "string") {
    return `"${value}"`
  }
  return String(value)
}

function formatColumnFilterOperator(operator: string): string {
  switch (operator) {
    case "contains":
      return "contains"
    case "startsWith":
    case "starts-with":
      return "starts with"
    case "endsWith":
    case "ends-with":
      return "ends with"
    case "equals":
      return "="
    case "notEquals":
    case "not-equals":
      return "!="
    case "gt":
      return ">"
    case "gte":
      return ">="
    case "lt":
      return "<"
    case "lte":
      return "<="
    case "between":
      return "between"
    case "isEmpty":
    case "is-empty":
      return "is empty"
    case "notEmpty":
    case "not-empty":
      return "is not empty"
    case "isNull":
    case "is-null":
      return "is null"
    case "notNull":
    case "not-null":
      return "is not null"
    default:
      return operator
  }
}

function decodeColumnFilterToken(token: string): string {
  const normalized = String(token ?? "")
  if (normalized === "null") {
    return "(Blanks)"
  }
  const separatorIndex = normalized.indexOf(":")
  if (separatorIndex < 0) {
    return normalized
  }
  const kind = normalized.slice(0, separatorIndex)
  const payload = normalized.slice(separatorIndex + 1)
  if (
    kind === "string"
    || kind === "number"
    || kind === "boolean"
    || kind === "bigint"
    || kind === "date"
    || kind === "repr"
    || kind === "json"
  ) {
    return payload
  }
  return normalized
}

function isFormulaFunctionIdentifierCharacter(character: string | undefined): boolean {
  return typeof character === "string" && /^[A-Za-z0-9_]$/.test(character)
}

function findPreviousMeaningfulCharacter(text: string, fromIndex: number): string | null {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    const character = text[index]
    if (character && !/\s/.test(character)) {
      return character
    }
  }
  return null
}

function isFormulaFunctionContextCharacter(character: string | null): boolean {
  return character === "="
    || character === "("
    || character === ","
    || character === "+"
    || character === "-"
    || character === "*"
    || character === "/"
    || character === "<"
    || character === ">"
}

function formatFormulaFunctionArityLabel(
  definition: DataGridFormulaFunctionRegistry[string],
): string {
  if (typeof definition === "function" || definition.arity == null) {
    return "variable args"
  }
  if (typeof definition.arity === "number") {
    return `${definition.arity} arg${definition.arity === 1 ? "" : "s"}`
  }
  if (typeof definition.arity.max === "number") {
    if (definition.arity.max === definition.arity.min) {
      return `${definition.arity.min} arg${definition.arity.min === 1 ? "" : "s"}`
    }
    return `${definition.arity.min}-${definition.arity.max} args`
  }
  return `${definition.arity.min}+ args`
}

function resolveFormulaAutocompleteMatch(
  rawInput: string,
  selection: { start: number; end: number },
): FormulaAutocompleteMatch | null {
  if (!rawInput.startsWith("=") || selection.start !== selection.end) {
    return null
  }
  const caret = selection.end
  if (caret < 1) {
    return null
  }
  let replacementStart = caret
  while (replacementStart > 0 && isFormulaFunctionIdentifierCharacter(rawInput[replacementStart - 1])) {
    replacementStart -= 1
  }
  let replacementEnd = caret
  while (replacementEnd < rawInput.length && isFormulaFunctionIdentifierCharacter(rawInput[replacementEnd])) {
    replacementEnd += 1
  }
  const previousCharacter = findPreviousMeaningfulCharacter(rawInput, replacementStart)
  if (!isFormulaFunctionContextCharacter(previousCharacter)) {
    return null
  }
  return {
    query: rawInput.slice(replacementStart, caret),
    replacementStart,
    replacementEnd,
  }
}

function formatColumnFilterSummary(label: string, filter: DataGridColumnFilterEntry): string {
  if (filter.kind === "valueSet") {
    if (filter.tokens.length === 1) {
      return `${label}: ${decodeColumnFilterToken(filter.tokens[0] ?? "")}`
    }
    return `${label}: ${filter.tokens.length} values`
  }
  if (filter.operator === "between") {
    return `${label} between ${formatFilterDisplayValue(filter.value)} and ${formatFilterDisplayValue(filter.value2)}`
  }
  if (
    filter.operator === "isEmpty"
    || filter.operator === "notEmpty"
    || filter.operator === "isNull"
    || filter.operator === "notNull"
  ) {
    return `${label} ${formatColumnFilterOperator(filter.operator)}`
  }
  return `${label} ${formatColumnFilterOperator(filter.operator)} ${formatFilterDisplayValue(filter.value)}`
}

function formatAdvancedExpressionSummary(
  expression: DataGridAdvancedExpressionEntry,
  resolveColumnLabel: (columnKey: string) => string,
): string {
  if (expression.kind === "condition") {
    const label = resolveColumnLabel(expression.key)
    if (expression.operator === "between") {
      return `${label} between ${formatFilterDisplayValue(expression.value)} and ${formatFilterDisplayValue(expression.value2)}`
    }
    if (
      expression.operator === "isEmpty"
      || expression.operator === "notEmpty"
      || expression.operator === "isNull"
      || expression.operator === "notNull"
    ) {
      return `${label} ${formatColumnFilterOperator(expression.operator)}`
    }
    return `${label} ${formatColumnFilterOperator(expression.operator)} ${formatFilterDisplayValue(expression.value)}`
  }
  if (expression.kind === "not") {
    return `NOT (${formatAdvancedExpressionSummary(expression.child, resolveColumnLabel)})`
  }
  return expression.children
    .map(child => formatAdvancedExpressionSummary(child, resolveColumnLabel))
    .filter(part => part.length > 0)
    .join(` ${expression.operator.toUpperCase()} `)
}

function makeLocalCellKey(rowIndex: number, columnKey: string): string {
  return `${rowIndex}\u001f${columnKey}`
}

function makeScopedCellKey(cell: DataGridSpreadsheetCellAddress | null): string {
  if (!cell) {
    return ""
  }
  return `${cell.sheetId ?? ""}\u001f${cell.rowIndex}\u001f${cell.columnKey}`
}

function areCellsEqual(
  left: DataGridSpreadsheetCellAddress | null,
  right: DataGridSpreadsheetCellAddress | null,
): boolean {
  return makeScopedCellKey(left) === makeScopedCellKey(right)
}

function resolvePalette(index: number) {
  return REFERENCE_PALETTE[index % REFERENCE_PALETTE.length] ?? REFERENCE_PALETTE[0]
}

function resolveGridCellValue(cell: DataGridSpreadsheetCellSnapshot | null): unknown {
  if (!cell) {
    return ""
  }
  if (cell.errorValue) {
    return "#ERROR"
  }
  const value = cell.displayValue
  if (value == null) {
    return ""
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }
  return String(value)
}

function resolveCellDisplayText(cell: DataGridSpreadsheetCellSnapshot | null): string {
  if (!cell) {
    return ""
  }
  if (cell.errorValue) {
    return "#ERROR"
  }
  return cell.formattedValue
}

function formatCellReferenceLabel(
  sheetName: string | null | undefined,
  columnKey: string,
  rowIndex: number,
): string {
  const normalizedSheetName = String(sheetName ?? "").trim()
  return normalizedSheetName.length > 0
    ? `${normalizedSheetName} / ${columnKey} / row ${rowIndex + 1}`
    : `${columnKey} / row ${rowIndex + 1}`
}

function normalizeVisualStyle(style: DataGridSpreadsheetStyle | null | undefined): Record<string, unknown> {
  return style && typeof style === "object" ? { ...style } : {}
}

function mergeBoxShadow(...values: Array<string | undefined>): string | undefined {
  const merged = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ")
  return merged.length > 0 ? merged : undefined
}

function resolveCellVisualStyle(style: DataGridSpreadsheetStyle | null | undefined) {
  const visualStyle = normalizeVisualStyle(style)
  const background = typeof visualStyle.background === "string"
    ? visualStyle.background
    : typeof visualStyle.backgroundColor === "string"
      ? visualStyle.backgroundColor
      : undefined
  const borderColor = typeof visualStyle.borderColor === "string" ? visualStyle.borderColor : undefined
  return {
    backgroundColor: background,
    color: typeof visualStyle.color === "string" ? visualStyle.color : undefined,
    fontWeight: typeof visualStyle.fontWeight === "number" || typeof visualStyle.fontWeight === "string"
      ? visualStyle.fontWeight
      : undefined,
    fontStyle: visualStyle.italic === true
      ? "italic"
      : typeof visualStyle.fontStyle === "string"
        ? visualStyle.fontStyle
        : undefined,
    textAlign: visualStyle.textAlign === "left" || visualStyle.textAlign === "center" || visualStyle.textAlign === "right"
      ? visualStyle.textAlign
      : undefined,
    boxShadow: borderColor ? `inset 0 0 0 1px ${borderColor}` : undefined,
  }
}

function resolveColumnWidth(columnKey: string, title: string): number {
  const normalized = columnKey.toLowerCase()
  if (normalized === "qty" || normalized === "id") {
    return 88
  }
  if (normalized.endsWith("id") || normalized === "status" || normalized === "tier" || normalized === "region") {
    return 118
  }
  if (normalized === "price" || normalized === "total" || normalized === "value" || normalized === "totalspend") {
    return 132
  }
  if (normalized === "note") {
    return 320
  }
  return Math.max(132, Math.min(240, title.length * 10 + 44))
}

function resolveColumnAlignment(columnKey: string): "left" | "center" | "right" {
  const normalized = columnKey.toLowerCase()
  if (
    normalized === "qty"
    || normalized === "price"
    || normalized === "total"
    || normalized === "value"
    || normalized === "customerid"
    || normalized === "orderscount"
    || normalized === "totalspend"
    || normalized === "id"
  ) {
    return "right"
  }
  return "left"
}

function resolveColumnDataType(columnKey: string): "text" | "number" {
  const normalized = columnKey.toLowerCase()
  if (
    normalized === "qty"
    || normalized === "price"
    || normalized === "total"
    || normalized === "value"
    || normalized === "customerid"
    || normalized === "orderscount"
    || normalized === "totalspend"
    || normalized === "id"
  ) {
    return "number"
  }
  return "text"
}

let workbook = props.workbookModel
const workbookSnapshot = shallowRef(workbook.getSnapshot())
const workbookRevision = ref(0)
const copiedStyle = ref<DataGridSpreadsheetStyle | null>(null)
const isFormulaBarFocused = ref(false)
const isDiagnosticsPanelOpen = ref(false)
const pendingFormulaEditHistory = ref<{
  cellKey: string
  beforeSnapshot: DataGridSpreadsheetWorkbookState
  changed: boolean
} | null>(null)
const lastSpreadsheetOperation = ref<{
  label: string
  durationMs: number
  at: number
} | null>(null)
const workbookHistory = useDataGridSpreadsheetWorkbookHistory({
  workbookModel: workbook,
})
const hasPendingFormulaEditHistory = computed(() => pendingFormulaEditHistory.value?.changed === true)
const formulaAutocompleteOpen = ref(false)
const formulaAutocompleteActiveIndex = ref(0)
const formulaReferenceOverlayMetrics = ref<FormulaReferenceOverlayMetrics | null>(null)
const formulaReferenceDragState = ref<FormulaReferenceDragState | null>(null)
const hoveredFormulaReferenceKey = ref<string | null>(null)
const pendingWorkbookHistoryCommitCount = ref(0)
let pendingWorkbookHistoryTail: Promise<void> = Promise.resolve()
let pendingHoveredFormulaReferencePreviewTimer: number | null = null
let activeHoveredFormulaReferencePreview:
  | {
    referenceKey: string
    originSheetId: string | null
  }
  | null = null

const formulaAutocompleteMenuCallbacks: MenuCallbacks = {
  onOpen: () => {
    formulaAutocompleteOpen.value = true
    syncFormulaAutocompleteMenuAnchor()
  },
  onClose: () => {
    formulaAutocompleteOpen.value = false
  },
}

function trackWorkbookHistoryCommit<T>(promise: Promise<T>): Promise<T> {
  pendingWorkbookHistoryCommitCount.value += 1
  const trackedPromise = promise.finally(() => {
    pendingWorkbookHistoryCommitCount.value = Math.max(0, pendingWorkbookHistoryCommitCount.value - 1)
  })
  pendingWorkbookHistoryTail = pendingWorkbookHistoryTail
    .catch(() => undefined)
    .then(() => trackedPromise.then(() => undefined, () => undefined))
  return trackedPromise
}

function recordWorkbookHistoryTransaction(
  descriptor: { intent: string; label: string; affectedRange?: DataGridCopyRange | null },
  beforeSnapshot: DataGridSpreadsheetWorkbookState,
): Promise<string | null> {
  return trackWorkbookHistoryCommit(workbookHistory.recordIntentTransaction(descriptor, beforeSnapshot))
}

async function flushPendingWorkbookHistoryTransactions(): Promise<void> {
  await pendingWorkbookHistoryTail
}

const canUndoWorkbookHistory = computed(() => (
  hasPendingFormulaEditHistory.value
  || pendingWorkbookHistoryCommitCount.value > 0
  || workbookHistory.canUndo.value
))
const canRedoWorkbookHistory = computed(() => workbookHistory.canRedo.value)

const editorModel = createDataGridSpreadsheetFormulaEditorModel({
  outputSyntax: "smartsheet",
  referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
  resolveRowCount: cell => {
    if (!cell?.sheetId) {
      return workbook.getActiveSheet()?.sheetModel.getSnapshot().rowCount ?? 0
    }
    return workbook.getSheet(cell.sheetId)?.sheetModel.getSnapshot().rowCount ?? 0
  },
  resolveReferenceRowCount: (reference, activeCell) => {
    if (reference.sheetReference) {
      const normalizedAlias = reference.sheetReference.trim().toLowerCase()
      const targetSheet = workbook.getSheets().find(sheet => sheet.aliases.includes(normalizedAlias))
      return targetSheet?.sheetModel.getSnapshot().rowCount ?? null
    }
    if (!activeCell?.sheetId) {
      return workbook.getActiveSheet()?.sheetModel.getSnapshot().rowCount ?? 0
    }
    return workbook.getSheet(activeCell.sheetId)?.sheetModel.getSnapshot().rowCount ?? null
  },
})
const editorSnapshot = shallowRef(editorModel.getSnapshot())

const formulaFunctionSuggestions = computed<readonly FormulaAutocompleteSuggestion[]>(() => {
  const activeSheet = activeSheetHandle.value
  const customRegistry: DataGridFormulaFunctionRegistry = activeSheet?.sheetModel.exportState().functionRegistry ?? {}
  const mergedRegistry: DataGridFormulaFunctionRegistry = {
    ...DATAGRID_DEFAULT_FORMULA_FUNCTIONS,
    ...customRegistry,
  }
  return Object.entries(mergedRegistry)
    .map(([name, definition]) => {
      const normalizedName = String(name ?? "").trim().toUpperCase()
      return {
        name: normalizedName,
        arityLabel: formatFormulaFunctionArityLabel(definition),
        detail: typeof definition === "function"
          ? "Custom formula function"
          : definition.requiresRuntimeContext === true
            ? "Formula function with runtime context"
            : "Built-in formula function",
      }
    })
    .filter(item => item.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name))
})

const formulaAutocompleteMatch = computed(() => resolveFormulaAutocompleteMatch(
  editorSnapshot.value.rawInput,
  editorSnapshot.value.selection,
))

const formulaAutocompleteSuggestions = computed<readonly FormulaAutocompleteSuggestion[]>(() => {
  const match = formulaAutocompleteMatch.value
  if (!match) {
    return []
  }
  const normalizedQuery = match.query.trim().toUpperCase()
  const rankMatches = (items: readonly FormulaAutocompleteSuggestion[]) => ([...items].sort((left, right) => {
    const leftLengthDelta = Math.abs(left.name.length - normalizedQuery.length)
    const rightLengthDelta = Math.abs(right.name.length - normalizedQuery.length)
    if (leftLengthDelta !== rightLengthDelta) {
      return leftLengthDelta - rightLengthDelta
    }
    return left.name.localeCompare(right.name)
  }))
  const startsWithMatches = rankMatches(formulaFunctionSuggestions.value.filter(item => item.name.startsWith(normalizedQuery)))
  const includesMatches = normalizedQuery.length === 0
    ? []
    : rankMatches(formulaFunctionSuggestions.value.filter(item => !item.name.startsWith(normalizedQuery) && item.name.includes(normalizedQuery)))
  return [...startsWithMatches, ...includesMatches].slice(0, 8)
})

const isFormulaAutocompleteVisible = computed(() => (
  isFormulaBarFocused.value
  && !activeSheetReadOnly.value
  && formulaAutocompleteSuggestions.value.length > 0
))

let suppressNextSelectionSyncForCellKey: string | null = null
let formulaBlurTimer: number | null = null
let pendingSelectionRestoreTimer: number | null = null
let unsubscribeRuntimeRows = () => {}
let unsubscribeActiveSheet = () => {}
let unsubscribeWorkbook = () => {}
const preserveFormulaFocusFromGridPointer = ref(false)
let allowFormulaBlur = false
const activeSheetRenderRevision = ref(0)

interface SpreadsheetRuntimeHandle {
  api: DataGridApi<SpreadsheetGridRow>
  rowModel: DataGridRowModel<SpreadsheetGridRow>
  columnSnapshot: Ref<DataGridColumnModelSnapshot>
  virtualWindow: UseDataGridRuntimeResult<SpreadsheetGridRow>["virtualWindow"]
  syncBodyRowsInRange: UseDataGridRuntimeResult<SpreadsheetGridRow>["syncBodyRowsInRange"]
  setViewportRange: UseDataGridRuntimeResult<SpreadsheetGridRow>["setViewportRange"]
  rowPartition: UseDataGridRuntimeResult<SpreadsheetGridRow>["rowPartition"]
  setVirtualWindowRange?: (range: { start: number; end: number }) => void
  getBodyRowAtIndex: (rowIndex: number) => DataGridRowNode<SpreadsheetGridRow> | null
  resolveBodyRowIndexById: (rowId: string | number) => number
  setRows: UseDataGridRuntimeResult<SpreadsheetGridRow>["setRows"]
}

let runtimeRef: Pick<SpreadsheetRuntimeHandle, "api" | "columnSnapshot"> | null = null

const unsubscribeEditor = editorModel.subscribe(snapshot => {
  editorSnapshot.value = snapshot
})

watch(formulaAutocompleteMatch, () => {
  formulaAutocompleteActiveIndex.value = 0
})

watch(formulaAutocompleteSuggestions, suggestions => {
  if (suggestions.length === 0) {
    formulaAutocompleteActiveIndex.value = 0
    return
  }
  formulaAutocompleteActiveIndex.value = Math.max(0, Math.min(formulaAutocompleteActiveIndex.value, suggestions.length - 1))
})

watch(isFormulaAutocompleteVisible, async visible => {
  const controller = formulaAutocompleteMenuRef.value?.controller
  if (!controller) {
    return
  }
  if (visible) {
    controller.open("programmatic")
    await nextTick()
    syncFormulaAutocompleteMenuAnchor()
    return
  }
  controller.close("programmatic")
})

function syncWorkbookState(): void {
  workbookSnapshot.value = workbook.getSnapshot()
  workbookRevision.value += 1
}

function bindWorkbookSubscription(): void {
  unsubscribeWorkbook()
  unsubscribeWorkbook = workbook.subscribe(snapshot => {
    workbookSnapshot.value = snapshot
    workbookRevision.value += 1
  })
}

function readSpreadsheetClock(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now()
}

function recordSpreadsheetOperation(label: string, startedAt: number): void {
  lastSpreadsheetOperation.value = {
    label,
    durationMs: Math.max(0, readSpreadsheetClock() - startedAt),
    at: Date.now(),
  }
}

function measureSpreadsheetOperation<TResult>(label: string, run: () => TResult): TResult {
  const startedAt = readSpreadsheetClock()
  const result = run()
  recordSpreadsheetOperation(label, startedAt)
  return result
}

async function measureSpreadsheetOperationAsync<TResult>(
  label: string,
  run: () => Promise<TResult> | TResult,
): Promise<TResult> {
  const startedAt = readSpreadsheetClock()
  try {
    return await run()
  } finally {
    recordSpreadsheetOperation(label, startedAt)
  }
}

function applySpreadsheetCellInput(
  handle: DataGridSpreadsheetWorkbookSheetHandle | null,
  cell: DataGridSpreadsheetCellAddress,
  input: string,
  label: string,
): boolean {
  if (!handle) {
    return false
  }
  let applied = false
  measureSpreadsheetOperation(label, () => {
    applied = handle.sheetModel.setCellInput(cell, input)
  })
  return applied
}

function ensureFormulaEditHistorySession(cell: DataGridSpreadsheetCellAddress): void {
  const cellKey = makeScopedCellKey(cell)
  const currentSession = pendingFormulaEditHistory.value
  if (currentSession?.cellKey === cellKey) {
    return
  }
  if (currentSession?.changed) {
    void recordWorkbookHistoryTransaction({
      intent: "edit",
      label: "Cell edit",
    }, currentSession.beforeSnapshot)
  }
  pendingFormulaEditHistory.value = {
    cellKey,
    beforeSnapshot: workbookHistory.captureSnapshot(),
    changed: false,
  }
}

function markFormulaEditHistoryChanged(): void {
  if (!pendingFormulaEditHistory.value) {
    return
  }
  pendingFormulaEditHistory.value = {
    ...pendingFormulaEditHistory.value,
    changed: true,
  }
}

async function commitPendingFormulaEditHistory(): Promise<string | null> {
  const currentSession = pendingFormulaEditHistory.value
  pendingFormulaEditHistory.value = null
  if (!currentSession?.changed) {
    return null
  }
  return recordWorkbookHistoryTransaction({
    intent: "edit",
    label: "Cell edit",
  }, currentSession.beforeSnapshot)
}

function syncSpreadsheetAfterHistoryRestore(options: { focusGrid?: boolean } = {}): void {
  syncWorkbookState()
  activeSheetRenderRevision.value += 1
  runtimeRowVersion.value += 1
  void nextTick(() => {
    const activeCell = editorSnapshot.value.activeCell
    if (activeCell && resolveCellSnapshot(activeCell)) {
      syncEditorCellDisplay({ forceRawInput: true })
      restoreEditorCellSelection({ focusGrid: options.focusGrid })
      return
    }
    const fallbackCell = resolveFirstVisibleCellAddress(firstColumnKey.value)
    if (!fallbackCell) {
      return
    }
    openEditorCell(fallbackCell)
    restoreEditorCellSelection({ focusGrid: options.focusGrid })
  })
}

async function runWorkbookIntent(
  descriptor: SpreadsheetWorkbookIntentDescriptor,
  run: () => boolean,
): Promise<boolean> {
  await flushPendingWorkbookHistoryTransactions()
  await commitPendingFormulaEditHistory()
  const beforeSnapshot = workbookHistory.captureSnapshot()
  let applied = false
  measureSpreadsheetOperation(descriptor.label, () => {
    applied = run()
  })
  if (applied) {
    await recordWorkbookHistoryTransaction(descriptor, beforeSnapshot)
  }
  return applied
}

async function handleWorkbookHistoryAction(direction: "undo" | "redo"): Promise<void> {
  await flushPendingWorkbookHistoryTransactions()
  await commitPendingFormulaEditHistory()
  const committedId = await measureSpreadsheetOperationAsync(
    direction === "undo" ? "Undo workbook edit" : "Redo workbook edit",
    () => workbookHistory.runHistoryAction(direction),
  )
  if (!committedId) {
    return
  }
  syncSpreadsheetAfterHistoryRestore()
}

onBeforeUnmount(() => {
  pendingFormulaEditHistory.value = null
  if (formulaBlurTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(formulaBlurTimer)
  }
  clearHoveredFormulaReferencePreviewTimer()
  activeHoveredFormulaReferencePreview = null
  if (typeof window !== "undefined") {
    window.removeEventListener("mouseup", stopFormulaReferenceDrag)
  }
  clearPendingSelectionRestoreTimer()
  unsubscribeRuntimeRows()
  unsubscribeActiveSheet()
  unsubscribeEditor()
  unsubscribeWorkbook()
  editorModel.dispose()
  workbookHistory.dispose()
})

const activeSheetHandle = computed<DataGridSpreadsheetWorkbookSheetHandle | null>(() => {
  const activeSheetId = workbookSnapshot.value.activeSheetId
  if (activeSheetId) {
    return workbook.getSheet(activeSheetId)
  }
  return workbook.getSheets()[0] ?? null
})

const activeSheetStats = computed(() => {
  const activeSheetId = workbookSnapshot.value.activeSheetId
  return workbookSnapshot.value.sheets.find(sheet => sheet.id === activeSheetId) ?? null
})

const activeSheetReadOnly = computed(() => activeSheetHandle.value?.readOnly === true)
const activeSheetViewSourceLabel = computed(() => {
  void workbookRevision.value
  const sourceSheetId = activeSheetHandle.value?.viewDefinition?.sourceSheetId ?? null
  if (!sourceSheetId) {
    return "source sheet"
  }
  return workbook.getSheet(sourceSheetId)?.name ?? sourceSheetId
})
const formulaInputPlaceholder = computed(() => (
  activeSheetReadOnly.value
    ? `Derived view from ${activeSheetViewSourceLabel.value}. Edit the source sheet to recompute.`
    : props.formulaPlaceholder
))

watch(
  () => `${workbookRevision.value}:${activeSheetHandle.value?.id ?? ""}`,
  () => {
    unsubscribeActiveSheet()
    const handle = activeSheetHandle.value
    if (!handle) {
      return
    }
    activeSheetRenderRevision.value += 1
    unsubscribeActiveSheet = handle.sheetModel.subscribe(() => {
      activeSheetRenderRevision.value += 1
    })
  },
  { immediate: true },
)

const activeSheetView = computed(() => {
  const activeSheetRevision = activeSheetStats.value?.revision ?? 0
  const activeSheetRenderTick = activeSheetRenderRevision.value
  const handle = activeSheetHandle.value
  void activeSheetRevision
  void activeSheetRenderTick
  if (!handle) {
    return {
      rows: [] as SpreadsheetGridRow[],
      rowSnapshots: [] as ReturnType<DataGridSpreadsheetWorkbookSheetHandle["sheetModel"]["getRows"]>,
      columns: [] as ReturnType<DataGridSpreadsheetWorkbookSheetHandle["sheetModel"]["getColumns"]>,
      cellsByKey: new Map<string, DataGridSpreadsheetCellSnapshot>(),
    }
  }

  const rowSnapshots = handle.sheetModel.getRows()
  const columns = handle.sheetModel.getColumns()
  const rows: SpreadsheetGridRow[] = []
  const cellsByKey = new Map<string, DataGridSpreadsheetCellSnapshot>()

  for (const row of rowSnapshots) {
    const materializedRow: SpreadsheetGridRow = {
      id: row.id,
      __rowIndex: row.rowIndex,
    }
    for (const column of columns) {
      const cell = handle.sheetModel.getCell({
        sheetId: handle.id,
        rowId: row.id,
        rowIndex: row.rowIndex,
        columnKey: column.key,
      })
      if (cell) {
        cellsByKey.set(makeLocalCellKey(row.rowIndex, column.key), cell)
      }
      materializedRow[column.key] = resolveGridCellValue(cell)
    }
    rows.push(materializedRow)
  }

  return {
    rows,
    rowSnapshots,
    columns,
    cellsByKey,
  }
})

const gridRows = computed<readonly SpreadsheetGridRow[]>(() => activeSheetView.value.rows)
const gridColumns = computed<readonly DataGridColumnInput[]>(() => {
  return activeSheetView.value.columns.map(column => {
    const align = resolveColumnAlignment(column.key)
    return {
      key: column.key,
      label: column.title,
      dataType: resolveColumnDataType(column.key),
      initialState: {
        width: resolveColumnWidth(column.key, column.title),
      },
      presentation: {
        align,
        headerAlign: align,
      },
      capabilities: {
        editable: !activeSheetReadOnly.value,
        sortable: true,
        filterable: true,
      },
    }
  })
})

const gridMode = computed(() => "base" as const)
const layoutMode = computed(() => "fill" as const)
const rowRenderMode = computed(() => "virtualization" as const)
const rowHeightMode = computed(() => "fixed" as const)
const baseRowHeight = computed(() => 34)
const virtualization = computed(() => ({
  rows: true,
  columns: true,
  rowOverscan: 8,
  columnOverscan: 2,
}))

const visibleColumns = computed<readonly DataGridColumnSnapshot[]>(() => runtimeRef?.columnSnapshot.value.visibleColumns ?? [])
const totalRows = computed(() => runtimeRef?.api.rows.getCount() ?? 0)
const sortState = ref<SortToggleState[]>([])
const filterModelState = ref<DataGridFilterSnapshot>(createEmptyFilterModel())
const columnFilterTextByKey = computed<Record<string, string>>(() => (
  resolveInitialFilterTexts(filterModelState.value)
))
const columnLabelByKey = computed(() => {
  const map = new Map<string, string>()
  for (const column of activeSheetView.value.columns) {
    map.set(column.key, column.title)
  }
  return map
})
const advancedFilterColumns = computed(() => {
  return visibleColumns.value
    .filter(column => column.visible !== false)
    .map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
    }))
})
const {
  isAdvancedFilterPanelOpen,
  advancedFilterDraftClauses,
  appliedAdvancedFilterExpression,
  openAdvancedFilterPanel,
  addAdvancedFilterClause,
  removeAdvancedFilterClause,
  updateAdvancedFilterClause,
  cancelAdvancedFilterPanel,
  applyAdvancedFilterPanel,
  clearAdvancedFilterPanel,
} = useDataGridAppAdvancedFilterBuilder({
  resolveColumns: () => advancedFilterColumns.value,
})

const {
  selectionSnapshot,
  selectionAnchor,
  runtimeServices,
  syncSelectionSnapshotFromRuntime,
} = useDataGridAppSelection<SpreadsheetGridRow>({
  mode: gridMode,
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
  visibleColumns,
  totalRows,
})

const {
  rowSelectionSnapshot,
  syncRowSelectionSnapshotFromRuntime,
  runtimeServices: rowSelectionRuntimeServices,
} = useDataGridAppRowSelection<SpreadsheetGridRow>({
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
})

const runtimeBundle = useDataGridRuntime<SpreadsheetGridRow>({
  rows: gridRows,
  columns: gridColumns,
  services: {
    selection: {
      ...(runtimeServices.selection ?? {}),
      ...(rowSelectionRuntimeServices.selection ?? {}),
      name: "selection",
    },
  },
  clientRowModelOptions: {
    resolveRowId: (row: SpreadsheetGridRow) => row.id,
  },
}) as unknown as SpreadsheetRuntimeHandle

runtimeRef = runtimeBundle
const runtimeRowVersion = ref(0)
unsubscribeRuntimeRows = runtimeBundle.rowModel.subscribe(() => {
  runtimeRowVersion.value += 1
})

watch(
  gridRows,
  rows => {
    runtimeBundle.setRows(rows)
  },
  { immediate: true },
)

const resolveColumnLabel = (columnKey: string): string => {
  return columnLabelByKey.value.get(columnKey) ?? columnKey
}

const activeFilterSummaryItems = computed<readonly string[]>(() => {
  const items: string[] = []

  for (const [columnKey, entry] of Object.entries(filterModelState.value.columnFilters ?? {})) {
    if (!entry) {
      continue
    }
    items.push(formatColumnFilterSummary(resolveColumnLabel(columnKey), entry))
  }

  if (appliedAdvancedFilterExpression.value) {
    items.push(`Advanced: ${formatAdvancedExpressionSummary(appliedAdvancedFilterExpression.value, resolveColumnLabel)}`)
  }

  return Object.freeze(items)
})

const hasActiveFilters = computed(() => activeFilterSummaryItems.value.length > 0)
const sortSummaryItems = computed<readonly string[]>(() => {
  return Object.freeze(sortState.value.map((entry, index) => (
    `${index + 1}. ${resolveColumnLabel(entry.key)} ${entry.direction === "asc" ? "ASC" : "DESC"}`
  )))
})

function applySortAndFilter(label = "Recompute filtered view"): void {
  const nextSortModel: readonly DataGridSortState[] = sortState.value.map(entry => ({
    key: entry.key,
    direction: entry.direction,
  }))

  measureSpreadsheetOperation(label, () => {
    runtimeBundle.api.rows.setSortAndFilterModel({
      sortModel: nextSortModel,
      filterModel: cloneDataGridFilterSnapshot({
        ...filterModelState.value,
        advancedExpression: appliedAdvancedFilterExpression.value ?? null,
      }),
    })
  })
}

function isColumnFilterActive(columnKey: string): boolean {
  const entry = filterModelState.value.columnFilters?.[columnKey]
  if (!entry) {
    return false
  }
  return entry.kind === "valueSet"
    ? entry.tokens.length > 0
    : true
}

function resolveCurrentValueFilterTokens(columnKey: string): readonly string[] {
  const entry = filterModelState.value.columnFilters?.[columnKey]
  if (!entry || entry.kind !== "valueSet") {
    return []
  }
  return entry.tokens.map(token => normalizeColumnMenuToken(String(token ?? "")))
}

function toggleSortForColumn(columnKey: string, additive = false): void {
  const currentIndex = sortState.value.findIndex(entry => entry.key === columnKey)
  const current = currentIndex >= 0 ? sortState.value[currentIndex] : null

  if (!current) {
    const nextEntry: SortToggleState = { key: columnKey, direction: "asc" }
    sortState.value = additive ? [...sortState.value, nextEntry] : [nextEntry]
    applySortAndFilter("Sort column")
    return
  }

  if (current.direction === "asc") {
    const nextEntry: SortToggleState = { key: columnKey, direction: "desc" }
    sortState.value = additive
      ? sortState.value.map(entry => (entry.key === columnKey ? nextEntry : entry))
      : [nextEntry]
    applySortAndFilter("Sort column")
    return
  }

  sortState.value = additive
    ? sortState.value.filter(entry => entry.key !== columnKey)
    : []
  applySortAndFilter("Sort column")
}

function sortIndicator(columnKey: string): string {
  const currentIndex = sortState.value.findIndex(entry => entry.key === columnKey)
  if (currentIndex < 0) {
    return ""
  }
  const current = sortState.value[currentIndex]
  if (!current) {
    return ""
  }
  const direction = current.direction === "asc" ? "↑" : "↓"
  return sortState.value.length > 1 ? `${direction}${currentIndex + 1}` : direction
}

function setColumnFilterText(columnKey: string, value: string): void {
  const nextFilterModel = cloneFilterModelState(filterModelState.value)
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    delete nextFilterModel.columnFilters[columnKey]
  } else {
    nextFilterModel.columnFilters[columnKey] = {
      kind: "predicate",
      operator: "contains",
      value: normalizedValue,
      caseSensitive: false,
    }
  }
  filterModelState.value = nextFilterModel
  applySortAndFilter("Type header filter")
}

function resolveColumnMenuSortDirection(columnKey: string): "asc" | "desc" | null {
  return sortState.value.find(entry => entry.key === columnKey)?.direction ?? null
}

function applyColumnMenuSort(columnKey: string, direction: "asc" | "desc" | null): void {
  sortState.value = direction === null ? [] : [{ key: columnKey, direction }]
  applySortAndFilter("Column menu sort")
}

function applyColumnMenuFilter(columnKey: string, tokens: readonly string[]): void {
  const normalizedTokens = Array.from(new Set(
    tokens
      .map(token => normalizeColumnMenuToken(String(token ?? "")))
      .filter(token => token.length > 0),
  ))
  const nextFilterModel = cloneFilterModelState(filterModelState.value)
  if (normalizedTokens.length === 0) {
    delete nextFilterModel.columnFilters[columnKey]
  } else {
    nextFilterModel.columnFilters[columnKey] = {
      kind: "valueSet",
      tokens: normalizedTokens,
    }
  }
  filterModelState.value = nextFilterModel
  applySortAndFilter("Column menu filter")
}

function clearColumnMenuFilter(columnKey: string): void {
  const nextFilterModel = cloneFilterModelState(filterModelState.value)
  delete nextFilterModel.columnFilters[columnKey]
  filterModelState.value = nextFilterModel
  applySortAndFilter("Clear column filter")
}

function resetAllFilters(): void {
  filterModelState.value = createEmptyFilterModel()
  clearAdvancedFilterPanel()
  applySortAndFilter("Reset filters")
}

watch(
  appliedAdvancedFilterExpression,
  () => {
    applySortAndFilter("Apply advanced filter")
  },
  { deep: true },
)

watch(
  () => workbookSnapshot.value.activeSheetId,
  () => {
    sortState.value = []
    filterModelState.value = createEmptyFilterModel()
    clearAdvancedFilterPanel()
    applySortAndFilter("Reset sheet view")
  },
)

function rebindWorkbookModel(nextWorkbook: DataGridSpreadsheetWorkbookModel): void {
  pendingFormulaEditHistory.value = null
  unsubscribeActiveSheet()
  unsubscribeWorkbook()
  workbook = nextWorkbook
  workbookHistory.rebindWorkbook(nextWorkbook)
  copiedStyle.value = null
  sortState.value = []
  filterModelState.value = createEmptyFilterModel()
  clearAdvancedFilterPanel()
  bindWorkbookSubscription()
  workbook.sync()
  syncWorkbookState()
  runtimeRowVersion.value += 1
  editorModel.clear()
  applySortAndFilter("Reset workbook view")
  void nextTick(() => {
    const nextSheetId = workbook.getSnapshot().activeSheetId ?? workbook.getSheets()[0]?.id ?? null
    if (nextSheetId) {
      openSheet(nextSheetId)
    }
    syncEditorCellDisplay()
  })
}

watch(
  () => props.workbookModel,
  nextWorkbook => {
    if (nextWorkbook === workbook) {
      return
    }
    rebindWorkbookModel(nextWorkbook)
  },
)

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("mouseup", stopFormulaReferenceDrag)
  }
  bindWorkbookSubscription()
  void nextTick(() => {
    workbook.sync()
    syncWorkbookState()
    runtimeRowVersion.value += 1
    const nextSheetId = workbook.getSnapshot().activeSheetId ?? workbook.getSheets()[0]?.id ?? null
    if (nextSheetId) {
      openSheet(nextSheetId)
    }
    syncEditorCellDisplay()
  })
})

const firstColumnKey = computed(() => {
  return visibleColumns.value[0]?.key ?? activeSheetView.value.columns[0]?.key ?? "metric"
})

const {
  tableStageProps,
  syncViewportFromDom,
} = useDataGridTableStageRuntime<SpreadsheetGridRow>({
  mode: gridMode,
  layoutMode,
  minRows: computed(() => null),
  maxRows: computed(() => null),
  enableFillHandle: computed(() => true),
  enableRangeMove: computed(() => true),
  rows: gridRows as never,
  sourceRows: gridRows as never,
  runtime: runtimeBundle,
  rowVersion: runtimeRowVersion,
  totalRuntimeRows: totalRows,
  visibleColumns,
  rowRenderMode,
  rowHeightMode,
  normalizedBaseRowHeight: baseRowHeight,
  selectionSnapshot,
  selectionAnchor,
  syncSelectionSnapshotFromRuntime,
  rowSelectionSnapshot,
  syncRowSelectionSnapshotFromRuntime,
  firstColumnKey,
  columnFilterTextByKey,
  virtualization,
  toggleSortForColumn,
  sortIndicator,
  setColumnFilterText,
  columnMenuEnabled: computed(() => true),
  columnMenuMaxFilterValues: computed(() => 200),
  isColumnFilterActive,
  resolveColumnMenuSortDirection,
  resolveColumnMenuSelectedTokens: resolveCurrentValueFilterTokens,
  applyColumnMenuSort,
  applyColumnMenuPin: (columnKey, pin) => {
    runtimeBundle.api.columns.setPin(columnKey, pin)
  },
  applyColumnMenuFilter,
  clearColumnMenuFilter,
  applyRowHeightSettings: () => {},
  cloneRowData,
  readClipboardCell: (row, columnKey) => readSpreadsheetClipboardCell(row, columnKey),
  applyClipboardEdits: applySpreadsheetGridEdits,
  buildFillMatrixFromRange: buildSpreadsheetFillMatrixFromRange,
  applyRangeMove: applySpreadsheetRangeMove,
  history: {
    captureSnapshot: () => workbookHistory.captureSnapshot(),
    recordIntentTransaction: (descriptor, beforeSnapshot) => {
      void recordWorkbookHistoryTransaction(
        descriptor,
        beforeSnapshot as DataGridSpreadsheetWorkbookState,
      )
    },
    canUndo: () => (
      hasPendingFormulaEditHistory.value
      || pendingWorkbookHistoryCommitCount.value > 0
      || workbookHistory.canUndo.value
    ),
    canRedo: () => workbookHistory.canRedo.value,
    runHistoryAction: async direction => {
      await flushPendingWorkbookHistoryTransactions()
      await commitPendingFormulaEditHistory()
      const committedId = await measureSpreadsheetOperationAsync(
        direction === "undo" ? "Undo workbook edit" : "Redo workbook edit",
        () => workbookHistory.runHistoryAction(direction),
      )
      if (committedId) {
        syncSpreadsheetAfterHistoryRestore()
      }
      return committedId
    },
  },
})

function resolveSelectionContext(): GridSelectionContext<DataGridRowId> {
  return {
    grid: {
      rowCount: totalRows.value,
      colCount: visibleColumns.value.length,
    },
    getRowIdByIndex: rowIndex => runtimeBundle.getBodyRowAtIndex(rowIndex)?.rowId ?? null,
  }
}

function buildSelectionSnapshot(
  range: ReturnType<typeof createGridSelectionRange<DataGridRowId>>,
  activeCell: GridSelectionPointLike<DataGridRowId>,
): DataGridSelectionSnapshot {
  return {
    ranges: [
      {
        startRow: range.startRow,
        endRow: range.endRow,
        startCol: range.startCol,
        endCol: range.endCol,
        startRowId: range.startRowId ?? null,
        endRowId: range.endRowId ?? null,
        anchor: {
          rowIndex: range.anchor.rowIndex,
          colIndex: range.anchor.colIndex,
          rowId: range.anchor.rowId ?? null,
        },
        focus: {
          rowIndex: range.focus.rowIndex,
          colIndex: range.focus.colIndex,
          rowId: range.focus.rowId ?? null,
        },
      },
    ],
    activeRangeIndex: 0,
    activeCell: {
      rowIndex: activeCell.rowIndex,
      colIndex: activeCell.colIndex,
      rowId: activeCell.rowId ?? null,
    },
  }
}

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  visibleColumns.value.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const stageVisibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  tableStagePropsForView.value.columns.visibleColumns.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

function resolveSpreadsheetColumnKeyFromStageIndex(columnIndex: number): string | null {
  const columnKey = tableStagePropsForView.value.columns.visibleColumns[columnIndex]?.key
  return columnKey && visibleColumnIndexByKey.value.has(columnKey)
    ? columnKey
    : null
}

function resolveSpreadsheetRuntimeRow(
  visualRowIndex: number,
): { rowId: DataGridRowId; sourceRowIndex: number } | null {
  const rowNode = runtimeBundle.getBodyRowAtIndex(visualRowIndex)
  if (!rowNode || rowNode.kind === "group") {
    return null
  }
  const rowData = rowNode.data as SpreadsheetGridRow | undefined
  if (!rowData || typeof rowData.__rowIndex !== "number") {
    return null
  }
  return {
    rowId: rowNode.rowId,
    sourceRowIndex: rowData.__rowIndex,
  }
}

function resolveSpreadsheetCellSnapshotByVisualCoord(
  visualRowIndex: number,
  columnKey: string,
): DataGridSpreadsheetCellSnapshot | null {
  const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
  if (!row) {
    return null
  }
  return activeSheetView.value.cellsByKey.get(makeLocalCellKey(row.sourceRowIndex, columnKey)) ?? null
}

function readSpreadsheetClipboardCell(
  row: DataGridRowNode<SpreadsheetGridRow>,
  columnKey: string,
): string {
  const rowData = row.kind === "group" ? null : (row.data as SpreadsheetGridRow | undefined)
  const rowIndex = typeof rowData?.__rowIndex === "number" ? rowData.__rowIndex : null
  if (rowIndex == null) {
    return ""
  }
  const cell = activeSheetView.value.cellsByKey.get(makeLocalCellKey(rowIndex, columnKey)) ?? null
  if (!cell) {
    return ""
  }
  if (props.clipboardCopyMode === "formula") {
    return cell.rawInput ?? ""
  }
  if (props.clipboardCopyMode === "display") {
    return resolveCellDisplayText(cell)
  }
  return cell.inputKind === "formula"
    ? (cell.rawInput ?? "")
    : String(resolveGridCellValue(cell) ?? "")
}

function buildSpreadsheetFillMatrixFromRange(range: DataGridCopyRange): string[][] {
  const matrix: string[][] = []
  for (let visualRowIndex = range.startRow; visualRowIndex <= range.endRow; visualRowIndex += 1) {
    const rowValues: string[] = []
    for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
      const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
      const cell = columnKey ? resolveSpreadsheetCellSnapshotByVisualCoord(visualRowIndex, columnKey) : null
      rowValues.push(cell?.rawInput ?? "")
    }
    matrix.push(rowValues)
  }
  return matrix
}

function applySpreadsheetGridEdits(
  range: DataGridCopyRange,
  matrix: string[][],
  options: { recordHistory?: boolean } = {},
): number {
  if (activeSheetReadOnly.value) {
    return 0
  }
  const handle = activeSheetHandle.value
  if (!handle) {
    return 0
  }
  const beforeSnapshot = options.recordHistory === false ? null : workbookHistory.captureSnapshot()
  const matrixHeight = Math.max(1, matrix.length)
  const matrixWidth = Math.max(1, matrix[0]?.length ?? 1)
  const patches: Array<{ cell: DataGridSpreadsheetCellAddress; rawInput: string }> = []
  const affectedRowIds = new Set<DataGridRowId>()

  for (let visualRowIndex = range.startRow; visualRowIndex <= range.endRow; visualRowIndex += 1) {
    const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
    if (!row) {
      continue
    }
    for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
      const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
      if (!columnKey) {
        continue
      }
      const rowOffset = visualRowIndex - range.startRow
      const columnOffset = columnIndex - range.startColumn
      const rawInput = matrix[rowOffset % matrixHeight]?.[columnOffset % matrixWidth] ?? ""
      patches.push({
        cell: {
          sheetId: handle.id,
          rowId: row.rowId,
          rowIndex: row.sourceRowIndex,
          columnKey,
        },
        rawInput,
      })
      affectedRowIds.add(row.rowId)
    }
  }

  if (patches.length === 0) {
    return 0
  }

  let applied = false
  measureSpreadsheetOperation("Grid fill / paste", () => {
    applied = handle.sheetModel.setCellInputs(patches)
  })
  if (applied) {
    if (beforeSnapshot) {
      void recordWorkbookHistoryTransaction({
        intent: "edit",
        label: "Cell edit",
        affectedRange: range,
      }, beforeSnapshot)
    }
    const anchor = {
      rowIndex: range.startRow,
      colIndex: range.startColumn,
      rowId: runtimeBundle.getBodyRowAtIndex(range.startRow)?.rowId ?? null,
    }
    const focus = {
      rowIndex: range.endRow,
      colIndex: range.endColumn,
      rowId: runtimeBundle.getBodyRowAtIndex(range.endRow)?.rowId ?? null,
    }
    const nextRange = createGridSelectionRange(anchor, focus, resolveSelectionContext())
    const nextSnapshot = buildSelectionSnapshot(nextRange, {
      rowIndex: nextRange.focus.rowIndex,
      colIndex: nextRange.focus.colIndex,
      rowId: nextRange.focus.rowId ?? null,
    })
    selectionAnchor.value = {
      rowIndex: nextRange.anchor.rowIndex,
      colIndex: nextRange.anchor.colIndex,
      rowId: nextRange.anchor.rowId ?? null,
    }
    selectionSnapshot.value = nextSnapshot
    runtimeBundle.api.selection.setSnapshot(nextSnapshot)
  }
  return applied ? affectedRowIds.size : 0
}

function applySpreadsheetRangeMove(baseRange: DataGridCopyRange, targetRange: DataGridCopyRange): boolean {
  if (activeSheetReadOnly.value) {
    return false
  }
  const handle = activeSheetHandle.value
  if (!handle) {
    return false
  }
  const beforeSnapshot = workbookHistory.captureSnapshot()
  const sourceMatrix = buildSpreadsheetFillMatrixFromRange(baseRange)
  const patches: Array<{ cell: DataGridSpreadsheetCellAddress; rawInput: string }> = []
  let changedCells = 0

  for (let visualRowIndex = baseRange.startRow; visualRowIndex <= baseRange.endRow; visualRowIndex += 1) {
    const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
    if (!row) {
      continue
    }
    for (let columnIndex = baseRange.startColumn; columnIndex <= baseRange.endColumn; columnIndex += 1) {
      const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
      if (!columnKey) {
        continue
      }
      patches.push({
        cell: {
          sheetId: handle.id,
          rowId: row.rowId,
          rowIndex: row.sourceRowIndex,
          columnKey,
        },
        rawInput: "",
      })
    }
  }

  for (let visualRowIndex = targetRange.startRow; visualRowIndex <= targetRange.endRow; visualRowIndex += 1) {
    const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
    if (!row) {
      continue
    }
    for (let columnIndex = targetRange.startColumn; columnIndex <= targetRange.endColumn; columnIndex += 1) {
      const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
      if (!columnKey) {
        continue
      }
      const rowOffset = visualRowIndex - targetRange.startRow
      const columnOffset = columnIndex - targetRange.startColumn
      patches.push({
        cell: {
          sheetId: handle.id,
          rowId: row.rowId,
          rowIndex: row.sourceRowIndex,
          columnKey,
        },
        rawInput: sourceMatrix[rowOffset]?.[columnOffset] ?? "",
      })
      changedCells += 1
    }
  }

  if (patches.length === 0 || changedCells === 0) {
    return false
  }

  let applied = false
  measureSpreadsheetOperation("Move cells", () => {
    applied = handle.sheetModel.setCellInputs(patches)
  })
  if (!applied) {
    return false
  }

  const anchor = {
    rowIndex: targetRange.startRow,
    colIndex: targetRange.startColumn,
    rowId: runtimeBundle.getBodyRowAtIndex(targetRange.startRow)?.rowId ?? null,
  }
  const focus = {
    rowIndex: targetRange.endRow,
    colIndex: targetRange.endColumn,
    rowId: runtimeBundle.getBodyRowAtIndex(targetRange.endRow)?.rowId ?? null,
  }
  const nextRange = createGridSelectionRange(anchor, focus, resolveSelectionContext())
  const nextSnapshot = buildSelectionSnapshot(nextRange, {
    rowIndex: nextRange.anchor.rowIndex,
    colIndex: nextRange.anchor.colIndex,
    rowId: nextRange.anchor.rowId ?? null,
  })
  selectionAnchor.value = {
    rowIndex: nextRange.anchor.rowIndex,
    colIndex: nextRange.anchor.colIndex,
    rowId: nextRange.anchor.rowId ?? null,
  }
  selectionSnapshot.value = nextSnapshot
  runtimeBundle.api.selection.setSnapshot(nextSnapshot)
  void recordWorkbookHistoryTransaction({
    intent: "move",
    label: `Move ${changedCells} cells`,
    affectedRange: targetRange,
  }, beforeSnapshot)
  return true
}

function resolveVisualRowIndexForCell(cell: DataGridSpreadsheetCellAddress | null): number | null {
  if (!cell) {
    return null
  }
  const rowCount = runtimeBundle.api.rows.getCount()
  for (let visualRowIndex = 0; visualRowIndex < rowCount; visualRowIndex += 1) {
    const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
    if (row?.rowId === (cell.rowId ?? null)) {
      return visualRowIndex
    }
  }
  return null
}

function resolveFirstVisibleCellAddress(columnKey: string): DataGridSpreadsheetCellAddress | null {
  const currentSheet = activeSheetHandle.value
  const firstRow = resolveSpreadsheetRuntimeRow(0)
  if (!currentSheet || !firstRow) {
    return null
  }
  return {
    sheetId: currentSheet.id,
    rowId: firstRow.rowId,
    rowIndex: firstRow.sourceRowIndex,
    columnKey,
  }
}

function applySingleCellSelection(cell: DataGridSpreadsheetCellAddress): void {
  applyCellRangeSelection(cell, cell)
}

function applyCellRangeSelection(
  anchorCell: DataGridSpreadsheetCellAddress,
  focusCell: DataGridSpreadsheetCellAddress,
): void {
  const anchorColumnIndex = stageVisibleColumnIndexByKey.value.get(anchorCell.columnKey)
  const anchorVisualRowIndex = resolveVisualRowIndexForCell(anchorCell)
  const focusColumnIndex = stageVisibleColumnIndexByKey.value.get(focusCell.columnKey)
  const focusVisualRowIndex = resolveVisualRowIndexForCell(focusCell)
  if (
    anchorColumnIndex == null
    || anchorVisualRowIndex == null
    || focusColumnIndex == null
    || focusVisualRowIndex == null
  ) {
    return
  }
  const anchor = {
    rowIndex: anchorVisualRowIndex,
    colIndex: anchorColumnIndex,
    rowId: anchorCell.rowId ?? null,
  }
  const focus = {
    rowIndex: focusVisualRowIndex,
    colIndex: focusColumnIndex,
    rowId: focusCell.rowId ?? null,
  }
  const range = createGridSelectionRange(anchor, focus, resolveSelectionContext())
  const nextSnapshot = buildSelectionSnapshot(range, {
    rowIndex: range.focus.rowIndex,
    colIndex: range.focus.colIndex,
    rowId: range.focus.rowId ?? null,
  })
  selectionAnchor.value = {
    rowIndex: range.anchor.rowIndex,
    colIndex: range.anchor.colIndex,
    rowId: range.anchor.rowId ?? null,
  }
  selectionSnapshot.value = nextSnapshot
  runtimeBundle.api.selection.setSnapshot(nextSnapshot)
  syncViewportFromDom()
}

function resolveSheetHandle(sheetId: string | null | undefined): DataGridSpreadsheetWorkbookSheetHandle | null {
  if (!sheetId) {
    return activeSheetHandle.value
  }
  return workbook.getSheet(sheetId)
}

function isValidCellAddressForSheet(
  handle: DataGridSpreadsheetWorkbookSheetHandle,
  cell: DataGridSpreadsheetCellAddress,
): boolean {
  const hasColumn = handle.sheetModel.getColumns().some(column => column.key === cell.columnKey)
  if (!hasColumn) {
    return false
  }

  const hasRow = handle.sheetModel.getRows().some(row => (
    (cell.rowId != null && row.id === cell.rowId)
    || row.rowIndex === cell.rowIndex
  ))
  return hasRow
}

function resolveCellSnapshot(
  cell: DataGridSpreadsheetCellAddress | null,
): DataGridSpreadsheetCellSnapshot | null {
  if (!cell) {
    return null
  }
  const handle = resolveSheetHandle(cell.sheetId)
  if (!handle) {
    return null
  }
  if (!isValidCellAddressForSheet(handle, cell)) {
    return null
  }
  return handle.sheetModel.getCell({
    sheetId: handle.id,
    rowId: cell.rowId ?? null,
    rowIndex: cell.rowIndex,
    columnKey: cell.columnKey,
  })
}

function focusFormulaBar(selection?: { start: number; end: number }): void {
  clearFormulaBlurTimer()
  allowFormulaBlur = false
  isFormulaBarFocused.value = true
  void nextTick(() => {
    const input = formulaInputRef.value
    if (!input) {
      return
    }
    input.focus()
    if (selection) {
      input.setSelectionRange(selection.start, selection.end)
      editorModel.setSelection(selection)
    } else {
      const caret = input.value.length
      input.setSelectionRange(caret, caret)
      editorModel.setSelection({ start: caret, end: caret })
    }
  })
}

function clearFormulaBlurTimer(): void {
  if (formulaBlurTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(formulaBlurTimer)
    formulaBlurTimer = null
  }
}

function clearPendingSelectionRestoreTimer(): void {
  if (pendingSelectionRestoreTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(pendingSelectionRestoreTimer)
    pendingSelectionRestoreTimer = null
  }
}

function syncEditorCellDisplay(options: { forceRawInput?: boolean } = {}): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  const cell = resolveCellSnapshot(activeCell)
  if (!cell) {
    return
  }
  if ((options.forceRawInput || !isFormulaBarFocused.value) && cell.rawInput !== editorSnapshot.value.rawInput) {
    editorModel.setInput(cell.rawInput)
  }
  editorModel.setDisplayValue(cell.displayValue)
  editorModel.setErrorValue(cell.errorValue)
}

function openEditorCell(
  cell: DataGridSpreadsheetCellAddress,
  options: {
    focus?: boolean
    draftInput?: string | null
    selectAll?: boolean
  } = {},
): void {
  const nextCell = {
    ...cell,
    sheetId: cell.sheetId ?? activeSheetHandle.value?.id ?? null,
  }
  const nextHandle = resolveSheetHandle(nextCell.sheetId)
  if (!nextHandle || !isValidCellAddressForSheet(nextHandle, nextCell)) {
    return
  }
  const previousActiveCell = editorSnapshot.value.activeCell
  if (
    previousActiveCell
    && makeScopedCellKey(previousActiveCell) !== makeScopedCellKey(nextCell)
  ) {
    void commitPendingFormulaEditHistory()
  }
  const snapshot = resolveCellSnapshot(nextCell)
  const rawInput = options.draftInput != null ? options.draftInput : snapshot?.rawInput ?? ""
  const selection = options.selectAll
    ? { start: 0, end: rawInput.length }
    : { start: rawInput.length, end: rawInput.length }

  editorModel.start(nextCell, rawInput, {
    selection,
    displayValue: snapshot?.displayValue,
    errorValue: snapshot?.errorValue,
  })

  if (options.draftInput != null) {
    const handle = resolveSheetHandle(nextCell.sheetId)
    ensureFormulaEditHistorySession(nextCell)
    if (applySpreadsheetCellInput(handle, nextCell, rawInput, "Start formula edit")) {
      markFormulaEditHistoryChanged()
    }
    syncEditorCellDisplay()
  }

  if (options.focus) {
    focusFormulaBar(selection)
  }
}

function resolveSelectedGridCell(): DataGridSpreadsheetCellAddress | null {
  const currentSheet = activeSheetHandle.value
  const activeCell = selectionSnapshot.value?.activeCell
  if (!currentSheet || !activeCell) {
    return null
  }
  const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(activeCell.colIndex)
  const row = resolveSpreadsheetRuntimeRow(activeCell.rowIndex)
  if (!columnKey || !row) {
    return null
  }
  const nextCell = {
    sheetId: currentSheet.id,
    rowId: row.rowId,
    rowIndex: row.sourceRowIndex,
    columnKey,
  }
  return isValidCellAddressForSheet(currentSheet, nextCell) ? nextCell : null
}

function hasExpandedGridSelection(): boolean {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return false
  }
  const activeIndex = snapshot.activeRangeIndex ?? 0
  const range = snapshot.ranges[activeIndex] ?? snapshot.ranges[0]
  if (!range) {
    return false
  }
  return range.startRow !== range.endRow || range.startCol !== range.endCol
}

function focusGridCell(cell: DataGridSpreadsheetCellAddress): void {
  const element = resolveGridCellElement(cell)
  if (!element) {
    return
  }
  void nextTick(() => {
    element.focus({ preventScroll: true })
  })
}

function resolveGridCellElement(cell: DataGridSpreadsheetCellAddress | null): HTMLElement | null {
  if (!cell) {
    return null
  }
  const columnIndex = stageVisibleColumnIndexByKey.value.get(cell.columnKey)
  const visualRowIndex = resolveVisualRowIndexForCell(cell)
  if (columnIndex == null || visualRowIndex == null) {
    return null
  }
  const selector = `.spreadsheet-grid-host .grid-cell[data-row-index="${visualRowIndex}"][data-column-index="${columnIndex}"]`
  return cardRootRef.value?.querySelector<HTMLElement>(selector) ?? null
}

function resolveSpreadsheetCellAddressFromEventTarget(target: EventTarget | null): DataGridSpreadsheetCellAddress | null {
  const cellElement = target instanceof HTMLElement ? target.closest<HTMLElement>(".grid-cell") : null
  if (!cellElement) {
    return null
  }
  const visualRowIndex = Number.parseInt(cellElement.dataset.rowIndex ?? "", 10)
  const columnIndex = Number.parseInt(cellElement.dataset.columnIndex ?? "", 10)
  const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
  const row = Number.isInteger(visualRowIndex) ? resolveSpreadsheetRuntimeRow(visualRowIndex) : null
  const currentSheet = activeSheetHandle.value
  if (!currentSheet || !row || !columnKey) {
    return null
  }
  return {
    sheetId: currentSheet.id,
    rowId: row.rowId,
    rowIndex: row.sourceRowIndex,
    columnKey,
  }
}

function resolveActiveFormulaReferenceTargetCell(): DataGridSpreadsheetCellAddress | null {
  const reference = interactiveFormulaReference.value
  const currentSheet = activeSheetHandle.value
  if (
    !reference
    || !currentSheet
    || reference.targetRowIndexes.length !== 1
    || (typeof reference.rangeReferenceName === "string" && reference.rangeReferenceName.trim().length > 0)
  ) {
    return null
  }
  const referencedSheet = reference.sheetReference
    ? workbook.getSheets().find(sheet => sheet.aliases.includes(reference.sheetReference ?? "")) ?? null
    : currentSheet
  if (!referencedSheet || referencedSheet.id !== currentSheet.id) {
    return null
  }
  const rowIndex = reference.targetRowIndexes[0]
  if (typeof rowIndex !== "number" || rowIndex < 0) {
    return null
  }
  const row = referencedSheet.sheetModel.getRows()[rowIndex]
  if (!row) {
    return null
  }
  const column = referencedSheet.sheetModel.getColumns().find(entry => entry.key === reference.referenceName)
  if (!column) {
    return null
  }
  return {
    sheetId: referencedSheet.id,
    rowId: row.id,
    rowIndex: row.rowIndex,
    columnKey: column.key,
  }
}

function resolveWorkbookSheetHandleForReference(
  reference: Pick<(typeof editorSnapshot.value.analysis.references)[number], "sheetReference">,
): DataGridSpreadsheetWorkbookSheetHandle | null {
  if (reference.sheetReference) {
    return workbook.getSheets().find(sheet => sheet.aliases.includes(reference.sheetReference ?? "")) ?? null
  }
  return activeSheetHandle.value
}

function scheduleHoveredFormulaReferencePreview(
  reference: (typeof editorSnapshot.value.analysis.references)[number],
): void {
  clearHoveredFormulaReferencePreviewTimer()
  const targetSheet = resolveWorkbookSheetHandleForReference(reference)
  if (!targetSheet || targetSheet.id === workbookSnapshot.value.activeSheetId) {
    activeHoveredFormulaReferencePreview = null
    return
  }
  if (
    activeHoveredFormulaReferencePreview
    && activeHoveredFormulaReferencePreview.referenceKey === reference.key
    && workbookSnapshot.value.activeSheetId === targetSheet.id
  ) {
    return
  }
  pendingHoveredFormulaReferencePreviewTimer = window.setTimeout(() => {
    pendingHoveredFormulaReferencePreviewTimer = null
    activeHoveredFormulaReferencePreview = {
      referenceKey: reference.key,
      originSheetId: workbookSnapshot.value.activeSheetId,
    }
    revealFormulaReferenceTarget(reference)
  }, 120)
}

function clearHoveredFormulaReferencePreviewTimer(): void {
  if (pendingHoveredFormulaReferencePreviewTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(pendingHoveredFormulaReferencePreviewTimer)
    pendingHoveredFormulaReferencePreviewTimer = null
  }
}

function suppressInitialSheetSelection(sheet: DataGridSpreadsheetWorkbookSheetHandle): void {
  const fallbackColumnKey = sheet.sheetModel.getColumns()[0]?.key
  const fallbackRow = sheet.sheetModel.getRows()[0]
  if (!fallbackColumnKey || !fallbackRow) {
    return
  }
  suppressNextSelectionSyncForCellKey = makeScopedCellKey({
    sheetId: sheet.id,
    rowId: fallbackRow.id,
    rowIndex: fallbackRow.rowIndex,
    columnKey: fallbackColumnKey,
  })
}

function restoreHoveredFormulaReferencePreview(): void {
  clearHoveredFormulaReferencePreviewTimer()
  const preview = activeHoveredFormulaReferencePreview
  activeHoveredFormulaReferencePreview = null
  if (!preview || preview.originSheetId === workbookSnapshot.value.activeSheetId || !preview.originSheetId) {
    return
  }
  const originSheet = resolveSheetHandle(preview.originSheetId)
  if (!originSheet) {
    return
  }
  suppressInitialSheetSelection(originSheet)
  workbook.setActiveSheet(originSheet.id)
  void nextTick(() => {
    restoreEditorCellSelection()
    focusFormulaBar(editorSnapshot.value.selection)
  })
}

function resolveFormulaReferenceColumnBounds(
  reference: Pick<(typeof editorSnapshot.value.analysis.references)[number], "referenceName" | "rangeReferenceName">,
  referencedSheet: DataGridSpreadsheetWorkbookSheetHandle,
): {
  startColumnIndex: number
  endColumnIndex: number
  startColumnKey: string
  endColumnKey: string
} | null {
  const columns = referencedSheet.sheetModel.getColumns()
  const startColumnIndex = columns.findIndex(column => column.key === reference.referenceName)
  const requestedEndColumnKey = reference.rangeReferenceName && reference.rangeReferenceName !== reference.referenceName
    ? reference.rangeReferenceName
    : reference.referenceName
  const requestedEndColumnIndex = columns.findIndex(column => column.key === requestedEndColumnKey)
  if (startColumnIndex < 0 || requestedEndColumnIndex < 0) {
    return null
  }
  const [from, to] = startColumnIndex <= requestedEndColumnIndex
    ? [startColumnIndex, requestedEndColumnIndex]
    : [requestedEndColumnIndex, startColumnIndex]
  const startColumnKey = columns[from]?.key
  const endColumnKey = columns[to]?.key
  if (!startColumnKey || !endColumnKey) {
    return null
  }
  return {
    startColumnIndex: from,
    endColumnIndex: to,
    startColumnKey,
    endColumnKey,
  }
}

function resolveFormulaReferenceBoundsForReference(
  reference: Pick<(typeof editorSnapshot.value.analysis.references)[number], "sheetReference" | "referenceName" | "rangeReferenceName" | "targetRowIndexes">,
  options: {
    requireActiveSheet?: boolean
  } = {},
): {
  referencedSheet: DataGridSpreadsheetWorkbookSheetHandle
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  startColumnKey: string
  endColumnKey: string
  topLeftCell: DataGridSpreadsheetCellAddress
  bottomRightCell: DataGridSpreadsheetCellAddress
} | null {
  const referencedSheet = resolveWorkbookSheetHandleForReference(reference)
  if (!referencedSheet) {
    return null
  }
  if (options.requireActiveSheet === true && referencedSheet.id !== activeSheetHandle.value?.id) {
    return null
  }
  const rowIndexes = reference.targetRowIndexes.filter(rowIndex => typeof rowIndex === "number" && rowIndex >= 0)
  if (rowIndexes.length === 0) {
    return null
  }
  const startRowIndex = Math.min(...rowIndexes)
  const endRowIndex = Math.max(...rowIndexes)
  const columnBounds = resolveFormulaReferenceColumnBounds(reference, referencedSheet)
  if (!columnBounds) {
    return null
  }
  const topLeftCell = createFormulaReferenceCellAddress(referencedSheet, startRowIndex, columnBounds.startColumnKey)
  const bottomRightCell = createFormulaReferenceCellAddress(referencedSheet, endRowIndex, columnBounds.endColumnKey)
  if (!topLeftCell || !bottomRightCell) {
    return null
  }
  return {
    referencedSheet,
    startRowIndex,
    endRowIndex,
    startColumnIndex: columnBounds.startColumnIndex,
    endColumnIndex: columnBounds.endColumnIndex,
    startColumnKey: columnBounds.startColumnKey,
    endColumnKey: columnBounds.endColumnKey,
    topLeftCell,
    bottomRightCell,
  }
}

function createFormulaReferenceCellAddress(
  sheet: DataGridSpreadsheetWorkbookSheetHandle,
  rowIndex: number,
  columnKey: string,
): DataGridSpreadsheetCellAddress | null {
  const row = sheet.sheetModel.getRows()[rowIndex]
  if (!row) {
    return null
  }
  return {
    sheetId: sheet.id,
    rowId: row.id,
    rowIndex: row.rowIndex,
    columnKey,
  }
}

function resolveInteractiveFormulaReferenceBounds(): {
  referencedSheet: DataGridSpreadsheetWorkbookSheetHandle
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  startColumnKey: string
  endColumnKey: string
  topLeftCell: DataGridSpreadsheetCellAddress
  bottomRightCell: DataGridSpreadsheetCellAddress
} | null {
  const reference = interactiveFormulaReference.value
  if (!reference) {
    return null
  }
  return resolveFormulaReferenceBoundsForReference(reference, { requireActiveSheet: true })
}

function resolveVisibleFormulaReferenceBounds(): {
  referencedSheet: DataGridSpreadsheetWorkbookSheetHandle
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  startColumnKey: string
  endColumnKey: string
  topLeftCell: DataGridSpreadsheetCellAddress
  bottomRightCell: DataGridSpreadsheetCellAddress
} | null {
  const reference = previewFormulaReference.value ?? interactiveFormulaReference.value
  if (!reference) {
    return null
  }
  return resolveFormulaReferenceBoundsForReference(reference, { requireActiveSheet: true })
}

function resolveFormulaReferenceCornerCell(
  bounds: NonNullable<ReturnType<typeof resolveInteractiveFormulaReferenceBounds>>,
  corner: FormulaReferenceHandleCorner,
): DataGridSpreadsheetCellAddress | null {
  const rowIndex = corner.startsWith("top") ? bounds.startRowIndex : bounds.endRowIndex
  const columnKey = corner.endsWith("left") ? bounds.startColumnKey : bounds.endColumnKey
  return createFormulaReferenceCellAddress(bounds.referencedSheet, rowIndex, columnKey)
}

function resolveFormulaReferenceOppositeCorner(corner: FormulaReferenceHandleCorner): FormulaReferenceHandleCorner {
  switch (corner) {
    case "top-left":
      return "bottom-right"
    case "top-right":
      return "bottom-left"
    case "bottom-right":
      return "top-left"
    case "bottom-left":
      return "top-right"
  }
}

function revealFormulaReferenceTarget(
  reference: (typeof editorSnapshot.value.analysis.references)[number],
): void {
  const targetBounds = resolveFormulaReferenceBoundsForReference(reference)
  const targetSheet = targetBounds?.referencedSheet ?? null
  if (!targetBounds || !targetSheet) {
    return
  }
  if (workbookSnapshot.value.activeSheetId !== targetSheet.id) {
    suppressInitialSheetSelection(targetSheet)
    workbook.setActiveSheet(targetSheet.id)
  }
  void nextTick(() => {
    suppressNextSelectionSyncForCellKey = makeScopedCellKey(targetBounds.bottomRightCell)
    applyCellRangeSelection(targetBounds.topLeftCell, targetBounds.bottomRightCell)
    focusFormulaBar(editorSnapshot.value.selection)
  })
}

function syncFormulaReferenceOverlayMetrics(): void {
  if (!isFormulaReferenceMode.value) {
    formulaReferenceOverlayMetrics.value = null
    return
  }
  const bounds = resolveVisibleFormulaReferenceBounds()
  const stageElement = gridHostRef.value?.closest<HTMLElement>(".spreadsheet-grid-stage")
  const reference = previewFormulaReference.value ?? interactiveFormulaReference.value
  const topLeftElement = resolveGridCellElement(bounds?.topLeftCell ?? null)
  const bottomRightElement = resolveGridCellElement(bounds?.bottomRightCell ?? null)
  if (!bounds || !topLeftElement || !bottomRightElement || !stageElement || !reference) {
    formulaReferenceOverlayMetrics.value = null
    return
  }
  const topLeftRect = topLeftElement.getBoundingClientRect()
  const bottomRightRect = bottomRightElement.getBoundingClientRect()
  const stageRect = stageElement.getBoundingClientRect()
  const palette = resolvePalette(reference.colorIndex)
  formulaReferenceOverlayMetrics.value = {
    top: topLeftRect.top - stageRect.top,
    left: topLeftRect.left - stageRect.left,
    width: Math.max(0, bottomRightRect.right - topLeftRect.left),
    height: Math.max(0, bottomRightRect.bottom - topLeftRect.top),
    color: palette.border,
    borderColor: palette.border,
    backgroundColor: palette.soft,
  }
}

function rewriteActiveFormulaReferenceToCell(
  targetCell: DataGridSpreadsheetCellAddress,
  options: {
    anchorCell?: DataGridSpreadsheetCellAddress | null
  } = {},
): void {
  const activeCell = editorSnapshot.value.activeCell
  const activeReference = interactiveFormulaReference.value
  const handle = resolveSheetHandle(activeCell?.sheetId)
  if (!activeCell || !activeReference || !handle) {
    return
  }
  const nextInput = rewriteDataGridSpreadsheetFormulaReferences(editorSnapshot.value.rawInput, (reference) => {
    if (reference.key !== activeReference.key) {
      return null
    }
    const targetSheet = resolveSheetHandle(targetCell.sheetId)
    const targetSheetReference = targetCell.sheetId !== activeCell.sheetId
      ? (targetSheet?.aliases[0] ?? targetCell.sheetId)
      : null
    const anchorCell = options.anchorCell
    if (anchorCell && anchorCell.sheetId === targetCell.sheetId) {
      if (!targetSheet) {
        return null
      }
      const columns = targetSheet.sheetModel.getColumns()
      const anchorColumnIndex = columns.findIndex(column => column.key === anchorCell.columnKey)
      const targetColumnIndex = columns.findIndex(column => column.key === targetCell.columnKey)
      if (anchorColumnIndex < 0 || targetColumnIndex < 0) {
        return null
      }
      const [startColumnIndex, endColumnIndex] = anchorColumnIndex <= targetColumnIndex
        ? [anchorColumnIndex, targetColumnIndex]
        : [targetColumnIndex, anchorColumnIndex]
      const startColumnKey = columns[startColumnIndex]?.key
      const endColumnKey = columns[endColumnIndex]?.key
      const startRowIndex = Math.min(anchorCell.rowIndex, targetCell.rowIndex)
      const endRowIndex = Math.max(anchorCell.rowIndex, targetCell.rowIndex)
      if (!startColumnKey || !endColumnKey) {
        return null
      }
      if (startRowIndex === endRowIndex && startColumnKey === endColumnKey) {
        return {
          sheetReference: targetSheetReference,
          referenceName: startColumnKey,
          rowIndex: targetSheetReference ? null : startRowIndex,
          rowSelector: targetSheetReference
            ? {
              kind: "absolute",
              rowIndex: startRowIndex,
            }
            : null,
        }
      }
      return {
        sheetReference: targetSheetReference,
        referenceName: startColumnKey,
        rangeReferenceName: startColumnKey === endColumnKey ? null : endColumnKey,
        rowSelector: {
          kind: "absolute-window",
          startRowIndex,
          endRowIndex,
        },
      }
    }
    return {
      sheetReference: targetSheetReference,
      referenceName: targetCell.columnKey,
      rowIndex: targetSheetReference ? null : targetCell.rowIndex,
      rowSelector: targetSheetReference
        ? {
          kind: "absolute",
          rowIndex: targetCell.rowIndex,
        }
        : null,
    }
  }, {
    currentRowIndex: activeCell.rowIndex,
    rowCount: handle.sheetModel.getSnapshot().rowCount,
    referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
  })
  if (nextInput === editorSnapshot.value.rawInput) {
    return
  }
  ensureFormulaEditHistorySession(activeCell)
  editorModel.setInput(nextInput)
  editorModel.setSelection({
    start: activeReference.span.start,
    end: activeReference.span.start + (nextInput.length - editorSnapshot.value.rawInput.length) + (activeReference.span.end - activeReference.span.start),
  })
  if (applySpreadsheetCellInput(handle, activeCell, nextInput, "Drag formula reference")) {
    markFormulaEditHistoryChanged()
  }
  syncEditorCellDisplay()
}

function startFormulaReferenceDrag(handleCorner: FormulaReferenceHandleCorner): void {
  if (activeSheetReadOnly.value) {
    return
  }
  const referenceBounds = resolveInteractiveFormulaReferenceBounds()
  const targetCell = resolveActiveFormulaReferenceTargetCell()
  const isRangeReference = referenceBounds != null && (
    referenceBounds.startRowIndex !== referenceBounds.endRowIndex
    || referenceBounds.startColumnIndex !== referenceBounds.endColumnIndex
  )
  if (!referenceBounds && !targetCell) {
    return
  }
  const anchorCell = isRangeReference && referenceBounds
    ? resolveFormulaReferenceCornerCell(referenceBounds, resolveFormulaReferenceOppositeCorner(handleCorner))
    : null
  const currentCornerCell = isRangeReference && referenceBounds
    ? resolveFormulaReferenceCornerCell(referenceBounds, handleCorner)
    : targetCell
  if (!currentCornerCell) {
    return
  }
  formulaReferenceDragState.value = {
    mode: isRangeReference ? "resize-range" : "move",
    handleCorner,
    anchorCell,
    lastTargetCellKey: makeScopedCellKey(currentCornerCell),
  }
}

function handleFormulaReferenceDragMove(event: MouseEvent): void {
  const dragState = formulaReferenceDragState.value
  if (!dragState) {
    return
  }
  const targetCell = resolveSpreadsheetCellAddressFromEventTarget(event.target)
  if (!targetCell) {
    return
  }
  const nextCellKey = makeScopedCellKey(targetCell)
  if (nextCellKey === dragState.lastTargetCellKey) {
    return
  }
  formulaReferenceDragState.value = {
    ...dragState,
    lastTargetCellKey: nextCellKey,
  }
  rewriteActiveFormulaReferenceToCell(targetCell, {
    anchorCell: dragState.mode === "resize-range" ? dragState.anchorCell : null,
  })
  void nextTick(syncFormulaReferenceOverlayMetrics)
}

function stopFormulaReferenceDrag(): void {
  if (!formulaReferenceDragState.value) {
    return
  }
  formulaReferenceDragState.value = null
  focusFormulaBar(editorSnapshot.value.selection)
  void nextTick(syncFormulaReferenceOverlayMetrics)
}

function restoreEditorCellSelection(options: { focusGrid?: boolean } = {}): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  if (activeSheetHandle.value?.id !== activeCell.sheetId) {
    return
  }
  suppressNextSelectionSyncForCellKey = makeScopedCellKey(activeCell)
  applySingleCellSelection(activeCell)
  if (options.focusGrid) {
    focusGridCell(activeCell)
  }
}

function scheduleEditorCellSelectionRestore(options: {
  focusGrid?: boolean
  refocusFormula?: boolean
} = {}): void {
  clearPendingSelectionRestoreTimer()

  const runRestore = () => {
    pendingSelectionRestoreTimer = null
    restoreEditorCellSelection({ focusGrid: options.focusGrid })
    if (options.refocusFormula) {
      focusFormulaBar(editorSnapshot.value.selection)
    }
  }

  if (typeof window === "undefined") {
    void nextTick(runRestore)
    return
  }

  pendingSelectionRestoreTimer = window.setTimeout(runRestore, 0)
}

function resolveReferenceInsertionSelection(): { start: number; end: number } | null {
  const selection = editorSnapshot.value.selection
  if (selection.start !== selection.end) {
    return selection
  }
  const activeReference = activeFormulaReference.value
  if (!activeReference) {
    return null
  }
  const caret = selection.start
  if (caret < activeReference.span.start || caret > activeReference.span.end) {
    return null
  }
  return {
    start: activeReference.span.start,
    end: activeReference.span.end,
  }
}

function insertReferenceFromCell(targetCell: DataGridSpreadsheetCellAddress): void {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return
  }
  const targetSheet = resolveSheetHandle(targetCell.sheetId)
  const sheetReference = targetCell.sheetId !== activeCell.sheetId
    ? (targetSheet?.aliases[0] ?? targetCell.sheetId)
    : null
  ensureFormulaEditHistorySession(activeCell)
  const replacementSelection = resolveReferenceInsertionSelection()
  if (replacementSelection) {
    editorModel.setSelection(replacementSelection)
  }
  editorModel.insertReference({
    sheetReference,
    referenceName: targetCell.columnKey,
    rowIndex: sheetReference ? null : targetCell.rowIndex,
    rowSelector: sheetReference
      ? {
        kind: "absolute",
        rowIndex: targetCell.rowIndex,
      }
      : null,
  })
  const handle = resolveSheetHandle(activeCell.sheetId)
  if (applySpreadsheetCellInput(handle, activeCell, editorSnapshot.value.rawInput, "Insert formula reference")) {
    markFormulaEditHistoryChanged()
  }
  syncEditorCellDisplay()
}

function openSheet(sheetId: string): void {
  if (!workbook.setActiveSheet(sheetId)) {
    return
  }
  const handle = workbook.getSheet(sheetId)
  if (!handle) {
    return
  }
  const firstColumnKey = handle.sheetModel.getColumns()[0]?.key
  const firstRow = handle.sheetModel.getRows()[0]
  if (!firstColumnKey || !firstRow) {
    return
  }
  const nextCell = {
    sheetId: handle.id,
    rowId: firstRow.id,
    rowIndex: firstRow.rowIndex,
    columnKey: firstColumnKey,
  }
  if (
    editorSnapshot.value.analysis.kind === "formula"
    && editorSnapshot.value.activeCell
    && (isFormulaBarFocused.value || pendingFormulaEditHistory.value != null)
  ) {
    suppressNextSelectionSyncForCellKey = makeScopedCellKey(nextCell)
    applySingleCellSelection(nextCell)
    void nextTick(() => {
      focusFormulaBar(editorSnapshot.value.selection)
    })
    return
  }
  openEditorCell(nextCell)
  void nextTick(() => {
    restoreEditorCellSelection()
  })
}

function syncFormulaSelectionFromDom(): void {
  const input = formulaInputRef.value
  if (!input) {
    return
  }
  editorModel.setSelection({
    start: input.selectionStart ?? 0,
    end: input.selectionEnd ?? input.selectionStart ?? 0,
  })
  if (isFormulaAutocompleteVisible.value) {
    syncFormulaAutocompleteMenuAnchor()
  }
}

function syncFormulaAutocompleteMenuAnchor(): void {
  const controller = formulaAutocompleteMenuRef.value?.controller
  const input = formulaInputRef.value
  if (!controller || !input) {
    return
  }
  const rect = input.getBoundingClientRect()
  controller.setAnchor({
    x: rect.left,
    y: rect.bottom,
    width: rect.width,
    height: 0,
  })
}

function applyFormulaAutocomplete(suggestion: FormulaAutocompleteSuggestion): void {
  const activeCell = editorSnapshot.value.activeCell
  const match = formulaAutocompleteMatch.value
  if (!activeCell || !match || activeSheetReadOnly.value) {
    return
  }
  const currentInput = editorSnapshot.value.rawInput
  const suffix = currentInput.slice(match.replacementEnd)
  const hasOpeningParenthesis = suffix.startsWith("(")
  const insertion = hasOpeningParenthesis ? suggestion.name : `${suggestion.name}()`
  const nextInput = `${currentInput.slice(0, match.replacementStart)}${insertion}${suffix}`
  const nextSelection = {
    start: match.replacementStart + suggestion.name.length + 1,
    end: match.replacementStart + suggestion.name.length + 1,
  }

  ensureFormulaEditHistorySession(activeCell)
  editorModel.setInput(nextInput)
  editorModel.setSelection(nextSelection)
  const handle = resolveSheetHandle(activeCell.sheetId)
  const applied = applySpreadsheetCellInput(handle, activeCell, nextInput, `Insert formula function ${suggestion.name}`)
  if (applied) {
    markFormulaEditHistoryChanged()
  }
  syncEditorCellDisplay()
  formulaAutocompleteMenuRef.value?.controller?.close("programmatic")
  void nextTick(() => {
    const input = formulaInputRef.value
    if (!input) {
      return
    }
    input.focus({ preventScroll: true })
    input.setSelectionRange(nextSelection.start, nextSelection.end)
    syncFormulaAutocompleteMenuAnchor()
  })
}

function handleFormulaInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement | null
  const activeCell = editorSnapshot.value.activeCell
  if (!target || !activeCell) {
    return
  }
  if (activeSheetReadOnly.value) {
    target.value = editorSnapshot.value.rawInput
    return
  }
  ensureFormulaEditHistorySession(activeCell)
  editorModel.setInput(target.value)
  editorModel.setSelection({
    start: target.selectionStart ?? target.value.length,
    end: target.selectionEnd ?? target.selectionStart ?? target.value.length,
  })
  const handle = resolveSheetHandle(activeCell.sheetId)
  const applied = applySpreadsheetCellInput(handle, activeCell, target.value, "Apply formula edit")
  if (applied) {
    markFormulaEditHistoryChanged()
  }
  syncEditorCellDisplay()
  void nextTick(() => {
    if (isFormulaAutocompleteVisible.value) {
      syncFormulaAutocompleteMenuAnchor()
    }
  })
}

function handleFormulaFocus(): void {
  clearFormulaBlurTimer()
  allowFormulaBlur = false
  isFormulaBarFocused.value = true
  syncFormulaSelectionFromDom()
  void nextTick(() => {
    if (isFormulaAutocompleteVisible.value) {
      syncFormulaAutocompleteMenuAnchor()
    }
  })
}

function shouldPreserveFormulaFocusForGridInteraction(): boolean {
  return isFormulaBarFocused.value
    && editorSnapshot.value.analysis.kind === "formula"
    && editorSnapshot.value.activeCell != null
}

function handleGridPointerDownCapture(): void {
  preserveFormulaFocusFromGridPointer.value = shouldPreserveFormulaFocusForGridInteraction()
}

function handleFormulaBlur(): void {
  if (typeof window === "undefined") {
    clearPendingSelectionRestoreTimer()
    if (allowFormulaBlur) {
      allowFormulaBlur = false
    }
    isFormulaBarFocused.value = false
    return
  }
  formulaBlurTimer = window.setTimeout(() => {
    if (preserveFormulaFocusFromGridPointer.value && !allowFormulaBlur) {
      preserveFormulaFocusFromGridPointer.value = false
      formulaBlurTimer = null
      focusFormulaBar(editorSnapshot.value.selection)
      return
    }
    preserveFormulaFocusFromGridPointer.value = false
    allowFormulaBlur = false
    isFormulaBarFocused.value = false
    formulaBlurTimer = null
    void commitPendingFormulaEditHistory()
  }, 0)
}

function handleFormulaCommit(): void {
  clearPendingSelectionRestoreTimer()
  preserveFormulaFocusFromGridPointer.value = false
  allowFormulaBlur = true
  restoreEditorCellSelection({ focusGrid: true })
  formulaInputRef.value?.blur()
}

function handleFormulaCancel(): void {
  clearFormulaBlurTimer()
  clearPendingSelectionRestoreTimer()
  preserveFormulaFocusFromGridPointer.value = false

  const currentSession = pendingFormulaEditHistory.value
  pendingFormulaEditHistory.value = null
  allowFormulaBlur = true

  if (currentSession?.changed) {
    measureSpreadsheetOperation("Cancel formula edit", () => {
      workbook.restoreState(currentSession.beforeSnapshot)
    })
    formulaInputRef.value?.blur()
    syncSpreadsheetAfterHistoryRestore({ focusGrid: true })
    return
  }

  restoreEditorCellSelection({ focusGrid: true })
  formulaInputRef.value?.blur()
}

function handleFormulaKeydown(event: KeyboardEvent): void {
  if (!event.metaKey && !event.ctrlKey && !event.altKey && formulaAutocompleteSuggestions.value.length > 0) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      formulaAutocompleteActiveIndex.value = (formulaAutocompleteActiveIndex.value + 1) % formulaAutocompleteSuggestions.value.length
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      formulaAutocompleteActiveIndex.value = formulaAutocompleteActiveIndex.value === 0
        ? formulaAutocompleteSuggestions.value.length - 1
        : formulaAutocompleteActiveIndex.value - 1
      return
    }
    if ((event.key === "Enter" && !event.shiftKey) || (event.key === "Tab" && !event.shiftKey)) {
      const suggestion = formulaAutocompleteSuggestions.value[formulaAutocompleteActiveIndex.value] ?? formulaAutocompleteSuggestions.value[0]
      if (suggestion) {
        event.preventDefault()
        applyFormulaAutocomplete(suggestion)
        return
      }
    }
  }

  const lowerKey = event.key.toLowerCase()
  const primaryModifierPressed = event.metaKey || event.ctrlKey
  if (primaryModifierPressed && !event.altKey && lowerKey === "z") {
    event.preventDefault()
    void handleWorkbookHistoryAction(event.shiftKey ? "redo" : "undo")
    return
  }
  if (primaryModifierPressed && !event.altKey && !event.shiftKey && lowerKey === "y") {
    event.preventDefault()
    void handleWorkbookHistoryAction("redo")
    return
  }
  if (event.key === "Escape") {
    event.preventDefault()
    handleFormulaCancel()
    return
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    handleFormulaCommit()
  }
}

function isPrintableEditingKey(event: KeyboardEvent): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1
}

function beginGridEdit(cell: DataGridSpreadsheetCellAddress, draftInput?: string): void {
  if (activeSheetReadOnly.value) {
    return
  }
  openEditorCell(cell, {
    focus: true,
    draftInput: draftInput ?? null,
    selectAll: draftInput == null,
  })
}

function resolveCellAddressFromOffsets(
  rowOffset: number,
  columnIndex: number,
): DataGridSpreadsheetCellAddress | null {
  const currentSheet = activeSheetHandle.value
  const visualRowIndex = tableStageProps.value.viewport.viewportRowStart + rowOffset
  const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
  const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
  if (!currentSheet || !row || !columnKey) {
    return null
  }
  return {
    sheetId: currentSheet.id,
    rowId: row.rowId,
    rowIndex: row.sourceRowIndex,
    columnKey,
  }
}

function handleGridCellKeydown(
  event: KeyboardEvent,
  row: { rowId: DataGridRowId },
  rowOffset: number,
  columnIndex: number,
): void {
  const targetCell = resolveCellAddressFromOffsets(rowOffset, columnIndex)
  if (!activeSheetReadOnly.value && targetCell && (event.key === "Enter" || event.key === "F2")) {
    event.preventDefault()
    beginGridEdit(targetCell)
    return
  }
  if (!activeSheetReadOnly.value && targetCell && isPrintableEditingKey(event)) {
    event.preventDefault()
    beginGridEdit(targetCell, event.key)
    return
  }
  tableStageProps.value.interaction.handleCellKeydown(event, row as never, rowOffset, columnIndex)
}

function handleGridViewportKeydown(event: KeyboardEvent): void {
  const targetCell = resolveSelectedGridCell()
  if (!activeSheetReadOnly.value && targetCell && (event.key === "Enter" || event.key === "F2")) {
    event.preventDefault()
    beginGridEdit(targetCell)
    return
  }
  if (!activeSheetReadOnly.value && targetCell && isPrintableEditingKey(event)) {
    event.preventDefault()
    beginGridEdit(targetCell, event.key)
    return
  }
  tableStageProps.value.viewport.handleViewportKeydown(event)
}

function handleGridInlineEditRequest(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  columnKey: string,
): void {
  if (activeSheetReadOnly.value) {
    return
  }
  const currentSheet = activeSheetHandle.value
  const rowData = row.data as SpreadsheetGridRow | undefined
  if (!currentSheet || !rowData) {
    return
  }
  beginGridEdit({
    sheetId: currentSheet.id,
    rowId: row.rowId,
    rowIndex: rowData.__rowIndex,
    columnKey,
  })
}

function collectSelectedAddresses(): readonly DataGridSpreadsheetCellAddress[] {
  const currentSheet = activeSheetHandle.value
  const snapshot = selectionSnapshot.value
  if (!currentSheet || !snapshot || snapshot.ranges.length === 0) {
    return editorSnapshot.value.activeCell ? [editorSnapshot.value.activeCell] : []
  }
  const addresses: DataGridSpreadsheetCellAddress[] = []
  const seen = new Set<string>()

  for (const range of snapshot.ranges) {
    const startRow = Math.min(range.startRow, range.endRow)
    const endRow = Math.max(range.startRow, range.endRow)
    const startColumn = Math.min(range.startCol, range.endCol)
    const endColumn = Math.max(range.startCol, range.endCol)
    for (let visualRowIndex = startRow; visualRowIndex <= endRow; visualRowIndex += 1) {
      const row = resolveSpreadsheetRuntimeRow(visualRowIndex)
      if (!row) {
        continue
      }
      for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
        const columnKey = resolveSpreadsheetColumnKeyFromStageIndex(columnIndex)
        if (!columnKey) {
          continue
        }
        const address = {
          sheetId: currentSheet.id,
          rowId: row.rowId,
          rowIndex: row.sourceRowIndex,
          columnKey,
        }
        const scopedKey = makeScopedCellKey(address)
        if (seen.has(scopedKey)) {
          continue
        }
        seen.add(scopedKey)
        addresses.push(address)
      }
    }
  }

  return addresses
}

async function applyStylePreset(presetId: SpreadsheetStylePresetId): Promise<void> {
  if (activeSheetReadOnly.value) {
    return
  }
  const currentSheet = activeSheetHandle.value
  if (!currentSheet) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  await runWorkbookIntent({
    intent: "style",
    label: "Apply cell style",
  }, () => currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: STYLE_PRESETS[presetId],
  }))))
}

async function clearSelectedStyles(): Promise<void> {
  if (activeSheetReadOnly.value) {
    return
  }
  const currentSheet = activeSheetHandle.value
  if (!currentSheet) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  await runWorkbookIntent({
    intent: "style",
    label: "Clear cell style",
  }, () => currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: null,
  }))))
}

function copyStyleFromActiveCell(): void {
  const cell = resolveCellSnapshot(editorSnapshot.value.activeCell)
  copiedStyle.value = cell?.style ?? null
}

async function pasteStyleToSelection(): Promise<void> {
  if (activeSheetReadOnly.value) {
    return
  }
  const currentSheet = activeSheetHandle.value
  if (!currentSheet || copiedStyle.value == null) {
    return
  }
  const targets = collectSelectedAddresses()
  if (targets.length === 0) {
    return
  }
  await runWorkbookIntent({
    intent: "style",
    label: "Paste cell style",
  }, () => currentSheet.sheetModel.setCellStyles(targets.map(cell => ({
    cell,
    style: copiedStyle.value,
  }))))
}

const referenceHighlightByCellKey = computed(() => {
  const currentSheetId = activeSheetHandle.value?.id ?? null
  const activeReferenceKey = hoveredFormulaReferenceKey.value ?? editorSnapshot.value.activeReferenceKey
  const highlightByKey = new Map<string, { active: boolean; palette: ReturnType<typeof resolvePalette> }>()

  if (!currentSheetId || editorSnapshot.value.analysis.kind !== "formula") {
    return highlightByKey
  }

  const resolveReferenceColumnKeys = (reference: (typeof editorSnapshot.value.analysis.references)[number]): readonly string[] => {
    const targetSheet = reference.sheetReference
      ? workbook.getSheets().find(sheet => sheet.aliases.includes(reference.sheetReference ?? "")) ?? null
      : activeSheetHandle.value
    const columns = targetSheet?.sheetModel.getColumns() ?? []
    if (!reference.rangeReferenceName || reference.rangeReferenceName === reference.referenceName) {
      return Object.freeze([reference.referenceName])
    }
    const startIndex = columns.findIndex(column => column.key === reference.referenceName)
    const endIndex = columns.findIndex(column => column.key === reference.rangeReferenceName)
    if (startIndex < 0 || endIndex < 0) {
      return Object.freeze([reference.referenceName])
    }
    const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    return Object.freeze(columns.slice(from, to + 1).map(column => column.key))
  }

  for (const reference of editorSnapshot.value.analysis.references) {
    const palette = resolvePalette(reference.colorIndex)
    const columnKeys = resolveReferenceColumnKeys(reference)
    for (const rowIndex of reference.targetRowIndexes) {
      for (const columnKey of columnKeys) {
        const localKey = makeLocalCellKey(rowIndex, columnKey)
        const current = highlightByKey.get(localKey)
        if (!current) {
          highlightByKey.set(localKey, {
            active: reference.key === activeReferenceKey,
            palette,
          })
          continue
        }
        if (reference.key === activeReferenceKey) {
          highlightByKey.set(localKey, {
            active: true,
            palette: current.palette,
          })
        }
      }
    }
  }

  return highlightByKey
})

function resolveSpreadsheetCellClass(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  _rowOffset: number,
  column: DataGridColumnSnapshot,
): Record<string, boolean> {
  const rowData = row.data as SpreadsheetGridRow | undefined
  const rowIndex = rowData?.__rowIndex
  const cell = typeof rowIndex === "number"
    ? activeSheetView.value.cellsByKey.get(makeLocalCellKey(rowIndex, column.key)) ?? null
    : null
  const isActiveCell = areCellsEqual(editorSnapshot.value.activeCell, {
    sheetId: activeSheetHandle.value?.id ?? null,
    rowId: row.rowId,
    rowIndex: rowIndex ?? -1,
    columnKey: column.key,
  })
  const referenceHighlight = typeof rowIndex === "number"
    ? referenceHighlightByCellKey.value.get(makeLocalCellKey(rowIndex, column.key))
    : null

  return {
    "spreadsheet-cell--formula": cell?.inputKind === "formula",
    "spreadsheet-cell--error": cell?.errorValue != null,
    "spreadsheet-cell--active": isActiveCell,
    "spreadsheet-cell--reference": referenceHighlight != null,
    "spreadsheet-cell--reference-active": referenceHighlight?.active === true,
  }
}

function resolveSpreadsheetCellStyle(
  row: { rowId: DataGridRowId; data?: SpreadsheetGridRow },
  _rowOffset: number,
  column: DataGridColumnSnapshot,
): Readonly<Record<string, string | number>> {
  const rowData = row.data as SpreadsheetGridRow | undefined
  const rowIndex = rowData?.__rowIndex
  const cell = typeof rowIndex === "number"
    ? activeSheetView.value.cellsByKey.get(makeLocalCellKey(rowIndex, column.key)) ?? null
    : null
  const baseStyle = resolveCellVisualStyle(cell?.style)
  const referenceHighlight = typeof rowIndex === "number"
    ? referenceHighlightByCellKey.value.get(makeLocalCellKey(rowIndex, column.key))
    : null

  const referenceStyle = referenceHighlight
    ? {
        backgroundColor: referenceHighlight.active ? referenceHighlight.palette.solid : referenceHighlight.palette.soft,
        boxShadow: `inset 0 0 0 2px ${referenceHighlight.palette.border}`,
      }
    : {}

  const errorStyle = cell?.errorValue
    ? {
        color: "#b91c1c",
        backgroundColor: "rgba(239, 68, 68, 0.12)",
        boxShadow: mergeBoxShadow(referenceStyle.boxShadow, "inset 0 0 0 1px rgba(220, 38, 38, 0.72)"),
      }
    : {}

  return {
    ...(baseStyle.backgroundColor ? { backgroundColor: String(baseStyle.backgroundColor) } : {}),
    ...(baseStyle.color ? { color: String(baseStyle.color) } : {}),
    ...(baseStyle.fontWeight ? { fontWeight: baseStyle.fontWeight as string | number } : {}),
    ...(baseStyle.fontStyle ? { fontStyle: String(baseStyle.fontStyle) } : {}),
    ...(baseStyle.textAlign ? { textAlign: String(baseStyle.textAlign) } : {}),
    ...(baseStyle.boxShadow ? { boxShadow: String(baseStyle.boxShadow) } : {}),
    ...(referenceStyle.backgroundColor ? { backgroundColor: referenceStyle.backgroundColor } : {}),
    ...(referenceStyle.boxShadow ? { boxShadow: referenceStyle.boxShadow } : {}),
    ...(errorStyle.backgroundColor ? { backgroundColor: errorStyle.backgroundColor } : {}),
    ...(errorStyle.color ? { color: errorStyle.color } : {}),
    ...(errorStyle.boxShadow ? { boxShadow: errorStyle.boxShadow } : {}),
  }
}

const tableStagePropsForView = computed<DataGridTableStageProps<SpreadsheetGridRow>>(() => ({
  mode: tableStageProps.value.mode,
  layoutMode: tableStageProps.value.layoutMode,
  rowHeightMode: tableStageProps.value.rowHeightMode,
  layout: tableStageProps.value.layout,
  selection: tableStageProps.value.selection,
  rows: {
    ...tableStageProps.value.rows,
    sourceRows: gridRows.value,
  },
  columns: {
    ...tableStageProps.value.columns,
    columnMenuEnabled: true,
  },
  editing: {
    ...tableStageProps.value.editing,
    editingCellValue: "",
    isEditingCell: () => false,
    startInlineEdit: handleGridInlineEditRequest,
    handleEditorKeydown: () => {},
    commitInlineEdit: () => {},
  },
  cells: {
    ...tableStageProps.value.cells,
    cellClass: resolveSpreadsheetCellClass,
    cellStyle: resolveSpreadsheetCellStyle,
  },
  interaction: {
    ...tableStageProps.value.interaction,
    handleCellKeydown: handleGridCellKeydown,
  },
  viewport: {
    ...tableStageProps.value.viewport,
    handleViewportKeydown: handleGridViewportKeydown,
  },
}))

const tableStageContextForView = createDataGridTableStageContext<SpreadsheetGridRow>({
  mode: computed(() => tableStagePropsForView.value.mode),
  layoutMode: computed(() => tableStagePropsForView.value.layoutMode),
  rowHeightMode: computed(() => tableStagePropsForView.value.rowHeightMode),
  layout: computed(() => tableStagePropsForView.value.layout),
  viewport: computed(() => tableStagePropsForView.value.viewport),
  columns: computed(() => tableStagePropsForView.value.columns),
  rows: computed(() => tableStagePropsForView.value.rows),
  selection: computed(() => tableStagePropsForView.value.selection),
  editing: computed(() => tableStagePropsForView.value.editing),
  cells: computed(() => tableStagePropsForView.value.cells),
  interaction: computed(() => tableStagePropsForView.value.interaction),
})

const formulaPreviewSegments = computed<readonly FormulaPreviewSegment[]>(() => {
  const rawInput = editorSnapshot.value.rawInput
  const references = editorSnapshot.value.analysis.references
  const previewReferenceKey = hoveredFormulaReferenceKey.value ?? editorSnapshot.value.activeReferenceKey
  if (rawInput.length === 0) {
    return Object.freeze([
      {
        key: "empty",
        kind: "plain",
        text: "Formula preview",
      },
    ])
  }

  const segments: FormulaPreviewSegment[] = []
  let cursor = 0
  for (const reference of references) {
    if (reference.span.start > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        kind: "plain",
        text: rawInput.slice(cursor, reference.span.start),
      })
    }
    const palette = resolvePalette(reference.colorIndex)
    segments.push({
      key: reference.key,
      kind: "reference",
      referenceKey: reference.key,
      text: rawInput.slice(reference.span.start, reference.span.end),
      active: reference.key === previewReferenceKey,
      style: Object.freeze({
        color: palette.text,
        backgroundColor: reference.key === previewReferenceKey ? palette.solid : palette.soft,
        boxShadow: `inset 0 -1px 0 ${palette.border}`,
      }),
    })
    cursor = reference.span.end
  }
  if (cursor < rawInput.length) {
    segments.push({
      key: `plain-${cursor}`,
      kind: "plain",
      text: rawInput.slice(cursor),
    })
  }
  return Object.freeze(segments)
})

const referenceLegend = computed<readonly ReferenceLegendEntry[]>(() => {
  const previewReferenceKey = hoveredFormulaReferenceKey.value ?? editorSnapshot.value.activeReferenceKey
  return Object.freeze(editorSnapshot.value.analysis.references.map(reference => {
    const palette = resolvePalette(reference.colorIndex)
    return {
      key: reference.key,
      text: reference.text,
      active: reference.key === previewReferenceKey,
      targetsLabel: reference.targetRowIndexes.length === 0
        ? "out of range"
        : reference.targetRowIndexes.map(rowIndex => `r${rowIndex + 1}`).join(", "),
      style: Object.freeze({
        color: palette.text,
        borderColor: palette.border,
        backgroundColor: reference.key === previewReferenceKey ? palette.solid : palette.soft,
      }),
    }
  }))
})

const previewFormulaReference = computed(() => {
  const hoveredKey = hoveredFormulaReferenceKey.value
  if (hoveredKey) {
    return editorSnapshot.value.analysis.references.find(reference => reference.key === hoveredKey) ?? null
  }
  return activeFormulaReference.value
})

const activeFormulaReference = computed(() => (
  editorSnapshot.value.analysis.references.find(reference => reference.key === editorSnapshot.value.activeReferenceKey) ?? null
))

const formulaReferenceOverlayStyle = computed(() => {
  const metrics = formulaReferenceOverlayMetrics.value
  if (!metrics) {
    return {}
  }
  return {
    top: `${metrics.top}px`,
    left: `${metrics.left}px`,
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    color: metrics.color,
    borderColor: metrics.borderColor,
    backgroundColor: metrics.backgroundColor,
  }
})

const isFormulaReferenceMode = computed(() => (
  !activeSheetReadOnly.value
  && editorSnapshot.value.analysis.kind === "formula"
  && editorSnapshot.value.activeCell != null
  && (isFormulaBarFocused.value || preserveFormulaFocusFromGridPointer.value)
))

const interactiveFormulaReference = computed(() => {
  if (activeFormulaReference.value) {
    return activeFormulaReference.value
  }
  if (!isFormulaReferenceMode.value) {
    return null
  }
  return editorSnapshot.value.analysis.references.length === 1
    ? editorSnapshot.value.analysis.references[0] ?? null
    : null
})

const formulaReferenceTargetSheetId = computed(() => {
  const reference = previewFormulaReference.value ?? interactiveFormulaReference.value
  if (!reference) {
    return null
  }
  if (!reference.sheetReference) {
    return activeSheetHandle.value?.id ?? null
  }
  return workbook.getSheets().find(sheet => sheet.aliases.includes(reference.sheetReference ?? ""))?.id ?? null
})

const formulaReferenceTargetSheetStyle = computed(() => {
  const reference = previewFormulaReference.value ?? interactiveFormulaReference.value
  if (!reference) {
    return undefined
  }
  const palette = resolvePalette(reference.colorIndex)
  return {
    borderColor: palette.border,
    boxShadow: `0 0 0 1px ${palette.border}`,
    background: palette.soft,
    color: palette.text,
  }
})

watch(
  [previewFormulaReference, interactiveFormulaReference, isFormulaReferenceMode, workbookRevision],
  () => {
    void nextTick(syncFormulaReferenceOverlayMetrics)
  },
  { immediate: true },
)

const activeCellSnapshot = computed(() => {
  void workbookRevision.value
  return resolveCellSnapshot(editorSnapshot.value.activeCell)
})

const activeCellBadge = computed(() => {
  const activeCell = editorSnapshot.value.activeCell
  if (!activeCell) {
    return "No active cell"
  }
  return formatCellReferenceLabel(activeSheetHandle.value?.name, activeCell.columnKey, activeCell.rowIndex)
})

const activeCellDisplayLabel = computed(() => {
  const activeCell = activeCellSnapshot.value
  if (!activeCell) {
    return "—"
  }
  if (activeCell.errorValue) {
    return "#ERROR"
  }
  return activeCell.formattedValue || "—"
})

const activeDiagnosticMessage = computed(() => {
  const firstDiagnostic = editorSnapshot.value.analysis.diagnostics[0]
  if (firstDiagnostic?.message) {
    return firstDiagnostic.message
  }
  const errorValue = activeCellSnapshot.value?.errorValue as { message?: unknown } | null | undefined
  return typeof errorValue?.message === "string" ? errorValue.message : ""
})

const formulaModeLabel = computed(() => {
  if (activeSheetReadOnly.value) {
    return "View only"
  }
  if (isFormulaReferenceMode.value) {
    return activeFormulaReference.value ? "Replace ref" : "Pick refs"
  }
  if (isFormulaBarFocused.value) {
    return "Editing"
  }
  return "Selection"
})

const formulaModeHint = computed(() => {
  if (activeSheetReadOnly.value) {
    return `Derived from ${activeSheetViewSourceLabel.value}. Edit the source sheet to recompute.`
  }
  if (isFormulaReferenceMode.value && activeFormulaReference.value) {
    return `Click a cell to replace ${activeFormulaReference.value.text}. Enter applies. Escape reverts.`
  }
  if (isFormulaReferenceMode.value) {
    return "Click cells to inject references at the caret. Drag the grid selection first if you want a range preview."
  }
  if (isFormulaBarFocused.value) {
    return "Edit raw values directly or start with = to build a formula without leaving the keyboard."
  }
  return "Select a cell, press Enter or F2 to edit, and use the grid to compose formulas like Sheets or Smartsheet."
})

const formulaStateSummary = computed(() => {
  if (activeSheetReadOnly.value) {
    return "Derived sheet"
  }
  if (isFormulaReferenceMode.value) {
    return "Reference compose"
  }
  if (isFormulaBarFocused.value) {
    return editorSnapshot.value.analysis.kind === "formula" ? "Formula edit" : "Cell edit"
  }
  return "Grid selection"
})

const formulaReferenceSummary = computed(() => {
  const count = editorSnapshot.value.analysis.references.length
  if (count === 0) {
    return "None"
  }
  const activeReferenceText = activeFormulaReference.value?.text
  return activeReferenceText ? `${count} total · ${activeReferenceText}` : String(count)
})

const workbookSyncSummary = computed(() => workbookSnapshot.value.sync)

const workbookFormulaTotals = computed(() => {
  return workbookSnapshot.value.sheets.reduce((acc, sheet) => ({
    formulaCells: acc.formulaCells + sheet.formulaCellCount,
    errorCells: acc.errorCells + sheet.errorCellCount,
  }), {
    formulaCells: 0,
    errorCells: 0,
  })
})

const workbookDiagnostics = computed(() => Object.freeze(workbookSnapshot.value.diagnostics ?? []))

const workbookWarningDiagnostics = computed(() => Object.freeze(
  workbookDiagnostics.value.filter(diagnostic => diagnostic.severity === "warning"),
))

const lastSpreadsheetOperationLabel = computed(() => {
  if (!lastSpreadsheetOperation.value) {
    return "No measured recalcs"
  }
  return lastSpreadsheetOperation.value.label
})

const lastSpreadsheetOperationDurationLabel = computed(() => {
  if (!lastSpreadsheetOperation.value) {
    return "Waiting for an edit"
  }
  const durationMs = lastSpreadsheetOperation.value.durationMs
  return `${durationMs < 10 ? durationMs.toFixed(2) : durationMs.toFixed(1)} ms`
})

const activeFormulaSummary = computed(() => {
  const analysis = editorSnapshot.value.analysis
  const referenceCount = analysis.references.length
  const crossSheetReferenceCount = analysis.references.filter(reference => (
    typeof reference.sheetReference === "string" && reference.sheetReference.trim().length > 0
  )).length
  const diagnosticCount = analysis.diagnostics.length
  return {
    kindLabel: analysis.kind === "formula" ? "formula" : analysis.kind,
    validityLabel: analysis.kind !== "formula"
      ? "not a formula"
      : analysis.isFormulaValid
        ? "valid"
        : "invalid",
    referenceCount,
    crossSheetReferenceCount,
    diagnosticCount,
    cellLabel: activeCellBadge.value,
  }
})

const activeFormulaReferenceItems = computed<readonly string[]>(() => {
  return Object.freeze(editorSnapshot.value.analysis.references.slice(0, 8).map(reference => {
    const scope = reference.sheetReference ? `${reference.sheetReference}!` : ""
    const columnLabel = reference.rangeReferenceName
      ? `${reference.referenceName}:${reference.rangeReferenceName}`
      : reference.referenceName
    const rows = reference.targetRowIndexes.length > 0
      ? reference.targetRowIndexes.map(rowIndex => `r${rowIndex + 1}`).join(", ")
      : "out of range"
    return `${scope}${columnLabel} -> ${rows}`
  }))
})

const activeFormulaDiagnosticItems = computed<readonly string[]>(() => {
  const items = editorSnapshot.value.analysis.diagnostics.map(diagnostic => diagnostic.message).filter(Boolean)
  if (
    items.length === 0
    && activeCellSnapshot.value?.errorValue
    && typeof (activeCellSnapshot.value.errorValue as { message?: unknown }).message === "string"
  ) {
    return Object.freeze([(activeCellSnapshot.value.errorValue as { message: string }).message])
  }
  return Object.freeze(items.slice(0, 6))
})

const workbookDiagnosticItems = computed<readonly string[]>(() => {
  return Object.freeze(workbookDiagnostics.value.slice(0, 6).map(diagnostic => {
    const scope = diagnostic.relatedSheetId
      ? `${diagnostic.sheetId} -> ${diagnostic.relatedSheetId}`
      : diagnostic.sheetId
    return `${scope}: ${diagnostic.message}`
  }))
})

const selectedRangeLabel = computed(() => {
  const snapshot = selectionSnapshot.value
  if (!snapshot || snapshot.ranges.length === 0) {
    return "No selection"
  }
  const range = snapshot.ranges[snapshot.activeRangeIndex] ?? snapshot.ranges[0]
  if (!range) {
    return "No selection"
  }
  const rowSpan = Math.abs(range.endRow - range.startRow) + 1
  const columnSpan = Math.abs(range.endCol - range.startCol) + 1
  return `${rowSpan} row${rowSpan === 1 ? "" : "s"} × ${columnSpan} column${columnSpan === 1 ? "" : "s"}`
})

const formulaSelectionSummary = computed(() => {
  if (isFormulaReferenceMode.value && activeFormulaReference.value) {
    return `Replacing ${activeFormulaReference.value.text}`
  }
  if (isFormulaReferenceMode.value) {
    return "Caret ready for a cell reference"
  }
  return selectedRangeLabel.value
})

const selectionHintMessage = computed(() => {
  if (activeSheetReadOnly.value) {
    return `This sheet is derived from ${activeSheetViewSourceLabel.value} and cannot be edited here.`
  }
  if (isFormulaReferenceMode.value) {
    return formulaModeHint.value
  }
  return "Grid selection drives styling, fill, copy, and active-cell focus. Start a formula to turn cell clicks into reference picking."
})

watch(
  () => [
    workbookRevision.value,
    workbookSnapshot.value.activeSheetId,
    totalRows.value,
    visibleColumns.value.map(column => column.key).join("|"),
  ].join("::"),
  () => {
    const currentSheet = activeSheetHandle.value
    if (!currentSheet || totalRows.value <= 0 || visibleColumns.value.length === 0) {
      return
    }
    const currentEditorCell = editorSnapshot.value.activeCell
    const shouldPreserveCrossSheetEditorCell = currentEditorCell
      && currentEditorCell.sheetId !== currentSheet.id
      && editorSnapshot.value.analysis.kind === "formula"
      && (isFormulaBarFocused.value || pendingFormulaEditHistory.value != null)
    const nextCell = shouldPreserveCrossSheetEditorCell
      ? currentEditorCell
      : currentEditorCell
        && currentEditorCell.sheetId === currentSheet.id
        && resolveVisualRowIndexForCell(currentEditorCell) != null
        && visibleColumnIndexByKey.value.has(currentEditorCell.columnKey)
        ? currentEditorCell
        : resolveFirstVisibleCellAddress(
            visibleColumns.value[0]?.key ?? activeSheetView.value.columns[0]?.key ?? "",
          )
    if (!nextCell || !nextCell.columnKey) {
      return
    }
    openEditorCell(nextCell)
    if (hasExpandedGridSelection()) {
      return
    }
    void nextTick(() => {
      restoreEditorCellSelection()
    })
  },
  { immediate: true },
)

watch(
  () => makeScopedCellKey(resolveSelectedGridCell()),
  () => {
    const nextCell = resolveSelectedGridCell()
    if (!nextCell) {
      return
    }
    const nextCellKey = makeScopedCellKey(nextCell)
    if (suppressNextSelectionSyncForCellKey) {
      const shouldSuppress = suppressNextSelectionSyncForCellKey === nextCellKey
      suppressNextSelectionSyncForCellKey = null
      if (shouldSuppress) {
        return
      }
    }
    if (hasExpandedGridSelection()) {
      return
    }
    if (
      editorSnapshot.value.analysis.kind === "formula"
      && editorSnapshot.value.activeCell
      && (isFormulaReferenceMode.value || pendingFormulaEditHistory.value != null)
      && !areCellsEqual(nextCell, editorSnapshot.value.activeCell)
    ) {
      insertReferenceFromCell(nextCell)
      scheduleEditorCellSelectionRestore({ refocusFormula: true })
      return
    }
    if (!areCellsEqual(nextCell, editorSnapshot.value.activeCell)) {
      openEditorCell(nextCell)
    }
  },
)

watch(workbookRevision, () => {
  syncEditorCellDisplay()
})

function moveCaretToReference(referenceKey: string): void {
  const reference = editorSnapshot.value.analysis.references.find(entry => entry.key === referenceKey)
  if (!reference) {
    return
  }
  activeHoveredFormulaReferencePreview = null
  clearHoveredFormulaReferencePreviewTimer()
  editorModel.setSelection({
    start: reference.span.start,
    end: reference.span.end,
  })
  focusFormulaBar({
    start: reference.span.start,
    end: reference.span.end,
  })
  revealFormulaReferenceTarget(reference)
}

function setHoveredFormulaReferenceKey(referenceKey: string | null | undefined): void {
  const nextKey = typeof referenceKey === "string" && referenceKey.length > 0
    ? referenceKey
    : null
  hoveredFormulaReferenceKey.value = nextKey
  if (!nextKey) {
    restoreHoveredFormulaReferencePreview()
    return
  }
  const reference = editorSnapshot.value.analysis.references.find(entry => entry.key === nextKey)
  if (!reference || typeof window === "undefined") {
    return
  }
  if (activeHoveredFormulaReferencePreview && activeHoveredFormulaReferencePreview.referenceKey !== nextKey) {
    restoreHoveredFormulaReferencePreview()
  }
  scheduleHoveredFormulaReferencePreview(reference)
}

function clearHoveredFormulaReferenceKey(): void {
  hoveredFormulaReferenceKey.value = null
  restoreHoveredFormulaReferencePreview()
}
</script>

<style scoped>
.spreadsheet-card {
  --spreadsheet-panel-bg: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.88));
  --spreadsheet-border: rgba(148, 163, 184, 0.25);
  --spreadsheet-ink-soft: rgba(71, 85, 105, 0.92);
  --spreadsheet-accent: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94));
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.08);
}

.card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.spreadsheet-card__title-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spreadsheet-card__title-copy h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
}

.spreadsheet-card__subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.mode-badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--spreadsheet-accent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.card__footer {
  font-size: 12px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-card__header {
  gap: 10px;
}

.spreadsheet-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.spreadsheet-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--datagrid-text-color);
  cursor: pointer;
}

.spreadsheet-tab--active {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(37, 99, 235, 0.9));
  border-color: rgba(37, 99, 235, 0.55);
  color: #f8fafc;
}

.spreadsheet-tab--readonly {
  border-style: dashed;
}

.spreadsheet-tab--reference-target {
  font-weight: 700;
}

.spreadsheet-tab__name {
  font-weight: 600;
}

.spreadsheet-tab__meta {
  font-size: 11px;
  opacity: 0.72;
}

.spreadsheet-style-actions,
.spreadsheet-history-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-action {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--datagrid-text-color);
  cursor: pointer;
}

.spreadsheet-action--subtle {
  background: rgba(255, 255, 255, 0.86);
}

.spreadsheet-action--primary {
  border-color: rgba(37, 99, 235, 0.36);
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(37, 99, 235, 0.92));
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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.9));
}

.spreadsheet-formula-shell--focused {
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.28);
}

.spreadsheet-formula-shell--reference-mode {
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18), 0 18px 38px rgba(37, 99, 235, 0.08);
}

.spreadsheet-formula-shell--readonly {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.96));
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
  background: rgba(15, 23, 42, 0.06);
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
  background: rgba(37, 99, 235, 0.1);
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
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.9));
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
  background: rgba(255, 255, 255, 0.84);
  color: var(--datagrid-text-color);
  font: 500 13px/1.5 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.spreadsheet-formula-input[readonly] {
  background: rgba(248, 250, 252, 0.9);
  color: var(--spreadsheet-ink-soft);
  cursor: default;
}

.spreadsheet-formula-preview {
  min-height: 24px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
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
  --ui-menu-bg: rgba(255, 255, 255, 0.98);
  --ui-menu-border: color-mix(in srgb, var(--spreadsheet-border) 82%, rgba(37, 99, 235, 0.18));
  --ui-menu-hover-bg: rgba(37, 99, 235, 0.08);
  --ui-menu-text: var(--datagrid-text-color);
  --ui-menu-muted: var(--spreadsheet-ink-soft);
  --ui-menu-focus-ring: 0 0 0 2px rgba(37, 99, 235, 0.16);
  --ui-menu-shadow: 0 22px 48px rgba(15, 23, 42, 0.16);
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
  background: rgba(37, 99, 235, 0.08);
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
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.4;
}

.spreadsheet-layout {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  align-items: stretch;
}

.spreadsheet-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding-right: 4px;
}

.spreadsheet-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 16px;
  background: var(--spreadsheet-panel-bg);
}

.spreadsheet-panel h3 {
  margin: 0;
  font-size: 13px;
}

.spreadsheet-panel p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-reference-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.spreadsheet-reference-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font: 500 12px/1 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
}

.spreadsheet-reference-chip--active {
  box-shadow: 0 0 0 1px currentColor;
}

.spreadsheet-empty-state,
.spreadsheet-selection-summary,
.spreadsheet-selection-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-diagnostic-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.spreadsheet-diagnostic-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-diagnostic-metric strong {
  color: var(--spreadsheet-accent);
  font-size: 14px;
}

.spreadsheet-diagnostic-metric small {
  font-size: 11px;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-diagnostic-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spreadsheet-diagnostic-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-diagnostic-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.spreadsheet-diagnostic-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  font: 500 12px/1.2 ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  color: var(--spreadsheet-accent);
}

.spreadsheet-diagnostic-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spreadsheet-diagnostic-list__item {
  padding: 8px 10px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  font-size: 12px;
  line-height: 1.45;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-grid-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  min-height: 0;
}

.spreadsheet-grid-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.spreadsheet-grid-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
}

.spreadsheet-formula-reference-overlay {
  position: absolute;
  border: 2px solid;
  border-radius: 4px;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 3;
}

.spreadsheet-formula-reference-overlay--dragging {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.86), 0 10px 24px rgba(15, 23, 42, 0.16);
}

.spreadsheet-formula-reference-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: 2px;
  background: #fff;
  color: inherit;
  pointer-events: auto;
  cursor: grab;
}

.spreadsheet-formula-reference-overlay--dragging .spreadsheet-formula-reference-handle {
  cursor: grabbing;
}

.spreadsheet-formula-reference-handle--top-left {
  top: -5px;
  left: -5px;
}

.spreadsheet-formula-reference-handle--top-right {
  top: -5px;
  right: -5px;
}

.spreadsheet-formula-reference-handle--bottom-right {
  right: -5px;
  bottom: -5px;
}

.spreadsheet-formula-reference-handle--bottom-left {
  left: -5px;
  bottom: -5px;
}

.spreadsheet-diagnostics-drawer {
  position: absolute;
  top: 14px;
  right: 14px;
  bottom: 14px;
  width: min(360px, calc(100vw - 56px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(10px);
  overflow: auto;
  transform: translateX(calc(100% + 24px));
  opacity: 0;
  pointer-events: none;
  transition: transform 160ms ease, opacity 160ms ease;
  z-index: 4;
}

.spreadsheet-diagnostics-drawer--open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.spreadsheet-diagnostics-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.spreadsheet-diagnostics-drawer__header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  color: var(--spreadsheet-accent);
}

.spreadsheet-diagnostics-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.spreadsheet-grid-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 16px;
  background: var(--spreadsheet-panel-bg);
}

.spreadsheet-grid-actions__copy {
  font-size: 12px;
  line-height: 1.5;
  color: var(--spreadsheet-ink-soft);
}

.spreadsheet-grid-host {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--spreadsheet-border);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
}

.spreadsheet-cell--formula {
  font-weight: 600;
}

.spreadsheet-cell--error {
  text-decoration: underline wavy rgba(220, 38, 38, 0.72);
  text-underline-offset: 3px;
}

.spreadsheet-cell--reference {
  transition: box-shadow 120ms ease, background-color 120ms ease;
}

.spreadsheet-cell--reference-active {
  font-weight: 700;
}

:deep(.spreadsheet-grid-host .col-filter) {
  display: none;
}

:deep(.spreadsheet-grid-host .sort-indicator) {
  opacity: 0.24;
}

:deep(.spreadsheet-grid-host .grid-cell--header) {
  min-height: 40px;
  background: rgba(248, 250, 252, 0.95);
}

:deep(.spreadsheet-grid-host .grid-cell) {
  font-size: 12px;
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

  .spreadsheet-layout {
    grid-template-columns: 1fr;
  }

  .spreadsheet-sidebar {
    order: 2;
  }

  .spreadsheet-grid-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .spreadsheet-diagnostics-drawer {
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
  }
}
</style>
