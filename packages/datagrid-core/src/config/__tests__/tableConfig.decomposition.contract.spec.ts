import { describe, expect, it } from "vitest"
import {
  DEFAULT_LAZY_PAGE_SIZE,
  migrateLegacyUiTableConfig,
  normalizeTableConfigSections,
  normalizeTableProps,
} from "../tableConfig"

describe("table config decomposition", () => {
  it("migrates legacy flat props into canonical config sections with legacy precedence", () => {
    const onReachBottom = () => {}
    const onFiltersReset = () => {}
    const configPlugin = { id: "config-plugin", setup: () => {} }
    const rawPlugin = { id: "raw-plugin", setup: () => {} }

    const migrated = migrateLegacyUiTableConfig({
      tableId: "raw-table",
      rows: [{ id: 1 }],
      totalRows: 91,
      rowHeight: 48,
      selectable: true,
      selected: [1],
      pageSize: 40,
      showZoom: true,
      events: { filtersReset: onFiltersReset },
      plugins: [rawPlugin],
      config: {
        tableId: "config-table",
        data: { rows: [{ id: -1 }], totalRows: 3 },
        appearance: { rowHeight: 22 },
        selection: { enabled: false },
        load: { pageSize: 10 },
        events: { reachBottom: onReachBottom },
        plugins: [configPlugin],
      },
    })

    expect(migrated.tableId).toBe("raw-table")
    expect(migrated.data?.rows).toEqual([{ id: 1 }])
    expect(migrated.data?.totalRows).toBe(91)
    expect(migrated.appearance?.rowHeight).toBe(48)
    expect(migrated.selection?.enabled).toBe(true)
    expect(migrated.selection?.selected).toEqual([1])
    expect(migrated.load?.pageSize).toBe(40)
    expect(migrated.features?.zoom).toBe(true)
    expect(migrated.events?.reachBottom).toBe(onReachBottom)
    expect(migrated.events?.filtersReset).toBe(onFiltersReset)
    expect(migrated.plugins?.map(item => item.id)).toEqual(["raw-plugin"])
  })

  it("normalizes into isolated data/model/view/interaction sections", () => {
    const onReachBottom = () => {}
    const sections = normalizeTableConfigSections({
      config: {
        data: { rows: [{ id: 1 }], totalRows: 33 },
        events: { reachBottom: onReachBottom },
      },
    })

    expect(sections.data.rows).toEqual([{ id: 1 }])
    expect(sections.data.totalRows).toBe(33)
    expect(sections.model.tableId).toBe("default")
    expect(sections.view.inlineControls).toBe(true)
    expect(sections.view.hoverable).toBe(true)
    expect(sections.interaction.pageSize).toBe(DEFAULT_LAZY_PAGE_SIZE)
    expect(sections.interaction.events.reachBottom).toBe(onReachBottom)
  })

  it("keeps selection controlled invariant from state.selected fallback", () => {
    const normalized = normalizeTableProps({
      config: {
        selection: { enabled: true },
        state: { selected: ["row-1"] },
      },
    })

    expect(normalized.selection.enabled).toBe(true)
    expect(normalized.selection.controlled).toBe(true)
    expect(normalized.selection.selected).toEqual(["row-1"])
  })

  it("preserves legacy defaults when optional config is omitted", () => {
    const normalized = normalizeTableProps({})

    expect(normalized.rows).toEqual([])
    expect(normalized.columns).toEqual([])
    expect(normalized.columnGroups).toEqual([])
    expect(normalized.pageSize).toBe(DEFAULT_LAZY_PAGE_SIZE)
    expect(normalized.rowHeight).toBeGreaterThan(0)
    expect(normalized.inlineControls).toBe(true)
    expect(normalized.hoverable).toBe(true)
    expect(normalized.selection.enabled).toBe(false)
    expect(normalized.events).toEqual({})
    expect(normalized.plugins).toEqual([])
  })
})
