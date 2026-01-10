import { Equal, FastCheck } from "effect"
import { describe, expect, it } from "vitest"

import * as VotingProcedures from "../src/VotingProcedures.js"

describe("VotingProcedures Individual Test", () => {
  it("property: VotingProcedures round-trips through CBOR with Equal.equals", () => {
    FastCheck.assert(
      FastCheck.property(VotingProcedures.arbitrary, (original) => {
        const cbor = VotingProcedures.toCBORHex(original)
        const decoded = VotingProcedures.fromCBORHex(cbor)
        expect(Equal.equals(original, decoded)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
