import { chromium } from "@playwright/test"

const baseUrl = process.env.DATAGRID_BENCH_URL ?? "http://127.0.0.1:4173"
const browser = await chromium.launch({ headless: true })

try {
  for (const route of ["shell/grouped-grid", "base-grid?rows=10000&cols=128"]) {
    const runs = []
    for (let run = 0; run < 3; run += 1) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
      try {
        const session = await page.context().newCDPSession(page)
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 })
        const url = new URL(`/vue/${route}`, baseUrl)
        url.searchParams.set("dgPerfTrace", "1")
        await page.goto(url.href)
        await page.locator(".grid-body-shared-vertical-scroll-shell").first().waitFor()
        await page.waitForTimeout(700)
        runs.push(await page.evaluate(async () => {
          const store = window.__AFFINO_DATAGRID_PERF__
          const owner = document.querySelector(".grid-body-shared-vertical-scroll-shell")
          if (!store || !owner || owner.scrollHeight <= owner.clientHeight) {
            throw new Error("Expected a scrollable table with dgPerfTrace enabled")
          }
          store.clear()
          const gaps = []
          let previousFrame = performance.now()
          owner.scrollTop = 1
          await new Promise(resolve => {
            let frames = 0
            function frame(now) {
              gaps.push(now - previousFrame)
              previousFrame = now
              if (++frames < 18) requestAnimationFrame(frame)
              else resolve()
            }
            requestAnimationFrame(frame)
          })
          return {
            maxFrameMs: Math.max(...gaps.slice(1)),
            rendererCalls: store.samples.filter(sample => sample.scope === "cellRenderer" || sample.scope === "groupCellRenderer").length,
            windowChanges: store.samples.filter(sample => sample.scope === "stageWindowFlush").length,
          }
        }))
      } finally {
        await page.close()
      }
    }
    console.log(JSON.stringify({ route, cpuThrottle: 4, runs }))
  }
} finally {
  await browser.close()
}
