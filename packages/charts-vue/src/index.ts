export { default as AffinoBarChart } from "./AffinoBarChart.vue"
export { default as AffinoChartFrame } from "./AffinoChartFrame.vue"
export { default as AffinoChartLegend } from "./AffinoChartLegend.vue"
export { default as AffinoLineChart } from "./AffinoLineChart.vue"
export { default as AffinoMetricCard } from "./AffinoMetricCard.vue"
export { default as AffinoPieChart } from "./AffinoPieChart.vue"

export function createChartsVue(): { version: string } {
  return {
    version: "0.1.0",
  }
}

export type {
  AffinoBarChartBarEvent,
  AffinoChartInteractionPayload,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartLegendItem,
  ChartLegendOrientation,
  ChartThemeVariant,
} from "./types"
