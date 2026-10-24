type MenuState = { open: boolean; activeItemId: string | null }

export class MenuCore {
  private isOpen = false
  private activeItemId: string | null = null
  private items = new Map<string, { disabled: boolean }>()
  private order: string[] = []
  private listeners = new Set<(state: MenuState) => void>()

  constructor(_options: unknown, private callbacks: { onSelect?: (id: string) => void }) {}

  getSnapshot(): MenuState { return { open: this.isOpen, activeItemId: this.activeItemId } }

  subscribe(listener: (state: MenuState) => void) {
    this.listeners.add(listener)
    return { unsubscribe: () => this.listeners.delete(listener) }
  }

  registerItem(id: string, options?: { disabled?: boolean }) {
    this.items.set(id, { disabled: options?.disabled === true })
    this.emit()
    return () => { this.items.delete(id); this.emit() }
  }

  syncItemOrder(order: string[]): void { this.order = order; this.emit() }

  getTriggerProps() {
    return {
      onKeyDown: (event: KeyboardEvent) => {
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) this.openMenu()
      },
    }
  }

  getPanelProps() { return { id: "menu-panel", role: "menu", tabIndex: -1, "aria-labelledby": "trigger" } }

  getItemProps(id: string) {
    return {
      id: `item-${id}`,
      role: "menuitem",
      tabIndex: this.activeItemId === id ? 0 : -1,
      "aria-disabled": this.items.get(id)?.disabled === true,
      "data-state": this.activeItemId === id ? "highlighted" : "idle",
      onClick: () => {
        if (this.items.get(id)?.disabled) return
        this.callbacks.onSelect?.(id)
        this.close()
      },
      onKeyDown: () => undefined,
    }
  }

  openMenu(): void {
    this.isOpen = true
    this.activeItemId = this.order.find(id => !this.items.get(id)?.disabled) ?? null
    this.emit()
  }

  open(): void { this.openMenu() }
  close(): void { this.isOpen = false; this.emit() }
  requestClose(): void { this.close() }
  destroy(): void { this.listeners.clear(); this.items.clear() }

  private emit(): void {
    for (const listener of this.listeners) listener(this.getSnapshot())
  }
}

export function computePosition(anchor: DOMRect, _surface: DOMRect, options: { gutter?: number }) {
  return { left: anchor.left, top: anchor.bottom + (options.gutter ?? 0), placement: "bottom", align: "start" }
}
