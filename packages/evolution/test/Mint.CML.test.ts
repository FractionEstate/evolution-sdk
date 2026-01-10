import { Equal, FastCheck } from "effect"
import { describe, expect, it } from "vitest"

import * as Mint from "../src/Mint.js"

describe("Mint CML Compatibility", () => {
  it("property: Mint round-trips through CBOR with Equal.equals", () => {
    FastCheck.assert(
      FastCheck.property(Mint.arbitrary, (original) => {
        const cbor = Mint.toCBORHex(original)
        const decoded = Mint.fromCBORHex(cbor)
        expect(Equal.equals(original, decoded)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
