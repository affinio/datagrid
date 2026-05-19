export { default as AffinoAreaChart } from "./AffinoAreaChart.vue"
export { default as AffinoBarChart } from "./AffinoBarChart.vue"
export { default as AffinoChartFrame } from "./AffinoChartFrame.vue"
export { default as AffinoChartLegend } from "./AffinoChartLegend.vue"
export { default as AffinoHistogram } from "./AffinoHistogram.vue"
export { default as AffinoLineChart } from "./AffinoLineChart.vue"
export { default as AffinoMetricCard } from "./AffinoMetricCard.vue"
export { default as AffinoPieChart } from "./AffinoPieChart.vue"
export { default as AffinoScatterChart } from "./AffinoScatterChart.vue"

export function createChartsVue(): { version: string } {
  return {
    version: "0.1.0",
  }
}

export type {
  AffinoAreaChartPointEvent,
  AffinoBarChartBarEvent,
  AffinoChartInteractionPayload,
  AffinoHistogramBinEvent,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  AffinoScatterChartPointEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartLegendItem,
  ChartLegendOrientation,
  ChartThemeVariant,
} from "./types"
