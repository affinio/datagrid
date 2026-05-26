import { beforeEach, describe, expect, it } from "vitest"
import {
  DATA_GRID_PINNED_NATIVE_SCROLL_STORAGE_KEY,
  resolveDataGridPinnedNativeScrollPrototypeEnabled,
} from "../dataGridPinnedNativeScroll"

function setSearch(search: string): void {
  window.history.replaceState({}, "", `${window.location.pathname}${search}`)
}

describe("dataGridPinnedNativeScroll", () => {
  beforeEach(() => {
    window.localStorage.clear()
    setSearch("")
  })

  it("keeps the prototype disabled by default", () => {
    expect(resolveDataGridPinnedNativeScrollPrototypeEnabled()).toBe(false)
  })

  it("enables the prototype from query params", () => {
    setSearch("?dgPinnedNativeScroll=prototype")

    expect(resolveDataGridPinnedNativeScrollPrototypeEnabled()).toBe(true)
  })

  it("lets query params override local storage", () => {
    window.localStorage.setItem(DATA_GRID_PINNED_NATIVE_SCROLL_STORAGE_KEY, "on")
    setSearch("?dgPinnedNativeScroll=0")

    expect(resolveDataGridPinnedNativeScrollPrototypeEnabled()).toBe(false)
  })

  it("enables the prototype from local storage", () => {
    window.localStorage.setItem(DATA_GRID_PINNED_NATIVE_SCROLL_STORAGE_KEY, "true")

    expect(resolveDataGridPinnedNativeScrollPrototypeEnabled()).toBe(true)
  })
})
