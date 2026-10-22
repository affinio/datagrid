export interface StickyGroupRowsOptions {
  enabled: boolean
  mode: "root-only"
  transition: "push-off"
}

export const DEFAULT_STICKY_GROUP_ROWS: StickyGroupRowsOptions = Object.freeze({
  enabled: false,
  mode: "root-only",
  transition: "push-off",
})
