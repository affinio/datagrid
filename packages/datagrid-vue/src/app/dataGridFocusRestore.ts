import { nextTick } from "vue"

export interface RestoreDataGridFocusOptions {
  animationFramePasses?: number
  includeTimeoutPass?: boolean
}

function resolveAnimationFramePasses(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1
  }
  return Math.max(0, Math.trunc(value))
}

async function waitForAnimationFrame(): Promise<void> {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return
  }
  await new Promise<void>(resolve => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function waitForTimeout(): Promise<void> {
  if (typeof window === "undefined") {
    return
  }
  await new Promise<void>(resolve => {
    window.setTimeout(() => resolve(), 0)
  })
}

export async function restoreDataGridFocus(
  applyFocus: () => void,
  options: RestoreDataGridFocusOptions = {},
): Promise<void> {
  const animationFramePasses = resolveAnimationFramePasses(options.animationFramePasses)

  applyFocus()
  await nextTick()
  applyFocus()

  for (let passIndex = 0; passIndex < animationFramePasses; passIndex += 1) {
    await waitForAnimationFrame()
    applyFocus()
  }

  if (options.includeTimeoutPass === true) {
    await waitForTimeout()
    applyFocus()
  }
}