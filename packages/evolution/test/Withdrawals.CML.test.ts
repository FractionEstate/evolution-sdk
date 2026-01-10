import { Equal, FastCheck } from "effect"
import { describe, expect, it } from "vitest"

import * as Withdrawals from "../src/Withdrawals.js"

describe("Withdrawals CML Compatibility", () => {
  it("property: Withdrawals round-trips through CBOR with Equal.equals", () => {
    FastCheck.assert(
      FastCheck.property(Withdrawals.arbitrary, (original) => {
        const cbor = Withdrawals.toCBORHex(original)
        const decoded = Withdrawals.fromCBORHex(cbor)
        expect(Equal.equals(original, decoded)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
