export type {
  ChartDatum,
  ChartMargin,
  ChartPoint,
  ChartRect,
  ChartSize,
} from "./types"

export function createChartsCore(): { version: string } {
  return { version: "0.1.0" }
}
