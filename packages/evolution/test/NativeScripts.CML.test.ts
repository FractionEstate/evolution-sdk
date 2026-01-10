import * as CML from "@dcspark/cardano-multiplatform-lib-nodejs"
import { Equal, FastCheck } from "effect"
import { describe, expect, it } from "vitest"

import * as NativeScripts from "../src/NativeScripts.js"

describe("NativeScripts CML Compatibility (property)", () => {
  it("Evolution NativeScript CBOR is parseable by CML and roundtrips CBOR", () => {
    FastCheck.assert(
      FastCheck.property(NativeScripts.arbitrary, (ns) => {
        // Evolution -> CBOR hex
        const evoHex = NativeScripts.toCBORHex(ns)

        // CML parse and re-encode
        const cmlNative = CML.NativeScript.from_cbor_hex(evoHex)
        const cmlHex = cmlNative.to_cbor_hex()

        // Exact CBOR parity
        expect(cmlHex).toBe(evoHex)

        // Evolution decoder accepts CML's CBOR and equals original by CBOR encoding
        const evoRoundTrip = NativeScripts.fromCBORHex(cmlHex)
        expect(Equal.equals(evoRoundTrip, ns)).toBe(true)
      })
    )
  })
})
