import { createAdvancedClientRowModel } from "../packages/datagrid-core/dist/src/advanced.js"

const sizes = (process.env.BENCH_ROW_SIZES ?? "1000,10000,50000").split(",").map(Number)
const samples = Number(process.env.BENCH_SAMPLES ?? 25)
const warmups = Number(process.env.BENCH_WARMUPS ?? 4)

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: `r${index}`, value: index, label: `row-${index}` },
    rowId: `r${index}`,
    originalIndex: index,
  }))
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}

function measure(count, operation) {
  const durations = []
  let fullRebuilds = 0
  let notifications = 0
  for (let index = 0; index < warmups + samples; index += 1) {
    const raw = createAdvancedClientRowModel({ rows: rows(count) })
    let currentFullRebuilds = 0
    let currentNotifications = 0
    raw.subscribe(() => { currentNotifications += 1 })
    const model = new Proxy(raw, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver)
        if (property === "setRows" || property === "replaceRows") {
          return (...args) => {
            currentFullRebuilds += 1
            return value.apply(target, args)
          }
        }
        return typeof value === "function" ? value.bind(target) : value
      },
    })
    const start = performance.now()
    operation(model, count)
    const elapsed = performance.now() - start
    if (index >= warmups) {
      durations.push(elapsed)
      fullRebuilds += currentFullRebuilds
      notifications += currentNotifications
    }
    model.dispose?.()
  }
  return {
    medianMs: Number(percentile(durations, 0.5).toFixed(3)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    medianFullRebuilds: fullRebuilds / samples,
    medianNotifications: notifications / samples,
  }
}

const scenarios = {
  editOne(model, count) {
    model.patchRows([{ rowId: `r${Math.floor(count / 2)}`, data: { value: -1 } }])
  },
  insertOne(model, count) {
    model.insertRowsAt(Math.floor(count / 2), [{ row: { id: "inserted", value: -1 }, rowId: "inserted" }])
  },
  deleteOne(model, count) {
    model.removeRows([`r${Math.floor(count / 2)}`])
  },
  patchBatch100(model, count) {
    const updates = Array.from({ length: 100 }, (_, index) => ({
      rowId: `r${index}`,
      data: { value: -index - 1 },
    }))
    model.batchMutations(() => model.patchRows(updates))
  },
}

console.log(JSON.stringify({
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    samples,
    warmups,
    browserRenderMeasured: false,
  },
  results: sizes.map(count => ({
    rows: count,
    operations: Object.fromEntries(Object.entries(scenarios).map(([name, operation]) => [name, measure(count, operation)])),
  })),
}, null, 2))
