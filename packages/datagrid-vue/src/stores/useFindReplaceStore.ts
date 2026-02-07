import { computed, reactive } from "vue"
import type { UiTableColumn, VisibleRow } from "@affino/datagrid-core/types"

export type FindReplaceMode = "find" | "replace"

export interface FindReplaceMatch {
  rowIndex: number
  columnKey: string
  value: string
}

interface FindReplaceContext {
  getRows: () => VisibleRow[]
  getColumns: () => UiTableColumn[]
  scrollToCell: (rowIndex: number, columnKey: string) => Promise<void> | void
  selectCell: (rowIndex: number, columnKey: string) => void
  getCellValue: (rowIndex: number, columnKey: string) => unknown
  setCellValue: (rowIndex: number, columnKey: string | number, value: unknown) => boolean
  focusContainer: () => void
  undo: () => void
  redo: () => void
}

interface FindReplaceStoreState {
  isActive: boolean
  mode: FindReplaceMode
  query: string
  replaceText: string
  matchCase: boolean
  searchAllColumns: boolean
  searching: boolean
  matches: FindReplaceMatch[]
  currentIndex: number
  activeColumn: string | null
  context: FindReplaceContext | null
}

function normalizeText(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function testMatch(source: string, query: string, matchCase: boolean): boolean {
  if (!query.length) return false
  if (matchCase) {
    return source.includes(query)
  }
  return source.toLowerCase().includes(query.toLowerCase())
}

const state = reactive<FindReplaceStoreState>({
  isActive: false,
  mode: "find",
  query: "",
  replaceText: "",
  matchCase: false,
  searchAllColumns: false,
  searching: false,
  matches: [],
  currentIndex: 0,
  activeColumn: null,
  context: null,
})

async function focusByIndex(index: number) {
  const context = state.context
  if (!context || !state.matches.length) {
    return
  }
  const bounded = ((index % state.matches.length) + state.matches.length) % state.matches.length
  const match = state.matches[bounded]
  state.currentIndex = bounded
  await context.scrollToCell(match.rowIndex, match.columnKey)
  context.selectCell(match.rowIndex, match.columnKey)
}

function resolveSearchColumns(columns: UiTableColumn[]): UiTableColumn[] {
  const searchable = columns.filter(column => !column.isSystem)
  if (state.searchAllColumns) {
    return searchable
  }
  if (state.activeColumn) {
    const active = searchable.find(column => column.key === state.activeColumn)
    if (active) return [active]
  }
  return searchable.length ? [searchable[0]] : []
}

async function runSearch(nextQuery?: string) {
  const context = state.context
  const query = (nextQuery ?? state.query ?? "").trim()
  state.query = nextQuery ?? state.query

  if (!context || !query) {
    state.matches = []
    state.currentIndex = 0
    return
  }

  state.searching = true
  try {
    const columns = resolveSearchColumns(context.getColumns())
    const rows = context.getRows()
    const found: FindReplaceMatch[] = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const rowValue = (row?.row ?? null) as Record<string, unknown> | null
      if (!rowValue || rowValue.__group === true) {
        continue
      }
      const rowIndex = typeof row.displayIndex === "number" ? row.displayIndex : index
      if (rowIndex < 0) {
        continue
      }

      for (const column of columns) {
        const raw = context.getCellValue(rowIndex, column.key)
        const text = normalizeText(raw)
        if (!testMatch(text, query, state.matchCase)) {
          continue
        }
        found.push({
          rowIndex,
          columnKey: column.key,
          value: text,
        })
      }
    }

    state.matches = found
    state.currentIndex = 0
    if (found.length) {
      await focusByIndex(0)
    }
  } finally {
    state.searching = false
  }
}

async function replaceAt(index: number) {
  const context = state.context
  const match = state.matches[index]
  if (!context || !match) {
    return false
  }
  const applied = context.setCellValue(match.rowIndex, match.columnKey, state.replaceText)
  if (!applied) {
    return false
  }
  await runSearch(state.query)
  return true
}

export function useFindReplaceStore() {
  const activeMatchKey = computed(() => {
    const match = state.matches[state.currentIndex]
    if (!match) return null
    return `${match.rowIndex}:${match.columnKey}`
  })

  return {
    get isActive() {
      return state.isActive
    },
    get mode() {
      return state.mode
    },
    get query() {
      return state.query
    },
    set query(value: string) {
      state.query = value ?? ""
    },
    get replaceText() {
      return state.replaceText
    },
    set replaceText(value: string) {
      state.replaceText = value ?? ""
    },
    get matchCase() {
      return state.matchCase
    },
    set matchCase(value: boolean) {
      state.matchCase = Boolean(value)
    },
    get searchAllColumns() {
      return state.searchAllColumns
    },
    set searchAllColumns(value: boolean) {
      state.searchAllColumns = Boolean(value)
    },
    get searching() {
      return state.searching
    },
    get matches() {
      return state.matches
    },
    get currentIndex() {
      return state.currentIndex
    },
    get activeMatchKey() {
      return activeMatchKey.value
    },

    activate(mode: FindReplaceMode) {
      state.mode = mode
      state.isActive = true
    },

    deactivate() {
      state.isActive = false
      state.mode = "find"
      state.context?.focusContainer()
    },

    clearResults() {
      state.matches = []
      state.currentIndex = 0
    },

    setContext(context: FindReplaceContext) {
      state.context = context
    },

    setActiveColumn(columnKey: string | null) {
      state.activeColumn = columnKey
    },

    async findAll(nextQuery?: string) {
      await runSearch(nextQuery)
      return state.matches
    },

    async focusNext() {
      if (!state.matches.length) {
        await runSearch(state.query)
        return
      }
      await focusByIndex(state.currentIndex + 1)
    },

    async focusPrev() {
      if (!state.matches.length) {
        await runSearch(state.query)
        return
      }
      await focusByIndex(state.currentIndex - 1)
    },

    async replaceCurrent() {
      if (!state.matches.length) {
        await runSearch(state.query)
        return 0
      }
      const changed = await replaceAt(state.currentIndex)
      return changed ? 1 : 0
    },

    async replaceAll() {
      if (!state.matches.length) {
        return 0
      }
      let changed = 0
      // Replace from end to start to keep current indexes stable.
      for (let index = state.matches.length - 1; index >= 0; index -= 1) {
        const applied = await replaceAt(index)
        if (applied) {
          changed += 1
        }
      }
      await runSearch(state.query)
      return changed
    },

    undo() {
      state.context?.undo()
    },

    redo() {
      state.context?.redo()
    },
  }
}
