export type DataGridMenuOverlayOpenReason = "button" | "contextmenu" | "keyboard"
export type DataGridMenuOverlayControllerOpenReason = "pointer" | "keyboard" | "programmatic"

export interface DataGridMenuOverlayController {
  closeMenu: () => void
  openMenuFromElement: (element: HTMLElement | null, reason?: DataGridMenuOverlayOpenReason) => void
  toggleMenuFromElement: (element: HTMLElement | null, reason?: DataGridMenuOverlayOpenReason) => void
}
