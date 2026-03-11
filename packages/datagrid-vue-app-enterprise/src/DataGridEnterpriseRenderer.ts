import {
  type Component,
  computed,
  defineComponent,
  h,
  shallowRef,
  type PropType,
} from "vue"
import {
  type DataGridApiDiagnosticsSnapshot,
  type DataGridApiFormulaExplainSnapshot,
  useDataGridAppDiagnosticsPanel,
} from "@affino/datagrid-vue"
import {
  DataGridDefaultRenderer,
  type DataGridAppInspectorPanel,
  type DataGridAppToolbarModule,
} from "@affino/datagrid-vue-app/internal"
import {
  DataGridDiagnosticsInspectorPanel,
  DataGridDiagnosticsTriggerButton,
} from "@affino/datagrid-diagnostics-enterprise"
import type { DataGridDiagnosticsOptions } from "./dataGridDiagnostics"
import DataGridEnterpriseLicenseBadge from "./DataGridEnterpriseLicenseBadge"
import type {
  AffinoDataGridEnterpriseBlockedFeature,
  AffinoDataGridEnterpriseLicenseSummary,
} from "./dataGridEnterpriseLicense"

interface RuntimeWithDiagnostics {
  api: {
    diagnostics: {
      getAll: () => DataGridApiDiagnosticsSnapshot
      getFormulaExplain: () => DataGridApiFormulaExplainSnapshot
    }
  }
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

interface DataGridEnterpriseDiagnosticsFormulaSummary {
  formulaCount: number
  executionLevels: number
  recomputedFieldCount: number
  runtimeErrorCount: number
  rowsTouched: number | null
  changedRows: number | null
  dirtyNodeCount: number
  hotFormulaFields: readonly string[]
}

interface DataGridEnterpriseDiagnosticsTraceEntry {
  id: string
  sourceLabel: string
  capturedAtLabel: string
  rowRevision: number | null
  rowCount: number
  configuredComputeMode: string
  effectiveComputeMode: string
  dispatchCount: number | null
  fallbackCount: number | null
  rowsTouched: number | null
  changedRows: number | null
  runtimeErrorCount: number
  dirtyNodeCount: number
  hotFormulaFields: readonly string[]
}

const MAX_ENTERPRISE_DIAGNOSTIC_TRACES = 6

export default defineComponent({
  name: "DataGridEnterpriseRenderer",
  props: {
    defaultRendererProps: {
      type: Object as PropType<Record<string, unknown>>,
      required: true,
    },
    diagnostics: {
      type: Object as PropType<DataGridDiagnosticsOptions>,
      required: true,
    },
    blockedFeatures: {
      type: Array as PropType<readonly AffinoDataGridEnterpriseBlockedFeature[]>,
      required: true,
    },
    licenseSummary: {
      type: Object as PropType<AffinoDataGridEnterpriseLicenseSummary>,
      required: true,
    },
    performanceSummary: {
      type: Object as PropType<DataGridEnterpriseDiagnosticsPerformanceSummary | null>,
      required: true,
    },
  },
  setup(props) {
    const runtime = computed(() => props.defaultRendererProps.runtime as RuntimeWithDiagnostics)
    const formulaExplainSnapshot = shallowRef<DataGridApiFormulaExplainSnapshot | null>(null)
    const traceHistory = shallowRef<readonly DataGridEnterpriseDiagnosticsTraceEntry[]>([])
    const existingToolbarModules = computed<readonly DataGridAppToolbarModule[]>(() => {
      const value = props.defaultRendererProps.toolbarModules
      return Array.isArray(value) ? value as readonly DataGridAppToolbarModule[] : []
    })
    const {
      isDiagnosticsPanelOpen,
      diagnosticsSnapshot,
      openDiagnosticsPanel,
      closeDiagnosticsPanel,
      refreshDiagnosticsPanel,
    } = useDataGridAppDiagnosticsPanel<DataGridApiDiagnosticsSnapshot>({
      readDiagnostics: () => runtime.value.api.diagnostics.getAll(),
    })
    const formulaSummary = computed<DataGridEnterpriseDiagnosticsFormulaSummary | null>(() => {
      const snapshot = formulaExplainSnapshot.value
      if (!snapshot) {
        return null
      }

      const formulas = Array.isArray(snapshot.formulas) ? snapshot.formulas : []
      const executionLevels = Array.isArray(snapshot.executionPlan?.levels)
        ? snapshot.executionPlan.levels.length
        : 0
      const recomputedFieldCount = Array.isArray(snapshot.projectionFormula?.recomputedFields)
        ? snapshot.projectionFormula.recomputedFields.length
        : 0
      const dirtyNodeCount = Array.isArray(snapshot.computeStage?.dirtyNodes)
        ? snapshot.computeStage.dirtyNodes.length
        : 0
      const hotFormulaFields = formulas
        .filter(entry => entry.dirty || entry.recomputed || entry.touched)
        .slice(0, 3)
        .map(entry => entry.field)

      if (
        formulas.length === 0
        && executionLevels === 0
        && recomputedFieldCount === 0
        && dirtyNodeCount === 0
      ) {
        return null
      }

      return {
        formulaCount: formulas.length,
        executionLevels,
        recomputedFieldCount,
        runtimeErrorCount: snapshot.projectionFormula?.runtimeErrorCount ?? 0,
        rowsTouched: snapshot.computeStage?.rowsTouched ?? null,
        changedRows: snapshot.computeStage?.changedRows ?? null,
        dirtyNodeCount,
        hotFormulaFields,
      }
    })

    const appendTraceEntry = (
      sourceLabel: string,
      diagnostics: DataGridApiDiagnosticsSnapshot,
      formulaExplain: DataGridApiFormulaExplainSnapshot,
    ): void => {
      const formulas = Array.isArray(formulaExplain.formulas) ? formulaExplain.formulas : []
      const hotFormulaFields = formulas
        .filter(entry => entry.dirty || entry.recomputed || entry.touched)
        .slice(0, 3)
        .map(entry => entry.field)
      const nextEntry: DataGridEnterpriseDiagnosticsTraceEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sourceLabel,
        capturedAtLabel: new Date().toISOString().slice(11, 19),
        rowRevision: diagnostics.rowModel.revision,
        rowCount: diagnostics.rowModel.rowCount,
        configuredComputeMode: diagnostics.compute?.configuredMode ?? "sync",
        effectiveComputeMode: diagnostics.compute?.effectiveMode ?? "sync",
        dispatchCount: diagnostics.compute?.dispatchCount ?? null,
        fallbackCount: diagnostics.compute?.fallbackCount ?? null,
        rowsTouched: formulaExplain.computeStage?.rowsTouched ?? null,
        changedRows: formulaExplain.computeStage?.changedRows ?? null,
        runtimeErrorCount: formulaExplain.projectionFormula?.runtimeErrorCount ?? 0,
        dirtyNodeCount: Array.isArray(formulaExplain.computeStage?.dirtyNodes)
          ? formulaExplain.computeStage.dirtyNodes.length
          : 0,
        hotFormulaFields,
      }
      traceHistory.value = [
        nextEntry,
        ...traceHistory.value,
      ].slice(0, MAX_ENTERPRISE_DIAGNOSTIC_TRACES)
    }

    const captureEnterpriseDiagnostics = (sourceLabel: string): void => {
      const diagnostics = runtime.value.api.diagnostics.getAll()
      const formulaExplain = runtime.value.api.diagnostics.getFormulaExplain()
      formulaExplainSnapshot.value = formulaExplain
      appendTraceEntry(sourceLabel, diagnostics, formulaExplain)
    }

    const refreshEnterpriseDiagnosticsPanel = (): void => {
      refreshDiagnosticsPanel()
      captureEnterpriseDiagnostics("refreshed")
    }

    const openEnterpriseDiagnosticsPanel = (): void => {
      openDiagnosticsPanel()
      captureEnterpriseDiagnostics("opened")
    }

    const closeEnterpriseDiagnosticsPanel = (): void => {
      closeDiagnosticsPanel()
    }

    const toggleEnterpriseDiagnosticsPanel = (): void => {
      if (isDiagnosticsPanelOpen.value) {
        closeEnterpriseDiagnosticsPanel()
        return
      }
      openEnterpriseDiagnosticsPanel()
    }

    const toolbarModules = computed<readonly DataGridAppToolbarModule[]>(() => {
      const modules: DataGridAppToolbarModule[] = [...existingToolbarModules.value]
      if (
        props.blockedFeatures.length > 0
        || props.licenseSummary.isTrial
        || props.licenseSummary.status === "expired"
        || props.licenseSummary.status === "invalid"
      ) {
        modules.push({
          key: "enterprise-license",
          component: DataGridEnterpriseLicenseBadge as Component,
          props: {
            blockedFeatures: props.blockedFeatures,
            licenseSummary: props.licenseSummary,
          },
        })
      }
      if (props.diagnostics.enabled) {
        modules.push({
          key: "diagnostics",
          component: DataGridDiagnosticsTriggerButton as Component,
          props: {
            buttonLabel: props.diagnostics.buttonLabel,
            active: isDiagnosticsPanelOpen.value,
            onToggle: toggleEnterpriseDiagnosticsPanel,
          },
        })
      }
      return modules
    })

    const inspectorPanel = computed<DataGridAppInspectorPanel | null>(() => {
      if (!props.diagnostics.enabled || !isDiagnosticsPanelOpen.value) {
        return null
      }
      return {
        component: DataGridDiagnosticsInspectorPanel as Component,
        props: {
          licenseSummary: props.licenseSummary,
          snapshot: diagnosticsSnapshot.value,
          performanceSummary: props.performanceSummary,
          formulaSummary: formulaSummary.value,
          traceHistory: traceHistory.value,
          onClose: closeEnterpriseDiagnosticsPanel,
          onRefresh: refreshEnterpriseDiagnosticsPanel,
        },
      }
    })

    return () => h(DataGridDefaultRenderer as Component, {
      ...props.defaultRendererProps,
      toolbarModules: toolbarModules.value,
      inspectorPanel: inspectorPanel.value,
    })
  },
})
