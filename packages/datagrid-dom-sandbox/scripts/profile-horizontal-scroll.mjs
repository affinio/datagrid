import { chromium } from "@playwright/test"

const baseUrl = process.env.DATAGRID_DOM_SANDBOX_URL ?? "http://127.0.0.1:5175"
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(new URL("/examples/column-virtualization/", baseUrl).href)
  await page.waitForSelector(".affino-grid-dom__body [role=gridcell]")
  await page.waitForTimeout(300)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Performance.enable")
  await cdp.send("Profiler.enable")
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 })
  await page.evaluate(() => {
    window.scrollProfile = { created: 0, frames: [], last: performance.now(), running: true }
    const createElement = document.createElement
    document.createElement = function (...args) {
      window.scrollProfile.created += 1
      return createElement.apply(this, args)
    }
    function sample(now) {
      const profile = window.scrollProfile
      if (!profile.running) return
      profile.frames.push(now - profile.last)
      profile.last = now
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  const before = await cdp.send("Performance.getMetrics")
  await cdp.send("Profiler.start")
  const box = await page.locator(".affino-grid-dom__body").boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 100)
  for (let index = 0; index < 45; index += 1) await page.mouse.wheel(40, 0)
  await page.waitForTimeout(100)
  const { profile } = await cdp.send("Profiler.stop")
  const after = await cdp.send("Performance.getMetrics")
  const samples = new Map()
  for (let index = 0; index < profile.samples.length; index += 1) {
    const id = profile.samples[index]
    samples.set(id, (samples.get(id) ?? 0) + profile.timeDeltas[index])
  }
  const topFunctions = profile.nodes.map(node => ({
    name: node.callFrame.functionName,
    url: node.callFrame.url.split("/").slice(-2).join("/"),
    selfMs: (samples.get(node.id) ?? 0) / 1000,
  })).filter(node => node.selfMs > 2 && node.url)
    .sort((a, b) => b.selfMs - a.selfMs).slice(0, 10)
  const metricNames = ["LayoutDuration", "RecalcStyleDuration", "ScriptDuration", "TaskDuration"]
  const durationMs = Object.fromEntries(after.metrics.filter(metric => metricNames.includes(metric.name))
    .map(metric => [metric.name, (metric.value - before.metrics.find(previous => previous.name === metric.name).value) * 1000]))
  const dom = await page.evaluate(() => {
    const profile = window.scrollProfile
    profile.running = false
    const frames = profile.frames.slice(1).sort((a, b) => a - b)
    return {
      createdElements: profile.created,
      liveElements: document.querySelector("[role=grid]").querySelectorAll("*").length,
      p95FrameMs: frames[Math.floor(frames.length * 0.95)],
      maxFrameMs: frames.at(-1),
      framesOver25Ms: frames.filter(frame => frame > 25).length,
    }
  })
  console.log(JSON.stringify({ durationMs, dom, topFunctions }, null, 2))
} finally {
  await browser.close()
}
