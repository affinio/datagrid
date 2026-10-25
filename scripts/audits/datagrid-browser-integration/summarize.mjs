import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const input = process.env.BROWSER_AUDIT_OUTPUT ?? '/tmp/affino-browser-integration'
const output = process.env.BROWSER_AUDIT_REPORT ?? 'docs/internal/audits/202610/browser-integration'
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const raw = await read(input + '/results.json')
const fixture = await read(input + '/fixture-results.json')
function cases(suite) {
  return [...(suite.specs ?? []).map(spec => ({ title: spec.title, passed: spec.tests.every(t => t.status === 'expected'), errors: spec.tests.flatMap(t => t.results.flatMap(r => r.errors.map(e => e.message?.replace(/\u001b\[[0-9;]*m/g, '')))) })), ...(suite.suites ?? []).flatMap(cases)]
}
const existing = await Promise.all(['/tmp/affino-browser-existing.json', '/tmp/affino-browser-extra.json'].map(read))
const tests = existing.flatMap(run => run.suites.flatMap(cases))
const hash = createHash('sha256').update(execFileSync('git', ['diff', '--binary', '--', 'packages'])).digest('hex')
const before = (await readFile('/tmp/affino-browser-product-before.sha', 'utf8')).split(/\s/)[0]
const observations = raw.observations.map(({ hits, alignments, lines, ...observation }) => ({
  ...observation,
  ...(hits ? { hitSamples: hits.length, mismatches: hits.filter(h => JSON.stringify(h.expected) !== JSON.stringify(h.actual)) } : {}),
  ...(alignments ? { headerCellSamples: alignments.length, maxHeaderCellDelta: Math.max(0, ...alignments.flatMap(a => [Math.abs(a.left), Math.abs(a.right)])) } : {}),
  ...(lines ? { sampledVerticalLines: lines.slice(0, 6), verticalLineCount: lines.length } : {}),
}))
const summary = {
  environment: { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), node: process.version, arch: process.arch, platform: process.platform, browser: raw.browser, headless: true, productionBuild: true, productDiffHashBefore: before, productDiffHashAfter: hash, productSourceUnchanged: before === hash },
  tests: { executions: tests.length, unique: new Set(tests.map(t => t.title)).size, passed: tests.filter(t => t.passed).length, cases: tests },
  diagnostics: { errors: raw.errors, observations }, fixture,
  stickyClick: await read(input + '/sticky-click.json'),
  reorderTrace: await read(input + '/reorder-trace.json'),
}
await mkdir(output, { recursive: true })
await writeFile(output + '/results.json', JSON.stringify(summary, null, 2))
for (const name of ['coarse-fill-handle.png', 'selected-row-resize.png']) await copyFile(input + '/' + name, output + '/' + name)
console.log(JSON.stringify({ output, executions: tests.length, records: observations.length, fixtureCheckpoints: fixture.observations.length, sourceUnchanged: before === hash }))
