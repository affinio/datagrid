import { describe, expect, it } from "vitest"
import { createChunkedSequence } from "../tree/treeProjectionChunkedSequence"

describe("chunked tree projection sequence", () => {
  it("keeps the oracle order after an in-chunk equal-size replacement", () => {
    const source = Array.from({ length: 10_000 }, (_, index) => index)
    const sequence = createChunkedSequence(source, 256)
    const expected = source.slice()
    const replacement = ["a", "b", "c"]
    sequence.replace(513, replacement.length, replacement)
    expected.splice(513, replacement.length, ...replacement)
    expect(sequence.length).toBe(expected.length)
    expect(sequence.toArray()).toEqual(expected)
    expect(sequence.get(513)).toBe("a")
    expect(sequence.get(515)).toBe("c")
    expect(sequence.get(516)).toBe(516)
  })

  it("clamps deletion at the sequence boundary without corrupting length", () => {
    const sequence = createChunkedSequence([0, 1, 2], 2)
    sequence.replace(2, 100, ["tail"])
    expect(sequence.length).toBe(3)
    expect(sequence.toArray()).toEqual([0, 1, "tail"])

    sequence.replace(3, 100, ["after-end"])
    expect(sequence.length).toBe(4)
    expect(sequence.toArray()).toEqual([0, 1, "tail", "after-end"])
  })

  it("preserves variable-length replacement behavior", () => {
    const sequence = createChunkedSequence([0, 1, 2, 3, 4, 5], 2)
    sequence.replace(1, 3, ["x"])
    expect(sequence.toArray()).toEqual([0, "x", 4, 5])
    sequence.replace(2, 1, ["a", "b", "c"])
    expect(sequence.toArray()).toEqual([0, "x", "a", "b", "c", 5])
  })
})
