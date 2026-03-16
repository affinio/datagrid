import {
  computed,
  defineComponent,
  h,
  ref,
  type Component,
  type PropType,
  type VNode,
} from "vue"
import CommunityDataGrid from "@affino/datagrid-vue-app"
import {
  resolveDataGridFormulaRowModelOptions,
  useDataGridAppRowModel,
  type DataGridAppClientRowModelOptions,
  type DataGridAppColumnInput,
} from "@affino/datagrid-vue-app/internal"
import {
  mergeDataGridFormulaFunctionRegistries,
  resolveDataGridEnterpriseFormulaFunctions,
} from "@affino/datagrid-formula-engine-enterprise"
import type {
  DataGridClientComputeMode,
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFunctionRegistry,
} from "@affino/datagrid-vue"
import type { DataGridVirtualizationProp } from "@affino/datagrid-vue-app"
import type { DataGridRowModel } from "@affino/datagrid-vue"
import DataGridEnterpriseRenderer from "./DataGridEnterpriseRenderer"
import {
  explainAffinoDataGridEnterpriseLicenseFailure,
  hasAffinoDataGridEnterpriseLicenseFeature,
  resolveAffinoDataGridEnterpriseLicense,
  summarizeAffinoDataGridEnterpriseLicense,
  useAffinoDataGridEnterpriseLicenseKey,
  type AffinoDataGridEnterpriseBlockedFeature,
  type AffinoDataGridEnterpriseLicenseFeature,
} from "./dataGridEnterpriseLicense"
import {
  resolveDataGridDiagnostics,
  type DataGridDiagnosticsProp,
} from "./dataGridDiagnostics"
import {
  resolveDataGridPerformance,
  type DataGridPerformanceProp,
} from "./dataGridPerformance"
import {
  resolveDataGridFormulaPacks,
  type DataGridFormulaPacksProp,
} from "./dataGridFormulaPacks"
import {
  resolveDataGridFormulaRuntime,
  type DataGridFormulaRuntimeProp,
} from "./dataGridFormulaRuntime"

interface DataGridSlotProps {
  defaultRendererProps?: Record<string, unknown>
  [key: string]: unknown
}

interface DataGridEnterpriseDiagnosticsPerformanceSummary {
  policyLabel: string
  runtimeSourceLabel: string
  configuredComputeMode: string
  workerPatchDispatchThreshold: number | null
  formulaColumnCacheMaxColumns: number | null
  virtualization: {
    rows: boolean | null
    columns: boolean | null
    rowOverscan: number | null
    columnOverscan: number | null
  } | null
}

interface CommunityDataGridAttrs {
  rows?: readonly unknown[]
  rowModel?: DataGridRowModel<unknown> | undefined
  columns?: readonly DataGridAppColumnInput[] | undefined
  clientRowModelOptions?: DataGridAppClientRowModelOptions<unknown> | undefined
  virtualization?: DataGridVirtualizationProp | undefined
  computedFields?: readonly DataGridComputedFieldDefinition<unknown>[] | null | undefined
  formulas?: readonly DataGridFormulaFieldDefinition[] | null | undefined
  formulaFunctions?: DataGridFormulaFunctionRegistry | null | undefined
}

const warnedEnterpriseFeatures = new Set<string>()

function warnBlockedEnterpriseFeature(
  feature: AffinoDataGridEnterpriseLicenseFeature,
  reason: string,
): void {
  const warningKey = `${feature}:${reason}`
  if (warnedEnterpriseFeatures.has(warningKey) || typeof console === "undefined") {
    return
  }
  warnedEnterpriseFeatures.add(warningKey)
  console.warn(`[Affino DataGrid] ${reason}`)
}

function readCommunityAttr<T>(
  attrs: Record<string, unknown>,
  camelKey: string,
  kebabKey?: string,
): T | undefined {
  const value = attrs[camelKey] ?? (kebabKey ? attrs[kebabKey] : undefined)
  return value as T | undefined
}

function mergeVirtualizationProps(
  preset: DataGridVirtualizationProp | undefined,
  user: DataGridVirtualizationProp | undefined,
): DataGridVirtualizationProp | undefined {
  if (typeof user === "undefined") {
    return preset
  }
  if (typeof preset === "undefined") {
    return user
  }
  if (user === false) {
    return false
  }
  if (user === true) {
    if (typeof preset === "object") {
      return {
        ...preset,
        rows: true,
        columns: true,
      }
    }
    return true
  }
  if (preset === true) {
    return {
      rows: true,
      columns: true,
      ...user,
    }
  }
  if (preset === false) {
    return user
  }
  return {
    ...preset,
    ...user,
  }
}

function summarizeVirtualization(
  input: DataGridVirtualizationProp | undefined,
): DataGridEnterpriseDiagnosticsPerformanceSummary["virtualization"] {
  if (typeof input === "undefined") {
    return null
  }
  if (input === true) {
    return {
      rows: true,
      columns: true,
      rowOverscan: null,
      columnOverscan: null,
    }
  }
  if (input === false) {
    return {
      rows: false,
      columns: false,
      rowOverscan: null,
      columnOverscan: null,
    }
  }
  return {
    rows: typeof input.rows === "boolean" ? input.rows : null,
    columns: typeof input.columns === "boolean" ? input.columns : null,
    rowOverscan: Number.isFinite(input.rowOverscan) ? Math.trunc(input.rowOverscan as number) : null,
    columnOverscan: Number.isFinite(input.columnOverscan)
      ? Math.trunc(input.columnOverscan as number)
      : null,
  }
}

export default defineComponent({
  name: "DataGrid",
  inheritAttrs: false,
  props: {
    diagnostics: {
      type: [Boolean, Object] as PropType<DataGridDiagnosticsProp | undefined>,
      default: undefined,
    },
    formulaRuntime: {
      type: [Boolean, Object] as PropType<DataGridFormulaRuntimeProp | undefined>,
      default: undefined,
    },
    performance: {
      type: [Boolean, String, Object] as PropType<DataGridPerformanceProp | undefined>,
      default: undefined,
    },
    formulaPacks: {
      type: [Boolean, Array, Object] as PropType<DataGridFormulaPacksProp | undefined>,
      default: undefined,
    },
    licenseKey: {
      type: String as PropType<string | null | undefined>,
      default: undefined,
    },
  },
  setup(props, { attrs, slots, expose }) {
    const dataGridRef = ref<Record<string, unknown> | null>(null)
    const injectedLicenseKey = useAffinoDataGridEnterpriseLicenseKey()
    const communityAttrs = computed<CommunityDataGridAttrs>(() => ({
      rows: readCommunityAttr<readonly unknown[]>(attrs, "rows"),
      rowModel: readCommunityAttr<DataGridRowModel<unknown>>(attrs, "rowModel", "row-model"),
      columns: readCommunityAttr<readonly DataGridAppColumnInput[]>(attrs, "columns"),
      clientRowModelOptions: readCommunityAttr<DataGridAppClientRowModelOptions<unknown>>(
        attrs,
        "clientRowModelOptions",
        "client-row-model-options",
      ),
      virtualization: readCommunityAttr<DataGridVirtualizationProp>(attrs, "virtualization"),
      computedFields: readCommunityAttr<readonly DataGridComputedFieldDefinition<unknown>[] | null>(
        attrs,
        "computedFields",
        "computed-fields",
      ),
      formulas: readCommunityAttr<readonly DataGridFormulaFieldDefinition[] | null>(attrs, "formulas"),
      formulaFunctions: readCommunityAttr<DataGridFormulaFunctionRegistry | null>(
        attrs,
        "formulaFunctions",
        "formula-functions",
      ),
    }))
    const resolvedLicense = computed(() => {
      const propLicense = typeof props.licenseKey === "string" ? props.licenseKey.trim() : ""
      if (propLicense.length > 0) {
        return resolveAffinoDataGridEnterpriseLicense(propLicense, "prop")
      }
      if (typeof injectedLicenseKey === "string" && injectedLicenseKey.trim().length > 0) {
        return resolveAffinoDataGridEnterpriseLicense(injectedLicenseKey, "provider")
      }
      return resolveAffinoDataGridEnterpriseLicense(undefined, "none")
    })
    const blockedFeatures = computed<readonly AffinoDataGridEnterpriseBlockedFeature[]>(() => {
      const result: AffinoDataGridEnterpriseBlockedFeature[] = []
      const requestedFeatures: readonly [AffinoDataGridEnterpriseLicenseFeature, boolean][] = [
        ["diagnostics", resolveDataGridDiagnostics(props.diagnostics).enabled],
        ["formulaRuntime", resolveDataGridFormulaRuntime(props.formulaRuntime).enabled],
        ["formulaPacks", resolveDataGridFormulaPacks(props.formulaPacks).enabled],
        ["performance", resolveDataGridPerformance(props.performance).enabled],
      ]

      for (const [feature, requested] of requestedFeatures) {
        if (!requested) {
          continue
        }
        if (hasAffinoDataGridEnterpriseLicenseFeature(resolvedLicense.value, feature)) {
          continue
        }
        result.push({
          feature,
          reason: explainAffinoDataGridEnterpriseLicenseFailure(resolvedLicense.value, feature),
        })
      }

      return result
    })
    const licenseSummary = computed(() => summarizeAffinoDataGridEnterpriseLicense(
      resolvedLicense.value,
    ))
    const gateEnterpriseFeature = <T extends { enabled: boolean }>(
      feature: AffinoDataGridEnterpriseLicenseFeature,
      resolved: T,
      disabled: T,
    ): T => {
      if (!resolved.enabled) {
        return resolved
      }
      if (hasAffinoDataGridEnterpriseLicenseFeature(resolvedLicense.value, feature)) {
        return resolved
      }
      warnBlockedEnterpriseFeature(
        feature,
        explainAffinoDataGridEnterpriseLicenseFailure(resolvedLicense.value, feature),
      )
      return disabled
    }
    const resolvedDiagnostics = computed(() => {
      const resolved = resolveDataGridDiagnostics(props.diagnostics)
      return gateEnterpriseFeature("diagnostics", resolved, {
        ...resolved,
        enabled: false,
      })
    })
    const resolvedFormulaRuntime = computed(() => {
      const resolved = resolveDataGridFormulaRuntime(props.formulaRuntime)
      return gateEnterpriseFeature("formulaRuntime", resolved, {
        ...resolved,
        enabled: false,
      })
    })
    const resolvedPerformance = computed(() => {
      const resolved = resolveDataGridPerformance(props.performance)
      return gateEnterpriseFeature("performance", resolved, {
        ...resolved,
        enabled: false,
      })
    })
    const resolvedFormulaPacks = computed(() => {
      const resolved = resolveDataGridFormulaPacks(props.formulaPacks)
      return gateEnterpriseFeature("formulaPacks", resolved, {
        ...resolved,
        enabled: false,
      })
    })
    const resolvedFormulaFunctionRegistry = computed(() => {
      const baseRegistry = communityAttrs.value.formulaFunctions
      if (!resolvedFormulaPacks.value.enabled) {
        return baseRegistry
      }
      const enterpriseRegistry = resolveDataGridEnterpriseFormulaFunctions(resolvedFormulaPacks.value.packs)
      if (baseRegistry === undefined || baseRegistry === null) {
        return enterpriseRegistry
      }
      return mergeDataGridFormulaFunctionRegistries(enterpriseRegistry, baseRegistry)
    })
    const resolvedEnterpriseRowModelRuntime = computed(() => {
      const performanceRuntime = resolvedPerformance.value.enabled
        ? resolvedPerformance.value
        : null
      const explicitFormulaRuntime = resolvedFormulaRuntime.value.enabled
        ? resolvedFormulaRuntime.value
        : null
      const computeMode = (
        explicitFormulaRuntime?.computeMode
        ?? performanceRuntime?.computeMode
      ) as DataGridClientComputeMode | undefined
      const workerPatchDispatchThreshold = performanceRuntime?.workerPatchDispatchThreshold
      const formulaColumnCacheMaxColumns = (
        explicitFormulaRuntime?.formulaColumnCacheMaxColumns
        ?? performanceRuntime?.formulaColumnCacheMaxColumns
      )

      if (
        typeof computeMode === "undefined"
        && typeof workerPatchDispatchThreshold === "undefined"
        && typeof formulaColumnCacheMaxColumns === "undefined"
      ) {
        return undefined
      }

      return {
        ...(computeMode ? { computeMode } : {}),
        ...(typeof workerPatchDispatchThreshold !== "undefined"
          ? { workerPatchDispatchThreshold }
          : {}),
        ...(typeof formulaColumnCacheMaxColumns !== "undefined"
          ? { formulaColumnCacheMaxColumns }
          : {}),
      }
    })
    const resolvedVirtualization = computed(() => mergeVirtualizationProps(
      resolvedPerformance.value.enabled
        ? resolvedPerformance.value.virtualization
        : undefined,
      communityAttrs.value.virtualization,
    ))
    const diagnosticsPerformanceSummary = computed<DataGridEnterpriseDiagnosticsPerformanceSummary>(() => ({
      policyLabel: resolvedPerformance.value.enabled
        ? resolvedPerformance.value.preset
        : "community-default",
      runtimeSourceLabel: resolvedFormulaRuntime.value.enabled
        ? (
          resolvedPerformance.value.enabled
            ? "formulaRuntime override + performance preset"
            : "formulaRuntime override"
        )
        : (
          resolvedPerformance.value.enabled
            ? "performance preset"
            : "community defaults"
        ),
      configuredComputeMode: resolvedEnterpriseRowModelRuntime.value?.computeMode ?? "sync",
      workerPatchDispatchThreshold:
        resolvedEnterpriseRowModelRuntime.value?.workerPatchDispatchThreshold ?? null,
      formulaColumnCacheMaxColumns:
        resolvedEnterpriseRowModelRuntime.value?.formulaColumnCacheMaxColumns ?? null,
      virtualization: summarizeVirtualization(resolvedVirtualization.value),
    }))
    const resolvedEnterpriseRowModelOptions = computed(() => resolveDataGridFormulaRowModelOptions({
      columns: communityAttrs.value.columns,
      clientRowModelOptions: communityAttrs.value.clientRowModelOptions,
      computedFields: communityAttrs.value.computedFields,
      formulas: communityAttrs.value.formulas,
      formulaFunctions: resolvedFormulaFunctionRegistry.value,
      enterpriseClientRowModelOptions: resolvedEnterpriseRowModelRuntime.value,
    }))
    const { resolvedRowModel } = useDataGridAppRowModel({
      rows: computed(() => communityAttrs.value.rows ?? []),
      rowModel: computed(() => communityAttrs.value.rowModel),
      clientRowModelOptions: resolvedEnterpriseRowModelOptions,
    })

    expose({
      grid: dataGridRef,
      getApi: () => (dataGridRef.value as { getApi?: () => unknown } | null)?.getApi?.() ?? null,
      getRuntime: () => (dataGridRef.value as { getRuntime?: () => unknown } | null)?.getRuntime?.() ?? null,
      getCore: () => (dataGridRef.value as { getCore?: () => unknown } | null)?.getCore?.() ?? null,
      getColumnState: () => (dataGridRef.value as { getColumnState?: () => unknown } | null)?.getColumnState?.() ?? null,
      getColumnSnapshot: () => (dataGridRef.value as { getColumnSnapshot?: () => unknown } | null)?.getColumnSnapshot?.() ?? null,
      getSelectionAggregatesLabel: () => (dataGridRef.value as { getSelectionAggregatesLabel?: () => unknown } | null)?.getSelectionAggregatesLabel?.() ?? null,
      getSelectionSummary: () => (dataGridRef.value as { getSelectionSummary?: () => unknown } | null)?.getSelectionSummary?.() ?? null,
      getView: () => (dataGridRef.value as { getView?: () => unknown } | null)?.getView?.() ?? null,
      setView: (...args: unknown[]) => (dataGridRef.value as { setView?: (...values: unknown[]) => unknown } | null)?.setView?.(...args) ?? null,
      applyColumnState: (...args: unknown[]) => (dataGridRef.value as { applyColumnState?: (...values: unknown[]) => unknown } | null)?.applyColumnState?.(...args) ?? null,
      getState: () => (dataGridRef.value as { getState?: () => unknown } | null)?.getState?.() ?? null,
      migrateState: (...args: unknown[]) => (dataGridRef.value as { migrateState?: (...values: unknown[]) => unknown } | null)?.migrateState?.(...args) ?? null,
      applyState: (...args: unknown[]) => (dataGridRef.value as { applyState?: (...values: unknown[]) => unknown } | null)?.applyState?.(...args) ?? null,
      exportPivotLayout: () => (dataGridRef.value as { exportPivotLayout?: () => unknown } | null)?.exportPivotLayout?.() ?? null,
      exportPivotInterop: () => (dataGridRef.value as { exportPivotInterop?: () => unknown } | null)?.exportPivotInterop?.() ?? null,
      importPivotLayout: (...args: unknown[]) => (dataGridRef.value as { importPivotLayout?: (...values: unknown[]) => unknown } | null)?.importPivotLayout?.(...args) ?? null,
      expandAllGroups: () => (dataGridRef.value as { expandAllGroups?: () => unknown } | null)?.expandAllGroups?.() ?? null,
      collapseAllGroups: () => (dataGridRef.value as { collapseAllGroups?: () => unknown } | null)?.collapseAllGroups?.() ?? null,
      insertRowsAt: (...args: unknown[]) => (dataGridRef.value as { insertRowsAt?: (...values: unknown[]) => unknown } | null)?.insertRowsAt?.(...args) ?? false,
      insertRowBefore: (...args: unknown[]) => (dataGridRef.value as { insertRowBefore?: (...values: unknown[]) => unknown } | null)?.insertRowBefore?.(...args) ?? false,
      insertRowAfter: (...args: unknown[]) => (dataGridRef.value as { insertRowAfter?: (...values: unknown[]) => unknown } | null)?.insertRowAfter?.(...args) ?? false,
      insertColumnsAt: (...args: unknown[]) => (dataGridRef.value as { insertColumnsAt?: (...values: unknown[]) => unknown } | null)?.insertColumnsAt?.(...args) ?? false,
      insertColumnBefore: (...args: unknown[]) => (dataGridRef.value as { insertColumnBefore?: (...values: unknown[]) => unknown } | null)?.insertColumnBefore?.(...args) ?? false,
      insertColumnAfter: (...args: unknown[]) => (dataGridRef.value as { insertColumnAfter?: (...values: unknown[]) => unknown } | null)?.insertColumnAfter?.(...args) ?? false,
    })

    return (): VNode => h(
      CommunityDataGrid as Component,
      {
        ...attrs,
        ref: dataGridRef,
        rowModel: resolvedRowModel.value,
        ...(resolvedVirtualization.value !== undefined
          ? { virtualization: resolvedVirtualization.value }
          : {}),
      },
      slots.default
        ? slots
        : {
            default: (slotProps: DataGridSlotProps) => h(DataGridEnterpriseRenderer as Component, {
              defaultRendererProps: slotProps.defaultRendererProps ?? {},
              blockedFeatures: blockedFeatures.value,
              diagnostics: resolvedDiagnostics.value,
              licenseSummary: licenseSummary.value,
              performanceSummary: diagnosticsPerformanceSummary.value,
            }),
          },
    )
  },
})
