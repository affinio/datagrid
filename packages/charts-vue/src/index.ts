export { default as AffinoBarChart } from "./AffinoBarChart.vue"
export { default as AffinoChartFrame } from "./AffinoChartFrame.vue"
export { default as AffinoLineChart } from "./AffinoLineChart.vue"
export { default as AffinoPieChart } from "./AffinoPieChart.vue"

export function createChartsVue(): { version: string } {
  return {
    version: "0.1.0",
  }
}

export type {
  AffinoBarChartBarEvent,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartThemeVariant,
} from "./types"
