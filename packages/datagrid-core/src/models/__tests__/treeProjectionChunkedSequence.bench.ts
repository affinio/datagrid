import { bench, describe } from "vitest"
import { createChunkedSequence } from "../tree/treeProjectionChunkedSequence"

const ROWS = 300_000
const source = Array.from({ length: ROWS }, (_, index) => index)

describe("tree projection local replacement proof of concept", () => {
  const sequence = createChunkedSequence(source, 256)

  bench("array oracle — copy and splice one row", () => {
    const rows = source.slice()
    rows.splice(128, 1, "replacement")
  }, { iterations: 10, time: 500 })

  bench("chunked sequence — replace one row", () => {
    sequence.replace(128, 1, ["replacement"])
  }, { iterations: 10, time: 500 })
})
