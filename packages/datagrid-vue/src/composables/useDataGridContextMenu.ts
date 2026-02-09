import { computed, nextTick, onBeforeUnmount, ref, type Ref } from "vue"
import {
  resolveDataGridContextMenuKeyboardIntent,
  useDataGridContextMenu as useDataGridContextMenuCore,
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuSnapshot,
  type DataGridContextMenuState,
  type DataGridContextMenuZone,
  type OpenDataGridContextMenuInput,
  type UseDataGridContextMenuOptions,
} from "@affino/datagrid-orchestration"

export type {
  DataGridContextMenuZone,
  DataGridContextMenuActionId,
  DataGridContextMenuState,
  DataGridContextMenuAction,
  OpenDataGridContextMenuInput,
  UseDataGridContextMenuOptions,
}

export interface UseDataGridContextMenuResult {
  contextMenu: Ref<DataGridContextMenuState>
  contextMenuRef: Ref<HTMLElement | null>
  contextMenuStyle: Ref<{ left: string; top: string }>
  contextMenuActions: Ref<readonly DataGridContextMenuAction[]>
  closeContextMenu: () => void
  openContextMenu: (clientX: number, clientY: number, context: OpenDataGridContextMenuInput) => void
  onContextMenuKeyDown: (event: KeyboardEvent, handlers?: { onEscape?: () => void }) => void
}

function resolveFocusedMenuIndex(
  items: readonly HTMLButtonElement[],
  activeElement: HTMLElement | null,
): number {
  if (!activeElement || !items.length) {
    return -1
  }
  return items.findIndex(item => item === activeElement)
}

export function useDataGridContextMenu(
  options: UseDataGridContextMenuOptions = {},
): UseDataGridContextMenuResult {
  const core = useDataGridContextMenuCore(options)
  const snapshot = ref<DataGridContextMenuSnapshot>(core.getSnapshot())
  const contextMenu = ref<DataGridContextMenuState>(snapshot.value.contextMenu)
  const contextMenuActions = ref<readonly DataGridContextMenuAction[]>(snapshot.value.actions)
  const contextMenuRef = ref<HTMLElement | null>(null)

  const unsubscribe = core.subscribe(nextSnapshot => {
    snapshot.value = nextSnapshot
    contextMenu.value = nextSnapshot.contextMenu
    contextMenuActions.value = nextSnapshot.actions
  })

  onBeforeUnmount(() => {
    unsubscribe()
  })

  const contextMenuStyle = computed(() => ({
    left: `${contextMenu.value.x}px`,
    top: `${contextMenu.value.y}px`,
  }))
  async function focusContextMenuFirstItem() {
    await nextTick()
    const menu = contextMenuRef.value
    if (!menu) {
      return
    }
    const first = menu.querySelector('[data-datagrid-menu-action]') as HTMLButtonElement | null
    if (first) {
      first.focus()
      return
    }
    menu.focus()
  }

  function closeContextMenu() {
    core.closeContextMenu()
  }

  function openContextMenu(clientX: number, clientY: number, context: OpenDataGridContextMenuInput) {
    core.openContextMenu(clientX, clientY, context)
    void focusContextMenuFirstItem()
  }

  function onContextMenuKeyDown(event: KeyboardEvent, handlers?: { onEscape?: () => void }) {
    const menu = contextMenuRef.value
    if (!menu) {
      return
    }
    const items = Array.from(menu.querySelectorAll('[data-datagrid-menu-action]')) as HTMLButtonElement[]
    if (!items.length) {
      return
    }
    const activeElement = (typeof document !== "undefined" ? document.activeElement : null) as HTMLElement | null
    const intent = resolveDataGridContextMenuKeyboardIntent({
      key: event.key,
      activeIndex: resolveFocusedMenuIndex(items, activeElement),
      itemCount: items.length,
      shiftKey: event.shiftKey,
    })
    if (!intent.handled) {
      return
    }

    event.preventDefault()

    if (intent.shouldClose) {
      closeContextMenu()
      handlers?.onEscape?.()
      return
    }

    const target = items[intent.nextIndex] ?? null
    if (intent.shouldTrigger) {
      target?.click()
      return
    }

    target?.focus()
  }

  return {
    contextMenu,
    contextMenuRef,
    contextMenuStyle,
    contextMenuActions,
    closeContextMenu,
    openContextMenu,
    onContextMenuKeyDown,
  }
}
