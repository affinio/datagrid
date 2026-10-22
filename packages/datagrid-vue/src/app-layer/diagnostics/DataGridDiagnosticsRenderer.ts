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
} from "@affino/datagrid-core"
import { useDataGridDiagnosticsPanel } from "./useDataGridDiagnosticsPanel"
import DataGridDefaultRenderer from "../host/DataGridDefaultRenderer"
import type {
  DataGridAppInspectorPanel,
  DataGridAppToolbarModule,
} from "../host/DataGridModuleHost"
import DataGridDiagnosticsInspectorPanel from "./DataGridDiagnosticsInspectorPanel.vue"
import DataGridDiagnosticsTriggerButton from "./DataGridDiagnosticsTriggerButton"
import type { DataGridDiagnosticsOptions } from "../config/dataGridDiagnostics"

interface RuntimeWithDiagnostics {
  api: {
    diagnostics: {
      getAll: () => DataGridApiDiagnosticsSnapshot
      getFormulaExplain: () => DataGridApiFormulaExplainSnapshot
    }
  }
}

interface DataGridDiagnosticsPerformanceSummary {
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

interface DataGridDiagnosticsFormulaSummary {
  formulaCount: number
  executionLevels: number
  recomputedFieldCount: number
  runtimeErrorCount: number
  rowsTouched: number | null
  changedRows: number | null
  dirtyNodeCount: number
  hotFormulaFields: readonly string[]
}

interface DataGridDiagnosticsTraceEntry {
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

const MAX_DIAGNOSTIC_TRACES = 6

export default defineComponent({
  name: "DataGridDiagnosticsRenderer",
  props: {
    defaultRendererProps: {
      type: Object as PropType<Record<string, unknown>>,
      required: true,
    },
    diagnostics: {
      type: Object as PropType<DataGridDiagnosticsOptions>,
      required: true,
    },
    performanceSummary: {
      type: Object as PropType<DataGridDiagnosticsPerformanceSummary | null>,
      default: null,
    },
  },
  setup(props) {
    const runtime = computed(() => props.defaultRendererProps.runtime as RuntimeWithDiagnostics)
    const formulaExplainSnapshot = shallowRef<DataGridApiFormulaExplainSnapshot | null>(null)
    const traceHistory = shallowRef<readonly DataGridDiagnosticsTraceEntry[]>([])
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
    } = useDataGridDiagnosticsPanel<DataGridApiDiagnosticsSnapshot>({
      readDiagnostics: () => runtime.value.api.diagnostics.getAll(),
    })
    const formulaSummary = computed<DataGridDiagnosticsFormulaSummary | null>(() => {
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
      const nextEntry: DataGridDiagnosticsTraceEntry = {
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
      ].slice(0, MAX_DIAGNOSTIC_TRACES)
    }

    const captureDataGridDiagnostics = (sourceLabel: string): void => {
      const diagnostics = runtime.value.api.diagnostics.getAll()
      const formulaExplain = runtime.value.api.diagnostics.getFormulaExplain()
      formulaExplainSnapshot.value = formulaExplain
      appendTraceEntry(sourceLabel, diagnostics, formulaExplain)
    }

    const refreshDataGridDiagnosticsPanel = (): void => {
      refreshDiagnosticsPanel()
      captureDataGridDiagnostics("refreshed")
    }

    const openDataGridDiagnosticsPanel = (): void => {
      openDiagnosticsPanel()
      captureDataGridDiagnostics("opened")
    }

    const closeDataGridDiagnosticsPanel = (): void => {
      closeDiagnosticsPanel()
    }

    const toggleDataGridDiagnosticsPanel = (): void => {
      if (isDiagnosticsPanelOpen.value) {
        closeDataGridDiagnosticsPanel()
        return
      }
      openDataGridDiagnosticsPanel()
    }

    const toolbarModules = computed<readonly DataGridAppToolbarModule[]>(() => {
      const modules: DataGridAppToolbarModule[] = [...existingToolbarModules.value]
      if (props.diagnostics.enabled) {
        modules.push({
          key: "diagnostics",
          component: DataGridDiagnosticsTriggerButton as Component,
          props: {
            buttonLabel: props.diagnostics.buttonLabel,
            active: isDiagnosticsPanelOpen.value,
            onToggle: toggleDataGridDiagnosticsPanel,
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
          snapshot: diagnosticsSnapshot.value,
          performanceSummary: props.performanceSummary,
          formulaSummary: formulaSummary.value,
          traceHistory: traceHistory.value,
          onClose: closeDataGridDiagnosticsPanel,
          onRefresh: refreshDataGridDiagnosticsPanel,
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
