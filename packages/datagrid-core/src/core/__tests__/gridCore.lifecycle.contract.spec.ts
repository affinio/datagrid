import { describe, expect, it } from "vitest"
import {
  createDataGridCore,
  type DataGridCoreServiceByName,
  type DataGridCoreServiceName,
} from "../gridCore"

function createTrackedService<TName extends DataGridCoreServiceName>(
  name: TName,
  log: string[],
): DataGridCoreServiceByName[TName] {
  return {
    name,
    init() {
      log.push(`init:${name}`)
    },
    start() {
      log.push(`start:${name}`)
    },
    stop() {
      log.push(`stop:${name}`)
    },
    dispose() {
      log.push(`dispose:${name}`)
    },
  } as DataGridCoreServiceByName[TName]
}

describe("data grid core service registry lifecycle", () => {
  it("runs init/start in deterministic startup order", async () => {
    const log: string[] = []
    const core = createDataGridCore({
      services: {
        viewport: createTrackedService("viewport", log),
        selection: createTrackedService("selection", log),
        columnModel: createTrackedService("columnModel", log),
        rowModel: createTrackedService("rowModel", log),
        event: createTrackedService("event", log),
      },
      startupOrder: ["viewport", "selection"],
    })

    await core.start()

    expect(core.lifecycle.startupOrder).toEqual([
      "viewport",
      "selection",
      "event",
      "rowModel",
      "columnModel",
      "edit",
      "transaction",
    ])
    expect(log).toEqual([
      "init:viewport",
      "init:selection",
      "init:event",
      "init:rowModel",
      "init:columnModel",
      "start:viewport",
      "start:selection",
      "start:event",
      "start:rowModel",
      "start:columnModel",
    ])
  })

  it("runs stop/dispose in reverse order and is idempotent", async () => {
    const log: string[] = []
    const core = createDataGridCore({
      services: {
        event: createTrackedService("event", log),
        rowModel: createTrackedService("rowModel", log),
        columnModel: createTrackedService("columnModel", log),
        selection: createTrackedService("selection", log),
        viewport: createTrackedService("viewport", log),
      },
    })

    await core.start()
    await core.stop()
    await core.stop()
    await core.dispose()
    await core.dispose()

    expect(log.slice(10)).toEqual([
      "stop:viewport",
      "stop:selection",
      "stop:columnModel",
      "stop:rowModel",
      "stop:event",
      "dispose:viewport",
      "dispose:selection",
      "dispose:columnModel",
      "dispose:rowModel",
      "dispose:event",
    ])
  })

  it("exposes service lookup from registry", async () => {
    const log: string[] = []
    const event = createTrackedService("event", log)
    const core = createDataGridCore({
      services: { event },
    })

    expect(core.getService("event")).toBe(event)
    expect(core.services.event).toBe(event)

    await core.init()
    expect(core.lifecycle.state).toBe("initialized")
  })
})
