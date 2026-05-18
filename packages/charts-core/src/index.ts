export type {
  ChartDatum,
  ChartMargin,
  ChartPoint,
  ChartRect,
  ChartSize,
} from "./types"
export {
  getChartNumberValue,
  getChartStringValue,
  isFiniteChartNumber,
} from "./data"

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
