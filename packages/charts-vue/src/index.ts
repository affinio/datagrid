export { default as AffinoBarChart } from "./AffinoBarChart.vue"
export { default as AffinoChartFrame } from "./AffinoChartFrame.vue"

export function createChartsVue(): { version: string } {
  return {
    version: "0.1.0",
  }
}

export type {
  AffinoBarChartBarEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartThemeVariant,
} from "./types"
