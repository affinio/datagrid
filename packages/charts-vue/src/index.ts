export { default as AffinoChartFrame } from "./AffinoChartFrame.vue"

export function createChartsVue(): { version: string } {
  return {
    version: "0.1.0",
  }
}

export type { ChartAnchorRect, ChartInteractionPoint, ChartThemeVariant } from "./types"
