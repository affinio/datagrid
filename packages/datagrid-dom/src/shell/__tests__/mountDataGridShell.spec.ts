import { afterEach, describe, expect, it, vi } from "vitest"
import { mountDataGridShell, type DataGridDomShellHandle } from "../../index.js"

interface PersonRow {
  id: string
  name: string
  team: string
}

const rows: readonly PersonRow[] = [
  { id: "p1", name: "Ada Lovelace", team: "Engine" },
  { id: "p2", name: "Grace Hopper", team: "Platform" },
]

describe("DOM DataGrid shell", () => {
  let handle: DataGridDomShellHandle<PersonRow> | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await handle?.destroy()
    handle = undefined
    root?.remove()
  })

  it("uses the shared filter model for its quick-filter control", async () => {
    root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGridShell(root, {
      rows,
      columns: [
        { key: "name", field: "name", label: "Name" },
        { key: "team", field: "team", label: "Team" },
      ],
      quickFilter: { placeholder: "Search people", columns: ["name"], mode: "contains" },
    })
    await handle.ready

    const input = root.querySelector<HTMLInputElement>('input[aria-label="Quick filter"]')!
    expect(root.querySelector('[data-row-selection-select-all]')).not.toBeNull()
    expect(input.placeholder).toBe("Search people")
    input.value = "grace"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(readNames(root)).toEqual(["Grace Hopper"])
    expect(handle.api.rows.getSnapshot().filterModel?.quickFilter).toMatchObject({
      query: "grace",
      columns: ["name"],
      mode: "contains",
    })
  })

  it("preserves other filter clauses and supports manual apply and shell actions", async () => {
    root = document.createElement("div")
    document.body.append(root)
    const action = vi.fn(async api => {
      api.rows.setFilterModel(null)
    })
    handle = mountDataGridShell(root, {
      rows,
      columns: [
        { key: "name", field: "name", label: "Name" },
        { key: "team", field: "team", label: "Team" },
      ],
      quickFilter: { applyMode: "manual" },
      toolbar: { actions: [{ key: "clear-all", label: "Clear all", onAction: action }] },
    })
    await handle.ready
    handle.api.rows.setFilterModel({
      columnFilters: { team: { kind: "valueSet", tokens: ["string:Engine"] } },
    })

    const input = root.querySelector<HTMLInputElement>('input[aria-label="Quick filter"]')!
    input.value = "Ada"
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(handle.api.rows.getSnapshot().filterModel?.quickFilter).toBeUndefined()

    root.querySelector<HTMLButtonElement>("[data-action='apply-filter']")!.click()
    expect(handle.api.rows.getSnapshot().filterModel).toMatchObject({
      columnFilters: { team: { kind: "valueSet", tokens: ["string:Engine"] } },
      quickFilter: { query: "Ada", mode: "contains" },
    })

    root.querySelector<HTMLButtonElement>("[data-toolbar-action='clear-all']")!.click()
    await Promise.resolve()
    expect(action).toHaveBeenCalledOnce()
    expect(handle.api.rows.getSnapshot().filterModel).toBeNull()
  })
})

function readNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".affino-grid-dom__body [role=row]"))
    .map(row => row.querySelector('[role="gridcell"][data-column-index="0"]')?.textContent ?? "")
}
