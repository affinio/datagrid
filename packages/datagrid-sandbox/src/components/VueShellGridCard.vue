<template>
  <article class="card">
    <header class="card__header">
      <div class="card__title-row">
        <h2>{{ title }}</h2>
        <div class="mode-badge">{{ modeBadge }}</div>
      </div>
      <div class="controls">
        <label>
          Rows
          <select v-model.number="rowCount">
            <option
              v-for="option in ROW_MODE_OPTIONS"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>
        <label>
          Cols
          <select v-model.number="columnCount">
            <option
              v-for="option in COLUMN_MODE_OPTIONS"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>
        <label>
          Theme
          <select v-model="themePreset">
            <option value="default">Default</option>
            <option value="industrial">Industrial</option>
            <option value="sugar">Sugar</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          Group by
          <select v-model="groupByField">
            <option value="">None</option>
            <option
              v-for="column in columns"
              :key="`group-by-${column.key}`"
              :value="column.key"
            >
              {{ column.label ?? column.key }}
            </option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          Row mode
          <select v-model="rowHeightMode">
            <option value="fixed">Fixed</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          Render
          <select v-model="rowRenderMode">
            <option value="virtualization">Virtualization</option>
            <option value="pagination">Pagination</option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          View
          <select v-model="viewMode">
            <option value="table">Table</option>
            <option value="gantt">Gantt</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && viewMode === 'gantt'">
          Zoom
          <select v-model="ganttZoomLevel">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && rowRenderMode === 'pagination'">
          Page size
          <select v-model.number="paginationPageSize">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && rowRenderMode === 'pagination'">
          Page
          <input
            v-model.number="paginationPage"
            type="number"
            min="1"
            step="1"
          />
        </label>
        <label v-if="props.mode === 'base'">
          Row size
          <input
            v-model.number="baseRowHeight"
            type="number"
            min="24"
            max="120"
            step="1"
          />
        </label>
        <label>
          <input v-model="rowHover" type="checkbox" />
          Row hover
        </label>
        <label>
          <input v-model="stripedRows" type="checkbox" />
          Striped rows
        </label>
        <label v-if="props.mode === 'pivot'">
          Pivot view
          <select v-model="pivotViewMode">
            <option value="pivot">Pivot</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label v-if="props.mode === 'pivot' && pivotViewMode === 'pivot'">
          Pivot layout
          <select v-model="pivotLayout">
            <option value="department-month-revenue">
              Department × Month (Revenue Σ)
            </option>
            <option value="channel-status-deals">
              Channel × Status (Deals Σ)
            </option>
            <option value="month-channel-margin">
              Month × Channel (Margin Avg)
            </option>
          </select>
        </label>
        <label v-if="props.mode === 'pivot' && pivotViewMode === 'pivot'">
          <input v-model="hideUnusedPivotSourceColumns" type="checkbox" />
          Hide unused source columns
        </label>
        <div
          v-if="props.mode === 'tree' || props.mode === 'pivot' || (props.mode === 'base' && groupByField)"
          class="group-actions"
        >
          <button type="button" @click="expandAllGroups">Expand all</button>
          <button type="button" @click="collapseAllGroups">Collapse all</button>
        </div>
      </div>
      <StatePanel
        :is-open="isStatePanelOpen"
        :import-text="stateImportText"
        :output-text="stateOutputText"
        @open="isStatePanelOpen = true"
        @close="isStatePanelOpen = false"
        @export-state="exportStatePayload"
        @migrate-state="migrateStatePayload"
        @apply-state="applyStatePayload"
        @update-import="stateImportText = $event"
      />
      <PivotAdvancedPanel
        v-if="props.mode === 'pivot'"
        :is-open="isPivotAdvancedPanelOpen"
        :import-text="pivotAdvancedImportText"
        :output-text="pivotAdvancedOutputText"
        @open="isPivotAdvancedPanelOpen = true"
        @close="isPivotAdvancedPanelOpen = false"
        @export-layout="exportPivotLayout"
        @export-interop="exportPivotInterop"
        @update-import="pivotAdvancedImportText = $event"
        @import-layout="importPivotLayout"
        @clear-import="pivotAdvancedImportText = ''"
      />
      <div class="meta">
        <span>Rows: {{ rows.length }}</span>
        <span>Columns: {{ columns.length }}</span>
        <span>{{ modeHint }}</span>
      </div>
      <div
        v-if="props.ganttShowcase && viewMode === 'gantt'"
        class="gantt-legend"
      >
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--bar" />
          Actual task
        </span>
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--baseline" />
          Baseline plan
        </span>
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--critical" />
          Critical task
        </span>
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--variance" />
          Variance marker
        </span>
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--today" />
          Today
        </span>
        <span class="gantt-legend__item">
          <span class="gantt-legend__swatch gantt-legend__swatch--summary" />
          Summary bar
        </span>
      </div>
    </header>

    <section class="grid-host">
      <DataGrid
        ref="gridRef"
        :rows="rows"
        :columns="columns"
        license-key="affino-dg-v1:enterprise:sandbox-demo:2099-12-31:all:0HTTHMS"
        column-menu
        column-layout
        diagnostics
        advanced-filter
        aggregations
        :client-row-model-options="clientRowModelOptions"
        :group-by="groupBy"
        :pivot-model="pivotModel"
        :pagination="pagination"
        :page-size="paginationPageSize"
        :current-page="Math.max(0, paginationPage - 1)"
        :column-state="effectiveColumnState"
        :view-mode="viewMode"
        :gantt="ganttOptions"
        :theme="theme"
        :virtualization="virtualization"
        :row-height-mode="rowHeightMode"
        :base-row-height="baseRowHeight"
        :row-hover="rowHover"
        :striped-rows="stripedRows"
        @cell-change="syncSelectionAggregatesLabel"
        @selection-change="syncSelectionAggregatesLabel"
        @update:column-state="handleColumnStateUpdate"
        @update:view-mode="handleViewModeUpdate"
        @update:state="handleStateUpdate"
      />
    </section>

    <footer class="card__footer">
      Enterprise app package demo:
      <code>import { DataGrid } from "@affino/datagrid-vue-app-enterprise"</code>
      <span v-if="selectionAggregatesLabel">
        {{ selectionAggregatesLabel }}</span
      >
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  DataGrid,
  type DataGridAppViewMode,
  type DataGridGanttOptions,
  type DataGridGanttZoomLevel,
} from "@affino/datagrid-vue-app-enterprise";
import {
  industrialNeutralTheme,
  sugarTheme,
  type DataGridStyleConfig,
} from "@affino/datagrid-theme";
import type {
  DataGridColumnInput,
  DataGridColumnPin,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
  DataGridSelectionSummarySnapshot,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
} from "@affino/datagrid-vue";
import {
  buildVueColumns,
  buildVueRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  type VueTreeRow,
} from "../sandboxData";
import PivotAdvancedPanel from "./PivotAdvancedPanel.vue";
import StatePanel from "./StatePanel.vue";

type Mode = "base" | "tree" | "pivot";
type PivotLayoutId =
  | "department-month-revenue"
  | "channel-status-deals"
  | "month-channel-margin";
type PivotViewMode = "pivot" | "table";

interface PublicDataGridExpose {
  getApi: () => unknown | null;
  getColumnState: () => DataGridUnifiedColumnState | null;
  getSelectionAggregatesLabel: () => string;
  getSelectionSummary: () => DataGridSelectionSummarySnapshot | null;
  getView: () => DataGridAppViewMode | null;
  setView: (mode: DataGridAppViewMode) => void;
  applyColumnState: (columnState: DataGridUnifiedColumnState) => boolean;
  getState: () => DataGridUnifiedState<unknown> | null;
  migrateState: (
    state: unknown,
    options?: unknown,
  ) => DataGridUnifiedState<unknown> | null;
  applyState: (
    state: DataGridUnifiedState<unknown>,
    options?: unknown,
  ) => boolean;
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<unknown> | null;
  exportPivotInterop: () => DataGridPivotInteropSnapshot<unknown> | null;
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<unknown>,
    options?: DataGridPivotLayoutImportOptions,
  ) => boolean;
  expandAllGroups: () => void;
  collapseAllGroups: () => void;
}

type ThemePreset = "default" | "industrial" | "sugar" | "custom";

const props = defineProps<{
  title: string;
  mode: Mode;
  initialViewMode?: DataGridAppViewMode;
  ganttShowcase?: boolean;
}>();

const PIVOT_LAYOUTS: Record<PivotLayoutId, DataGridPivotSpec> = {
  "department-month-revenue": {
    rows: ["department"],
    columns: ["month"],
    values: [{ field: "amount", agg: "sum" }],
  },
  "channel-status-deals": {
    rows: ["channel"],
    columns: ["status"],
    values: [{ field: "deals", agg: "sum" }],
  },
  "month-channel-margin": {
    rows: ["month"],
    columns: ["channel"],
    values: [{ field: "marginPct", agg: "avg" }],
  },
};

function serializePretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function buildBaseColumnState(
  columns: readonly DataGridColumnInput[],
): DataGridUnifiedColumnState {
  const visibility: Record<string, boolean> = {};
  const widths: Record<string, number | null> = {};
  const pins: Record<string, DataGridColumnPin> = {};

  for (const column of columns) {
    visibility[column.key] = column.initialState?.visible !== false;
    widths[column.key] =
      typeof column.initialState?.width === "number"
        ? column.initialState.width
        : null;
    pins[column.key] = column.initialState?.pin ?? "none";
  }

  return {
    order: columns.map((column) => column.key),
    visibility,
    widths,
    pins,
  };
}

function normalizeColumnState(
  state: DataGridUnifiedColumnState | null | undefined,
  columns: readonly DataGridColumnInput[],
): DataGridUnifiedColumnState {
  const source = buildBaseColumnState(columns);
  const base = {
    order: [...source.order],
    visibility: { ...source.visibility },
    widths: { ...source.widths },
    pins: { ...source.pins },
  };
  if (!state) {
    return base;
  }

  const knownKeys = new Set(base.order);
  const nextOrder = [
    ...state.order.filter((key) => knownKeys.has(key)),
    ...base.order.filter((key) => !state.order.includes(key)),
  ];

  for (const key of base.order) {
    if (state.visibility[key] !== undefined) {
      base.visibility[key] = state.visibility[key] ?? true;
    }
    if (state.widths[key] !== undefined) {
      base.widths[key] = state.widths[key] ?? null;
    }
    if (state.pins[key] !== undefined) {
      base.pins[key] = state.pins[key] ?? "none";
    }
  }

  base.order = nextOrder;
  return base;
}

const rowCount = ref<number>(10000);
const columnCount = ref<number>(16);
const themePreset = ref<ThemePreset>("sugar");
const groupByField = ref("");
const rowHeightMode = ref<"fixed" | "auto">("fixed");
const rowRenderMode = ref<"virtualization" | "pagination">("virtualization");
const paginationPageSize = ref(100);
const paginationPage = ref(1);
const viewMode = ref<DataGridAppViewMode>("table");
const ganttZoomLevel = ref<DataGridGanttZoomLevel>("week");
const baseRowHeight = ref(31);
const rowHover = ref(true);
const stripedRows = ref(true);
const pivotViewMode = ref<PivotViewMode>("pivot");
const pivotLayout = ref<PivotLayoutId>("department-month-revenue");
const hideUnusedPivotSourceColumns = ref(true);
const gridRef = ref<PublicDataGridExpose | null>(null);

const modeBadge = computed(() => {
  return props.mode === "tree"
    ? "Sugar / Tree"
    : props.mode === "pivot"
      ? "Sugar / Pivot"
      : viewMode.value === "gantt"
        ? "Sugar / Base + Gantt"
        : "Sugar / Base";
});

const modeHint = computed(() => {
  return props.mode === "tree"
    ? "Public component with tree-data row model options."
    : props.mode === "pivot"
      ? "Public component with declarative pivot model."
      : viewMode.value === "gantt"
        ? props.ganttShowcase
          ? "Enterprise gantt showcase over the same row model: baseline, typed predecessors, summaries and computed critical path."
          : "Public component in split grid plus timeline mode over the same visible rows."
        : "Public component with declarative rows, columns and view state.";
});

const isStatePanelOpen = ref(false);
const stateImportText = ref("");
const stateOutputText = ref("");
const isPivotAdvancedPanelOpen = ref(false);
const pivotAdvancedImportText = ref("");
const pivotAdvancedOutputText = ref("");
const columnState = ref<DataGridUnifiedColumnState | null>(null);
const stateModel = ref<DataGridUnifiedState<unknown> | null>(null);
const selectionAggregatesLabel = ref("");

const rows = computed(() =>
  buildVueRows(props.mode, rowCount.value, columnCount.value),
);
const columns = computed(() => buildVueColumns(props.mode, columnCount.value));
const groupBy = computed(() => {
  if (props.mode !== "base" || !groupByField.value.trim()) {
    return null;
  }
  return groupByField.value.trim();
});
const pivotModel = computed(() => {
  return props.mode === "pivot" && pivotViewMode.value === "pivot"
    ? (PIVOT_LAYOUTS[pivotLayout.value] ?? null)
    : null;
});
const pagination = computed<boolean>(() => {
  return props.mode === "base" && rowRenderMode.value === "pagination";
});
const clientRowModelOptions = computed(() => {
  if (props.mode !== "tree") {
    return undefined;
  }
  return {
    initialTreeData: {
      mode: "path" as const,
      getDataPath: (row: unknown) => (row as VueTreeRow).path,
      expandedByDefault: true,
      filterMode: "include-descendants" as const,
    },
  };
});
const ganttOptions = computed<DataGridGanttOptions | undefined>(() => {
  if (props.mode !== "base") {
    return undefined;
  }
  return {
    idKey: "id",
    labelKey: "name",
    startKey: "start",
    endKey: "end",
    baselineStartKey: "baselineStart",
    baselineEndKey: "baselineEnd",
    progressKey: "progress",
    dependencyKey: "dependencies",
    criticalKey: "critical",
    computedCriticalPath: true,
    zoomLevel: ganttZoomLevel.value,
    paneWidth: props.ganttShowcase ? 760 : 720,
    rangePaddingDays: props.ganttShowcase ? 2 : 0,
    workingCalendar: props.ganttShowcase
      ? {
          workingWeekdays: [1, 2, 3, 4, 5],
          holidays: ["2026-05-25T00:00:00.000Z"],
        }
      : undefined,
    rowBarHeight: Math.max(12, Math.min(baseRowHeight.value - 10, 22)),
  };
});
const virtualization = computed(() => {
  return {
    rows: props.mode !== "base" || rowRenderMode.value !== "pagination",
    columns: true,
    rowOverscan: 8,
    columnOverscan: 2,
  };
});
const theme = computed<DataGridStyleConfig | "default">(() => {
  if (themePreset.value === "industrial") {
    return industrialNeutralTheme;
  }
  if (themePreset.value === "sugar") {
    return sugarTheme;
  }
  if (themePreset.value === "custom") {
    return {
      inheritThemeFromDocument: false,
      tokens: {
        gridFontFamily: '"Azeret Mono", "IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
        gridFontSize: "0.81rem",
        gridTextColor: "#5f240f",
        gridTextPrimary: "#3b1107",
        gridTextMuted: "rgba(76, 23, 10, 0.82)",
        gridTextSoft: "rgba(95, 36, 15, 0.72)",
        gridGlassBorder: "rgba(194, 65, 12, 0.24)",
        gridAccentStrong: "#ea580c",
        gridBackgroundColor: "#fff2e8",
        gridViewportBackground: "#fff7f1",
        gridControlsBackground: "rgba(255, 237, 213, 0.88)",
        gridControlsInputBackground: "#fff8f3",
        gridControlsSurfaceBackground: "#fff6ef",
        gridHeaderRowBackgroundColor: "#fed7aa",
        gridHeaderCellBackgroundColor: "#fdba74",
        gridHeaderCellHoverBackgroundColor: "#fb923c",
        headerBackgroundColor: "#fdba74",
        headerTextColor: "#5f1d0f",
        headerSelectedTextColor: "#3b1107",
        headerSystemTextColor: "#5f1d0f",
        headerPaddingX: "0.92rem",
        headerPaddingY: "0.44rem",
        bodyRowBackgroundColor: "#fffaf6",
        bodyRowTextColor: "#5f240f",
        bodyRowHoverBackgroundColor: "#ffedd5",
        bodyRowSelectedBackgroundColor: "#fed7aa",
        bodyRowSelectedTextColor: "#3b1107",
        selectionCellTextColor: "#3b1107",
        indexCellBackgroundColor: "#fff1e6",
        indexCellTextColor: "#7c2d12",
        bodyCellBorderColor: "rgba(251, 146, 60, 0.28)",
        rowDividerColor: "rgba(249, 115, 22, 0.20)",
        columnDividerColor: "rgba(249, 115, 22, 0.22)",
        headerDividerColor: "rgba(194, 65, 12, 0.24)",
        groupRowBackgroundColor: "#ffedd5",
        groupRowTextColor: "#7c2d12",
        summaryRowBackgroundColor: "#fff1e6",
        summaryRowTextColor: "#5f240f",
        summaryLabelTextColor: "#7c2d12",
        pinnedLeftBackgroundColor: "#fff1e6",
        pinnedRightBackgroundColor: "#fff1e6",
        pinnedBackgroundColor: "#fff1e6",
        pinnedLeftShadow: "inset -1px 0 0 rgba(194, 65, 12, 0.18)",
        pinnedRightShadow: "inset 1px 0 0 rgba(194, 65, 12, 0.18)",
        gridEditorBackgroundColor: "#fff8f3",
        gridEditorBorderColor: "rgba(234, 88, 12, 0.34)",
        gridEditorFocusBorderColor: "rgba(234, 88, 12, 0.72)",
        gridEditorFocusRingColor: "rgba(249, 115, 22, 0.18)",
        gridFilterTriggerBorderColor: "rgba(234, 88, 12, 0.28)",
        gridFilterTriggerBackgroundColor: "#fff4ec",
        gridFilterTriggerHoverBorderColor: "rgba(234, 88, 12, 0.62)",
        gridFilterTriggerHoverTextColor: "#7c2d12",
        gridFilterTriggerActiveBorderColor: "rgba(194, 65, 12, 0.72)",
        gridFilterTriggerActiveBackgroundColor: "#fed7aa",
        gridFilterTriggerActiveTextColor: "#5f1d0f",
        gridSelectionRangeBackgroundColor: "rgba(249, 115, 22, 0.16)",
        gridSelectionFillPreviewBackgroundColor: "rgba(249, 115, 22, 0.12)",
        gridSelectionMovePreviewBackgroundColor: "rgba(234, 88, 12, 0.12)",
        gridSelectionAnchorBackgroundColor: "rgba(251, 146, 60, 0.18)",
        gridSelectionActiveBorderColor: "#ea580c",
        gridSelectionHandleBackgroundColor: "#f97316",
        gridSelectionHandleBorderColor: "#c2410c",
        gridSortIndicatorColor: "#9a3412",
        gridNumericTextColor: "#9a3412",
        gridEditableHoverBackgroundColor: "#fff0e3",
        gridStickyBackgroundColor: "#fff1e6",
        gridStickyShadowColor: "rgba(124, 45, 18, 0.14)",
        gridHeaderStickyBackgroundColor: "#fed7aa",
        gridColumnMenuBackgroundColor: "#fff8f3",
        gridColumnMenuBorderColor: "rgba(194, 65, 12, 0.24)",
        gridColumnMenuShadowColor: "rgba(124, 45, 18, 0.14)",
        gridColumnMenuItemHoverBackgroundColor: "#ffedd5",
        gridColumnMenuMutedTextColor: "rgba(95, 36, 15, 0.78)",
        gridColumnMenuFocusRingColor: "rgba(249, 115, 22, 0.18)",
        gridColumnMenuSearchBorderColor: "rgba(234, 88, 12, 0.22)",
        gridColumnMenuSearchBackgroundColor: "#fffdfb",
      },
    };
  }
  return "default";
});

const effectiveColumnState = computed<DataGridUnifiedColumnState>(() => {
  const base = normalizeColumnState(columnState.value, columns.value);
  const pins: Record<string, DataGridColumnPin> = { ...base.pins };
  for (const key of Object.keys(pins)) {
    if (pins[key] === "left") {
      pins[key] = "none";
    }
  }
  const pinnedLeftKey =
    base.order.find((key) => key === "id") ??
    base.order.find((key) => key !== "updatedAt" && key !== "amount") ??
    null;
  if (pinnedLeftKey && pins[pinnedLeftKey] !== "left") {
    pins[pinnedLeftKey] = "left";
  }
  const pinnedRightKey =
    props.mode === "pivot"
      ? "amount"
      : props.mode === "tree"
        ? "amount"
        : "end";
  if (pins[pinnedRightKey] !== "right") {
    pins[pinnedRightKey] = "right";
  }
  if (
    props.mode !== "pivot" ||
    pivotViewMode.value !== "pivot" ||
    !hideUnusedPivotSourceColumns.value
  ) {
    return {
      order: [...base.order],
      visibility: { ...base.visibility },
      widths: { ...base.widths },
      pins,
    };
  }
  const order = [...base.order];
  const visibility: Record<string, boolean> = { ...base.visibility };
  const labelColumnKey =
    PIVOT_LAYOUTS[pivotLayout.value]?.rows[0] ??
    columns.value[0]?.key ??
    "name";
  for (const key of order) {
    visibility[key] = key === labelColumnKey;
  }
  return {
    order,
    visibility,
    widths: { ...base.widths },
    pins,
  };
});
const shouldHideUnusedPivotSourceColumns = computed(() => {
  return (
    props.mode === "pivot" &&
    pivotViewMode.value === "pivot" &&
    hideUnusedPivotSourceColumns.value
  );
});

watch(
  () => props.initialViewMode,
  (nextViewMode) => {
    viewMode.value = nextViewMode === "gantt" ? "gantt" : "table";
  },
  { immediate: true },
);

watch(
  () => props.ganttShowcase,
  (enabled) => {
    if (!enabled || props.mode !== "base") {
      return;
    }
    viewMode.value = "gantt";
    themePreset.value = "sugar";
    rowCount.value = 1000;
    columnCount.value = Math.max(columnCount.value, 16);
    groupByField.value = "region";
    ganttZoomLevel.value = "week";
    rowRenderMode.value = "virtualization";
    rowHeightMode.value = "fixed";
    baseRowHeight.value = 31;
    rowHover.value = true;
    stripedRows.value = true;
  },
  { immediate: true },
);

watch(
  [gridRef, groupByField, viewMode],
  async ([grid, groupField, mode]) => {
    if (!props.ganttShowcase || !grid || !groupField || mode !== "gantt") {
      return;
    }
    await nextTick();
    grid.expandAllGroups();
  },
  { immediate: true },
);

watch(
  columns,
  (nextColumns) => {
    columnState.value = normalizeColumnState(columnState.value, nextColumns);
    if (
      groupByField.value &&
      !nextColumns.some((column) => column.key === groupByField.value)
    ) {
      groupByField.value = "";
    }
    selectionAggregatesLabel.value = "";
  },
  { immediate: true },
);

const handleColumnStateUpdate = (
  nextState: DataGridUnifiedColumnState,
): void => {
  const normalizedNextState = normalizeColumnState(nextState, columns.value);
  if (!shouldHideUnusedPivotSourceColumns.value) {
    columnState.value = normalizedNextState;
    return;
  }
  const persistedState = normalizeColumnState(columnState.value, columns.value);
  columnState.value = {
    order: [...normalizedNextState.order],
    widths: { ...normalizedNextState.widths },
    pins: { ...normalizedNextState.pins },
    visibility: { ...persistedState.visibility },
  };
};

const handleStateUpdate = (nextState: DataGridUnifiedState<unknown>): void => {
  stateModel.value = nextState;
};

const handleViewModeUpdate = (nextViewMode: DataGridAppViewMode): void => {
  viewMode.value = nextViewMode === "gantt" ? "gantt" : "table";
};

const syncSelectionAggregatesLabel = (): void => {
  selectionAggregatesLabel.value =
    gridRef.value?.getSelectionAggregatesLabel() ?? "";
};

const exportStatePayload = (): void => {
  stateOutputText.value = serializePretty(
    gridRef.value?.getState() ?? stateModel.value,
  );
};

const migrateStatePayload = (): void => {
  const parsed = parseJson(stateImportText.value);
  if (!parsed) {
    return;
  }
  const migrated = gridRef.value?.migrateState(parsed) ?? null;
  if (!migrated) {
    return;
  }
  stateOutputText.value = serializePretty(migrated);
};

const applyStatePayload = (): void => {
  const parsed = parseJson(stateImportText.value);
  if (!parsed) {
    return;
  }
  const migrated = gridRef.value?.migrateState(parsed) ?? null;
  if (!migrated) {
    return;
  }
  if (gridRef.value?.applyState(migrated)) {
    stateModel.value = migrated;
    stateOutputText.value = serializePretty(migrated);
  }
};

const exportPivotLayout = (): void => {
  pivotAdvancedOutputText.value = serializePretty(
    gridRef.value?.exportPivotLayout() ?? null,
  );
};

const exportPivotInterop = (): void => {
  pivotAdvancedOutputText.value = serializePretty(
    gridRef.value?.exportPivotInterop() ?? null,
  );
};

const importPivotLayout = (): void => {
  const parsed = parseJson(pivotAdvancedImportText.value);
  if (!parsed) {
    return;
  }
  gridRef.value?.importPivotLayout(
    parsed as DataGridPivotLayoutSnapshot<unknown>,
  );
};

const expandAllGroups = (): void => {
  gridRef.value?.expandAllGroups();
};

const collapseAllGroups = (): void => {
  gridRef.value?.collapseAllGroups();
};
</script>

<style scoped>
.gantt-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
  align-items: center;
  margin-top: 0.75rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.gantt-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: rgba(15, 23, 42, 0.82);
}

.gantt-legend__swatch {
  display: inline-block;
  width: 24px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
}

.gantt-legend__swatch--bar {
  background: #2563eb;
}

.gantt-legend__swatch--baseline {
  background: rgba(100, 116, 139, 0.34);
  border: 1px solid rgba(71, 85, 105, 0.5);
}

.gantt-legend__swatch--critical {
  background: #2563eb;
  border: 2px solid #dc2626;
}

.gantt-legend__swatch--variance {
  height: 2px;
  border-radius: 0;
  background: rgba(220, 38, 38, 0.62);
  position: relative;
}

.gantt-legend__swatch--variance::before,
.gantt-legend__swatch--variance::after {
  content: "";
  position: absolute;
  top: -4px;
  width: 2px;
  height: 10px;
  background: rgba(220, 38, 38, 0.62);
}

.gantt-legend__swatch--variance::before {
  left: 0;
}

.gantt-legend__swatch--variance::after {
  right: 0;
}

.gantt-legend__swatch--today {
  width: 2px;
  height: 16px;
  border-radius: 0;
  background: #2563eb;
}

.gantt-legend__swatch--summary {
  background: rgba(37, 99, 235, 0.16);
  border: 2px solid rgba(37, 99, 235, 0.82);
}

.grid-host {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
</style>
