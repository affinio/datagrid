<template>
  <article class="card">
    <header class="card__header">
      <div class="card__title-row">
        <h2>{{ title }}</h2>
        <div class="mode-badge">{{ modeBadge }}</div>
      </div>
      <div class="controls">
        <label v-if="!props.timesheetShowcase">
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
        <label v-if="!props.timesheetShowcase">
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
          Row mode
          <select v-model="rowHeightMode">
            <option value="fixed">Fixed</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase">
          Render
          <select v-model="rowRenderMode">
            <option value="virtualization">Virtualization</option>
            <option value="pagination">Pagination</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase">
          View
          <select v-model="viewMode">
            <option value="table">Table</option>
            <option value="gantt">Gantt</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase">
          Menu demo
          <select v-model="columnMenuPreset">
            <option value="default">Default</option>
            <option value="compact">Compact</option>
            <option value="labels">Custom labels</option>
            <option value="locked">Disabled sections</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase && viewMode === 'gantt'">
          Zoom
          <select v-model="ganttZoomLevel">
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase && rowRenderMode === 'pagination'">
          Page size
          <select v-model.number="paginationPageSize">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && !props.timesheetShowcase && rowRenderMode === 'pagination'">
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
          v-if="!props.timesheetShowcase && (props.mode === 'tree' || props.mode === 'pivot' || (props.mode === 'base' && hasActiveGrouping))"
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
        :column-menu="columnMenu"
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
        :show-row-index="!props.timesheetShowcase"
        :row-selection="!props.timesheetShowcase"
        :is-cell-editable="timesheetIsCellEditable"
        @cell-change="handleGridCellChange"
        @selection-change="syncSelectionAggregatesLabel"
        @update:group-by="handleGroupByUpdate"
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
  type DataGridColumnMenuProp,
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
  DataGridGroupBySpec,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowNodeInput,
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

type TimesheetDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

interface TimesheetRow {
  id: string;
  project: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  total: number;
}

interface PublicDataGridExpose {
  getApi: () => unknown | null;
  getRuntime: () => unknown | null;
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

interface TimesheetGridApi {
  rows: {
    getCount: () => number;
    get: (index: number) => { rowId: DataGridRowId; data?: TimesheetRow } | undefined;
  };
}

interface TimesheetGridRuntimeHandle {
  resolveBodyRowIndexById: (rowId: string | number) => number;
}

type ThemePreset = "default" | "industrial" | "sugar" | "custom";
type ColumnMenuPreset = "default" | "compact" | "labels" | "locked";
type DeclarativeColumnMenuConfig = Exclude<DataGridColumnMenuProp, boolean | null>;

const COMPACT_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  items: ["sort", "group", "pin"],
  columns: {
    amount: {
      hide: ["group"],
    },
  },
};

const LABELLED_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  labels: {
    group: "Toggle grouping",
    pin: "Pinning",
    filter: "Quick filters",
  },
  columns: {
    region: {
      labels: {
        filter: "Region filters",
      },
    },
    amount: {
      labels: {
        pin: "Freeze amount",
      },
    },
  },
};

const LOCKED_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  disabled: ["pin"],
  columns: {
    amount: {
      hide: ["group"],
    },
    start: {
      disabled: ["filter"],
    },
    name: {
      labels: {
        group: "Group tasks",
      },
    },
  },
};

const props = defineProps<{
  title: string;
  mode: Mode;
  initialViewMode?: DataGridAppViewMode;
  ganttShowcase?: boolean;
  timesheetShowcase?: boolean;
}>();

const TIMESHEET_DAY_COLUMNS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const satisfies readonly { key: TimesheetDayKey; label: string }[];

const TIMESHEET_PROJECTS: readonly Omit<TimesheetRow, "total">[] = [
  {
    id: "proj-product-foundation",
    project: "Product foundation",
    monday: 6,
    tuesday: 7.5,
    wednesday: 6,
    thursday: 8,
    friday: 5.5,
    saturday: 0,
    sunday: 0,
  },
  {
    id: "proj-growth-experiments",
    project: "Growth experiments",
    monday: 2,
    tuesday: 1.5,
    wednesday: 3,
    thursday: 1,
    friday: 2.5,
    saturday: 0,
    sunday: 0,
  },
  {
    id: "proj-enterprise-rollout",
    project: "Enterprise rollout",
    monday: 4,
    tuesday: 4,
    wednesday: 5,
    thursday: 3.5,
    friday: 4,
    saturday: 0,
    sunday: 0,
  },
  {
    id: "proj-design-system",
    project: "Design system",
    monday: 1.5,
    tuesday: 2,
    wednesday: 2.5,
    thursday: 3,
    friday: 2,
    saturday: 0,
    sunday: 0,
  },
  {
    id: "proj-support-ops",
    project: "Support ops",
    monday: 2,
    tuesday: 1,
    wednesday: 1.5,
    thursday: 1.5,
    friday: 2,
    saturday: 1,
    sunday: 0,
  },
] as const;

function roundTimesheetHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function cloneTimesheetProjects(): readonly Omit<TimesheetRow, "total">[] {
  return TIMESHEET_PROJECTS.map(row => ({ ...row }));
}

function normalizeTimesheetHours(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return roundTimesheetHours(Math.min(24, Math.max(0, parsed)));
}

function sumTimesheetDays(row: Omit<TimesheetRow, "total">): number {
  return roundTimesheetHours(
    TIMESHEET_DAY_COLUMNS.reduce((sum, column) => sum + row[column.key], 0),
  );
}

function buildTimesheetColumns(): readonly DataGridColumnInput[] {
  return [
    {
      key: "project",
      label: "Project",
      initialState: { width: 240, pin: "left" },
      capabilities: { sortable: true, filterable: false },
    },
    ...TIMESHEET_DAY_COLUMNS.map(({ key, label }) => ({
      key,
      label,
      dataType: "number" as const,
      initialState: { width: 104 },
      presentation: { align: "right" as const, headerAlign: "right" as const },
      capabilities: { sortable: true, filterable: false, editable: true },
      constraints: { min: 0, max: 24, step: 0.5 },
    })),
    {
      key: "total",
      label: "Row total",
      dataType: "number" as const,
      initialState: { width: 128, pin: "right" },
      presentation: { align: "right" as const, headerAlign: "right" as const },
      capabilities: { sortable: true, filterable: false },
    },
  ] as const;
}

function buildTimesheetRows(
  projects: readonly Omit<TimesheetRow, "total">[],
): readonly DataGridRowNodeInput<TimesheetRow>[] {
  const projectRows = projects.map((row, index) => ({
    kind: "leaf" as const,
    rowId: row.id,
    rowKey: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    state: {
      selected: false,
      group: false,
      pinned: "none" as const,
      expanded: false,
    },
    data: {
      ...row,
      total: sumTimesheetDays(row),
    },
    row: {
      ...row,
      total: sumTimesheetDays(row),
    },
  }));

  const totalsByDay = TIMESHEET_DAY_COLUMNS.reduce<Record<TimesheetDayKey, number>>(
    (result, column) => {
      result[column.key] = roundTimesheetHours(
        projects.reduce((sum, row) => sum + row[column.key], 0),
      );
      return result;
    },
    {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    },
  );

  const totalRow: DataGridRowNodeInput<TimesheetRow> = {
    kind: "leaf",
    rowId: "timesheet-total",
    rowKey: "timesheet-total",
    sourceIndex: projectRows.length,
    originalIndex: projectRows.length,
    displayIndex: projectRows.length,
    state: {
      selected: false,
      group: false,
      pinned: "bottom",
      expanded: false,
    },
    data: {
      id: "timesheet-total",
      project: "Daily total",
      ...totalsByDay,
      total: roundTimesheetHours(
        Object.values(totalsByDay).reduce((sum, value) => sum + value, 0),
      ),
    },
    row: {
      id: "timesheet-total",
      project: "Daily total",
      ...totalsByDay,
      total: roundTimesheetHours(
        Object.values(totalsByDay).reduce((sum, value) => sum + value, 0),
      ),
    },
  };

  return [...projectRows, totalRow];
}

function createTimesheetColumnState(
  columns: readonly DataGridColumnInput[],
): DataGridUnifiedColumnState {
  const normalized = normalizeColumnState(null, columns);
  return {
    order: [...normalized.order],
    visibility: { ...normalized.visibility },
    widths: { ...normalized.widths },
    pins: {
      ...normalized.pins,
      project: "left",
      total: "right",
    },
  };
}

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

function applySandboxColumnOrder(
  state: DataGridUnifiedColumnState,
  preferredKeys: readonly string[],
): DataGridUnifiedColumnState {
  const knownKeys = new Set(state.order);
  const preferredOrder = preferredKeys.filter((key) => knownKeys.has(key));
  if (preferredOrder.length === 0) {
    return state;
  }
  return {
    order: [
      ...preferredOrder,
      ...state.order.filter((key) => !preferredOrder.includes(key)),
    ],
    visibility: { ...state.visibility },
    widths: { ...state.widths },
    pins: { ...state.pins },
  };
}

function createBaseShowcaseColumnState(
  columns: readonly DataGridColumnInput[],
  existingState: DataGridUnifiedColumnState | null | undefined,
): DataGridUnifiedColumnState {
  const normalized = normalizeColumnState(existingState, columns);
  const ordered = applySandboxColumnOrder(normalized, [
    "id",
    "name",
    "amount",
    "start",
    "end",
    "updatedAt",
    "region",
    "category",
    "status",
    "progress",
    "dependencies",
    "baselineStart",
    "baselineEnd",
    "critical",
  ]);
  return {
    order: [...ordered.order],
    visibility: {
      ...ordered.visibility,
      amount: true,
      start: true,
      end: true,
      updatedAt: true,
      progress: true,
      dependencies: true,
      baselineStart: true,
      baselineEnd: true,
      critical: true,
    },
    widths: { ...ordered.widths },
    pins: {
      ...ordered.pins,
      id: "left",
      name: "left",
      amount: "none",
      start: "none",
      end: "right",
    },
  };
}

const rowCount = ref<number>(10000);
const columnCount = ref<number>(16);
const timesheetProjects = ref<readonly Omit<TimesheetRow, "total">[]>(cloneTimesheetProjects());
const themePreset = ref<ThemePreset>("sugar");
const columnMenuPreset = ref<ColumnMenuPreset>("default");
const groupByModel = ref<DataGridGroupBySpec | null>(null);
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
  if (props.timesheetShowcase) {
    return "Sugar / Timesheet";
  }
  return props.mode === "tree"
    ? "Sugar / Tree"
    : props.mode === "pivot"
      ? "Sugar / Pivot"
      : viewMode.value === "gantt"
        ? "Sugar / Base + Gantt"
        : "Sugar / Base";
});

const modeHint = computed(() => {
  if (props.timesheetShowcase) {
    return "Simple declarative timesheet: projects by row, weekdays by column, pinned daily totals below and pinned row totals on the right.";
  }
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
  props.timesheetShowcase
    ? buildTimesheetRows(timesheetProjects.value)
    : buildVueRows(props.mode, rowCount.value, columnCount.value),
);
const columns = computed(() => (
  props.timesheetShowcase
    ? buildTimesheetColumns()
    : buildVueColumns(props.mode, columnCount.value)
));
const groupBy = computed(() => {
  if (props.timesheetShowcase || props.mode !== "base") {
    return null;
  }
  return groupByModel.value;
});
const hasActiveGrouping = computed(() => (groupBy.value?.fields.length ?? 0) > 0);
const pivotModel = computed(() => {
  return props.mode === "pivot" && pivotViewMode.value === "pivot"
    ? (PIVOT_LAYOUTS[pivotLayout.value] ?? null)
    : null;
});
const pagination = computed<boolean>(() => {
  return !props.timesheetShowcase && props.mode === "base" && rowRenderMode.value === "pagination";
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
  if (props.timesheetShowcase || props.mode !== "base") {
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
    rows: props.timesheetShowcase || props.mode !== "base" || rowRenderMode.value !== "pagination",
    columns: true,
    rowOverscan: 8,
    columnOverscan: 2,
  };
});
const columnMenu = computed<DataGridColumnMenuProp>(() => {
  if (props.timesheetShowcase || props.mode !== "base") {
    return true;
  }

  switch (columnMenuPreset.value) {
    case "compact":
      return COMPACT_COLUMN_MENU;
    case "labels":
      return LABELLED_COLUMN_MENU;
    case "locked":
      return LOCKED_COLUMN_MENU;
    default:
      return true;
  }
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
  if (props.timesheetShowcase) {
    return createTimesheetColumnState(columns.value);
  }
  const base = normalizeColumnState(columnState.value, columns.value);
  if (
    props.mode !== "pivot" ||
    pivotViewMode.value !== "pivot" ||
    !hideUnusedPivotSourceColumns.value
  ) {
    return {
      order: [...base.order],
      visibility: { ...base.visibility },
      widths: { ...base.widths },
      pins: { ...base.pins },
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
    pins: { ...base.pins },
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
    groupByModel.value = { fields: ["region"], expandedByDefault: true };
    ganttZoomLevel.value = "week";
    rowRenderMode.value = "virtualization";
    rowHeightMode.value = "fixed";
    baseRowHeight.value = 31;
    rowHover.value = true;
    stripedRows.value = true;
    columnState.value = createBaseShowcaseColumnState(columns.value, columnState.value);
  },
  { immediate: true },
);

watch(
  () => props.timesheetShowcase,
  (enabled) => {
    if (!enabled) {
      return;
    }
    themePreset.value = "sugar";
    rowHeightMode.value = "fixed";
    rowRenderMode.value = "virtualization";
    viewMode.value = "table";
    baseRowHeight.value = 35;
    rowHover.value = true;
    stripedRows.value = false;
    groupByModel.value = null;
    timesheetProjects.value = cloneTimesheetProjects();
    columnState.value = createTimesheetColumnState(columns.value);
  },
  { immediate: true },
);

const timesheetIsCellEditable = ({
  row,
  rowId,
  columnKey,
}: {
  row: TimesheetRow;
  rowId: DataGridRowId;
  columnKey: string;
}): boolean => {
  if (!props.timesheetShowcase) {
    return true;
  }
  if (rowId === "timesheet-total" || row.id === "timesheet-total") {
    return false;
  }
  return TIMESHEET_DAY_COLUMNS.some(entry => entry.key === columnKey);
};

const syncTimesheetProjectsFromGrid = (): void => {
  if (!props.timesheetShowcase) {
    return;
  }
  const api = gridRef.value?.getApi() as TimesheetGridApi | null;
  const runtime = gridRef.value?.getRuntime() as TimesheetGridRuntimeHandle | null;
  if (!api) {
    return;
  }
  const nextProjects = timesheetProjects.value.map((project, index) => {
    const bodyRowIndex = runtime?.resolveBodyRowIndexById(project.id) ?? index;
    const gridRow = bodyRowIndex >= 0 ? api.rows.get(bodyRowIndex)?.data : undefined;
    if (!gridRow || gridRow.id === "timesheet-total") {
      return project;
    }
    return {
      ...project,
      monday: normalizeTimesheetHours(gridRow.monday),
      tuesday: normalizeTimesheetHours(gridRow.tuesday),
      wednesday: normalizeTimesheetHours(gridRow.wednesday),
      thursday: normalizeTimesheetHours(gridRow.thursday),
      friday: normalizeTimesheetHours(gridRow.friday),
      saturday: normalizeTimesheetHours(gridRow.saturday),
      sunday: normalizeTimesheetHours(gridRow.sunday),
    };
  });
  const hasChanged = nextProjects.some((project, index) => (
    project.monday !== timesheetProjects.value[index]?.monday
    || project.tuesday !== timesheetProjects.value[index]?.tuesday
    || project.wednesday !== timesheetProjects.value[index]?.wednesday
    || project.thursday !== timesheetProjects.value[index]?.thursday
    || project.friday !== timesheetProjects.value[index]?.friday
    || project.saturday !== timesheetProjects.value[index]?.saturday
    || project.sunday !== timesheetProjects.value[index]?.sunday
  ));
  if (!hasChanged) {
    return;
  }
  timesheetProjects.value = nextProjects;
};

watch(
  [gridRef, groupBy, viewMode],
  async ([grid, nextGroupBy, mode]) => {
    if (!props.ganttShowcase || !grid || !nextGroupBy?.fields.length || mode !== "gantt") {
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
    columnState.value =
      props.mode === "base" && columnState.value == null
        ? createBaseShowcaseColumnState(nextColumns, columnState.value)
        : normalizeColumnState(columnState.value, nextColumns);
    if (groupByModel.value) {
      const nextFields = groupByModel.value.fields.filter((field) => (
        nextColumns.some((column) => column.key === field)
      ));
      groupByModel.value = nextFields.length > 0
        ? { ...groupByModel.value, fields: nextFields }
        : null;
    }
    selectionAggregatesLabel.value = "";
  },
  { immediate: true },
);

const handleGroupByUpdate = (nextGroupBy: DataGridGroupBySpec | null): void => {
  groupByModel.value = nextGroupBy;
};

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

const handleGridCellChange = (): void => {
  syncTimesheetProjectsFromGrid();
  syncSelectionAggregatesLabel();
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
