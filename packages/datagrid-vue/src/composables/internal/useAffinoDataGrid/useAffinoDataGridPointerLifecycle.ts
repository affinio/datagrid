export interface UseAffinoDataGridPointerLifecycleOptions {
  onPointerUp: () => void
  onPointerCancel: () => void
}

export interface UseAffinoDataGridPointerLifecycleResult {
  dispose: () => void
}

export function useAffinoDataGridPointerLifecycle(
  options: UseAffinoDataGridPointerLifecycleOptions,
): UseAffinoDataGridPointerLifecycleResult {
  if (typeof window !== "undefined") {
    window.addEventListener("mouseup", options.onPointerUp)
    window.addEventListener("pointerup", options.onPointerUp)
    window.addEventListener("pointercancel", options.onPointerCancel)
  }

  const dispose = (): void => {
    if (typeof window !== "undefined") {
      window.removeEventListener("mouseup", options.onPointerUp)
      window.removeEventListener("pointerup", options.onPointerUp)
      window.removeEventListener("pointercancel", options.onPointerCancel)
    }
  }

  return { dispose }
}
