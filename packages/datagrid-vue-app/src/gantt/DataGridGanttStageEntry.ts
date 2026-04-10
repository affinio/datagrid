import { defineComponent, h, type PropType } from "vue"
import type { UseDataGridRuntimeResult } from "@affino/datagrid-vue"
import DataGridGanttStage from "./DataGridGanttStage.vue"
import {
  normalizeDataGridGanttOptions,
} from "./dataGridGantt"
import type { DataGridGanttProp } from "./dataGridGantt.types"
import type { DataGridTableStageContext } from "../stage/dataGridTableStageContext"

export default defineComponent({
  name: "DataGridGanttStageEntry",
  props: {
    stageContext: {
      type: Object as PropType<DataGridTableStageContext<Record<string, unknown>>>,
      required: true,
    },
    runtime: {
      type: Object as PropType<Pick<UseDataGridRuntimeResult<Record<string, unknown>>, "api">>,
      required: true,
    },
    gantt: {
      type: [Boolean, Object] as PropType<DataGridGanttProp | undefined>,
      default: undefined,
    },
    baseRowHeight: {
      type: Number,
      required: true,
    },
    rowVersion: {
      type: Number,
      required: true,
    },
  },
  setup(props) {
    return () => h(DataGridGanttStage, {
      stageContext: props.stageContext,
      runtime: props.runtime,
      gantt: normalizeDataGridGanttOptions(props.gantt),
      baseRowHeight: props.baseRowHeight,
      rowVersion: props.rowVersion,
    })
  },
})