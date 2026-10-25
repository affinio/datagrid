import { expect, type Locator, type Page, test } from "@playwright/test"

test("Vue sandbox manages whole-column selection through the public grid API", async ({ page }) => {
  await page.goto("/vue/column-selection-grid")
  const result = page.getByTestId("column-selection-result")

  await expect(result).toContainText("Selected column keys: none")
  await page.getByTestId("column-selection-status").check()
  await expect(result).toContainText("Selected column keys: status")

  await page.getByTestId("column-selection-preset").click()
  await expect(result).toContainText("Selected column keys: status, owner")
  await expect(page.getByTestId("column-selection-owner")).toBeChecked()

  await page.getByTestId("column-selection-clear").click()
  await expect(result).toContainText("Selected column keys: none")
  await expect(page.getByTestId("column-selection-status")).not.toBeChecked()
  await expect(page.getByTestId("column-selection-owner")).not.toBeChecked()
})

test("saved preferences commit resize on release and restore filters without a width flash", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/vue/state-persistence")
  const status = page.getByTestId("persistence-status")
  await expect(status).toContainText("ready")
  const readWrites = async () => Number((await status.textContent())?.match(/(\d+) writes/)?.[1] ?? 0)
  await expect.poll(readWrites).toBe(1)
  const header = page.locator('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
  const before = (await header.boundingBox())!
  const handle = (await header.locator(".col-resize").boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 48, handle.y + handle.height / 2)
  await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(before.width + 30)
  // Pause longer than the debounce while still holding the resize handle.
  await page.waitForTimeout(350)
  expect(await readWrites()).toBe(1)
  await page.mouse.up()
  await expect.poll(readWrites).toBe(2)
  const resizedWidth = (await header.boundingBox())!.width
  await page.getByPlaceholder("Search rows").fill("Mira")
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("sandbox:preferences:v1:local:A") ?? "null")?.rows.snapshot.filterModel?.quickFilter?.query)).toBe("Mira")

  const visibleWidths = await page.evaluate(async () => {
    const widths: number[] = []
    document.querySelector<HTMLButtonElement>('[data-testid="persistence-remount"]')!.click()
    for (let frame = 0; frame < 12; frame += 1) {
      await new Promise(requestAnimationFrame)
      const header = document.querySelector<HTMLElement>('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
      if (header && getComputedStyle(header).visibility !== "hidden") widths.push(header.getBoundingClientRect().width)
    }
    return widths
  })
  expect(visibleWidths.length).toBeGreaterThan(0)
  for (const width of visibleWidths) expect(width).toBeCloseTo(resizedWidth, 0)
  await expect(page.getByPlaceholder("Search rows")).toHaveValue("Mira")
  await page.getByTestId("persistence-reset").click()
  await expect(page.getByPlaceholder("Search rows")).toHaveValue("")
  await expect.poll(async () => (await header.boundingBox())!.width).toBeCloseTo(before.width, 0)
})

test("async saved preferences hide unrestored widths and isolate profile loads", async ({ page }) => {
  await page.goto("/vue/state-persistence")
  await expect.poll(async () => Number((await page.getByTestId("persistence-status").textContent())?.match(/(\d+) writes/)?.[1] ?? 0)).toBe(1)
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem("sandbox:preferences:v1:local:A")!)
    for (const [profile, width] of [["A", 200], ["B", 300]] as const) {
      const state = structuredClone(base)
      state.columns.widths.owner = width
      localStorage.setItem(`sandbox:preferences:v1:remote:${profile}`, JSON.stringify(state))
    }
  })
  await page.locator(".persistence-demo__controls select").nth(1).selectOption("remote")
  const grid = page.locator(".affino-datagrid-app-root")
  const header = grid.locator('.grid-header-viewport .grid-cell--header[data-column-key="owner"]')
  await expect(grid).toHaveAttribute("data-persistence-loading", "true")
  await expect(header).toHaveCSS("visibility", "hidden")
  await page.getByTestId("persistence-profile").selectOption("B")
  await expect(page.getByTestId("persistence-status")).toContainText("ready")
  await expect.poll(async () => (await header.boundingBox())!.width).toBe(300)
  await page.getByTestId("persistence-profile").selectOption("A")
  await expect(header).toHaveCSS("visibility", "hidden")
  await expect(page.getByTestId("persistence-status")).toContainText("ready")
  await expect.poll(async () => (await header.boundingBox())!.width).toBe(200)
})

test("row resize keeps dividers and selection aligned before pointer release", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 })
  await page.goto("/vue/height-sizing-grid")
  const centerRows = page.locator(".grid-body-content > .grid-row")
  await centerRows.locator('[data-column-key="name"]').nth(6).click()

  const readAlignment = () => page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row"))
    const pinnedRows = Array.from(document.querySelectorAll<HTMLElement>(".grid-body-pane--left .grid-row"))
    const lines = Array.from(document.querySelectorAll<HTMLElement>(".grid-chrome-layer__line--horizontal"))
    const selected = rows.find(row => row.dataset.rowIndex === "6")!.getBoundingClientRect()
    const overlay = document.querySelector<HTMLElement>(".grid-selection-overlay__segment")!.getBoundingClientRect()
    return Math.max(
      ...rows.slice(0, 8).map((row, index) => {
        const rect = row.getBoundingClientRect()
        const pinned = pinnedRows[index]!.getBoundingClientRect()
        return Math.max(
          Math.abs(lines[index]!.getBoundingClientRect().top - (rect.bottom - 1)),
          Math.abs(pinned.top - rect.top),
          Math.abs(pinned.height - rect.height),
        )
      }),
      Math.abs(overlay.top - (selected.top - 1)),
      Math.abs(overlay.height - (selected.height + 2)),
    )
  })

  // Small changes leave the virtual window unchanged; repeating a row also
  // catches geometry that only refreshes on the first height override.
  for (const rowIndex of [4, 4, 2]) {
    const handle = page.locator(`.grid-body-pane--left .grid-row[data-row-index="${rowIndex}"] .row-resize-handle`)
    const bounds = (await handle.boundingBox())!
    const targetRow = page.locator(`.grid-body-content > .grid-row[data-row-index="${rowIndex}"]`)
    const originalHeight = (await targetRow.boundingBox())!.height
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (const delta of [4, 8, 12, 6]) {
      await page.mouse.move(x, y + delta)
      await expect.poll(async () => (await targetRow.boundingBox())!.height).toBe(originalHeight + delta)
      await expect.poll(readAlignment).toBeLessThanOrEqual(1)
    }
    await page.mouse.up()
    await expect.poll(readAlignment).toBeLessThanOrEqual(1)
  }
})

test("fill layout shares bounded host height across toolbar placements", async ({ page }) => {
  await page.goto("/vue/height-sizing-grid")

  const host = page.getByTestId("bounded-grid-host")
  const grid = host.locator(".affino-datagrid-app-root")
  const placementSelect = page.getByTestId("toolbar-placement")
  const statusHeader = grid.locator('.grid-header-viewport .grid-cell--header[data-column-key="status"]')

  await expect(statusHeader).toHaveClass(/grid-cell--header-terminal/)
  await expect(statusHeader).toHaveCSS("box-shadow", /1px 0px 0px/)

  for (const placement of ["stacked", "integrated", "hidden"] as const) {
    await placementSelect.selectOption(placement)
    await expect(host.locator(".datagrid-app-toolbar")).toHaveCount(1)
    await expect(grid.locator(`.datagrid-app-layout--toolbar-${placement}`)).toHaveCount(1)

    if (placement === "hidden") {
      await expect(grid.locator(".datagrid-app-toolbar")).toHaveCount(0)
    } else {
      await expect(grid.locator(".datagrid-app-toolbar")).toHaveCount(1)
    }
    if (placement === "integrated") {
      await expect(grid.locator(".datagrid-app-stage-surface--integrated")).toHaveCount(1)
    }

    const readSizes = () => host.evaluate(hostElement => {
      const root = hostElement.querySelector<HTMLElement>(".affino-datagrid-app-root")!
      const height = (selector: string): number => root.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0
      const viewport = root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")
      const toolbar = hostElement.querySelector<HTMLElement>(".datagrid-app-toolbar")
      return {
        root: root.getBoundingClientRect().height,
        layout: height(".datagrid-app-layout"),
        toolbar: toolbar?.getBoundingClientRect().height ?? 0,
        workspace: height(".datagrid-app-workspace"),
        surface: height(".datagrid-app-stage-surface--integrated"),
        stage: height(".grid-stage"),
        viewport: viewport?.getBoundingClientRect().height ?? 0,
        viewportScrollable: Boolean(viewport && viewport.scrollHeight > viewport.clientHeight),
      }
    })

    const initial = await readSizes()
    expect(initial.root).toBeGreaterThan(300)
    expect(initial.toolbar).toBeGreaterThan(0)
    expect(initial.layout).toBeCloseTo(initial.root, 0)
    expect(initial.stage).toBeGreaterThan(100)
    expect(initial.viewport).toBeLessThan(initial.stage)
    expect(initial.viewportScrollable).toBe(true)
    if (placement === "stacked") {
      expect(initial.workspace).toBeLessThan(initial.layout - initial.toolbar)
    }
    if (placement === "integrated") {
      expect(initial.surface).toBeCloseTo(initial.workspace, 0)
      expect(initial.stage).toBeLessThan(initial.surface)
    }
    if (placement === "hidden") {
      expect(initial.root + initial.toolbar).toBeLessThan(520)
    }

    await host.evaluate(hostElement => {
      (hostElement as HTMLElement).style.height = "660px"
    })
    await expect.poll(async () => Math.round((await readSizes()).root)).toBe(Math.round(initial.root + 140))

    const resized = await readSizes()
    expect(resized.stage - initial.stage).toBeCloseTo(140, 0)
    expect(resized.viewport - initial.viewport).toBeCloseTo(140, 0)
    expect(resized.viewportScrollable).toBe(true)

    await host.evaluate(hostElement => {
      (hostElement as HTMLElement).style.height = "520px"
    })
  }

  await placementSelect.selectOption("hidden")
  const beforeHide = await host.locator(".affino-datagrid-app-root").evaluate(root => ({
    root: root.getBoundingClientRect().height,
    viewport: root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")?.clientHeight ?? 0,
  }))
  await host.evaluate(hostElement => {
    (hostElement as HTMLElement).style.display = "none"
  })
  await host.evaluate(hostElement => {
    (hostElement as HTMLElement).style.removeProperty("display")
  })
  await expect.poll(async () => Math.round(await host.locator(".affino-datagrid-app-root").evaluate(root => root.getBoundingClientRect().height)))
    .toBe(Math.round(beforeHide.root))
  const afterReveal = await host.locator(".affino-datagrid-app-root").evaluate(root => ({
    viewport: root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")?.clientHeight ?? 0,
    scrollable: Boolean(root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")?.scrollHeight
      && root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")!.scrollHeight
        > root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")!.clientHeight),
  }))
  expect(afterReveal.viewport).toBe(beforeHide.viewport)
  expect(afterReveal.scrollable).toBe(true)
})

test("auto-height and Gantt sizing stay bounded by their selected layout", async ({ page }) => {
  await page.goto("/vue/height-sizing-modes")
  const autoHost = page.getByTestId("auto-height-host")
  const autoGrid = autoHost.locator(".affino-datagrid-app-root")
  await expect(autoGrid).toHaveClass(/--auto-height/)
  const shortHeight = await autoGrid.evaluate(element => element.getBoundingClientRect().height)
  await page.getByTestId("load-auto-rows").click()
  await expect.poll(async () => await autoGrid.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(shortHeight + 10)
  const maxHeight = await autoGrid.evaluate(element => element.getBoundingClientRect().height)
  await page.getByTestId("clear-auto-rows").click()
  await expect(autoGrid.locator(".datagrid-empty-state")).toBeVisible()
  await expect.poll(async () => await autoGrid.evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(maxHeight)

  const inspectorGrid = page.getByTestId("inspector-host").locator(".affino-datagrid-app-root")
  await expect(inspectorGrid.locator("[data-testid='fixture-inspector']")).toBeVisible()
  const inspectorSizes = await inspectorGrid.evaluate(root => {
    const workspace = root.querySelector<HTMLElement>(".datagrid-app-workspace")!
    const stage = root.querySelector<HTMLElement>(".datagrid-app-stage")!
    const inspector = root.querySelector<HTMLElement>(".datagrid-app-inspector-shell")!
    return { workspace: workspace.getBoundingClientRect().height, stage: stage.getBoundingClientRect().height, inspector: inspector.getBoundingClientRect().height }
  })
  expect(inspectorSizes.workspace).toBeGreaterThan(300)
  expect(inspectorSizes.stage).toBeGreaterThan(100)
  expect(inspectorSizes.inspector).toBeCloseTo(inspectorSizes.workspace, 0)

  const ganttHost = page.getByTestId("gantt-host")
  const ganttGrid = ganttHost.locator(".affino-datagrid-app-root")
  await expect(ganttGrid.locator(".datagrid-gantt-stage")).toHaveCount(1)
  const initial = await ganttGrid.locator(".datagrid-gantt-stage").evaluate(element => element.getBoundingClientRect().height)
  await ganttHost.evaluate(element => { (element as HTMLElement).style.height = "660px" })
  await expect.poll(async () => Math.round(await ganttGrid.locator(".datagrid-gantt-stage").evaluate(element => element.getBoundingClientRect().height))).toBe(Math.round(initial + 140))
})

test("pinned bottom rows stay inside the table stage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/vue/shell/timesheet-grid")
  const grid = page.locator(".affino-datagrid-app-root").first()
  await expect(grid.locator(".grid-body-shell--pinned-bottom")).toHaveCount(1)
  await grid.locator(".grid-body-shared-vertical-scroll-shell").evaluate(element => {
    const viewport = element as HTMLElement
    viewport.scrollTop = viewport.scrollHeight
  })
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const shellSizes = await grid.evaluate(root => {
    const stage = root.querySelector<HTMLElement>(".grid-stage")!
    const body = root.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport")!
    const bottom = root.querySelector<HTMLElement>(".grid-body-shell--pinned-bottom")!
    return { stage: stage.getBoundingClientRect().height, body: body.getBoundingClientRect().height, bottom: bottom.getBoundingClientRect().height }
  })
  expect(shellSizes.body + shellSizes.bottom).toBeLessThanOrEqual(shellSizes.stage)
  const chromeGeometry = await grid.evaluate(root => {
    const readCell = (selector: string, key: string) => {
      const cell = root.querySelector<HTMLElement>(`${selector} .grid-cell[data-column-key="${key}"]`)
      const rect = cell?.getBoundingClientRect()
      return rect ? { left: rect.left, right: rect.right, width: rect.width } : null
    }
    const bodySelector = ".grid-body-shell:not(.grid-body-shell--pinned-bottom) .grid-body-viewport--shared-vertical"
    const bottomSelector = ".grid-body-shell--pinned-bottom .grid-body-viewport--pinned-bottom"
    const canvas = root.querySelector<HTMLCanvasElement>(".grid-chrome-canvas--center-shell")
    const sundayHeader = root.querySelector<HTMLElement>('.grid-header-viewport .grid-cell--header[data-column-key="sunday"]')
    const totalHeader = root.querySelector<HTMLElement>('.grid-header-pane--right .grid-cell--header[data-column-key="total"]')
    const totalBottom = root.querySelector<HTMLElement>('.grid-body-shell--pinned-bottom .grid-body-pane--right .grid-cell[data-column-key="total"]')
    const stage = root.querySelector<HTMLElement>(".grid-stage")!
    const bottomShell = root.querySelector<HTMLElement>(".grid-body-shell--pinned-bottom")!
    const bodyShell = root.querySelector<HTMLElement>(".grid-body-shell:not(.grid-body-shell--pinned-top):not(.grid-body-shell--pinned-bottom)")!
    const canvasRect = canvas?.getBoundingClientRect()
    const context = canvas?.getContext("2d")
    const pixelLines: number[] = []
    if (canvas && canvasRect && context) {
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round(canvas.height / 2)))
      const pixels = context.getImageData(0, y, canvas.width, 1).data
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const offset = x * 4
        const previous = (x - 1) * 4
        const next = (x + 1) * 4
        const contrast = Math.abs(pixels[offset]! - pixels[previous]!)
          + Math.abs(pixels[offset + 1]! - pixels[previous + 1]!)
          + Math.abs(pixels[offset + 2]! - pixels[previous + 2]!)
          + Math.abs(pixels[offset]! - pixels[next]!)
          + Math.abs(pixels[offset + 1]! - pixels[next + 1]!)
          + Math.abs(pixels[offset + 2]! - pixels[next + 2]!)
        if (contrast > 100) pixelLines.push((x / (window.devicePixelRatio || 1)) + canvasRect.left)
      }
    }
    const rect = (element: HTMLElement | null) => {
      const rect = element?.getBoundingClientRect()
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null
    }
    return {
      bodyMon: readCell(bodySelector, "monday"),
      bottomMon: readCell(bottomSelector, "monday"),
      bodySun: readCell(bodySelector, "sunday"),
      bottomSun: readCell(bottomSelector, "sunday"),
      sundayHeaderHasTerminalDivider: sundayHeader?.classList.contains("grid-cell--header-terminal") ?? false,
      stage: rect(stage),
      bottomShell: rect(bottomShell),
      bodyShell: rect(bodyShell),
      bodyHorizontalLines: Array.from(root.querySelectorAll<HTMLElement>(".grid-chrome-layer--body-center .grid-chrome-layer__line--horizontal"))
        .map(line => rect(line)!.bottom),
      totalHeader: rect(totalHeader),
      totalBottom: rect(totalBottom),
      pixelLines,
    }
  })
  expect(chromeGeometry.bodyMon).not.toBeNull()
  expect(chromeGeometry.bottomMon).not.toBeNull()
  expect(chromeGeometry.bodySun).not.toBeNull()
  expect(chromeGeometry.bottomSun).not.toBeNull()
  expect(chromeGeometry.bottomMon!.left).toBeCloseTo(chromeGeometry.bodyMon!.left, 1)
  expect(chromeGeometry.bottomMon!.right).toBeCloseTo(chromeGeometry.bodyMon!.right, 1)
  expect(chromeGeometry.bottomSun!.left).toBeCloseTo(chromeGeometry.bodySun!.left, 1)
  expect(chromeGeometry.bottomSun!.right).toBeCloseTo(chromeGeometry.bodySun!.right, 1)
  expect(chromeGeometry.sundayHeaderHasTerminalDivider).toBe(true)
  expect(chromeGeometry.bottomShell!.top).toBeCloseTo(chromeGeometry.bodyShell!.bottom, 1)
  expect(chromeGeometry.bottomShell!.bottom).toBeCloseTo(chromeGeometry.stage!.bottom - 1, 1)
  expect(chromeGeometry.bodyHorizontalLines.every(lineBottom => Math.abs(lineBottom - chromeGeometry.bodyShell!.bottom) > 0.5)).toBe(true)
  for (const boundary of [chromeGeometry.bottomMon!.right, chromeGeometry.bottomSun!.right]) {
    expect(chromeGeometry.pixelLines.some(line => Math.abs(line - boundary) < 0.2)).toBe(true)
  }
})

test("column flex resize does not move the pinned pane boundary or overflow the sandbox route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto("/vue/column-flex-stress")
  const route = page.locator(".sandbox__route")
  const routeSize = await route.evaluate(element => ({ client: element.clientHeight, scroll: element.scrollHeight }))
  expect(routeSize.scroll).toBeLessThanOrEqual(routeSize.client)

  await page.getByRole("button", { name: "Pin flex column left" }).click()
  const pinned = page.locator(".grid-header-pane--left .grid-cell--header[data-column-key='workstream']")
  const centerOwner = page.locator(".grid-header-viewport .grid-cell--header[data-column-key='owner']")
  await expect(pinned).toBeVisible()
  const before = await page.evaluate(() => ({
    pinnedWidth: document.querySelector<HTMLElement>(".grid-header-pane--left .grid-cell--header[data-column-key='workstream']")!.getBoundingClientRect().width,
    centerLeft: document.querySelector<HTMLElement>(".grid-header-viewport .grid-cell--header[data-column-key='owner']")!.getBoundingClientRect().left,
  }))
  expect(before.pinnedWidth).toBeGreaterThan(0)
  const handle = await centerOwner.locator(".col-resize").boundingBox()
  if (!handle) throw new Error("Owner resize handle is missing")
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 30, handle.y + handle.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect.poll(async () => await centerOwner.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(130)
  const after = await page.evaluate(() => ({
    pinnedWidth: document.querySelector<HTMLElement>(".grid-header-pane--left .grid-cell--header[data-column-key='workstream']")!.getBoundingClientRect().width,
    centerLeft: document.querySelector<HTMLElement>(".grid-header-viewport .grid-cell--header[data-column-key='owner']")!.getBoundingClientRect().left,
  }))
  expect(after.pinnedWidth).toBe(before.pinnedWidth)
  expect(after.pinnedWidth).toBeGreaterThan(0)
  expect(after.centerLeft).toBe(before.centerLeft)
})

test("document and reactive theme changes repaint canvas chrome for every mounted grid", async ({ page }) => {
  await page.goto("/vue/theme-canvas-grid?dgPerfTrace=1")
  const stages = page.locator("[data-testid^='theme-grid-'] .grid-stage")
  await expect(stages).toHaveCount(2)
  await expect(page.locator(".grid-body-shell--pinned-bottom")).toHaveCount(0)
  await expect(page.locator(".grid-body-pane--left")).toHaveCount(2)
  await expect(page.locator(".grid-body-pane--right")).toHaveCount(2)

  const readCanvasSignatures = async (): Promise<Array<Array<number | null>>> => page.evaluate(() => {
    const hashCanvas = (canvas: HTMLCanvasElement): number | null => {
      if (canvas.width === 0 || canvas.height === 0) return 0
      const sample = document.createElement("canvas")
      sample.width = 128
      sample.height = 128
      const context = sample.getContext("2d")
      if (!context) return 0
      context.drawImage(canvas, 0, 0, sample.width, sample.height)
      const { data } = context.getImageData(0, 0, sample.width, sample.height)
      let hash = 2166136261
      let hasPaintedPixel = false
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] === 0) continue
        hasPaintedPixel = true
        hash = Math.imul(hash ^ data[index]!, 16777619)
        hash = Math.imul(hash ^ data[index + 1]!, 16777619)
        hash = Math.imul(hash ^ data[index + 2]!, 16777619)
        hash = Math.imul(hash ^ data[index + 3]!, 16777619)
      }
      return hasPaintedPixel ? hash >>> 0 : null
    }
    return Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='theme-grid-'] .grid-stage"), stage =>
      Array.from(stage.querySelectorAll<HTMLCanvasElement>("canvas.grid-chrome-canvas"), hashCanvas),
    )
  })
  const waitForPaint = async (): Promise<void> => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }
  const changedCanvasCount = (before: Array<Array<number | null>>, after: Array<Array<number | null>>): number[] => before.map((grid, gridIndex) =>
    grid.reduce((count, hash, canvasIndex) => count + (hash !== null && hash !== after[gridIndex]?.[canvasIndex] ? 1 : 0), 0),
  )

  await page.evaluate(() => { document.documentElement.dataset.theme = "light" })
  await waitForPaint()
  const light = await readCanvasSignatures()
  const selectedCell = page.locator('[data-testid="theme-grid-first"] .grid-body-viewport .grid-cell[data-column-key="value"]').first()
  await selectedCell.evaluate(element => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, buttons: 1 }))
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
  })
  const selectedRowId = await selectedCell.getAttribute("data-row-id")
  const selectedCellWidthBefore = await selectedCell.evaluate(element => element.getBoundingClientRect().width)
  await page.evaluate(() => {
    const store = (window as typeof window & { __AFFINO_DATAGRID_PERF__?: { samples: unknown[] } }).__AFFINO_DATAGRID_PERF__
    if (store) store.samples.length = 0
  })
  const scrollBeforeTheme = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="theme-grid-first"]')!
    const stage = root.querySelector<HTMLElement>(".grid-stage")!
    const vertical = stage.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell")!
    const horizontal = stage.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")!
    ;(window as typeof window & { __themeCanvasGridRoot?: HTMLElement }).__themeCanvasGridRoot = root
    vertical.scrollTop = 31
    vertical.dispatchEvent(new Event("scroll", { bubbles: true }))
    horizontal.scrollLeft = Math.min(100, horizontal.scrollWidth - horizontal.clientWidth)
    horizontal.dispatchEvent(new Event("scroll", { bubbles: true }))
    document.documentElement.dataset.theme = "dark"
    document.documentElement.dataset.theme = "light"
    document.documentElement.dataset.theme = "dark"
    return { top: vertical.scrollTop, left: horizontal.scrollLeft }
  })
  await expect.poll(async () => changedCanvasCount(light, await readCanvasSignatures())).toEqual([3, 3])
  const themeDraws = await page.evaluate(() => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples: Array<Record<string, string | number>> }
    }).__AFFINO_DATAGRID_PERF__
    return store?.samples.filter(sample => sample.scope === "chromeDraw" && String(sample.redrawSources).includes("theme-change")) ?? []
  })
  expect(themeDraws).toHaveLength(2)
  expect(themeDraws.every(sample => sample.redrawMode === "full")).toBe(true)
  expect(themeDraws.map(sample => Number(sample.drawnPaneCount))).toEqual([4, 4])
  const stateAfterTheme = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="theme-grid-first"]')!
    const stage = root.querySelector<HTMLElement>(".grid-stage")!
    return {
      sameRoot: (window as typeof window & { __themeCanvasGridRoot?: HTMLElement }).__themeCanvasGridRoot === root,
      top: stage.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell")!.scrollTop,
      left: stage.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")!.scrollLeft,
      selectedCellWidth: stage.querySelector<HTMLElement>(".grid-cell.grid-cell--selection-anchor[data-column-key='value']")?.getBoundingClientRect().width ?? 0,
    }
  })
  expect(stateAfterTheme).toMatchObject({ sameRoot: true, ...scrollBeforeTheme })
  expect(stateAfterTheme.selectedCellWidth).toBe(selectedCellWidthBefore)
  await expect(page.locator(`[data-testid="theme-grid-first"] .grid-cell[data-row-id="${selectedRowId}"][data-column-key="value"]`)).toHaveClass(/grid-cell--selection-anchor/)

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light"
    document.documentElement.classList.remove("dark")
  })
  await waitForPaint()
  const lightScrolled = await readCanvasSignatures()
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme
    document.documentElement.classList.add("dark")
  })
  await expect.poll(async () => changedCanvasCount(lightScrolled, await readCanvasSignatures())).toEqual([3, 3])

  await page.evaluate(() => document.documentElement.classList.remove("dark"))
  await page.getByTestId("theme-prop-industrial").click()
  await expect.poll(async () => changedCanvasCount(lightScrolled, await readCanvasSignatures())).toEqual([3, 3])

  await page.getByTestId("theme-prop-default").click()
  await waitForPaint()
  const defaultProp = await readCanvasSignatures()
  await page.getByTestId("theme-prop-fixed").click()
  await waitForPaint()
  const fixedTheme = await readCanvasSignatures()
  await page.evaluate(() => {
    const store = (window as typeof window & { __AFFINO_DATAGRID_PERF__?: { samples: unknown[] } }).__AFFINO_DATAGRID_PERF__
    if (store) store.samples.length = 0
  })
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark" })
  await waitForPaint()
  expect(await readCanvasSignatures()).toEqual(fixedTheme)
  const fixedThemeRedraws = await page.evaluate(() => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples: Array<Record<string, string | number>> }
    }).__AFFINO_DATAGRID_PERF__
    return store?.samples.filter(sample => sample.scope === "chromeDraw" && String(sample.redrawSources).includes("theme-change")).length ?? 0
  })
  expect(fixedThemeRedraws).toBe(0)
  expect(defaultProp).not.toEqual(fixedTheme)
})

test("document theme changes repaint pinned-bottom canvas chrome", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/shell/timesheet-grid?dgPerfTrace=1")
  const bottom = page.locator(".grid-body-shell--pinned-bottom").first()
  await expect(bottom).toBeVisible()
  await expect(bottom.locator("canvas.grid-chrome-canvas")).toHaveCount(3)

  const readBottomCanvasSignatures = async (): Promise<number[]> => bottom.locator("canvas.grid-chrome-canvas").evaluateAll(canvases =>
    canvases.map(element => {
      const canvas = element as HTMLCanvasElement
      if (canvas.width === 0 || canvas.height === 0) return 0
      const sample = document.createElement("canvas")
      sample.width = 128
      sample.height = 64
      const context = sample.getContext("2d")!
      context.drawImage(canvas, 0, 0, sample.width, sample.height)
      const { data } = context.getImageData(0, 0, sample.width, sample.height)
      let hash = 2166136261
      for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] === 0) continue
        hash = Math.imul(hash ^ data[index]!, 16777619)
        hash = Math.imul(hash ^ data[index + 1]!, 16777619)
        hash = Math.imul(hash ^ data[index + 2]!, 16777619)
        hash = Math.imul(hash ^ data[index + 3]!, 16777619)
      }
      return hash >>> 0
    }),
  )
  const waitForPaint = async (): Promise<void> => {
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  }

  await page.evaluate(() => { document.documentElement.dataset.theme = "light" })
  await waitForPaint()
  const light = await readBottomCanvasSignatures()
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark" })
  await expect.poll(readBottomCanvasSignatures).not.toEqual(light)
  const draw = await page.evaluate(() => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples: Array<Record<string, string | number>> }
    }).__AFFINO_DATAGRID_PERF__
    return store?.samples.filter(sample => sample.scope === "chromeDraw" && String(sample.redrawSources).includes("theme-change")).at(-1) ?? null
  })
  expect(draw).toMatchObject({ redrawMode: "full" })
})

test("right-pinned checkbox indicators do not animate recycled row states during vertical scroll", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/grouped-header-grid?rows=1000&cols=32")
  const stage = page.locator(".grid-stage").first()
  const viewport = page.locator(".grid-body-shared-vertical-scroll-shell").first()
  const checkbox = page.locator('.grid-body-pane--right .grid-cell[data-column-key="critical"] .grid-checkbox-indicator').first()
  await expect(checkbox).toBeVisible({ timeout: 20_000 })

  const idleTransition = await checkbox.evaluate(element => getComputedStyle(element).transitionDuration)
  await viewport.evaluate(element => {
    element.scrollTop = 240
    element.dispatchEvent(new Event("scroll", { bubbles: true }))
  })
  await expect(stage).toHaveClass(/grid-stage--scrolling/)
  await expect.poll(() => checkbox.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s")

  await expect(stage).not.toHaveClass(/grid-stage--scrolling/, { timeout: 2_000 })
  await expect.poll(() => checkbox.evaluate(element => getComputedStyle(element).transitionDuration)).toBe(idleTransition)
})

test("grouped headers retain body scroll offsets across animation frames and direction changes", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/grouped-header-grid?rows=1000&cols=32")
  await expect(page.locator(".grid-header-row--pivot-groups").first()).toBeVisible()
  await expect(page.locator(".grid-body-viewport .grid-row").first()).toBeVisible()
  const samples = await page.evaluate(async () => {
    const body = document.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")!
    const header = document.querySelector<HTMLElement>(".grid-header-viewport")!
    const overscrollBehaviorX = getComputedStyle(body).overscrollBehaviorX
    const stageOverscrollBehaviorX = getComputedStyle(body.closest<HTMLElement>(".grid-stage")!).overscrollBehaviorX
    const maximum = body.scrollWidth - body.clientWidth
    const samples: Array<{ body: number; header: number }> = []
    for (const fraction of [0.2, 0.7, 1, 0.5, 0, 0.9]) {
      body.scrollLeft = maximum * fraction
      body.dispatchEvent(new Event("scroll"))
      for (let frame = 0; frame < 3; frame += 1) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        samples.push({ body: body.scrollLeft, header: header.scrollLeft })
      }
    }
    return { maximum, samples, overscrollBehaviorX, stageOverscrollBehaviorX }
  })
  expect(samples.maximum).toBeGreaterThan(0)
  expect(samples.overscrollBehaviorX).toBe("none")
  expect(samples.stageOverscrollBehaviorX).toBe("none")
  for (const sample of samples.samples) {
    expect(Math.abs(sample.header - sample.body)).toBeLessThanOrEqual(1)
  }
})

test("group labels follow the visible group edge in the same frame during rapid horizontal scrolling", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/grouped-header-grid?rows=1000&cols=32")
  await expect(page.locator(".grid-header-row--pivot-groups").first()).toBeVisible()
  await expect(page.locator(".grid-header-row--pivot-groups .col-head__pivot-group-label").first()).toBeVisible()

  const samples = await page.evaluate(async () => {
    const body = document.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")!
    const header = document.querySelector<HTMLElement>(".grid-header-viewport")!
    const label = header.querySelector<HTMLElement>(".grid-header-row--pivot-groups .col-head__pivot-group-label")!
    const group = label.parentElement!
    const maximum = body.scrollWidth - body.clientWidth
    const measurements: Array<{ actual: number; expected: number; visibleWidth: number; scrollLeft: number; groupLeft: number }> = []
    const visibleLabelWidths: number[] = []

    for (let step = 1; step <= 48; step += 1) {
      body.scrollLeft = maximum * step / 48
      body.dispatchEvent(new Event("scroll"))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await Promise.resolve()
      const viewportRect = header.getBoundingClientRect()
      const groupRect = group.getBoundingClientRect()
      const labelRect = label.getBoundingClientRect()
      const visibleStart = Math.max(groupRect.left, viewportRect.left)
      const visibleEnd = Math.min(groupRect.right, viewportRect.right)
      const visibleWidth = Math.max(0, visibleEnd - visibleStart)
      if (visibleWidth > 0) {
        const labelWidth = Math.min(label.scrollWidth, visibleWidth)
        const expected = Math.min(visibleEnd - labelWidth, Math.max(visibleStart, groupRect.left))
        measurements.push({ actual: labelRect.left, expected, visibleWidth, scrollLeft: header.scrollLeft, groupLeft: groupRect.left })
      }
      for (const visibleLabel of Array.from(header.querySelectorAll<HTMLElement>(".grid-header-row--pivot-groups .col-head__pivot-group-label"))) {
        const visibleGroup = visibleLabel.parentElement!.getBoundingClientRect()
        if (Math.min(visibleGroup.right, viewportRect.right) > Math.max(visibleGroup.left, viewportRect.left)) {
          visibleLabelWidths.push(visibleLabel.getBoundingClientRect().width)
        }
      }
    }

    return { measurements, visibleLabelWidths }
  })

  expect(samples.measurements.length).toBeGreaterThan(0)
  expect(samples.visibleLabelWidths.length).toBeGreaterThan(0)
  expect(samples.visibleLabelWidths.every(width => width > 0)).toBe(true)
  for (const sample of samples.measurements) {
    expect(Math.abs(sample.actual - sample.expected), JSON.stringify(sample)).toBeLessThanOrEqual(1)
  }
})

test("a partially visible group's header node stays mounted while its columns virtualize", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/grouped-header-grid?rows=100&cols=128")
  const target = page.locator('.grid-header-viewport [data-datagrid-column-group-label="Identity"] .col-head__pivot-group-label').first()
  await expect(target).toBeVisible()
  const mergedIndexGeometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".grid-header-pane--left")!
    const groupBand = shell.querySelector<HTMLElement>(".grid-header-row--pivot-groups")!
    const index = shell.querySelector<HTMLElement>(".grid-cell--index-header[role='columnheader']")!
    const groupRect = groupBand.getBoundingClientRect()
    const indexRect = index.getBoundingClientRect()
    const leafRect = shell.querySelector<HTMLElement>(".grid-header-row:not(.grid-header-row--pivot-groups) .grid-cell--index-header")!.getBoundingClientRect()
    const contentRect = index.querySelector<HTMLElement>(".col-head")!.getBoundingClientRect()
    const expectedContentCenter = (groupRect.top + leafRect.bottom) / 2
    const emptyGroupBorders = Array.from(document.querySelectorAll<HTMLElement>(".grid-header-row--pivot-groups .grid-cell--header-group-empty"))
      .map(cell => getComputedStyle(cell).borderBottomColor)
    const checkboxHeader = document.querySelector<HTMLElement>(".grid-header-shell .grid-cell--row-selection")
    const regularHeader = document.querySelector<HTMLElement>(".grid-header-viewport .grid-header-row:not(.grid-header-row--pivot-groups) .grid-cell--header[data-column-key]")
    const centerHeaderBorders = Array.from(document.querySelectorAll<HTMLElement>(".grid-header-viewport .grid-header-row .grid-cell:not(:first-child)"))
      .map(cell => {
        const style = getComputedStyle(cell)
        return {
          width: Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth),
          color: Number.parseFloat(style.borderLeftWidth) > 0 ? style.borderLeftColor : style.borderRightColor,
        }
      })
    return {
      contentCenterOffset: contentRect.top + contentRect.height / 2 - expectedContentCenter,
      groupHeight: groupRect.height,
      leafHeight: leafRect.height,
      merged: index.classList.contains("grid-cell--header-merged-untitled"),
      emptyGroupBorders,
      hasCheckboxHeader: Boolean(checkboxHeader),
      checkboxBackground: checkboxHeader ? getComputedStyle(checkboxHeader).backgroundColor : null,
      regularBackground: regularHeader ? getComputedStyle(regularHeader).backgroundColor : null,
      centerHeaderBorders,
    }
  })
  expect(mergedIndexGeometry.merged).toBe(true)
  expect(Math.abs(mergedIndexGeometry.contentCenterOffset), JSON.stringify(mergedIndexGeometry)).toBeLessThanOrEqual(1)
  expect(mergedIndexGeometry.emptyGroupBorders.length).toBeGreaterThan(0)
  expect(mergedIndexGeometry.emptyGroupBorders.every(color => color === "rgba(0, 0, 0, 0)")).toBe(true)
  expect(mergedIndexGeometry.hasCheckboxHeader).toBe(true)
  if (mergedIndexGeometry.checkboxBackground && mergedIndexGeometry.regularBackground) {
    expect(mergedIndexGeometry.checkboxBackground).toBe(mergedIndexGeometry.regularBackground)
  }
  expect(mergedIndexGeometry.centerHeaderBorders.length).toBeGreaterThan(0)
  expect(Math.max(...mergedIndexGeometry.centerHeaderBorders.map(border => border.width))).toBeLessThanOrEqual(1.1)
  expect(new Set(mergedIndexGeometry.centerHeaderBorders.map(border => border.color)).size).toBeLessThanOrEqual(1)
  const stayedMounted = await page.evaluate(async () => {
    const body = document.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")!
    const header = document.querySelector<HTMLElement>(".grid-header-viewport")!
    const selector = '.grid-header-viewport [data-datagrid-column-group-label="Identity"] .col-head__pivot-group-label'
    const original = header.querySelector<HTMLElement>(selector)
    if (!original) return false
    for (const scrollLeft of [24, 56, 96, 144, 192]) {
      body.scrollLeft = scrollLeft
      body.dispatchEvent(new Event("scroll"))
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (!original.isConnected || header.querySelector(selector) !== original || original.textContent !== "Identity") return false
    }
    return true
  })
  expect(stayedMounted).toBe(true)
})

test("untitled Extra headers render above the empty grouped-header bands", async ({ page }) => {
  await gotoSandboxRoute(page, "/vue/grouped-header-grid?rows=100&cols=32")
  const body = page.locator(".grid-body-center-horizontal-scrollport--scroll-owner")
  await body.evaluate(element => {
    const viewport = element as HTMLElement
    viewport.scrollLeft = viewport.scrollWidth
    viewport.dispatchEvent(new Event("scroll"))
  })

  const extraHeader = page.locator('.grid-header-viewport .grid-header-row:not(.grid-header-row--pivot-groups) [data-column-key^="extra_"]').first()
  await expect(extraHeader).toBeVisible()
  await expect(extraHeader.locator(".col-head__label")).toContainText("Extra")
  const visibleText = await extraHeader.evaluate(element => {
    const label = element.querySelector<HTMLElement>(".col-head__label")!
    const rect = label.getBoundingClientRect()
    const header = element.closest<HTMLElement>(".grid-header-viewport")!
    const viewport = header.getBoundingClientRect()
    const leafRow = element.parentElement!
    return {
      labelHeight: rect.height,
      labelInsideViewportVertically: rect.top >= viewport.top && rect.bottom <= viewport.bottom,
      rowZIndex: getComputedStyle(leafRow).zIndex,
    }
  })
  expect(visibleText.labelHeight).toBeGreaterThan(0)
  expect(visibleText.labelInsideViewportVertically, JSON.stringify(visibleText)).toBe(true)
  expect(visibleText.rowZIndex).toBe("7")
})

test.describe("sandbox grid baseline (adapted from affinio datagrid e2e)", () => {
  test("@a11y vue base grid exposes mounted grid semantics after scroll and pinning", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=1000&cols=32")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("grid").first()).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(32)

    const before = await mountedGridA11ySnapshot(page)
    expect(before.grid.role).toBe("grid")
    expect(before.grid.ariaMultiselectable).toBe("true")
    expect(Number(before.grid.ariaRowCount)).toBeGreaterThan(0)
    expect(Number(before.grid.ariaColCount)).toBeGreaterThanOrEqual(32)
    expect(before.headers.length).toBeGreaterThan(0)
    expect(before.headers.some(header => header.role === "columnheader")).toBe(true)
    expect(before.firstCenterCell.role).toBe("gridcell")
    expect(before.firstCenterCell.id).toBeTruthy()
    expect(before.firstCenterCell.ariaRowIndex).toBe(String(Number(before.firstCenterCell.rowIndex) + 1))
    expect(before.firstCenterCell.ariaColIndex).toBe(String(Number(before.firstCenterCell.columnIndex) + 1))

    await pinColumnRight(page, "amount")
    const start = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(start)

    const after = await mountedGridA11ySnapshot(page)
    expect(after.firstCenterCell.id).toBeTruthy()
    expect(after.firstCenterCell.ariaRowIndex).toBe(String(Number(after.firstCenterCell.rowIndex) + 1))
    expect(after.firstCenterCell.ariaColIndex).toBe(String(Number(after.firstCenterCell.columnIndex) + 1))
    expect(after.rightPinnedCell).toMatchObject({
      role: "gridcell",
      columnKey: "amount",
    })
    expect(after.rightPinnedCell?.ariaColIndex).toBe(String(Number(after.rightPinnedCell?.columnIndex) + 1))
  })

  test("vue base grid updates viewport window on long vertical scroll", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    const rendered = await renderedRows(page)
    const total = await totalRows(page)
    expect(rendered).toBeGreaterThan(0)
    expect(total).toBeGreaterThan(rendered)
  })

  test("vue worker grid keeps viewport covered across long scroll jumps", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/worker-grid?rows=200000&cols=32")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 30_000 }).toBe(200000)

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page), { timeout: 20_000 }).toBeGreaterThan(before)
    await assertNoBlankVerticalViewport(page)
    expect(await renderedRows(page)).toBeLessThanOrEqual(96)
  })

  test("vue worker grid stays covered during a rapid scroll burst", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/worker-grid?rows=100000&cols=32")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 30_000 }).toBe(100000)
    const maxTop = await viewportMaxScrollTop(viewport)
    expect(maxTop).toBeGreaterThan(0)

    for (let step = 0; step < 32; step += 1) {
      await setViewportScroll(viewport, {
        top: Math.round(maxTop * ((step * 17) % 32) / 31),
        left: await viewportScrollLeft(viewport),
      })
      await page.waitForTimeout(8)
    }

    await assertNoBlankVerticalViewport(page)
    expect(await renderedRows(page)).toBeLessThanOrEqual(96)
  })

  test("vue worker grid reaches the last logical row beyond native scroll height", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/worker-grid?rows=200000&cols=8")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 30_000 }).toBe(200000)

    await expect.poll(async () => viewportMaxScrollTop(viewport), { timeout: 20_000 }).toBeGreaterThan(0)
    await setViewportScroll(viewport, { top: await viewportMaxScrollTop(viewport), left: 0 })
    await expect.poll(async () => viewportRangeStart(page), { timeout: 20_000 }).toBeGreaterThan(199_000)
    await assertNoBlankVerticalViewport(page)
  })

  test("vue base grid reaches the last logical row beyond native scroll height", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=200000&cols=8")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 30_000 }).toBe(200000)

    await page.getByLabel("Row size").fill("120")
    await expect.poll(async () => viewportMaxScrollTop(viewport), { timeout: 20_000 }).toBeGreaterThan(0)
    await setViewportScroll(viewport, { top: await viewportMaxScrollTop(viewport), left: 0 })
    await expect.poll(async () => viewportRangeStart(page), { timeout: 20_000 }).toBeGreaterThan(199_000)
    await assertNoBlankVerticalViewport(page)
  })

  test("vue base grid keeps variable-height viewport covered across long jumps", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=50000&cols=8")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 20_000 }).toBe(50000)
    await selectGridOption(page, "Row mode", "Auto")

    for (const ratio of [0.2, 0.55, 0.85, 1]) {
      const maxTop = await viewportMaxScrollTop(viewport)
      await setViewportScroll(viewport, { top: Math.round(maxTop * ratio), left: 0 })
      await page.waitForTimeout(48)
      await assertNoBlankVerticalViewport(page)
      expect(await renderedRows(page)).toBeLessThanOrEqual(96)
    }
  })

  test("vue base grid does not expose blank vertical viewport bands during fast scroll", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=50000")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    await assertNoBlankVerticalViewport(page)
    await runFastVerticalDetectionSession(page, viewport)
    await assertNoBlankVerticalViewport(page)
  })

  test("vue base grid does not expose blank horizontal viewport bands with column virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=10000")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await selectGridOption(page, "Cols", "32")
    await expect.poll(async () => totalColumns(page)).toBeGreaterThanOrEqual(32)

    await assertNoBlankHorizontalViewport(page)
    await runFastHorizontalDetectionSession(page, viewport)
    await assertNoBlankHorizontalViewport(page)
  })

  test("vue base grid keeps a bounded horizontal window on a 1000-column grid", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=1000&cols=1000")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(1000)

    await assertNoBlankHorizontalViewport(page)
    expect(await renderedCenterCellsInFirstVisibleRow(page)).toBeLessThanOrEqual(80)

    await runFastHorizontalDetectionSession(page, viewport)

    await assertNoBlankHorizontalViewport(page)
    expect(await renderedCenterCellsInFirstVisibleRow(page)).toBeLessThanOrEqual(80)
  })

  test("vue base grid bounds stress presets and disables oversized row/column combinations", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=50000&cols=1000")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalRows(page), { timeout: 30_000 }).toBe(50000)
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(128)
    await expect(page.getByRole("status").filter({ hasText: "Large grid combinations are disabled" })).toBeVisible()

    const columns = page.getByLabel("Cols")
    expect(await columns.locator("option[value='1000']").evaluate(option => (option as HTMLOptionElement).disabled)).toBe(true)
    await columns.selectOption("32")
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(32)
    await columns.selectOption("128")
    expect(await page.getByLabel("Rows").locator("option[value='100000']").evaluate(option => (option as HTMLOptionElement).disabled)).toBe(true)
  })

  test("vue base grid keeps a bounded window after hiding 999 of 1000 columns", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=1000&cols=1000")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(1000)

    await page.getByRole("button", { name: "Columns", exact: true }).click()
    const visibilityInputs = page.locator(".column-layout-panel input[type=checkbox]")
    await expect(visibilityInputs).toHaveCount(1000, { timeout: 20_000 })
    await visibilityInputs.evaluateAll(inputs => {
      for (const [index, input] of inputs.entries()) {
        if (index === 1) continue
        const checkbox = input as HTMLInputElement
        if (checkbox.checked) {
          checkbox.click()
        }
      }
    })
    await page.getByRole("button", { name: "Apply", exact: true }).click()

    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(1)
    await expect.poll(async () => renderedCenterCellsInFirstVisibleRow(page), { timeout: 20_000 }).toBe(1)
    await expect.poll(async () => viewportMaxScrollLeft(viewport), { timeout: 20_000 }).toBe(0)
  })

  test("core base grid keeps virtualization responsive while scrolling", async ({ page }) => {
    await gotoSandboxRoute(page, "/core/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    await expect(page.locator(".grid-body-viewport .grid-row").nth(1)).toBeVisible()
  })

  test("server data source settles below the viewport loading budget after fast scroll", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Steady latency" }).click()
    await expect.poll(async () => serverViewportLoadingRatio(page)).toBeLessThanOrEqual(0.05)

    await runLongVerticalSession(viewport)

    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await expect(page.locator(".grid-body-viewport .grid-cell[data-row-index]").nth(1)).toBeVisible()
  })

  test("server data source does not expose blank viewport bands during visible refresh", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Slow backend" }).click()
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)

    await runLongVerticalSession(viewport)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await expect.poll(async () => serverPlaceholderExposureEvents(page), {
      timeout: 20_000,
    }).toBeGreaterThan(0)
    expect(await serverPlaceholderExposureMaxMs(page)).toBeGreaterThanOrEqual(0)
    await assertNoBlankVerticalViewport(page)

    await page.getByRole("button", { name: "Refresh visible range" }).click()
    await assertNoBlankVerticalViewport(page)
    await expect(page.locator(".grid-body-viewport .grid-cell[data-row-index]").nth(1)).toBeVisible()
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await assertNoBlankVerticalViewport(page)
  })

  test("server data source grouped region expand and collapse rematerializes the viewport", async ({ page }) => {
    await clearServerDatasourceGridState(page)
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".sandbox-server-data-source-grid .grid-body-shared-vertical-scroll-shell, .sandbox-server-data-source-grid .grid-body-viewport.table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const regionMenuButton = page
      .locator('.sandbox-server-data-source-grid [data-datagrid-column-menu-button="true"][data-column-key="region"]')
      .first()
    await expect(regionMenuButton).toBeVisible({ timeout: 20_000 })
    await regionMenuButton.click()
    await page.locator('[data-datagrid-column-menu-action="toggle-group"]').click()

    const firstGroupRow = page.locator(".sandbox-server-data-source-grid .grid-body-viewport .grid-row.row--group").first()
    const firstGroupCell = firstGroupRow.locator(".grid-cell[data-column-key]:not(.grid-cell--row-selection)").first()
    await expect(firstGroupRow).toBeVisible({ timeout: 20_000 })
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "false")
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await firstGroupCell.click()
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "true")

    const expandedRowCount = await gridAriaRowCount(viewport)
    expect(expandedRowCount).toBeGreaterThan(20_000)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await assertNoBlankVerticalViewport(page)

    await firstGroupCell.click()
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "false")
    await expect.poll(async () => gridAriaRowCount(viewport), {
      timeout: 20_000,
    }).toBeLessThan(expandedRowCount)
    // Four collapsed roots can be shorter than the viewport; coverage is checked after reopening one.
    const collapsedRowCount = await gridAriaRowCount(viewport)

    await firstGroupCell.click()
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "true")
    await expect.poll(async () => gridAriaRowCount(viewport), {
      timeout: 20_000,
    }).toBeGreaterThan(collapsedRowCount)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await assertNoBlankVerticalViewport(page)
  })

  test("server data source grouped region scroll and refresh keep the viewport covered", async ({ page }) => {
    await clearServerDatasourceGridState(page)
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".sandbox-server-data-source-grid .grid-body-shared-vertical-scroll-shell, .sandbox-server-data-source-grid .grid-body-viewport.table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Steady latency" }).click()

    const regionMenuButton = page
      .locator('.sandbox-server-data-source-grid [data-datagrid-column-menu-button="true"][data-column-key="region"]')
      .first()
    await expect(regionMenuButton).toBeVisible({ timeout: 20_000 })
    await regionMenuButton.click()
    await page.locator('[data-datagrid-column-menu-action="toggle-group"]').click()
    const firstGroupRow = page.locator(".sandbox-server-data-source-grid .grid-body-viewport .grid-row.row--group").first()
    await expect(firstGroupRow).toBeVisible({ timeout: 20_000 })
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "false")
    const firstGroupCell = firstGroupRow.locator(".grid-cell[data-column-key]:not(.grid-cell--row-selection)").first()
    await firstGroupCell.click()
    await expect(firstGroupRow).toHaveAttribute("aria-expanded", "true")
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)

    await runLongVerticalSession(viewport)
    await assertNoBlankVerticalViewport(page)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)

    await page.getByRole("button", { name: "Refresh visible range" }).click()
    await assertNoBlankVerticalViewport(page)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await assertNoBlankVerticalViewport(page)
  })
})

test.describe("sandbox resize and fractional viewport contracts", () => {
  test.use({
    deviceScaleFactor: 1.25,
    viewport: { width: 1025, height: 769 },
  })

  test("vue base grid stays covered after high-DPI viewport resize while scrolled", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?rows=50000&cols=128")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => totalColumns(page), { timeout: 20_000 }).toBe(128)

    await setViewportScroll(viewport, { top: 12_345.5, left: 2_407.5 })
    await assertNoBlankVerticalViewport(page)
    await assertNoBlankHorizontalViewport(page)

    await page.setViewportSize({ width: 897, height: 673 })
    await page.waitForTimeout(64)

    await assertNoBlankVerticalViewport(page)
    await assertNoBlankHorizontalViewport(page)
    expect(await renderedCenterCellsInFirstVisibleRow(page)).toBeLessThanOrEqual(80)
  })

  test("server data source keeps viewport covered when resized during loading", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Slow backend" }).click()
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)

    await setViewportScroll(viewport, { top: 8_800.5, left: 0 })
    await page.setViewportSize({ width: 911, height: 707 })
    await page.waitForTimeout(64)

    await assertNoBlankVerticalViewport(page)
    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
  })
})

test.describe("sandbox touch scroll contracts", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })

  test("one-finger touch pan keeps the body viewport scroll-first", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toHaveCSS("touch-action", "pan-x pan-y")

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)

    await dispatchTouchPan(page, viewport, 260)

    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await viewport.evaluate(element => {
      element.scrollTop += 260
    })
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })

  test("body viewport touchmove is not prevented by linked-surface routing", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(viewport, { deltaY: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
  })

  test("body cell touch drag does not start selection fill range move or resize", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const cell = firstEditableAmountCell(page)
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(cell).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const dragResult = await dispatchTouchDragStartAndMove(cell, amountCellByViewportRow(page, 3))

    expect(dragResult.startPrevented).toBe(false)
    expect(dragResult.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview")).toHaveCount(0)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview")).toHaveCount(0)

    await viewport.evaluate(element => {
      element.scrollTop += 160
    })
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })

  test("body scroll keeps header and pinned panes synchronized", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const headerViewport = page.locator(".grid-header-viewport").first()
    const leftPaneContent = page.locator(".grid-body-pane--left .grid-pane-content").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(headerViewport).toBeVisible({ timeout: 20_000 })
    await expect(leftPaneContent).toBeVisible({ timeout: 20_000 })

    const scrollState = await setViewportScroll(viewport, { top: 180, left: 260 })

    await expect.poll(async () => viewportScrollLeft(headerViewport)).toBe(scrollState.left)
    await expect.poll(async () => inlineScrollTopVar(leftPaneContent)).toBe(scrollState.top)
  })

  test("body scroll keeps dynamically pinned right pane synchronized", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap").first()
    const rightPaneContent = page.locator(".grid-body-pane--right .grid-pane-content").first()
    await expect(page.locator(".grid-body-viewport .grid-row").first()).toBeVisible({ timeout: 20_000 })
    await expect(rightPaneContent).toBeVisible({ timeout: 20_000 })

    const scrollState = await setViewportScroll(viewport, { top: 180, left: 120 })

    await expect.poll(async () => inlineScrollTopVar(rightPaneContent)).toBe(scrollState.top)
  })

  test("touch pan on pinned pane stays native and unclaimed", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const pinnedPane = page.locator(".grid-body-pane--left").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(pinnedPane).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(pinnedPane, { deltaY: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("horizontal touch pan on pinned pane stays native and unclaimed", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const pinnedPane = page.locator(".grid-body-pane--left").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(pinnedPane).toBeVisible({ timeout: 20_000 })

    const beforeLeft = await viewportScrollLeft(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(pinnedPane, { deltaX: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollLeft(viewport)).toBe(beforeLeft)
  })

  test("touch pan on right pinned pane stays native and unclaimed", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap").first()
    const pinnedPane = page.locator(".grid-body-pane--right").first()
    await expect(page.locator(".grid-body-viewport .grid-row").first()).toBeVisible({ timeout: 20_000 })
    await expect(pinnedPane).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(pinnedPane, { deltaY: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("horizontal touch pan on right pinned pane stays native and unclaimed", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap").first()
    const pinnedPane = page.locator(".grid-body-pane--right").first()
    await expect(page.locator(".grid-body-viewport .grid-row").first()).toBeVisible({ timeout: 20_000 })
    await expect(pinnedPane).toBeVisible({ timeout: 20_000 })

    const beforeLeft = await viewportScrollLeft(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(pinnedPane, { deltaX: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollLeft(viewport)).toBe(beforeLeft)
  })

  test("touch pan on header shell is not translated by table fallback", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const headerShell = page.locator(".grid-header-shell").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(headerShell).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(headerShell, { deltaY: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("horizontal touch pan on header shell is not translated by table fallback", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const headerShell = page.locator(".grid-header-shell").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(headerShell).toBeVisible({ timeout: 20_000 })

    const beforeLeft = await viewportScrollLeft(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(headerShell, { deltaX: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    expect(await viewportScrollLeft(viewport)).toBe(beforeLeft)
  })

  test("touch scroll records stage scroll telemetry", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid?dgPerfTrace=1")

    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const scrollState = await setViewportScroll(viewport, { top: 220, left: 180 })

    await expect.poll(async () => latestPerfSample(page, "stageScrollFrame")).toMatchObject({
      scope: "stageScrollFrame",
      scrollTop: scrollState.top,
      scrollLeft: scrollState.left,
      hasScrollState: 1,
    })
    const frameSample = await latestPerfSample(page, "stageScrollFrame")
    expect(readNumericPerfField(frameSample, "totalMs")).toBeGreaterThanOrEqual(0)
    expect(readNumericPerfField(frameSample, "totalMs")).toBeLessThanOrEqual(50)
    const frameSummary = await perfSummary(page, "stageScrollFrame")
    expect(readNumericPerfField(frameSummary, "count")).toBeGreaterThanOrEqual(1)
    expect(readNumericPerfField(frameSummary, "p95Ms")).toBeLessThanOrEqual(50)
    expect(readNumericPerfField(frameSummary, "maxMs")).toBeLessThanOrEqual(50)

    await expect.poll(async () => latestPerfSample(page, "stageScrollPerf")).toMatchObject({
      scope: "stageScrollPerf",
      frameCount: expect.any(Number),
      droppedFrames: expect.any(Number),
      longTaskFrames: expect.any(Number),
      fps: expect.any(Number),
      quality: expect.any(String),
    })
    const perfSample = await latestPerfSample(page, "stageScrollPerf")
    const frameCount = readNumericPerfField(perfSample, "frameCount")
    expect(frameCount).toBeGreaterThanOrEqual(0)
    expect(readNumericPerfField(perfSample, "droppedFrames")).toBeLessThanOrEqual(frameCount)
    expect(readNumericPerfField(perfSample, "longTaskFrames")).toBeLessThanOrEqual(frameCount)
    expect(readNumericPerfField(perfSample, "fps")).toBeGreaterThanOrEqual(0)
    expect(["unknown", "good", "degraded"]).toContain(perfSample?.quality)

    await expect.poll(async () => latestPerfSample(page, "stageScrollPerf"), {
      timeout: 5_000,
    }).toMatchObject({
      scope: "stageScrollPerf",
      active: 0,
    })
    const idlePerfSample = await latestPerfSample(page, "stageScrollPerf")
    const idleFrameCount = readNumericPerfField(idlePerfSample, "frameCount")
    expect(readNumericPerfField(idlePerfSample, "droppedFrames")).toBeLessThanOrEqual(idleFrameCount)
    expect(readNumericPerfField(idlePerfSample, "longTaskFrames")).toBeLessThanOrEqual(idleFrameCount)
  })

  test("server data source stays below loading budget in touch mode after fast scroll", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Steady latency" }).click()
    await expect.poll(async () => serverViewportLoadingRatio(page)).toBeLessThanOrEqual(0.05)

    await runLongVerticalSession(viewport)

    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await expect(page.locator(".grid-body-viewport .grid-cell[data-row-index]").nth(1)).toBeVisible()
  })

  test("stationary long press selects a body cell without opening the context menu", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    await expect(page.locator(".grid-stage").first()).toHaveClass(/grid-stage--interaction-touch/)
    const cell = page
      .locator(".grid-body-viewport .grid-cell[data-row-id][data-row-index][data-column-index]:not(.grid-cell--row-selection)")
      .first()
    await expect(cell).toBeVisible({ timeout: 20_000 })

    const expectedSignature = await cellSignature(cell)
    await dispatchLongPress(page, cell, 650)

    await expect.poll(async () => selectionAnchorSignature(page)).toBe(expectedSignature)
    expect(await dispatchContextMenuAndReadPrevented(cell)).toBe(true)
  })

  test("touch double tap opens editing only when the viewport is idle", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 })
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const editableCell = firstEditableAmountCell(page)
    // The first row can be fractionally clipped (< 1 CSS px) by the scrollport
    // after layout rounding; the cell center remains fully available for the tap.
    await expect(editableCell).toBeInViewport({ ratio: 0.98 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
    await dispatchTouchGeneratedDoubleClick(editableCell)
    await expect(editableCell.locator("input.cell-editor-input")).toBeVisible({ timeout: 20_000 })
    await page.keyboard.press("Escape")
    await expect(page.locator(".grid-body-viewport input.cell-editor-input")).toHaveCount(0)

    await markViewportScrolling(viewport)
    await expect(stage).toHaveClass(/grid-stage--scrolling/)

    await dispatchTouchGeneratedDoubleClick(firstEditableAmountCell(page))
    await expect(page.locator(".grid-body-viewport input.cell-editor-input")).toHaveCount(0)

    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
    await dispatchTouchGeneratedDoubleClick(firstEditableAmountCell(page))
    await expect(firstEditableAmountCell(page).locator("input.cell-editor-input")).toBeVisible({ timeout: 20_000 })
  })

  test("touch fill drag starts only from the explicit fill handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const anchorCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await dispatchLongPress(page, anchorCell, 650)
    await expect(anchorCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const fillHandle = anchorCell.locator(".cell-fill-handle")
    const touchDrag = await dispatchTouchDragStartAndMove(fillHandle, targetCell)

    expectPassiveTouchDrag(touchDrag)
    await expect(stage).toHaveClass(/grid-stage--fill-dragging/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview").first()).toBeVisible()

    await dispatchTouchEndAtWindow(page, targetCell)
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("touch selection drag starts only from the explicit selection handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const anchorCell = firstEditableAmountCell(page)
    const rangeEndCell = amountCellByViewportRow(page, 1)
    const targetCell = amountCellByViewportRow(page, 3)
    await dispatchLongPress(page, anchorCell, 650)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(anchorCell))

    await page.keyboard.down("Shift")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.up("Shift")
    await expect(rangeEndCell).toHaveClass(/grid-cell--selected/)

    const selectionHandle = anchorCell.locator(".grid-touch-selection-handle")
    await expect(selectionHandle).toBeVisible({ timeout: 20_000 })
    await expect(rangeEndCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const touchDrag = await dispatchTouchDragStartAndMove(selectionHandle, targetCell)

    expectPassiveTouchDrag(touchDrag)
    await expect(targetCell).toHaveClass(/grid-cell--selected/)

    // Moving the selection can unmount the original handle; native touchend
    // still reaches the grid's stage-level listener after that DOM change.
    await dispatchTouchEndAt(stage, targetCell)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("touch range move drag starts only from the explicit range move handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const anchorCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await dispatchLongPress(page, anchorCell, 650)

    const rangeMoveHandle = anchorCell.locator(".grid-touch-range-move-handle")
    await expect(rangeMoveHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const targetPoint = await elementCenter(targetCell)
    const touchDrag = await dispatchTouchDragStartAndMove(rangeMoveHandle, targetPoint)

    expectPassiveTouchDrag(touchDrag)
    await expect(stage).toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview").first()).toBeVisible()

    await dispatchTouchEndAt(rangeMoveHandle, targetPoint)
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("coarse pointer clipboard shortcuts use long-press selection without taking touch scroll", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const sourceCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(targetCell).toBeVisible({ timeout: 20_000 })

    const sourceText = (await sourceCell.textContent())?.trim() ?? ""
    expect(sourceText).not.toBe("")

    await dispatchLongPress(page, sourceCell, 650)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))
    await page.keyboard.press("Control+C")
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)

    await dispatchLongPress(page, targetCell, 650)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(targetCell))
    await page.keyboard.press("Control+V")
    await expect.poll(async () => (await targetCell.textContent())?.trim() ?? "").toBe(sourceText)

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(viewport, { deltaY: 180 })
    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await viewport.evaluate(element => {
      element.scrollTop += 180
    })
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })

  test("touch column resize drag starts from the explicit resize handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const header = page.locator('.grid-cell--header[data-column-key="name"]').first()
    const resizeHandle = header.locator(".col-resize")
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(resizeHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const before = await boundingBox(header)
    const endPoint = {
      x: Math.round(before.x + before.width + 80),
      y: Math.round(before.y + before.height / 2),
    }
    const touchDrag = await dispatchTouchDragStartAndMove(resizeHandle, endPoint)
    await dispatchTouchEndAt(resizeHandle, endPoint)

    const after = await boundingBox(header)
    expectPassiveTouchDrag(touchDrag)
    expect(after.width).toBeGreaterThan(before.width + 30)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("touch row resize drag starts from the explicit resize handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap").first()
    const row = page.locator('.grid-body-pane--left .grid-row[data-row-index="0"]').first()
    const resizeHandle = row.locator(".row-resize-handle")
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(resizeHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const before = await boundingBox(row)
    const endPoint = {
      x: Math.round(before.x + before.width / 2),
      y: Math.round(before.y + before.height + 36),
    }
    const touchDrag = await dispatchTouchDragStartAndMove(resizeHandle, endPoint)
    await dispatchTouchEndAt(resizeHandle, endPoint)

    const after = await boundingBox(row)
    expectPassiveTouchDrag(touchDrag)
    expect(after.height).toBeGreaterThan(before.height + 16)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })
})

async function gotoSandboxRoute(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
  const rowsMeta = page.locator(".meta span").filter({ hasText: "Rows in model:" }).first()
  try {
    await expect(rowsMeta).toBeVisible({ timeout: 10_000 })
  } catch {
    await expect(page.locator(".grid-body-shared-vertical-scroll-shell:visible, .grid-body-viewport.table-wrap:visible, .table-wrap:visible").first()).toBeVisible({ timeout: 20_000 })
  }
}

async function clearServerDatasourceGridState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.includes("server-data-source-grid")) {
        window.localStorage.removeItem(key)
      }
    }
  })
}

async function forceCoarsePointer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== "(hover: none) and (pointer: coarse)") {
        return originalMatchMedia(query)
      }
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      } as MediaQueryList
    }
  })
}

async function viewportScrollTop(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => {
    const verticalViewport = element.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell") ?? element
    return verticalViewport.scrollTop
  })
}

async function viewportScrollLeft(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => {
    const usesSplitBodyScroll = element.classList.contains("grid-body-shared-vertical-scroll-shell")
      || element.classList.contains("grid-body-viewport")
      || element.classList.contains("table-wrap")
    const horizontalViewport = usesSplitBodyScroll
      ? element.closest(".grid-stage")?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? element
      : element
    return horizontalViewport.scrollLeft
  })
}

async function viewportMaxScrollTop(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => {
    const verticalViewport = element.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell") ?? element
    return Math.max(0, verticalViewport.scrollHeight - verticalViewport.clientHeight)
  })
}

async function viewportMaxScrollLeft(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => {
    const horizontalViewport = element.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? element
    return Math.max(0, horizontalViewport.scrollWidth - horizontalViewport.clientWidth)
  })
}

async function setViewportScroll(viewport: Locator, scroll: { top: number; left: number }): Promise<{ top: number; left: number }> {
  return await viewport.evaluate((element, nextScroll) => {
    const stage = element.closest(".grid-stage")
    const verticalViewport = stage?.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell") ?? element
    const horizontalViewport = stage?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? element
    verticalViewport.scrollTop = nextScroll.top
    horizontalViewport.scrollLeft = nextScroll.left
    verticalViewport.dispatchEvent(new Event("scroll", { bubbles: true }))
    if (horizontalViewport !== verticalViewport) {
      horizontalViewport.dispatchEvent(new Event("scroll", { bubbles: true }))
    }
    return {
      top: verticalViewport.scrollTop,
      left: horizontalViewport.scrollLeft,
    }
  }, scroll)
}

async function inlineScrollTopVar(locator: Locator): Promise<number | null> {
  return await locator.evaluate(element => {
    const raw = window.getComputedStyle(element as HTMLElement).getPropertyValue("--datagrid-body-scroll-top")
    const value = Number.parseFloat(raw)
    return Number.isFinite(value) ? value : null
  })
}

async function latestPerfSample(page: Page, scope: string): Promise<Record<string, unknown> | null> {
  return await page.evaluate(sampleScope => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples?: Array<Record<string, unknown>> }
    }).__AFFINO_DATAGRID_PERF__
    const samples = store?.samples ?? []
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (sample?.scope === sampleScope) {
        return sample
      }
    }
    return null
  }, scope)
}

async function perfSummary(page: Page, scope: string): Promise<Record<string, unknown> | null> {
  return await page.evaluate(sampleScope => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { summary?: () => Array<Record<string, unknown>> }
    }).__AFFINO_DATAGRID_PERF__
    return store?.summary?.().find(summary => summary.scope === sampleScope) ?? null
  }, scope)
}

async function dispatchElementClick(target: Locator): Promise<void> {
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
    }))
  })
}

async function pinColumnRight(page: Page, columnKey: string): Promise<void> {
  const menuButton = page.locator(`[data-datagrid-column-menu-button="true"][data-column-key="${columnKey}"]:visible`).first()
  await expect(menuButton).toBeVisible({ timeout: 20_000 })
  await dispatchElementClick(menuButton)
  const pinSubmenu = page.locator('[data-datagrid-column-menu-action="pin-submenu"]').first()
  await expect(pinSubmenu).toBeVisible({ timeout: 20_000 })
  await pinSubmenu.click({ force: true })
  const pinRight = page.locator('[data-datagrid-column-menu-action="pin-right"]').first()
  await expect(pinRight).toBeVisible({ timeout: 20_000 })
  await pinRight.click({ force: true })
  await expect.poll(async () => page.locator(`.grid-body-pane--right .grid-cell[data-column-key="${columnKey}"]`).count(), {
    timeout: 20_000,
  }).toBeGreaterThan(0)
}

interface MountedGridA11yCellSnapshot {
  id: string
  role: string | null
  rowIndex: string
  columnIndex: string
  columnKey: string
  ariaRowIndex: string | null
  ariaColIndex: string | null
  ariaSelected: string | null
}

interface MountedGridA11ySnapshot {
  grid: {
    role: string | null
    ariaRowCount: string | null
    ariaColCount: string | null
    ariaMultiselectable: string | null
  }
  headers: Array<{
    id: string
    role: string | null
    columnKey: string
    ariaColIndex: string | null
    ariaSort: string | null
  }>
  firstCenterCell: MountedGridA11yCellSnapshot
  rightPinnedCell: MountedGridA11yCellSnapshot | null
}

async function mountedGridA11ySnapshot(page: Page): Promise<MountedGridA11ySnapshot> {
  return await page.evaluate(() => {
    const stage = Array.from(document.querySelectorAll<HTMLElement>(".grid-stage"))
      .find(element => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden"
      })
    if (!stage) {
      throw new Error("missing visible grid stage")
    }
    const grid = stage.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell[role='grid'], .grid-body-viewport[role='grid']")
    if (!grid) {
      throw new Error("missing grid viewport")
    }
    const toCellSnapshot = (cell: HTMLElement): MountedGridA11yCellSnapshot => ({
      id: cell.id,
      role: cell.getAttribute("role"),
      rowIndex: cell.getAttribute("data-row-index") ?? "",
      columnIndex: cell.getAttribute("data-column-index") ?? "",
      columnKey: cell.getAttribute("data-column-key") ?? "",
      ariaRowIndex: cell.getAttribute("aria-rowindex"),
      ariaColIndex: cell.getAttribute("aria-colindex"),
      ariaSelected: cell.getAttribute("aria-selected"),
    })
    const firstCenterCell = grid.querySelector<HTMLElement>(
      ".grid-body-content > .grid-row[data-row-index] .grid-cell[data-row-index][data-column-index]:not(.grid-cell--row-selection)",
    )
    if (!firstCenterCell) {
      throw new Error("missing center body cell")
    }
    const rightPinnedCell = stage.querySelector<HTMLElement>(
      ".grid-body-pane--right .grid-cell[data-row-index][data-column-index]:not(.grid-cell--row-selection)",
    )
    return {
      grid: {
        role: grid.getAttribute("role"),
        ariaRowCount: grid.getAttribute("aria-rowcount"),
        ariaColCount: grid.getAttribute("aria-colcount"),
        ariaMultiselectable: grid.getAttribute("aria-multiselectable"),
      },
      headers: Array.from(stage.querySelectorAll<HTMLElement>(".grid-cell--header[data-column-key][aria-colindex]")).map(header => ({
        id: header.id,
        role: header.getAttribute("role"),
        columnKey: header.getAttribute("data-column-key") ?? "",
        ariaColIndex: header.getAttribute("aria-colindex"),
        ariaSort: header.getAttribute("aria-sort"),
      })),
      firstCenterCell: toCellSnapshot(firstCenterCell),
      rightPinnedCell: rightPinnedCell ? toCellSnapshot(rightPinnedCell) : null,
    }
  })
}

function readNumericPerfField(sample: Record<string, unknown> | null, field: string): number {
  const value = sample?.[field]
  expect(typeof value).toBe("number")
  expect(Number.isFinite(value)).toBe(true)
  return value as number
}

function firstEditableAmountCell(page: Page): Locator {
  return page.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
}

function amountCellByViewportRow(page: Page, rowIndex: number): Locator {
  return page.locator(`.grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-column-key="amount"]`).first()
}

async function markViewportScrolling(viewport: Locator): Promise<void> {
  const top = await viewportScrollTop(viewport)
  const left = await viewportScrollLeft(viewport)
  await setViewportScroll(viewport, { top: top + 80, left })
}

async function runLongVerticalSession(viewport: Locator): Promise<void> {
  const maxTop = await viewportMaxScrollTop(viewport)
  if (maxTop <= 0) {
    return
  }
  for (let step = 1; step <= 12; step += 1) {
    await setViewportScroll(viewport, {
      top: Math.round((maxTop * step) / 12),
      left: await viewportScrollLeft(viewport),
    })
    await new Promise<void>(resolve => setTimeout(resolve, 18))
  }
}

async function runFastVerticalDetectionSession(page: Page, viewport: Locator): Promise<void> {
  const maxTop = await viewportMaxScrollTop(viewport)
  expect(maxTop).toBeGreaterThan(0)
  const positions = [0.12, 0.35, 0.68, 0.92, 0.54, 0.18, 0.76, 0.98]
  for (const ratio of positions) {
    await setViewportScroll(viewport, { top: Math.round(maxTop * ratio), left: await viewportScrollLeft(viewport) })
    await page.waitForTimeout(32)
    await assertNoBlankVerticalViewport(page)
  }
}

async function runFastHorizontalDetectionSession(page: Page, viewport: Locator): Promise<void> {
  const maxLeft = await viewportMaxScrollLeft(viewport)
  expect(maxLeft).toBeGreaterThan(0)
  const positions = [0.16, 0.42, 0.74, 0.96, 0.58, 0.22, 0.86, 1]
  for (const ratio of positions) {
    await setViewportScroll(viewport, { top: await viewportScrollTop(viewport), left: Math.round(maxLeft * ratio) })
    await page.waitForTimeout(32)
    await assertNoBlankHorizontalViewport(page)
  }
}

async function selectGridOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByLabel(label).selectOption({ label: option })
}

async function dispatchTouchPan(page: Page, viewport: Locator, distanceY: number): Promise<void> {
  await viewport.scrollIntoViewIfNeeded()
  const box = await viewport.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const viewportSize = page.viewportSize() ?? { width: 390, height: 844 }
  const startX = Math.round(Math.min(viewportSize.width - 4, Math.max(4, box.x + box.width / 2)))
  const startY = Math.round(Math.min(viewportSize.height - 4, Math.max(4, box.y + box.height / 2)))
  const session = await page.context().newCDPSession(page)
  try {
    await session.send("Input.synthesizeScrollGesture", {
      x: startX,
      y: startY,
      yDistance: Math.abs(distanceY),
      speed: 900,
      gestureSourceType: "touch",
    })
  } finally {
    await session.detach()
  }
}

async function dispatchRoutedTouchPan(
  target: Locator,
  delta: { deltaX?: number; deltaY?: number },
): Promise<{ startPrevented: boolean; movePrevented: boolean }> {
  await target.scrollIntoViewIfNeeded()
  return await target.evaluate((element, touchDelta) => {
    const rect = element.getBoundingClientRect()
    const startX = Math.round(rect.left + rect.width / 2)
    const startY = Math.round(rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2)))
    const touchStart = new Touch({
      identifier: 1,
      target: element,
      clientX: startX,
      clientY: startY,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const startEvent = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touchStart],
      targetTouches: [touchStart],
      changedTouches: [touchStart],
    })
    const startPrevented = !element.dispatchEvent(startEvent)
    const touchMove = new Touch({
      identifier: 1,
      target: element,
      clientX: startX - (touchDelta.deltaX ?? 0),
      clientY: startY - (touchDelta.deltaY ?? 0),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const moveEvent = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touchMove],
      targetTouches: [touchMove],
      changedTouches: [touchMove],
    })
    const movePrevented = !element.dispatchEvent(moveEvent)
    element.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touchMove],
    }))
    return { startPrevented, movePrevented }
  }, delta)
}

async function dispatchLongPress(page: Page, target: Locator, durationMs: number): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  await target.evaluate(async (element, pressDurationMs) => {
    const rect = element.getBoundingClientRect()
    const touch = new Touch({
      identifier: 1,
      target: element,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    element.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch],
    }))
    await new Promise(resolve => window.setTimeout(resolve, pressDurationMs))
    element.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
    }))
  }, durationMs)
  await page.waitForTimeout(0)
}

async function dispatchTouchGeneratedDoubleClick(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const event = new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
    })
    Object.defineProperty(event, "sourceCapabilities", {
      configurable: true,
      value: { firesTouchEvents: true },
    })
    element.dispatchEvent(event)
  })
}

function expectPassiveTouchDrag(result: { startPrevented: boolean; movePrevented: boolean }): void {
  expect(result).toEqual({
    startPrevented: false,
    movePrevented: false,
  })
}

async function dispatchTouchDragStartAndMove(
  target: Locator,
  moveTo: Locator | { x: number; y: number },
): Promise<{ startPrevented: boolean; movePrevented: boolean }> {
  await target.scrollIntoViewIfNeeded()
  const point = "scrollIntoViewIfNeeded" in moveTo
    ? await elementCenter(moveTo)
    : moveTo
  return await target.evaluate((element, nextPoint) => {
    const rect = element.getBoundingClientRect()
    const startTouch = new Touch({
      identifier: 1,
      target: element,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const startEvent = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [startTouch],
      targetTouches: [startTouch],
      changedTouches: [startTouch],
    })
    element.dispatchEvent(startEvent)
    const moveTouch = new Touch({
      identifier: 1,
      target: element,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const moveEvent = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [moveTouch],
      targetTouches: [moveTouch],
      changedTouches: [moveTouch],
    })
    element.dispatchEvent(moveEvent)
    return {
      startPrevented: startEvent.defaultPrevented,
      movePrevented: moveEvent.defaultPrevented,
    }
  }, point)
}

async function dispatchTouchEndAt(
  target: Locator,
  endAt: Locator | { x: number; y: number },
): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const point = "scrollIntoViewIfNeeded" in endAt
    ? await elementCenter(endAt)
    : endAt
  await target.evaluate((element, nextPoint) => {
    const touch = new Touch({
      identifier: 1,
      target: element,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    element.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
    }))
  }, point)
}

async function dispatchTouchEndAtWindow(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  const point = await elementCenter(target)
  await page.evaluate(nextPoint => {
    const target = document.elementFromPoint(nextPoint.x, nextPoint.y) ?? document.body
    const touch = new Touch({
      identifier: 1,
      target,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    window.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
    }))
  }, point)
}

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Expected element to be visible with bounding box")
  }
  return box
}

async function elementCenter(target: Locator): Promise<{ x: number; y: number }> {
  return await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    }
  })
}

async function selectionAnchorSignature(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>(".grid-cell--selection-anchor")
    if (!anchor) {
      return "none"
    }
    return [
      anchor.getAttribute("data-row-index") ?? "",
      anchor.getAttribute("data-column-index") ?? "",
      anchor.getAttribute("data-column-key") ?? "",
    ].join(":")
  })
}

async function cellSignature(cell: Locator): Promise<string> {
  return await cell.evaluate(element => [
    element.getAttribute("data-row-index") ?? "",
    element.getAttribute("data-column-index") ?? "",
    element.getAttribute("data-column-key") ?? "",
  ].join(":"))
}

async function dispatchContextMenuAndReadPrevented(target: Locator): Promise<boolean> {
  return await target.evaluate(element => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    return !element.dispatchEvent(event) || event.defaultPrevented
  })
}

function metaSpan(page: Page, label: string): Locator {
  return page.locator(".meta span").filter({ hasText: label }).first()
}

async function viewportRangeStart(page: Page): Promise<number> {
  const raw = (await metaSpan(page, "Viewport rows:").textContent())?.trim() ?? ""
  const match = raw.match(/Viewport rows:\s*(\d+)\.\.(\d+)/)
  return match ? Number(match[1]) : 0
}

async function totalRows(page: Page): Promise<number> {
  const raw = (await metaSpan(page, "Rows in model:").textContent())?.trim() ?? ""
  const match = raw.match(/Rows in model:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function totalColumns(page: Page): Promise<number> {
  const raw = (await metaSpan(page, "Columns:").textContent())?.trim() ?? ""
  const match = raw.match(/Columns:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function renderedRows(page: Page): Promise<number> {
  const raw = (await page.locator(".card__footer").textContent())?.trim() ?? ""
  const match = raw.match(/Rendered\s+(\d+)\s*\/\s*(\d+)\s*rows/i)
  return match ? Number(match[1]) : 0
}

async function serverViewportLoadingRatio(page: Page): Promise<number> {
  const raw = await page
    .locator("[data-datagrid-server-viewport-loading-ratio]")
    .first()
    .getAttribute("data-ratio")
  const value = Number(raw)
  return Number.isFinite(value) ? value : 1
}

async function gridAriaRowCount(viewport: Locator): Promise<number> {
  const raw = await viewport.getAttribute("aria-rowcount")
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

async function serverPlaceholderExposureEvents(page: Page): Promise<number> {
  const raw = await page
    .locator("[data-datagrid-server-placeholder-exposure]")
    .first()
    .getAttribute("data-events")
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

async function serverPlaceholderExposureMaxMs(page: Page): Promise<number> {
  const raw = await page
    .locator("[data-datagrid-server-placeholder-exposure]")
    .first()
    .getAttribute("data-max-ms")
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

async function readVerticalViewportCoverage(page: Page) {
  return await page.evaluate(() => {
    const findVisibleElement = (selector: string): HTMLElement | null => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        ) {
          return element
        }
      }
      return null
    }
    const viewport = findVisibleElement(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap")
    if (!viewport) {
      return { ok: false, reason: "missing viewport" }
    }
    const rowRoot = viewport.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-viewport--shared-vertical") ?? viewport
    const viewportRect = viewport.getBoundingClientRect()
    const top = viewportRect.top
    const bottom = viewportRect.top + viewport.clientHeight
    const rows = Array.from(rowRoot.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row[data-row-index]"))
      .map(row => {
        const rect = row.getBoundingClientRect()
        return {
          rowIndex: row.getAttribute("data-row-index") ?? "",
          top: rect.top,
          bottom: rect.bottom,
          visibleTop: Math.max(rect.top, top),
          visibleBottom: Math.min(rect.bottom, bottom),
        }
      })
      .filter(row => row.visibleBottom - row.visibleTop > 1)
      .sort((left, right) => left.visibleTop - right.visibleTop)

    const rowIndexes = rows.map(row => row.rowIndex)
    const duplicateRowIndexes = rowIndexes.filter((rowIndex, index) => rowIndexes.indexOf(rowIndex) !== index)
    const gaps: Array<{ from: number; to: number; size: number; reason: string }> = []
    const tolerance = 2
    if (!rows.length) {
      gaps.push({ from: top, to: bottom, size: bottom - top, reason: "no rows" })
    } else {
      let coveredBottom = rows[0]!.visibleTop
      if (coveredBottom > top + tolerance) {
        gaps.push({ from: top, to: coveredBottom, size: coveredBottom - top, reason: "top" })
      }
      for (const row of rows) {
        if (row.visibleTop > coveredBottom + tolerance) {
          gaps.push({ from: coveredBottom, to: row.visibleTop, size: row.visibleTop - coveredBottom, reason: "between rows" })
        }
        coveredBottom = Math.max(coveredBottom, row.visibleBottom)
      }
      if (coveredBottom < bottom - tolerance) {
        gaps.push({ from: coveredBottom, to: bottom, size: bottom - coveredBottom, reason: "bottom" })
      }
    }

    return {
      ok: gaps.length === 0 && duplicateRowIndexes.length === 0,
      renderedRows: rows.length,
      rowIndexes,
      duplicateRowIndexes,
      gaps,
      viewport: { top, bottom, scrollTop: viewport.scrollTop, clientHeight: viewport.clientHeight },
    }
  })
}

async function assertNoBlankVerticalViewport(page: Page): Promise<void> {
  let result = await readVerticalViewportCoverage(page)
  const deadline = Date.now() + 5_000
  while ((result.ok !== true || (result.renderedRows ?? 0) <= 0) && Date.now() < deadline) {
    await page.waitForTimeout(50)
    result = await readVerticalViewportCoverage(page)
  }

  expect(result, JSON.stringify(result, null, 2)).toMatchObject({
    ok: true,
    duplicateRowIndexes: [],
    gaps: [],
  })
  expect(result.renderedRows).toBeGreaterThan(0)
}

async function assertNoBlankHorizontalViewport(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const findVisibleElement = (selector: string): HTMLElement | null => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        ) {
          return element
        }
      }
      return null
    }
    const viewport = findVisibleElement(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap")
    if (!viewport) {
      return { ok: false, reason: "missing viewport" }
    }
    const horizontalViewport = viewport.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? viewport
    const viewportRect = horizontalViewport.getBoundingClientRect()
    const left = viewportRect.left
    const right = viewportRect.left + horizontalViewport.clientWidth
    const top = viewportRect.top
    const bottom = viewportRect.top + horizontalViewport.clientHeight
    const row = Array.from(horizontalViewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row[data-row-index]"))
      .find(candidate => {
        const rect = candidate.getBoundingClientRect()
        return rect.bottom > top + 1 && rect.top < bottom - 1
      })
    if (!row) {
      return { ok: false, reason: "missing visible row" }
    }

    const cells = Array.from(row.querySelectorAll<HTMLElement>(".grid-cell[data-column-index]"))
      .map(cell => {
        const rect = cell.getBoundingClientRect()
        return {
          columnIndex: cell.getAttribute("data-column-index") ?? "",
          columnKey: cell.getAttribute("data-column-key") ?? "",
          left: rect.left,
          right: rect.right,
          visibleLeft: Math.max(rect.left, left),
          visibleRight: Math.min(rect.right, right),
        }
      })
      .filter(cell => cell.visibleRight - cell.visibleLeft > 1)
      .sort((leftCell, rightCell) => leftCell.visibleLeft - rightCell.visibleLeft)

    const columnIndexes = cells.map(cell => cell.columnIndex)
    const duplicateColumnIndexes = columnIndexes.filter((columnIndex, index) => columnIndexes.indexOf(columnIndex) !== index)
    const gaps: Array<{ from: number; to: number; size: number; reason: string }> = []
    const tolerance = 2
    if (!cells.length) {
      gaps.push({ from: left, to: right, size: right - left, reason: "no cells" })
    } else {
      let coveredRight = cells[0]!.visibleLeft
      if (coveredRight > left + tolerance) {
        gaps.push({ from: left, to: coveredRight, size: coveredRight - left, reason: "left" })
      }
      for (const cell of cells) {
        if (cell.visibleLeft > coveredRight + tolerance) {
          gaps.push({ from: coveredRight, to: cell.visibleLeft, size: cell.visibleLeft - coveredRight, reason: "between cells" })
        }
        coveredRight = Math.max(coveredRight, cell.visibleRight)
      }
      if (coveredRight < right - tolerance) {
        gaps.push({ from: coveredRight, to: right, size: right - coveredRight, reason: "right" })
      }
    }

    return {
      ok: gaps.length === 0 && duplicateColumnIndexes.length === 0,
      renderedCells: cells.length,
      rowIndex: row.getAttribute("data-row-index") ?? "",
      columnIndexes,
      duplicateColumnIndexes,
      gaps,
      viewport: { left, right, scrollLeft: horizontalViewport.scrollLeft, clientWidth: horizontalViewport.clientWidth },
    }
  })

  expect(result, JSON.stringify(result, null, 2)).toMatchObject({
    ok: true,
    duplicateColumnIndexes: [],
    gaps: [],
  })
  expect(result.renderedCells).toBeGreaterThan(0)
}

async function renderedCenterCellsInFirstVisibleRow(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const findVisibleElement = (selector: string): HTMLElement | null => {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        ) {
          return element
        }
      }
      return null
    }
    const viewport = findVisibleElement(".grid-body-shared-vertical-scroll-shell, .grid-body-viewport.table-wrap, .table-wrap")
    if (!viewport) {
      return 0
    }
    const horizontalViewport = viewport.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? viewport
    const viewportRect = horizontalViewport.getBoundingClientRect()
    const row = Array.from(horizontalViewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row[data-row-index]"))
      .find(candidate => {
        const rect = candidate.getBoundingClientRect()
        return rect.bottom > viewportRect.top + 1 && rect.top < viewportRect.bottom - 1
      })

    return row?.querySelectorAll(".grid-cell[data-column-index]").length ?? 0
  })
}
