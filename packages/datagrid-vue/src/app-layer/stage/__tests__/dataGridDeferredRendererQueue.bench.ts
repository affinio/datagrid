import { bench, describe } from "vitest"
import { createDataGridDeferredRendererQueue } from "../dataGridDeferredRendererQueue"

describe("deferred renderer queue", () => {
  bench("enqueue and flush 512 prioritized cells", () => {
    const queue = createDataGridDeferredRendererQueue(512)
    for (let index = 0; index < 512; index += 1) {
      queue.enqueue({
        key: `cell-${index}`,
        priority: index % 3 === 0 ? "visible" : "overscan",
        render: () => undefined,
      })
    }
    queue.flush(64)
  }, { iterations: 10, time: 500 })
})
