import { defineComponent, h, nextTick } from "vue"
import { mount } from "@vue/test-utils"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import DataGrid from "../DataGrid"
import {
  createAffinoDataGridEnterpriseLicenseKey,
  provideAffinoDataGridEnterpriseLicense,
} from "../dataGridEnterpriseLicense"

interface DemoRow {
  rowId: string
  owner: string
  region: string
  amount: number
}

interface FormulaRow {
  id: number
  price: number
  qty: number
  subtotal?: number
}

interface FinanceRow {
  id: number
  revenue: number
  cost: number
  grossMargin?: number
}

const BASE_ROWS: readonly DemoRow[] = [
  { rowId: "r1", owner: "NOC", region: "eu-west", amount: 10 },
  { rowId: "r2", owner: "NOC", region: "us-east", amount: 20 },
  { rowId: "r3", owner: "Payments", region: "eu-west", amount: 30 },
]

const COLUMNS = [
  { key: "owner", label: "Owner", width: 180 },
  { key: "region", label: "Region", width: 160 },
  { key: "amount", label: "Amount", width: 140 },
] as const

const FORMULA_ROWS: readonly FormulaRow[] = [
  { id: 1, price: 12, qty: 3 },
  { id: 2, price: 5, qty: 4 },
]

const FORMULA_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "price", label: "Price" },
  { key: "qty", label: "Qty" },
  { key: "subtotal", label: "Subtotal", formula: "price * qty" },
] as const

const FINANCE_ROWS: readonly FinanceRow[] = [
  { id: 1, revenue: 100, cost: 60 },
  { id: 2, revenue: 80, cost: 20 },
]

const FINANCE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "grossMargin", label: "Gross margin", formula: "SAFE_DIVIDE(revenue - cost, revenue, 0)" },
] as const

const ALL_FEATURES_LICENSE = createAffinoDataGridEnterpriseLicenseKey({
  customer: "enterprise-demo",
  expiresAt: "2099-12-31",
  features: ["all"],
})

const FORMULA_ONLY_LICENSE = createAffinoDataGridEnterpriseLicenseKey({
  customer: "formula-scope",
  expiresAt: "2099-12-31",
  features: ["formulaRuntime", "formulaPacks"],
})

const TRIAL_LICENSE = createAffinoDataGridEnterpriseLicenseKey({
  tier: "trial",
  customer: "trial-demo",
  expiresAt: "2099-12-31",
  features: ["all"],
})

const EXPIRED_LICENSE = createAffinoDataGridEnterpriseLicenseKey({
  customer: "expired-demo",
  expiresAt: "2025-01-01",
  features: ["all"],
})

async function flushRuntimeTasks() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function queryDiagnosticsRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-diagnostics-inspector")
}

function queryEnterpriseLicenseBadge(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>("[data-datagrid-enterprise-license-badge]")
}

function queryDiagnosticsAction(label: string): HTMLButtonElement | null {
  return Array
    .from(document.body.querySelectorAll<HTMLButtonElement>(".datagrid-diagnostics-inspector button"))
    .find(button => button.textContent?.trim() === label) ?? null
}

function queryDiagnosticsTrigger(): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>("[data-datagrid-enterprise-diagnostics-trigger]")
}

function queryDiagnosticsTab(tabId: string): HTMLButtonElement | null {
  return document.body.querySelector<HTMLButtonElement>(`[data-datagrid-diagnostics-tab="${tabId}"]`)
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.getBoundingClientRect = vi.fn(() => DOMRect.fromRect({
    x: 0,
    y: 0,
    width: 120,
    height: 32,
  }))
})

afterAll(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

describe("DataGrid enterprise facade contract", () => {
  it("opens enterprise diagnostics when a license key is present", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        diagnostics: true,
        performance: "throughput",
        licenseKey: ALL_FEATURES_LICENSE,
      },
    })

    await flushRuntimeTasks()

    const trigger = queryDiagnosticsTrigger()
    expect(trigger).toBeTruthy()

    trigger?.click()
    await flushRuntimeTasks()

    const inspector = queryDiagnosticsRoot()
    expect(inspector).toBeTruthy()
    expect(inspector?.textContent).toContain("Inspector")
    expect(inspector?.textContent).toContain("Overview")
    expect(inspector?.textContent).toContain("License")
    expect(inspector?.textContent).toContain("Performance")
    expect(inspector?.textContent).toContain("Traces")
    expect(inspector?.textContent).toContain("Raw")
    expect(inspector?.textContent).toContain("throughput")
    expect(inspector?.textContent).toContain("worker")
    expect(inspector?.textContent).toContain("opened")
    expect(inspector?.textContent).toContain("Preset")
    expect(inspector?.textContent).toContain("Latest trace")

    wrapper.unmount()
  })

  it("disables enterprise diagnostics and warns when no license key is present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        diagnostics: true,
      },
    })

    await flushRuntimeTasks()

    expect(queryDiagnosticsTrigger()).toBeNull()
    expect(queryDiagnosticsRoot()).toBeNull()
    expect(queryEnterpriseLicenseBadge()?.textContent).toContain("Enterprise locked")
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "diagnostics" requires a valid licenseKey.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it("applies enterprise formula runtime controls when a license key is present", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        licenseKey: ALL_FEATURES_LICENSE,
        formulaRuntime: {
          computeMode: "worker",
          formulaColumnCacheMaxColumns: 8,
        },
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        compute: { getMode: () => string | null }
        rows: { get: (index: number) => { data?: FormulaRow } | undefined }
      } | null
    }).getApi?.()

    expect(api?.compute.getMode()).toBe("worker")
    expect(api?.rows.get(0)?.data).toMatchObject({
      subtotal: 36,
    })

    wrapper.unmount()
  })

  it("shows formula explain summary in enterprise diagnostics", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        diagnostics: true,
        licenseKey: ALL_FEATURES_LICENSE,
      },
    })

    await flushRuntimeTasks()

    const trigger = queryDiagnosticsTrigger()
    expect(trigger).toBeTruthy()

    trigger?.click()
    await flushRuntimeTasks()

    queryDiagnosticsTab("formula")?.click()
    await flushRuntimeTasks()

    const inspector = queryDiagnosticsRoot()
    expect(inspector?.textContent).toContain("Formula")
    expect(inspector?.textContent).toContain("Formula explain")
    expect(inspector?.textContent).toContain("Formula fields")
    expect(inspector?.textContent).toContain("Execution levels")
    expect(inspector?.textContent).toContain("Recomputed fields")
    expect(inspector?.textContent).toContain("Active formulas")
    expect(inspector?.textContent).toContain("subtotal")

    wrapper.unmount()
  })

  it("records diagnostics trace history across refreshes", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        diagnostics: true,
        performance: "formulaHeavy",
        licenseKey: ALL_FEATURES_LICENSE,
      },
    })

    await flushRuntimeTasks()

    const trigger = queryDiagnosticsTrigger()
    expect(trigger).toBeTruthy()
    trigger?.click()
    await flushRuntimeTasks()

    const refreshButton = queryDiagnosticsAction("Refresh")
    expect(refreshButton).toBeTruthy()

    refreshButton?.click()
    await flushRuntimeTasks()

    queryDiagnosticsTab("traces")?.click()
    await flushRuntimeTasks()

    const inspector = queryDiagnosticsRoot()
    expect(inspector?.textContent).toContain("Recent traces")
    expect(inspector?.textContent).toContain("opened")
    expect(inspector?.textContent).toContain("refreshed")
    expect(inspector?.textContent).toContain("compute worker -> worker")
    expect(inspector?.textContent).toContain("dispatch")

    wrapper.unmount()
  })

  it("shows raw snapshot on the raw diagnostics tab", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        diagnostics: true,
        licenseKey: ALL_FEATURES_LICENSE,
      },
    })

    await flushRuntimeTasks()

    queryDiagnosticsTrigger()?.click()
    await flushRuntimeTasks()

    queryDiagnosticsTab("raw")?.click()
    await flushRuntimeTasks()

    const inspector = queryDiagnosticsRoot()
    expect(inspector?.textContent).toContain("Raw snapshot")
    expect(inspector?.textContent).toContain("rowModel")

    wrapper.unmount()
  })

  it("supports keyboard navigation across diagnostics tabs", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        diagnostics: true,
        performance: "formulaHeavy",
        licenseKey: ALL_FEATURES_LICENSE,
      },
    })

    await flushRuntimeTasks()

    queryDiagnosticsTrigger()?.click()
    await flushRuntimeTasks()

    const overviewTab = queryDiagnosticsTab("overview")
    const licenseTab = queryDiagnosticsTab("license")
    const rawTab = queryDiagnosticsTab("raw")

    expect(overviewTab).toBeTruthy()
    expect(licenseTab).toBeTruthy()
    expect(rawTab).toBeTruthy()

    overviewTab?.focus()
    overviewTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    await flushRuntimeTasks()
    expect(document.activeElement).toBe(licenseTab)

    licenseTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
    await flushRuntimeTasks()
    expect(document.activeElement).toBe(rawTab)

    wrapper.unmount()
  })

  it("disables enterprise formula runtime controls and warns when no license key is present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        formulaRuntime: {
          computeMode: "worker",
          formulaColumnCacheMaxColumns: 8,
        },
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        compute: { getMode: () => string | null }
        rows: { get: (index: number) => { data?: FormulaRow } | undefined }
      } | null
    }).getApi?.()

    expect(api?.compute.getMode()).toBe("sync")
    expect(api?.rows.get(0)?.data).toMatchObject({
      subtotal: 36,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "formulaRuntime" requires a valid licenseKey.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it("registers enterprise formula packs and computes premium formulas when a license key is present", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: FINANCE_ROWS,
        columns: FINANCE_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FinanceRow) => row.id,
        },
        licenseKey: ALL_FEATURES_LICENSE,
        formulaPacks: true,
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        rows: {
          get: (index: number) => { data?: FinanceRow } | undefined
          getFormulaFunctionNames: () => readonly string[]
        }
      } | null
    }).getApi?.()

    expect(api?.rows.get(0)?.data).toMatchObject({
      grossMargin: 0.4,
    })
    expect(api?.rows.getFormulaFunctionNames()).toEqual(expect.arrayContaining([
      "CLAMP",
      "PERCENT_DELTA",
      "SAFE_DIVIDE",
      "WEIGHTED_AVG",
    ]))

    wrapper.unmount()
  })

  it("does not register enterprise formula packs without a license key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        formulaPacks: true,
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        rows: {
          getFormulaFunctionNames: () => readonly string[]
        }
      } | null
    }).getApi?.()

    expect(api?.rows.getFormulaFunctionNames()).not.toEqual(expect.arrayContaining([
      "SAFE_DIVIDE",
    ]))
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "formulaPacks" requires a valid licenseKey.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it("applies enterprise performance presets when a license key is present", async () => {
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        licenseKey: ALL_FEATURES_LICENSE,
        performance: "throughput",
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        compute: {
          getMode: () => string | null
          getDiagnostics: () => { configuredMode: string | null } | null
        }
      } | null
    }).getApi?.()

    expect(api?.compute.getMode()).toBe("worker")
    expect(api?.compute.getDiagnostics()?.configuredMode).toBe("worker")

    wrapper.unmount()
  })

  it("disables enterprise performance presets without a license key", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        performance: "throughput",
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        compute: {
          getMode: () => string | null
          getDiagnostics: () => { configuredMode: string | null } | null
        }
      } | null
    }).getApi?.()

    expect(api?.compute.getMode()).toBe("sync")
    expect(api?.compute.getDiagnostics()?.configuredMode).toBe("sync")
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "performance" requires a valid licenseKey.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it("supports provider-based license resolution without a local prop", async () => {
    const ProviderHarness = defineComponent({
      setup() {
        provideAffinoDataGridEnterpriseLicense(ALL_FEATURES_LICENSE)
        return () => h(DataGrid, {
          rows: BASE_ROWS,
          columns: COLUMNS,
          diagnostics: true,
        })
      },
    })

    const wrapper = mount(ProviderHarness, {
      attachTo: document.body,
    })

    await flushRuntimeTasks()

    const trigger = queryDiagnosticsTrigger()
    expect(trigger).toBeTruthy()

    wrapper.unmount()
  })

  it("shows trial license state in the toolbar and inspector", async () => {
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        diagnostics: true,
        licenseKey: TRIAL_LICENSE,
      },
    })

    await flushRuntimeTasks()

    expect(queryEnterpriseLicenseBadge()?.textContent).toContain("Trial active")
    expect(queryEnterpriseLicenseBadge()?.getAttribute("title")).toContain("Tier: Trial")

    queryDiagnosticsTrigger()?.click()
    await flushRuntimeTasks()

    queryDiagnosticsTab("license")?.click()
    await flushRuntimeTasks()

    const inspector = queryDiagnosticsRoot()
    expect(inspector?.textContent).toContain("License status")
    expect(inspector?.textContent).toContain("Trial active")
    expect(inspector?.textContent).toContain("trial-demo")
    expect(inspector?.textContent).toContain("All enterprise features")

    wrapper.unmount()
  })

  it("blocks features that are not included in a scoped license", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        rows: BASE_ROWS,
        columns: COLUMNS,
        diagnostics: true,
        licenseKey: FORMULA_ONLY_LICENSE,
      },
    })

    await flushRuntimeTasks()

    expect(wrapper.find(".datagrid-app-toolbar__button").exists()).toBe(false)
    expect(queryEnterpriseLicenseBadge()?.textContent).toContain("Enterprise locked")
    expect(queryEnterpriseLicenseBadge()?.getAttribute("title")).toContain("Features: formulaRuntime, formulaPacks")
    expect(queryEnterpriseLicenseBadge()?.getAttribute("title")).toContain("not included")
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "diagnostics" is not included in the current licenseKey.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })

  it("blocks expired licenses even when a licenseKey is present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const wrapper = mount(DataGrid, {
      props: {
        rows: FORMULA_ROWS,
        columns: FORMULA_COLUMNS,
        clientRowModelOptions: {
          resolveRowId: (row: FormulaRow) => row.id,
        },
        performance: "throughput",
        licenseKey: EXPIRED_LICENSE,
      },
    })

    await flushRuntimeTasks()

    const api = (wrapper.vm as unknown as {
      getApi?: () => {
        compute: { getMode: () => string | null }
      } | null
    }).getApi?.()

    expect(api?.compute.getMode()).toBe("sync")
    expect(queryEnterpriseLicenseBadge()?.textContent).toContain("License expired")
    expect(queryEnterpriseLicenseBadge()?.getAttribute("title")).toContain("expired on 2025-01-01")
    expect(warnSpy).toHaveBeenCalledWith(
      '[Affino DataGrid] Enterprise feature "performance" is disabled because the licenseKey expired on 2025-01-01.',
    )

    warnSpy.mockRestore()
    wrapper.unmount()
  })
})
