import { defineComponent, h, provide, ref } from "vue"
import DataGrid from "./DataGrid"
import DataGridGanttStage from "./gantt/DataGridGanttStageEntry"
import { dataGridGanttStageKey } from "./gantt/dataGridGanttStageContext"

const DataGridWithGanttImpl = defineComponent({
  name: "DataGridWithGantt",
  inheritAttrs: false,
  props: DataGrid.props,
  emits: DataGrid.emits as any,
  setup(props, { attrs, slots, expose }) {
    provide(dataGridGanttStageKey, DataGridGanttStage)
    const gridRef = ref<any>(null)
    expose(new Proxy({}, { get: (_, key: string | symbol) => gridRef.value?.[key] }))
    return () => h(DataGrid as any, { ...props, ...attrs, ref: gridRef } as any, slots as any)
  },
})

export const DataGridWithGantt = DataGridWithGanttImpl as typeof DataGrid
export { DataGridWithGantt as DataGrid }
export { DataGridGanttStage }

export {
  buildDataGridTimelineRenderModels,
  normalizeDataGridGanttOptions,
  resolveDataGridTimelineRange,
} from "./gantt/dataGridGantt"

export type {
  DataGridAppViewMode,
  DataGridGanttDependencyRef,
  DataGridGanttDependencyType,
  DataGridGanttOptions,
  DataGridGanttProp,
  DataGridGanttZoomLevel,
  DataGridResolvedWorkingCalendar,
  DataGridTimelineHorizontalAlign,
  DataGridTimelineLine,
  DataGridTimelineModel,
  DataGridTimelineRange,
  DataGridTimelineRenderModels,
  DataGridTimelineSegment,
  DataGridTimelineSpan,
  DataGridTimelineViewport,
  DataGridWorkingCalendar,
  BuildDataGridTimelineRenderModelsInput,
  ResolveDataGridTimelineRangeInput,
} from "./gantt/dataGridGantt.types"