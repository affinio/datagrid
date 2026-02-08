import { describe, expect, it, vi } from "vitest"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { ViewportSyncTargets } from "../dataGridViewportTypes"

function createTargets(
  host: HTMLDivElement,
  layoutRoot: HTMLDivElement,
  overlayRoot: HTMLDivElement | null,
): ViewportSyncTargets {
  return {
    scrollHost: host,
    mainViewport: document.createElement("div"),
    layoutRoot,
    bodyLayer: document.createElement("div"),
    headerLayer: document.createElement("div"),
    pinnedLeftLayer: document.createElement("div"),
    pinnedRightLayer: document.createElement("div"),
    overlayRoot,
  }
}

describe("viewport sync-target contract", () => {
  it("does not use DOM fallback searches when explicit sync targets are provided", () => {
    const host = document.createElement("div")
    const layoutRoot = document.createElement("div")
    const overlayRoot = document.createElement("div")
    layoutRoot.appendChild(overlayRoot)

    const hostQuerySpy = vi.spyOn(host, "querySelector")
    const layoutQuerySpy = vi.spyOn(layoutRoot, "querySelector")

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
    })

    controller.setViewportSyncTargets(createTargets(host, layoutRoot, overlayRoot))

    expect(hostQuerySpy).not.toHaveBeenCalled()
    expect(layoutQuerySpy).not.toHaveBeenCalled()
    expect(overlayRoot.parentElement).toBe(host)

    controller.dispose()
  })

  it("does not search for overlay root when overlay target is null", () => {
    const host = document.createElement("div")
    const layoutRoot = document.createElement("div")

    const hostQuerySpy = vi.spyOn(host, "querySelector")
    const layoutQuerySpy = vi.spyOn(layoutRoot, "querySelector")

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
    })

    controller.setViewportSyncTargets(createTargets(host, layoutRoot, null))

    expect(hostQuerySpy).not.toHaveBeenCalled()
    expect(layoutQuerySpy).not.toHaveBeenCalled()

    controller.dispose()
  })
})
