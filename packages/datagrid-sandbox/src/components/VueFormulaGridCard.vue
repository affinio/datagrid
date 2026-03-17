<template>
  <article class="card">
    <header class="card__header">
      <div class="card__title-row">
        <h2>Vue: Formula Grid</h2>
        <div class="mode-badge">Formula</div>
      </div>

      <div class="controls">
        <label>
          Rows
          <select v-model.number="rowCount">
            <option v-for="option in ROW_OPTIONS" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>

        <label>
          Patch size
          <select v-model.number="patchSize">
            <option
              v-for="option in PATCH_OPTIONS"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>
        </label>

        <label>
          Menu demo
          <select v-model="columnMenuPreset">
            <option value="default">Default</option>
            <option value="compact">Compact</option>
            <option value="labels">Custom labels</option>
            <option value="actions">Action overrides</option>
            <option value="locked">Disabled sections</option>
          </select>
        </label>

        <button type="button" @click="applyRandomPatch">
          Patch random rows
        </button>
        <button type="button" @click="recomputeFormulas">
          Recompute formulas
        </button>
        <button type="button" @click="rebuildModel">Rebuild model</button>
        <button type="button" @click="captureSavedView">Capture view</button>
        <button type="button" :disabled="!savedViewModel" @click="applySavedView">Apply view</button>
        <button type="button" @click="saveSavedViewToStorage">Save local</button>
        <button type="button" :disabled="!hasPersistedSavedView" @click="loadSavedViewFromStorage">Load local</button>
        <button type="button" :disabled="!hasPersistedSavedView" @click="clearPersistedSavedView">Clear local</button>
      </div>

      <div class="meta">
        <span>Rows in model: {{ rows.length }}</span>
        <span>Formulas: {{ formulaPlan?.order.length ?? 0 }}</span>
        <span>Levels: {{ formulaPlan?.levels.length ?? 0 }}</span>
        <span>Grouping: {{ groupByLabel }}</span>
        <span>Saved view: {{ savedViewStatus }}</span>
        <span>Last action: {{ lastAction }}</span>
      </div>

      <div class="meta">
        <span>Compute strategy: {{ computeStage?.strategy ?? "—" }}</span>
        <span>Rows touched: {{ computeStage?.rowsTouched ?? 0 }}</span>
        <span>Evaluations: {{ computeStage?.evaluations ?? 0 }}</span>
        <span>Dirty nodes: {{ dirtyNodesLabel }}</span>
        <span v-if="selectionAggregatesLabel"
          >Selection: {{ selectionAggregatesLabel }}</span
        >
      </div>
    </header>

    <section class="grid-host">
      <DataGrid
        ref="gridRef"
        :rows="rows"
        :columns="columns"
        license-key="affino-dg-v1:enterprise:sandbox-demo:2099-12-31:all:0HTTHMS"
        diagnostics
        formula-packs
        performance="balanced"
        :column-menu="columnMenu"
        :formula-runtime="{
          formulaColumnCacheMaxColumns: 32,
        }"
        :client-row-model-options="clientRowModelOptions"
        :group-by="groupBy"
        :aggregation-model="aggregationModel"
        theme="industrial-neutral"
        virtualization
        @cell-change="handleGridCellChange"
        @selection-change="syncSelectionAggregatesLabel"
        @update:group-by="handleGroupByUpdate"
      />
    </section>

    <footer class="card__footer">
      Enterprise formula demo:
      <code>diagnostics + formula-packs + performance + formula-runtime</code>
      <span>{{ formulaPlan?.order.join(" -> ") || "—" }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  DataGrid,
  type DataGridAppColumnInput,
  type DataGridColumnMenuProp,
} from "@affino/datagrid-vue-app-enterprise";
import {
  clearDataGridSavedViewInStorage,
  readDataGridSavedViewFromStorage,
  type DataGridSavedViewSnapshot,
  writeDataGridSavedViewToStorage,
} from "@affino/datagrid-vue-app";
import type {
  DataGridAggregationModel,
  DataGridFormulaComputeStageDiagnostics,
  DataGridGroupBySpec,
  DataGridRowId,
} from "@affino/datagrid-vue";

interface FormulaSandboxRow {
  id: number;
  product: string;
  segment: string;
  price: number;
  qty: number;
  taxRate: number;
  shipping: number;
  discount: number;
  cost: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  margin?: number;
  marginPct?: number;
}

interface FormulaExplainSnapshot {
  executionPlan: {
    order: readonly string[];
    levels: readonly unknown[];
  } | null;
  computeStage: DataGridFormulaComputeStageDiagnostics | null;
}

interface PublicFormulaGridApi {
  rows: {
    getCount: () => number;
    get: (
      index: number,
    ) =>
      | { rowId: DataGridRowId; kind?: string; data?: FormulaSandboxRow }
      | undefined;
    patch: (
      updates: readonly {
        rowId: DataGridRowId;
        data: Partial<FormulaSandboxRow>;
      }[],
      options?: {
        recomputeFilter?: boolean;
        recomputeSort?: boolean;
        recomputeGroup?: boolean;
      },
    ) => void;
    recomputeComputedFields: (rowIds?: readonly DataGridRowId[]) => number;
  };
  diagnostics: {
    getFormulaExplain: () => FormulaExplainSnapshot;
  };
}

interface PublicFormulaGridExpose {
  getApi: () => PublicFormulaGridApi | null;
  getSelectionAggregatesLabel: () => string;
  getSavedView: () => DataGridSavedViewSnapshot<Record<string, unknown>> | null;
  migrateSavedView: (savedView: unknown) => DataGridSavedViewSnapshot<Record<string, unknown>> | null;
  applySavedView: (savedView: DataGridSavedViewSnapshot<Record<string, unknown>>) => boolean;
}

type ColumnMenuPreset = "default" | "compact" | "labels" | "actions" | "locked";
type DeclarativeColumnMenuConfig = Exclude<DataGridColumnMenuProp, boolean | null>;

const FORMULA_SAVED_VIEW_STORAGE_KEY = "affino-datagrid-sandbox:formula-saved-view";

function getBrowserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

const ROW_OPTIONS = [100, 1_000, 5_000] as const;
const PATCH_OPTIONS = [1, 10, 100] as const;
const COMPACT_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  items: ["sort", "group", "pin"],
  columns: {
    total: {
      hide: ["group"],
    },
  },
};

const LABELLED_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  labels: {
    group: "Toggle segment grouping",
    pin: "Freeze columns",
    filter: "Formula filters",
  },
  columns: {
    segment: {
      labels: {
        filter: "Segment filters",
      },
    },
    total: {
      labels: {
        pin: "Freeze totals",
      },
    },
  },
};

const ACTION_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  actions: {
    sortAsc: { label: "Ascending order" },
    clearSort: { hidden: true },
    pinMenu: { disabled: true, disabledReason: "Pinning is locked for this preset" },
  },
  columns: {
    segment: {
      actions: {
        toggleGroup: {
          label: "Group segment",
          disabled: true,
          disabledReason: "Segment grouping is managed by the active preset",
        },
        clearFilter: { hidden: true },
      },
    },
    total: {
      actions: {
        pinLeft: { label: "Freeze left" },
      },
    },
  },
};

const LOCKED_COLUMN_MENU: DeclarativeColumnMenuConfig = {
  disabled: ["pin"],
  disabledReasons: {
    pin: "Pinning is locked in this scenario",
  },
  columns: {
    total: {
      hide: ["group"],
    },
    taxRate: {
      disabled: ["filter"],
      disabledReasons: {
        filter: "Filtering is disabled for formula tax inputs",
      },
    },
    segment: {
      labels: {
        group: "Group by segment",
      },
    },
  },
};

const columns: readonly DataGridAppColumnInput[] = [
  {
    key: "id",
    label: "ID",
    dataType: "number",
    initialState: { width: 88, pin: "left" },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true },
  },
  {
    key: "product",
    label: "Product",
    initialState: { width: 180 },
    capabilities: { sortable: true, filterable: true },
  },
  {
    key: "segment",
    label: "Segment",
    initialState: { width: 120 },
    capabilities: { sortable: true, filterable: true, groupable: true },
  },
  {
    key: "price",
    label: "Price",
    dataType: "currency",
    initialState: { width: 110 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: {
      sortable: true,
      filterable: true,
      editable: true,
      aggregatable: true,
    },
    constraints: { min: 0 },
  },
  {
    key: "qty",
    label: "Qty",
    dataType: "number",
    initialState: { width: 90 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: {
      sortable: true,
      filterable: true,
      editable: true,
      aggregatable: true,
    },
    constraints: { min: 0 },
  },
  {
    key: "taxRate",
    label: "Tax rate",
    dataType: "percent",
    initialState: { width: 100 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true },
    constraints: { min: 0, max: 1 },
  },
  {
    key: "shipping",
    label: "Shipping",
    dataType: "currency",
    initialState: { width: 110 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true },
    constraints: { min: 0 },
  },
  {
    key: "discount",
    label: "Discount",
    dataType: "currency",
    initialState: { width: 110 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true },
    constraints: { min: 0 },
  },
  {
    key: "cost",
    label: "Cost",
    dataType: "currency",
    initialState: { width: 110 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true },
    constraints: { min: 0 },
  },
  {
    key: "subtotal",
    label: "Subtotal",
    dataType: "currency",
    initialState: { width: 118 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    formula: "price * qty",
  },
  {
    key: "tax",
    label: "Tax",
    dataType: "currency",
    initialState: { width: 110 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    formula: "subtotal * taxRate",
  },
  {
    key: "total",
    label: "Total",
    dataType: "currency",
    initialState: { width: 118 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    formula: "subtotal + tax + shipping - discount",
  },
  {
    key: "margin",
    label: "Margin",
    dataType: "currency",
    initialState: { width: 118 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    formula: "total - cost",
  },
  {
    key: "marginPct",
    label: "Margin %",
    dataType: "percent",
    initialState: { width: 108 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true },
    formula: "SAFE_DIVIDE(total - cost, total, 0)",
  },
];

const rowCount = ref<number>(1_000);
const columnMenuPreset = ref<ColumnMenuPreset>("default");
const groupByModel = ref<DataGridGroupBySpec | null>({
  fields: ["segment"],
  expandedByDefault: true,
});
const patchSize = ref<number>(10);
const lastAction = ref<string>("init");
const rows = ref<readonly FormulaSandboxRow[]>([]);
const gridRef = ref<PublicFormulaGridExpose | null>(null);
const savedViewModel = ref<DataGridSavedViewSnapshot<Record<string, unknown>> | null>(null);
const hasPersistedSavedView = ref(false);
const formulaPlan = ref<FormulaExplainSnapshot["executionPlan"]>(null);
const computeStage = ref<DataGridFormulaComputeStageDiagnostics | null>(null);
const selectionAggregatesLabel = ref("");
const clientRowModelOptions = {
  resolveRowId: (row: unknown) => (row as FormulaSandboxRow).id,
};
const groupBy = computed(() => {
  return groupByModel.value;
});
const columnMenu = computed<DataGridColumnMenuProp>(() => {
  switch (columnMenuPreset.value) {
    case "compact":
      return COMPACT_COLUMN_MENU;
    case "labels":
      return LABELLED_COLUMN_MENU;
    case "actions":
      return ACTION_COLUMN_MENU;
    case "locked":
      return LOCKED_COLUMN_MENU;
    default:
      return true;
  }
});
const groupByLabel = computed(() => {
  const fields = groupByModel.value?.fields ?? [];
  return fields.length > 0 ? fields.join(" + ") : "off";
});
const savedViewStatus = computed(() => {
  if (!savedViewModel.value) {
    return hasPersistedSavedView.value ? "persisted" : "not captured";
  }
  return `${savedViewModel.value.viewMode ?? "table"} / ${hasPersistedSavedView.value ? "captured + persisted" : "captured"}`;
});

const syncPersistedSavedViewFlag = (): void => {
  hasPersistedSavedView.value = getBrowserStorage()?.getItem(FORMULA_SAVED_VIEW_STORAGE_KEY) != null;
};
const aggregationModel =
  computed<DataGridAggregationModel<FormulaSandboxRow> | null>(() => {
    if (!groupBy.value) {
      return null;
    }
    return {
      columns: [
        { key: "price", op: "sum" },
        { key: "qty", op: "sum" },
        { key: "subtotal", op: "sum" },
        { key: "tax", op: "sum" },
        { key: "total", op: "sum" },
        { key: "margin", op: "sum" },
      ],
      basis: "filtered",
    };
  });

const handleGroupByUpdate = (nextGroupBy: DataGridGroupBySpec | null): void => {
  groupByModel.value = nextGroupBy;
};

const dirtyNodesLabel = computed(() => {
  if (!computeStage.value || computeStage.value.dirtyNodes.length === 0) {
    return "—";
  }
  return computeStage.value.dirtyNodes.join(", ");
});

const randomNumber = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

const buildRows = (count: number): readonly FormulaSandboxRow[] => {
  const segments = ["Retail", "SMB", "Enterprise", "Channel"] as const;
  const nextRows = new Array<FormulaSandboxRow>(count);
  for (let index = 0; index < count; index += 1) {
    nextRows[index] = {
      id: index + 1,
      product: `SKU-${index + 1}`,
      segment: segments[index % segments.length] ?? "Retail",
      price: Math.round(randomNumber(20, 400) * 100) / 100,
      qty: Math.max(1, Math.trunc(randomNumber(1, 12))),
      taxRate: Math.round(randomNumber(0.02, 0.2) * 1000) / 1000,
      shipping: Math.round(randomNumber(0, 25) * 100) / 100,
      discount: Math.round(randomNumber(0, 20) * 100) / 100,
      cost: Math.round(randomNumber(10, 250) * 100) / 100,
    };
  }
  return nextRows;
};

const refreshDiagnostics = (): void => {
  const api = gridRef.value?.getApi();
  if (!api) {
    formulaPlan.value = null;
    computeStage.value = null;
    return;
  }
  const explain = api.diagnostics.getFormulaExplain();
  formulaPlan.value = explain.executionPlan;
  computeStage.value = explain.computeStage;
};

const syncSelectionAggregatesLabel = (): void => {
  selectionAggregatesLabel.value =
    gridRef.value?.getSelectionAggregatesLabel() ?? "";
};

const handleGridCellChange = (): void => {
  refreshDiagnostics();
  syncSelectionAggregatesLabel();
};

const rebuildModel = (): void => {
  rows.value = buildRows(rowCount.value);
  lastAction.value = `rebuild:${rowCount.value}`;
  selectionAggregatesLabel.value = "";
  void nextTick(() => {
    refreshDiagnostics();
  });
};

const applyRandomPatch = (): void => {
  const api = gridRef.value?.getApi();
  if (!api || rows.value.length === 0) {
    return;
  }
  const updatesById = new Map<DataGridRowId, Partial<FormulaSandboxRow>>();
  const totalRows = api.rows.getCount();
  const patchCount = Math.min(patchSize.value, totalRows);
  for (let index = 0; index < patchCount; index += 1) {
    const rowIndex = Math.floor(Math.random() * totalRows);
    const rowNode = api.rows.get(rowIndex);
    const current = rowNode?.data;
    if (!rowNode || !current || rowNode.kind === "group") {
      continue;
    }
    updatesById.set(rowNode.rowId, {
      price: Math.round((current.price + randomNumber(-5, 5)) * 100) / 100,
      qty: Math.max(1, current.qty + Math.trunc(randomNumber(-1, 2))),
      shipping: Math.max(
        0,
        Math.round((current.shipping + randomNumber(-2, 2)) * 100) / 100,
      ),
    });
  }
  api.rows.patch(
    Array.from(updatesById.entries()).map(([rowId, data]) => ({ rowId, data })),
    { recomputeFilter: false, recomputeSort: false, recomputeGroup: false },
  );
  lastAction.value = `patch:${updatesById.size}`;
  refreshDiagnostics();
};

const recomputeFormulas = (): void => {
  const api = gridRef.value?.getApi();
  if (!api) {
    return;
  }
  const recomputedRows = api.rows.recomputeComputedFields();
  lastAction.value = `recompute:${recomputedRows}`;
  refreshDiagnostics();
};

const captureSavedView = (): void => {
  savedViewModel.value = gridRef.value?.getSavedView() ?? null;
  lastAction.value = savedViewModel.value
    ? `capture-view:${savedViewModel.value.viewMode ?? "table"}`
    : "capture-view:none";
};

const saveSavedViewToStorage = (): void => {
  const savedView = gridRef.value?.getSavedView() ?? savedViewModel.value;
  if (!savedView) {
    return;
  }
  savedViewModel.value = savedView;
  if (writeDataGridSavedViewToStorage(getBrowserStorage(), FORMULA_SAVED_VIEW_STORAGE_KEY, savedView)) {
    hasPersistedSavedView.value = true;
    lastAction.value = `save-view:${savedView.viewMode ?? "table"}`;
  }
};

const loadSavedViewFromStorage = (): void => {
  const savedView = readDataGridSavedViewFromStorage(
    getBrowserStorage(),
    FORMULA_SAVED_VIEW_STORAGE_KEY,
    (state: unknown) => gridRef.value?.migrateSavedView({ state })?.state ?? null,
  );
  hasPersistedSavedView.value = savedView != null;
  if (!savedView) {
    lastAction.value = "load-view:none";
    return;
  }
  savedViewModel.value = savedView;
  if (gridRef.value?.applySavedView(savedView)) {
    lastAction.value = `load-view:${savedView.viewMode ?? "table"}`;
    void nextTick(() => {
      refreshDiagnostics();
      syncSelectionAggregatesLabel();
    });
  }
};

const clearPersistedSavedView = (): void => {
  if (clearDataGridSavedViewInStorage(getBrowserStorage(), FORMULA_SAVED_VIEW_STORAGE_KEY)) {
    hasPersistedSavedView.value = false;
    lastAction.value = "clear-view";
  }
};

const applySavedView = (): void => {
  if (!savedViewModel.value) {
    return;
  }
  if (gridRef.value?.applySavedView(savedViewModel.value)) {
    lastAction.value = `apply-view:${savedViewModel.value.viewMode ?? "table"}`;
    void nextTick(() => {
      refreshDiagnostics();
      syncSelectionAggregatesLabel();
    });
  }
};

watch(rowCount, () => {
  rebuildModel();
});

watch(
  () => gridRef.value,
  () => {
    syncPersistedSavedViewFlag();
  },
  { immediate: true },
);

watch(
  () => gridRef.value,
  () => {
    void nextTick(() => {
      refreshDiagnostics();
      syncSelectionAggregatesLabel();
    });
  },
);

rebuildModel();
</script>

<style scoped>
.grid-host {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
</style>
