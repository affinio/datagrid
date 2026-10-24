import { describe, expect, it } from "vitest"
import { failDemoLoading, finishDemoLoading } from "./pageLoading"

describe("sandbox page loading state", () => {
  it("reveals page content after the grid runtime is ready", () => {
    document.body.innerHTML = `
      <div id="page-loading" role="status">Loading</div>
      <main data-demo-content inert aria-hidden="true" aria-busy="true"></main>
    `

    finishDemoLoading(document)

    expect(document.querySelector("#page-loading")).toBeNull()
    const content = document.querySelector("[data-demo-content]")
    expect(content?.hasAttribute("inert")).toBe(false)
    expect(content?.hasAttribute("aria-hidden")).toBe(false)
    expect(content?.getAttribute("aria-busy")).toBe("false")
  })

  it("keeps the loading cover and reports a startup failure accessibly", () => {
    document.body.innerHTML = `
      <div id="page-loading" role="status"><span>Loading</span></div>
      <main data-demo-content inert aria-hidden="true" aria-busy="true"></main>
    `

    failDemoLoading(document)

    const overlay = document.querySelector("#page-loading")
    expect(overlay?.getAttribute("role")).toBe("alert")
    expect(overlay?.textContent).toContain("DataGrid could not start")
    expect(document.querySelector("[data-demo-content]")?.hasAttribute("inert")).toBe(true)
  })
})
