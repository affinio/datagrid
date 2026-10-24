import {
  mountDataGridShell,
  type DataGridDomColumnInput,
  type DataGridDomShellHandle,
} from "@affino/datagrid-dom";
import type { DataGridFilterSnapshot } from "@affino/datagrid-core";
import "@affino/datagrid-dom/style.css";
import "../../style.css";
import { failDemoLoading, finishDemoLoading } from "../../pageLoading";

interface AccountRow {
  id: string;
  account: string;
  owner: string;
  region: string;
  stage: string;
  arr: number;
  seats: number;
  health: number;
  quarter: string;
  segment: string;
  country: string;
  renewalDate: string;
  nps: number;
  supportTickets: number;
  grossMargin: number;
}

const owners = [
  "Maya Chen",
  "Liam Patel",
  "Sofia Reyes",
  "Noah Kim",
  "Amara Okafor",
  "Ethan Walker",
];
const regions = ["EMEA", "AMER", "APAC"];
const stages = ["Renewal", "Expansion", "Onboarding", "At risk"];
const quarters = ["Q1", "Q2", "Q3", "Q4"];
const segments = ["Enterprise", "Mid-market", "Growth"];
const countries = [
  "Germany",
  "United States",
  "Singapore",
  "United Kingdom",
  "Canada",
  "Japan",
];

const shellColumnOrder = new Map([
  "account", "owner", "region", "country",
  "stage", "segment", "quarter", "renewalDate",
  "arr", "seats", "arrPerSeat", "grossMargin",
  "health", "nps", "supportTickets",
].map((key, index) => [key, index]));

const columnGroups = {
  identity: [
    { id: "customer", label: "Customer" },
    { id: "identity", label: "Identity" },
  ],
  coverage: [
    { id: "account-coverage", label: "Coverage" },
    { id: "ownership", label: "Ownership" },
  ],
  commercialStatus: [
    { id: "commercial", label: "Commercial" },
    { id: "portfolio", label: "Portfolio" },
  ],
  commercialRenewal: [
    { id: "commercial", label: "Commercial" },
    { id: "renewal", label: "Renewal" },
  ],
  financials: [
    { id: "revenue", label: "Revenue" },
    { id: "financials", label: "Financials" },
  ],
  signals: [
    { id: "customer-health", label: "Customer health" },
    { id: "signals", label: "Signals" },
  ],
} as const;

const rows: readonly AccountRow[] = Array.from({ length: 180 }, (_, index) => ({
  id: `account-${String(index + 1).padStart(3, "0")}`,
  account:
    [
      "Northstar Labs",
      "Juniper Works",
      "Bluebird Health",
      "Atlas Systems",
      "Cedar & Co",
      "Orbit Analytics",
    ][index % 6]! + (index >= 6 ? ` ${Math.floor(index / 6) + 1}` : ""),
  owner: owners[(index * 5 + Math.floor(index / 3)) % owners.length]!,
  region: regions[(index * 7 + Math.floor(index / 4)) % regions.length]!,
  stage: stages[(index * 3 + Math.floor(index / 5)) % stages.length]!,
  arr: 18000 + ((index * 7919) % 185000),
  seats: 8 + ((index * 13) % 240),
  health: (42 + ((index * 17) % 58)) / 100,
  quarter: quarters[Math.floor(index / 13) % quarters.length]!,
  segment: segments[(index * 7 + Math.floor(index / 4)) % segments.length]!,
  country: countries[(index * 5 + Math.floor(index / 6)) % countries.length]!,
  renewalDate: new Date(
    Date.UTC(2026, (index * 3) % 12, 1 + ((index * 11) % 27)),
  )
    .toISOString()
    .slice(0, 10),
  nps: -20 + ((index * 19) % 121),
  supportTickets: (index * 7) % 18,
  grossMargin: (48 + ((index * 11) % 45)) / 100,
}));

export interface ShellDemoHandle {
  readonly grid: DataGridDomShellHandle<AccountRow>;
  destroy(): Promise<void>;
}

export function mountShellDemo(root: HTMLElement): ShellDemoHandle {
  const document = root.ownerDocument;
  const heading = document.createElement("div");
  heading.className = "demo-panel__header";
  const title = document.createElement("div");
  const headingText = document.createElement("h2");
  headingText.textContent = "Customer accounts";
  const description = document.createElement("p");
  description.textContent =
    "A declarative account grid with grouped headers, compound filters, formulas, aggregation, pivot, editing, selection, and virtual scrolling.";
  title.append(headingText, description);
  const status = document.createElement("output");
  status.className = "demo-panel__sort-status";
  status.setAttribute("aria-live", "polite");
  heading.append(title, status);

  const host = document.createElement("div");
  host.className = "grid-host";
  const compoundFilter = document.createElement("div");
  compoundFilter.className = "demo-controls shell-demo__compound-filter";
  compoundFilter.setAttribute("role", "group");
  compoundFilter.setAttribute("aria-label", "Compound account filter");

  const stageLabel = document.createElement("label");
  stageLabel.textContent = "Stage";
  const stageSelect = document.createElement("select");
  stageSelect.dataset.compoundFilterStage = "";
  stageSelect.setAttribute("aria-label", "Compound filter stage");
  for (const stage of stages) {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage;
    stageSelect.append(option);
  }
  stageLabel.append(stageSelect);

  const joinLabel = document.createElement("label");
  joinLabel.textContent = "Match";
  const joinSelect = document.createElement("select");
  joinSelect.dataset.compoundFilterJoin = "";
  joinSelect.setAttribute("aria-label", "Combine compound filter conditions");
  for (const [value, label] of [["and", "All conditions (AND)"], ["or", "Any condition (OR)"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    joinSelect.append(option);
  }
  joinLabel.append(joinSelect);

  const amountLabel = document.createElement("label");
  amountLabel.textContent = "ARR at least";
  const minimumArr = document.createElement("input");
  minimumArr.type = "number";
  minimumArr.min = "0";
  minimumArr.step = "10000";
  minimumArr.value = "100000";
  minimumArr.dataset.compoundFilterMinimum = "";
  minimumArr.setAttribute("aria-label", "Minimum ARR for compound filter");
  amountLabel.append(minimumArr);

  const applyCompoundFilterButton = document.createElement("button");
  applyCompoundFilterButton.type = "button";
  applyCompoundFilterButton.dataset.compoundFilterApply = "";
  applyCompoundFilterButton.textContent = "Apply compound filter";
  const clearCompoundFilterButton = document.createElement("button");
  clearCompoundFilterButton.type = "button";
  clearCompoundFilterButton.dataset.compoundFilterClear = "";
  clearCompoundFilterButton.textContent = "Clear compound filter";
  const compoundFilterStatus = document.createElement("output");
  compoundFilterStatus.className = "shell-demo__compound-filter-status";
  compoundFilterStatus.dataset.compoundFilterStatus = "";
  compoundFilterStatus.setAttribute("aria-live", "polite");
  compoundFilterStatus.textContent = "No compound filter applied";
  compoundFilter.append(stageLabel, joinLabel, amountLabel, applyCompoundFilterButton, clearCompoundFilterButton, compoundFilterStatus);
  root.replaceChildren(heading, compoundFilter, host);

  const grid = mountDataGridShell<AccountRow>(host, {
    label: "Customer accounts",
    rows,
    formulas: [{ name: "arrPerSeat", formula: "arr / seats" }],
    columns: ([
      {
        key: "account",
        field: "account",
        label: "Account",
        columnGroup: columnGroups.identity,
        initialState: { pin: "left", width: 220 },
        capabilities: { sortable: true, searchable: true },
      },
      {
        key: "owner",
        field: "owner",
        label: "Owner",
        columnGroup: columnGroups.coverage,
        capabilities: {
          sortable: true,
          searchable: true,
          editable: true,
          groupable: true,
          filterable: true,
        },
      },
      {
        key: "region",
        field: "region",
        label: "Region",
        columnGroup: columnGroups.coverage,
        capabilities: {
          sortable: true,
          searchable: true,
          groupable: true,
          filterable: true,
        },
      },
      {
        key: "stage",
        field: "stage",
        label: "Stage",
        columnGroup: columnGroups.commercialStatus,
        capabilities: {
          sortable: true,
          searchable: true,
          groupable: true,
          filterable: true,
        },
        cellRenderer: ({ document: ownerDocument, value, displayValue }) => {
          const badge = ownerDocument.createElement("span");
          const stage = String(value ?? "")
            .toLowerCase()
            .replaceAll(" ", "-");
          badge.className = `shell-demo__stage-badge shell-demo__stage-badge--${stage}`;
          badge.textContent = displayValue;
          return badge;
        },
      },
      {
        key: "arr",
        field: "arr",
        label: "ARR",
        columnGroup: columnGroups.financials,
        dataType: "currency",
        presentation: {
          format: {
            number: {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            },
          },
        },
        initialState: { width: 140 },
        capabilities: { sortable: true, editable: true, filterable: true },
      },
      {
        key: "seats",
        field: "seats",
        label: "Seats",
        columnGroup: columnGroups.financials,
        dataType: "number",
        initialState: { width: 110 },
        capabilities: { sortable: true, editable: true, filterable: true },
      },
      {
        key: "arrPerSeat",
        field: "arrPerSeat",
        label: "ARR / seat",
        columnGroup: columnGroups.financials,
        dataType: "currency",
        presentation: {
          format: {
            number: {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            },
          },
        },
        initialState: { width: 140 },
        capabilities: { sortable: true },
      },
      {
        key: "health",
        field: "health",
        label: "Health",
        columnGroup: columnGroups.signals,
        dataType: "percent",
        initialState: { width: 120 },
        capabilities: { sortable: true, filterable: true },
      },
      {
        key: "quarter",
        field: "quarter",
        label: "Quarter",
        columnGroup: columnGroups.commercialRenewal,
        initialState: { width: 112 },
        capabilities: { sortable: true, groupable: true, filterable: true },
      },
      {
        key: "segment",
        field: "segment",
        label: "Segment",
        columnGroup: columnGroups.commercialStatus,
        initialState: { width: 140 },
        capabilities: { sortable: true, groupable: true, filterable: true },
      },
      {
        key: "country",
        field: "country",
        label: "Country",
        columnGroup: columnGroups.coverage,
        initialState: { width: 150 },
        capabilities: { sortable: true, groupable: true, filterable: true },
      },
      {
        key: "renewalDate",
        field: "renewalDate",
        label: "Renewal date",
        columnGroup: columnGroups.commercialRenewal,
        dataType: "date",
        initialState: { width: 150 },
        capabilities: { sortable: true, filterable: true },
      },
      {
        key: "nps",
        field: "nps",
        label: "NPS",
        columnGroup: columnGroups.signals,
        dataType: "number",
        initialState: { width: 100 },
        capabilities: { sortable: true, filterable: true },
      },
      {
        key: "supportTickets",
        field: "supportTickets",
        label: "Open tickets",
        columnGroup: columnGroups.signals,
        dataType: "number",
        initialState: { width: 130 },
        capabilities: { sortable: true, filterable: true },
      },
      {
        key: "grossMargin",
        field: "grossMargin",
        label: "Gross margin",
        columnGroup: columnGroups.financials,
        dataType: "percent",
        initialState: { width: 140 },
        capabilities: { sortable: true, filterable: true },
      },
    ] satisfies DataGridDomColumnInput<AccountRow>[]).sort((left, right) =>
      (shellColumnOrder.get(left.key) ?? 0) - (shellColumnOrder.get(right.key) ?? 0),
    ),
    rowSelection: true,
    columnReorder: true,
    fillHandle: true,
    rowVirtualization: { rowHeight: 36, overscan: 8 },
    columnMenu: { trigger: "button+contextmenu", maxFilterValues: 80 },
    quickFilter: {
      placeholder: "Search accounts",
      columns: ["account", "owner", "region", "stage"],
      mode: "tokens",
      applyMode: "input",
    },
    cellStyle: (row, _rowIndex, column) => {
      if (row.kind !== "leaf") return null;
      if (column.key === "health" && row.data.health < 0.6) {
        return {
          color: "#a12b2b",
          backgroundColor: "#fff0ef",
          fontWeight: "600",
        };
      }
      if (column.key === "stage" && row.data.stage === "At risk") {
        return { color: "#8b4a0b", backgroundColor: "#fff5e7" };
      }
      if (column.key === "arrPerSeat")
        return { backgroundColor: "#eaf2fb", fontWeight: "600" };
      return null;
    },
    toolbar: {
      actions: [
        {
          key: "group-region",
          label: "Group by region",
          onAction(api) {
            api.rows.setGroupBy({
              fields: ["region"],
              expandedByDefault: false,
            });
          },
        },
        {
          key: "aggregate",
          label: "Aggregate groups",
          onAction(api) {
            if (!api.rows.getSnapshot().groupBy) {
              api.rows.setGroupBy({
                fields: ["region"],
                expandedByDefault: false,
              });
            }
            api.rows.setAggregationModel({
              basis: "filtered",
              columns: [
                { key: "arr", field: "arr", op: "sum" },
                { key: "seats", field: "seats", op: "sum" },
                { key: "health", field: "health", op: "avg" },
              ],
            });
          },
        },
        {
          key: "pivot-arr",
          label: "Pivot ARR by quarter",
          onAction(api) {
            api.rows.setGroupBy(null);
            api.rows.setAggregationModel(null);
            api.pivot.setModel({
              rows: ["region"],
              columns: ["quarter"],
              values: [{ field: "arr", agg: "sum" }],
              columnGrandTotal: true,
              grandTotal: true,
            });
          },
        },
        {
          key: "clear-analysis",
          label: "Clear grouping / pivot",
          onAction(api) {
            api.pivot.setModel(null);
            api.rows.setAggregationModel(null);
            api.rows.setGroupBy(null);
          },
        },
        {
          key: "export-xlsx",
          label: "Export XLSX",
          async onAction(api) {
            const { downloadDataGridDomXlsx, exportDataGridDomXlsx } =
              await import("@affino/datagrid-dom/xlsx");
            const result = await exportDataGridDomXlsx(api, {
              fileName: "customer-accounts.xlsx",
              sheetName: "Accounts",
              formulas: "values",
            });
            if (result.status === "success")
              downloadDataGridDomXlsx(result, document);
            else if (
              result.status === "unsupported" ||
              result.status === "error"
            )
              throw new Error(result.message);
          },
        },
        {
          key: "clear-view",
          label: "Reset view",
          onAction(api) {
            api.rows.setFilterModel(null);
            api.rows.setSortModel([]);
            api.rows.setGroupBy(null);
            api.rows.setAggregationModel(null);
            api.pivot.setModel(null);
          },
        },
      ],
    },
  });

  const onApplyCompoundFilter = (): void => {
    const minimum = Number(minimumArr.value);
    if (!Number.isFinite(minimum) || minimum < 0) return;
    const current = grid.api.rows.getSnapshot().filterModel;
    const operator = joinSelect.value === "or" ? "or" : "and";
    const next: DataGridFilterSnapshot = {
      ...(current ?? { columnFilters: {} }),
      columnFilters: current?.columnFilters ?? {},
      advancedExpression: {
        kind: "group",
        operator,
        children: [
          {
            kind: "condition",
            key: "stage",
            type: "text",
            operator: "equals",
            value: stageSelect.value,
          },
          {
            kind: "condition",
            key: "arr",
            type: "number",
            operator: "gte",
            value: minimum,
          },
        ],
      },
    };
    grid.api.rows.setFilterModel(next);
    compoundFilterStatus.textContent = `${grid.api.rows.getCount()} matching · Stage ${stageSelect.value} ${operator.toUpperCase()} ARR ≥ ${minimum.toLocaleString()}`;
  };
  const onClearCompoundFilter = (): void => {
    const current = grid.api.rows.getSnapshot().filterModel;
    if (!current?.advancedExpression) return;
    const next: DataGridFilterSnapshot = {
      ...current,
      columnFilters: current.columnFilters ?? {},
    };
    delete next.advancedExpression;
    const hasOtherFilters = Boolean(next.quickFilter?.query.trim())
      || Object.values(next.columnFilters).some(Boolean)
      || Object.values(next.columnStyleFilters ?? {}).some(Boolean);
    grid.api.rows.setFilterModel(hasOtherFilters ? next : null);
    compoundFilterStatus.textContent = "No compound filter applied";
  };
  applyCompoundFilterButton.addEventListener("click", onApplyCompoundFilter);
  clearCompoundFilterButton.addEventListener("click", onClearCompoundFilter);

  const updateStatus = (): void => {
    const count = grid.api.rows.getCount();
    const selection = grid.api.rowSelection.getSnapshot();
    const selected =
      selection?.mode === "all"
        ? Math.max(0, count - (selection.excludedRows?.length ?? 0))
        : (selection?.selectedRows.length ?? 0);
    status.textContent = `${count.toLocaleString()} projected rows · ${selected} selected · right-click a header for column actions`;
  };
  const unsubscribeProjection = grid.api.events.on(
    "projection:recomputed",
    updateStatus,
  );
  const unsubscribeSelection = grid.api.events.on(
    "row-selection:changed",
    updateStatus,
  );
  void grid.ready
    .then(() => {
      updateStatus();
      finishDemoLoading(document);
    })
    .catch(() => failDemoLoading(document));

  return {
    grid,
    async destroy() {
      applyCompoundFilterButton.removeEventListener("click", onApplyCompoundFilter);
      clearCompoundFilterButton.removeEventListener("click", onClearCompoundFilter);
      unsubscribeProjection();
      unsubscribeSelection();
      await grid.destroy();
      root.replaceChildren();
    },
  };
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#shell-demo");
  if (root) {
    const demo = mountShellDemo(root);
    window.addEventListener("pagehide", () => void demo.destroy(), {
      once: true,
    });
  }
}
