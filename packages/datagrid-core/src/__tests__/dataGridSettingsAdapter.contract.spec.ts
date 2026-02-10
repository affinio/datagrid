import { describe, expect, it } from "vitest"
import { createInMemoryDataGridSettingsAdapter } from "../dataGridSettingsAdapter"
import type { FilterStateSnapshot } from "../types/filters"

describe("dataGrid settings adapter filter snapshot cloning", () => {
  it("isolates stored snapshots from external mutations", () => {
    const adapter = createInMemoryDataGridSettingsAdapter()
    const now = new Date("2026-02-08T12:34:56.000Z")
    const snapshot: FilterStateSnapshot = {
      columnFilters: {
        status: ["open"],
      },
      advancedFilters: {
        createdAt: {
          type: "date",
          clauses: [
            {
              id: "created-at-eq",
              operator: "eq",
              value: now,
            },
          ],
        },
      },
    }

    adapter.setFilterSnapshot("grid-1", snapshot)

    snapshot.columnFilters.status?.push("closed")
    const originalValue = snapshot.advancedFilters.createdAt?.clauses[0]?.value
    if (originalValue instanceof Date) {
      originalValue.setUTCFullYear(2030)
    }

    const persisted = adapter.getFilterSnapshot("grid-1")
    expect(persisted?.columnFilters.status).toEqual(["open"])
    expect(persisted?.advancedFilters.createdAt?.clauses[0]?.value).toBeInstanceOf(Date)
    expect((persisted?.advancedFilters.createdAt?.clauses[0]?.value as Date).toISOString()).toBe(
      "2026-02-08T12:34:56.000Z",
    )
  })

  it("returns defensive copy on getFilterSnapshot", () => {
    const adapter = createInMemoryDataGridSettingsAdapter()
    adapter.setFilterSnapshot("grid-2", {
      columnFilters: {
        owner: ["noc"],
      },
      advancedFilters: {},
    })

    const firstRead = adapter.getFilterSnapshot("grid-2")
    firstRead?.columnFilters.owner?.push("platform")

    const secondRead = adapter.getFilterSnapshot("grid-2")
    expect(secondRead?.columnFilters.owner).toEqual(["noc"])
  })

  it("persists and restores full column state snapshot defensively", () => {
    const adapter = createInMemoryDataGridSettingsAdapter()

    adapter.setColumnState("grid-state", {
      order: ["owner", "service", "region"],
      visibility: {
        owner: true,
        service: true,
        region: false,
      },
      widths: {
        owner: 220,
        service: 180,
      },
      pinning: {
        owner: "left",
        region: "right",
      },
    })

    const firstRead = adapter.getColumnState("grid-state")
    expect(firstRead).toEqual({
      order: ["owner", "service", "region"],
      visibility: {
        owner: true,
        service: true,
        region: false,
      },
      widths: {
        owner: 220,
        service: 180,
      },
      pinning: {
        owner: "left",
        region: "right",
      },
    })

    firstRead?.order.push("extra")
    firstRead?.widths && (firstRead.widths.owner = 999)

    const secondRead = adapter.getColumnState("grid-state")
    expect(secondRead?.order).toEqual(["owner", "service", "region"])
    expect(secondRead?.widths.owner).toBe(220)
  })
})
