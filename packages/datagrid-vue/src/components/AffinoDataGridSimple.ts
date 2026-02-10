import {
  computed,
  defineComponent,
  h,
  ref,
  watch,
  type ComponentPublicInstance,
  type PropType,
  type VNodeRef,
} from "vue"
import type {
  DataGridColumnDef,
  DataGridSortState,
  DataGridRowNode,
} from "@affino/datagrid-core"
import {
  useAffinoDataGridUi,
  type UseAffinoDataGridUiOptions,
} from "../composables/useAffinoDataGridUi"
import type {
  AffinoDataGridActionId,
  AffinoDataGridFeatures,
  AffinoDataGridEditSession,
} from "../composables/useAffinoDataGrid.types"

interface RowLike {
  [key: string]: unknown
  rowId?: string | number
  id?: string | number
  key?: string | number
}

function fallbackResolveRowKey(row: RowLike, index: number): string {
  if (row.rowId !== undefined && row.rowId !== null) {
    const rowKey = String(row.rowId).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  if (row.id !== undefined && row.id !== null) {
    const rowKey = String(row.id).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  if (row.key !== undefined && row.key !== null) {
    const rowKey = String(row.key).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  throw new Error(
    `[AffinoDataGridSimple] Missing stable row identity at index ${index}. ` +
    "Provide features.selection.resolveRowKey(row, index) or include non-empty rowId/id/key.",
  )
}

function castDraftValue(previous: unknown, draft: string): unknown {
  if (typeof previous === "number") {
    const parsed = Number(draft)
    return Number.isFinite(parsed) ? parsed : previous
  }
  if (typeof previous === "boolean") {
    if (draft === "true") {
      return true
    }
    if (draft === "false") {
      return false
    }
    return previous
  }
  return draft
}

export const AffinoDataGridSimple = defineComponent({
  name: "AffinoDataGridSimple",
  inheritAttrs: false,
  props: {
    rows: {
      type: Array as PropType<readonly RowLike[]>,
      default: () => [],
    },
    columns: {
      type: Array as PropType<readonly DataGridColumnDef[]>,
      required: true,
    },
    features: {
      type: Object as PropType<UseAffinoDataGridUiOptions<any>["features"]>,
      default: undefined,
    },
    initialSortState: {
      type: Array as PropType<readonly DataGridSortState[] | undefined>,
      default: undefined,
    },
    toolbarActions: {
      type: Array as PropType<readonly AffinoDataGridActionId[] | undefined>,
      default: undefined,
    },
    status: {
      type: String,
      default: "Ready",
    },
    showToolbar: {
      type: Boolean,
      default: true,
    },
    showMetrics: {
      type: Boolean,
      default: true,
    },
  },
  emits: {
    "update:rows": (_rows: readonly RowLike[]) => true,
    "update:status": (_status: string) => true,
    action: (_payload: { actionId: AffinoDataGridActionId; message: string; affected: number; ok: boolean }) => true,
  },
  setup(props, { attrs, emit, expose }) {
    const internalRows = ref<readonly RowLike[]>(props.rows)
    const statusRef = ref(props.status)
    let lastRowsSyncedFromProps: readonly RowLike[] | null = props.rows

    watch(
      () => props.rows,
      nextRows => {
        lastRowsSyncedFromProps = nextRows
        internalRows.value = nextRows
      },
    )

    watch(
      internalRows,
      nextRows => {
        if (nextRows === lastRowsSyncedFromProps) {
          lastRowsSyncedFromProps = null
          return
        }
        emit("update:rows", nextRows)
      },
      { deep: false },
    )

    watch(
      () => props.status,
      nextStatus => {
        statusRef.value = nextStatus
      },
    )

    watch(statusRef, nextStatus => {
      emit("update:status", nextStatus)
    })

    const resolveRowKey = (row: RowLike, index: number): string => {
      const selectionConfig = (props.features as AffinoDataGridFeatures<RowLike> | undefined)?.selection
      if (
        selectionConfig
        && typeof selectionConfig === "object"
        && typeof selectionConfig.resolveRowKey === "function"
      ) {
        return selectionConfig.resolveRowKey(row, index)
      }
      return fallbackResolveRowKey(row, index)
    }

    const defaultCommit = async (session: AffinoDataGridEditSession): Promise<void> => {
      const rowIndex = internalRows.value.findIndex((row, index) => (
        resolveRowKey(row, index) === session.rowKey
      ))
      if (rowIndex < 0) {
        return
      }

      const row = internalRows.value[rowIndex]
      const currentValue = row?.[session.columnKey]
      const nextValue = castDraftValue(currentValue, session.draft)
      const nextRow: RowLike = {
        ...row,
        [session.columnKey]: nextValue,
      }

      const nextRows = internalRows.value.slice()
      nextRows[rowIndex] = nextRow
      internalRows.value = nextRows
      statusRef.value = `Updated ${session.columnKey}`
    }

    const normalizedFeatures: AffinoDataGridFeatures<RowLike> = {
      selection: (props.features as AffinoDataGridFeatures<RowLike> | undefined)?.selection ?? true,
      clipboard: (props.features as AffinoDataGridFeatures<RowLike> | undefined)?.clipboard ?? true,
      editing: (() => {
        const editing = (props.features as AffinoDataGridFeatures<RowLike> | undefined)?.editing
        if (editing === undefined) {
          return {
            enabled: true,
            mode: "cell",
            onCommit: defaultCommit,
          }
        }
        if (editing === true) {
          return {
            enabled: true,
            mode: "cell",
            onCommit: defaultCommit,
          }
        }
        if (editing === false) {
          return false
        }
        if (editing.onCommit) {
          return editing
        }
        return {
          ...editing,
          onCommit: defaultCommit,
        }
      })(),
    }

    const grid = useAffinoDataGridUi<RowLike>({
      rows: internalRows,
      columns: computed(() => props.columns),
      initialSortState: props.initialSortState,
      features: normalizedFeatures,
      status: statusRef,
      toolbarActions: props.toolbarActions,
    })

    const syncRowsFromModel = () => {
      const count = grid.rowModel.getRowCount()
      if (count <= 0) {
        internalRows.value = []
        return
      }
      const nodes = grid.rowModel.getRowsInRange({
        start: 0,
        end: count - 1,
      }) as readonly DataGridRowNode<RowLike>[]

      const nextRows = nodes
        .filter(node => node.kind === "leaf")
        .map(node => node.data as RowLike)
      internalRows.value = nextRows
    }

    const ROW_MUTATION_ACTIONS = new Set<AffinoDataGridActionId>([
      "cut",
      "paste",
      "clear",
    ])

    const onActionResult = (actionId: AffinoDataGridActionId) => (result: {
      ok: boolean
      message: string
      affected: number
    }) => {
      grid.ui.applyActionResult(result)
      if (result.ok && ROW_MUTATION_ACTIONS.has(actionId)) {
        syncRowsFromModel()
      }
      emit("action", {
        actionId,
        ok: result.ok,
        message: result.message,
        affected: result.affected,
      })
    }

    const leafRows = computed(() => {
      const count = grid.rowModel.getRowCount()
      if (count <= 0) {
        return [] as readonly DataGridRowNode<RowLike>[]
      }
      return grid.rowModel
        .getRowsInRange({
          start: 0,
          end: count - 1,
        })
        .filter(row => row.kind === "leaf") as readonly DataGridRowNode<RowLike>[]
    })

    const statusText = computed(() => grid.ui.status.value)
    const selectedCount = computed(() => grid.features.selection.selectedCount.value)

    const renderCellValue = (row: RowLike, columnKey: string): string => {
      const value = row[columnKey]
      if (value === null || value === undefined) {
        return ""
      }
      return String(value)
    }

    const setContextMenuRef: VNodeRef = refValue => {
      const element = refValue && typeof (refValue as ComponentPublicInstance).$el !== "undefined"
        ? ((refValue as ComponentPublicInstance).$el as Element | null)
        : (refValue as Element | null)
      grid.ui.bindContextMenuRef(element)
    }

    expose({
      grid,
      api: grid.api,
      rowModel: grid.rowModel,
      columnModel: grid.columnModel,
    })

    return () => h(
      "section",
      {
        ...attrs,
        class: ["affino-datagrid-simple", attrs.class],
      },
      [
        props.showToolbar
          ? h(
              "div",
              { class: "affino-datagrid-simple__toolbar" },
              [
                ...(grid.ui.toolbarActions.value.map(action => h(
                  "button",
                  {
                    type: "button",
                    class: "affino-datagrid-simple__toolbar-action",
                    ...grid.bindings.actionButton(action.id, {
                      onResult: onActionResult(action.id),
                    }),
                  },
                  action.label,
                ))),
                h("span", { class: "affino-datagrid-simple__status" }, statusText.value),
              ],
            )
          : null,
        props.showMetrics
          ? h(
              "div",
              { class: "affino-datagrid-simple__metrics" },
              [
                h("span", `Rows: ${internalRows.value.length}`),
                h("span", `Selected: ${selectedCount.value}`),
              ],
            )
          : null,
        h(
          "div",
          { class: "affino-datagrid-simple__viewport" },
          [
            h(
              "table",
              { class: "affino-datagrid-simple__table" },
              [
                h(
                  "thead",
                  h(
                    "tr",
                    props.columns.map(column => h(
                      "th",
                      {
                        key: column.key,
                        ...grid.ui.bindHeaderCell(column.key),
                      },
                      [
                        h("span", column.label ?? column.key),
                        h("small", grid.ui.resolveHeaderAriaSort(column.key)),
                      ],
                    )),
                  ),
                ),
                h(
                  "tbody",
                  leafRows.value.map((rowNode, rowIndex) => {
                    const rowData = rowNode.data as RowLike
                    const rowKey = String(rowNode.rowId)
                    return h(
                      "tr",
                      {
                        key: rowKey,
                        class: {
                          "affino-datagrid-simple__row": true,
                          "is-selected": grid.features.selection.isSelectedByKey(rowKey),
                        },
                        ...grid.ui.bindRowSelection(rowData, rowIndex),
                      },
                      props.columns.map(column => {
                        const isEditing = grid.ui.isCellEditing(rowKey, column.key)
                        return h(
                          "td",
                          {
                            key: `${rowKey}-${column.key}`,
                            class: {
                              "affino-datagrid-simple__cell": true,
                              "is-editing": isEditing,
                            },
                            ...grid.ui.bindDataCell({
                              row: rowData,
                              rowIndex,
                              columnKey: column.key,
                              value: rowData[column.key],
                            }),
                          },
                          isEditing
                            ? h("input", {
                                class: "affino-datagrid-simple__editor",
                                "data-inline-editor-column-key": column.key,
                                ...grid.ui.bindInlineEditor({
                                  rowKey,
                                  columnKey: column.key,
                                }),
                              })
                            : renderCellValue(rowData, column.key),
                        )
                      }),
                    )
                  }),
                ),
              ],
            ),
            grid.contextMenu.state.value.visible
              ? h(
                  "div",
                  {
                    ref: setContextMenuRef,
                    class: "affino-datagrid-simple__menu",
                    style: grid.contextMenu.style.value,
                    ...grid.ui.bindContextMenuRoot(),
                  },
                  grid.contextMenu.actions.value.map(action => h(
                    "button",
                    {
                      key: action.id,
                      type: "button",
                      role: "menuitem",
                      class: "affino-datagrid-simple__menu-item",
                      ...grid.ui.bindContextMenuAction(action.id, {
                        onResult: onActionResult(action.id),
                      }),
                    },
                    action.label,
                  )),
                )
              : null,
          ],
        ),
      ],
    )
  },
})

export default AffinoDataGridSimple
