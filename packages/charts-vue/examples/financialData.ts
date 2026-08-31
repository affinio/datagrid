import type { TimeSeries } from "@affino/charts-core"

const day = 86_400_000
const start = Date.UTC(2025, 0, 1)

export const balanceEquitySeries: TimeSeries[] = [
  {
    id: "balance",
    label: "Balance",
    data: Array.from({ length: 12 }, (_, index) => ({
      time: start + index * 30 * day,
      value: 10_000 + index * 320,
    })),
  },
  {
    id: "equity",
    label: "Equity",
    data: Array.from({ length: 12 }, (_, index) => ({
      time: start + index * 30 * day,
      value: 10_000 + index * 320 + Math.sin(index * 1.7) * 420,
    })),
  },
]

export const drawdownSeries: TimeSeries[] = [{
  id: "drawdown",
  label: "Drawdown",
  presentation: { type: "area" },
  data: [0, -0.018, -0.041, -0.027, -0.086, -0.052, -0.12, -0.073, -0.034, 0].map((value, index) => ({
    time: start + index * 30 * day,
    value,
  })),
}]

export const periodicReturns = [
  { month: "Jan", value: 0.032 },
  { month: "Feb", value: -0.018 },
  { month: "Mar", value: 0 },
  { month: "Apr", value: 0.047 },
  { month: "May", value: -0.026 },
  { month: "Jun", value: 0.021 },
]
