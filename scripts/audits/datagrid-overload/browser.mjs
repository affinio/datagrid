import { chromium } from "@playwright/test"
import { mkdirSync, writeFileSync } from "node:fs"
const output = process.env.OVERLOAD_OUTPUT ?? "/tmp/affino-overload-audit"
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []; page.on("pageerror", error => errors.push(error.message))
const cdp = await page.context().newCDPSession(page)
await cdp.send("Performance.enable")
await page.goto(process.env.OVERLOAD_BASE_URL ?? "http://127.0.0.1:4192/")
await page.waitForFunction(() => window.overload && window.cost.ready)
const results = []
for (const n of [1000, 20_000]) {
  for (const kind of ["burst", "exclusive", "stream"]) {
    const fixture = await page.evaluate(({ n, kind }) => window.overload.mount(n, kind === "stream"), { n, kind })
    if (!fixture.production) throw Error("development build is not a responsiveness benchmark")
    // One warm-up before five independent samples, same row shape and workload.
    for (let repeat = -1; repeat < 5; repeat++) {
      await page.evaluate(({ kind }) => window.overload.begin(kind, 120), { kind })
      const dispatchStart = performance.now()
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "x", code: "KeyX", text: "x", timestamp: Date.now() / 1000 })
      const dispatchCompletionMs = performance.now() - dispatchStart
      await page.waitForFunction(() => window.overload.result() !== null)
      const value = await page.evaluate(() => window.overload.result())
      if (value.calls !== 120 || value.busy || value.finalValue !== value.expectedFinalValue || (kind !== "stream" && value.computedValue !== value.finalValue * 2 + 1)) throw Error("load did not drain correctly")
      if (repeat >= 0) results.push({ n, repeat, fixture, ...value, dispatchCompletionMs })
    }
  }
}
const activation = []
for (const dispose of [false, true]) { await page.evaluate(() => window.overload.mount(1000)); activation.push({ dispose, ...await page.evaluate(dispose => window.overload.activate(200, dispose), dispose) }) }
const activationCounted = []
for (const count of [1, 20, 200]) { await page.evaluate(() => window.overload.mount(1000)); activationCounted.push(await page.evaluate(count => window.overload.countActivation(count), count)) }
const countedLoads = []
for (const kind of ["burst", "exclusive"]) {
  await page.evaluate(() => window.overload.mount(1000))
  await page.evaluate(kind => window.overload.begin(kind, 120, true), kind)
  await page.waitForFunction(() => window.overload.result() !== null)
  countedLoads.push(await page.evaluate(() => window.overload.result()))
}
await page.evaluate(() => window.overload.mount(1000))
const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); const values = (await cdp.send("Performance.getMetrics")).metrics; return values.find(v => v.name === "JSHeapUsedSize").value }
await page.evaluate(() => window.overload.hold())
const memory = [{ accepted: 0, heapUsed: await heap() }]
let accepted = 0
for (const count of [1000, 4000, 5000]) { const queue = await page.evaluate(count => window.overload.enqueue(count), count); accepted += count; memory.push({ accepted, heapUsed: await heap(), ...queue }) }
const drained = await page.evaluate(() => window.overload.release())
memory.push({ accepted, afterDrain: true, heapUsed: await heap(), ...drained })
await page.evaluate(() => window.overload.close())
const artifact = { browser: browser.version(), production: true, viewport: { width: 1200, height: 800 }, warmups: 1, samples: 5, results, activation, activationCounted, countedLoads, memory, errors }
writeFileSync(`${output}/browser.json`, JSON.stringify(artifact, null, 2))
await browser.close()
console.log(JSON.stringify({ output, measuredLoads: results.length, activation, memory, errors }))
