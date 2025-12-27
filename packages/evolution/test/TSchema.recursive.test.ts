import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { fromHex } from "../src/core/Bytes.js"
import * as Data from "../src/core/Data.js"
import * as TSchema from "../src/core/TSchema.js"

/**
 * Tests for recursive TSchema structures
 */
describe("TSchema Recursive Structures", () => {
  describe("MultisigScript (Recursive Union)", () => {
    /**
     * MultisigScript type definition (runtime representation)
     * 
     * Type adapted from:
     * https://github.com/SundaeSwap-finance/aicone/blob/769a33046ccd08a4950e8d647f3b0c1fbc01a941/lib/sundae/multisig.ak
     */
    type MultisigScript =
      | { readonly Signature: { readonly keyHash: Uint8Array } }
      | { readonly AllOf: { readonly scripts: ReadonlyArray<MultisigScript> } }
      | { readonly AnyOf: { readonly scripts: ReadonlyArray<MultisigScript> } }
      | { readonly AtLeast: { readonly required: bigint; readonly scripts: ReadonlyArray<MultisigScript> } }
      | { readonly Before: { readonly time: bigint } }
      | { readonly After: { readonly time: bigint } }
      | { readonly Script: { readonly scriptHash: Uint8Array } }

    // Define the recursive MultisigScript schema
    const MultisigScriptSchema   = TSchema.Union(
      TSchema.Struct(
        {
          Signature: TSchema.Struct(
            {
              keyHash: TSchema.ByteArray,
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          AllOf: TSchema.Struct(
            {
              scripts: TSchema.Array(Schema.suspend(() : Schema.Schema<MultisigScript, Data.Constr> => MultisigScriptSchema)),
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          AnyOf: TSchema.Struct(
            {
              scripts: TSchema.Array(Schema.suspend(() : Schema.Schema<MultisigScript, Data.Constr> => MultisigScriptSchema)),
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          AtLeast: TSchema.Struct(
            {
              required: TSchema.Integer,
              scripts: TSchema.Array(Schema.suspend(() : Schema.Schema<MultisigScript, Data.Constr> => MultisigScriptSchema)),
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          Before: TSchema.Struct(
            {
              time: TSchema.Integer,
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          After: TSchema.Struct(
            {
              time: TSchema.Integer,
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
      TSchema.Struct(
        {
          Script: TSchema.Struct(
            {
              scriptHash: TSchema.ByteArray,
            },
            { flatFields: true },
          ),
        },
        { flatInUnion: true },
      ),
    )

    it("should encode/decode a simple Signature", () => {
      const signature: MultisigScript = {
        Signature: {
          keyHash: fromHex("abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"),
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(signature)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(signature)
    })

    it("should encode/decode a Before timelock", () => {
      const before: MultisigScript = {
        Before: {
          time: 1000000n,
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(before)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(before)
    })

    it("should encode/decode an After timelock", () => {
      const after: MultisigScript = {
        After: {
          time: 2000000n,
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(after)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(after)
    })

    it("should encode/decode a Script reference", () => {
      const script: MultisigScript = {
        Script: {
          scriptHash: fromHex("1234567890abcdef1234567890abcdef1234567890abcdef12345678"),
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(script)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(script)
    })

    it("should encode/decode AllOf with nested scripts", () => {
      const allOf: MultisigScript = {
        AllOf: {
          scripts: [
            {
              Signature: {
                keyHash: fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
              },
            },
            {
              Signature: {
                keyHash: fromHex("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(allOf)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(allOf)
    })

    it("should encode/decode AnyOf with nested scripts", () => {
      const anyOf: MultisigScript = {
        AnyOf: {
          scripts: [
            {
              Before: {
                time: 500000n,
              },
            },
            {
              After: {
                time: 600000n,
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(anyOf)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(anyOf)
    })

    it("should encode/decode AtLeast with nested scripts", () => {
      const atLeast: MultisigScript = {
        AtLeast: {
          required: 2n,
          scripts: [
            {
              Signature: {
                keyHash: fromHex("1111111111111111111111111111111111111111111111111111111111"),
              },
            },
            {
              Signature: {
                keyHash: fromHex("2222222222222222222222222222222222222222222222222222222222"),
              },
            },
            {
              Signature: {
                keyHash: fromHex("3333333333333333333333333333333333333333333333333333333333"),
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(atLeast)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(atLeast)
    })

    it("should encode/decode deeply nested AllOf structure", () => {
      const deeplyNested: MultisigScript = {
        AllOf: {
          scripts: [
            {
              Signature: {
                keyHash: fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
              },
            },
            {
              AllOf: {
                scripts: [
                  {
                    Signature: {
                      keyHash: fromHex("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
                    },
                  },
                  {
                    Before: {
                      time: 1000000n,
                    },
                  },
                ],
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(deeplyNested)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(deeplyNested)
    })

    it("should encode/decode complex nested structure with multiple levels", () => {
      const complex: MultisigScript = {
        AtLeast: {
          required: 2n,
          scripts: [
            {
              AllOf: {
                scripts: [
                  {
                    Signature: {
                      keyHash: fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
                    },
                  },
                  {
                    Before: {
                      time: 1000000n,
                    },
                  },
                ],
              },
            },
            {
              AnyOf: {
                scripts: [
                  {
                    Signature: {
                      keyHash: fromHex("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
                    },
                  },
                  {
                    After: {
                      time: 500000n,
                    },
                  },
                ],
              },
            },
            {
              Script: {
                scriptHash: fromHex("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"),
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(complex)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(complex)
    })

    it("should handle empty scripts array in AllOf", () => {
      const emptyAllOf: MultisigScript = {
        AllOf: {
          scripts: [],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(emptyAllOf)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(emptyAllOf)
    })

    it("should roundtrip maintain equivalence for complex structures", () => {
      const eq = TSchema.equivalence(MultisigScriptSchema)

      const complex: MultisigScript = {
        AtLeast: {
          required: 3n,
          scripts: [
            {
              AllOf: {
                scripts: [
                  {
                    Signature: {
                      keyHash: fromHex("1111111111111111111111111111111111111111111111111111111111"),
                    },
                  },
                  {
                    Before: {
                      time: 999999n,
                    },
                  },
                ],
              },
            },
            {
              AnyOf: {
                scripts: [
                  {
                    After: {
                      time: 100000n,
                    },
                  },
                  {
                    Script: {
                      scriptHash: fromHex("2222222222222222222222222222222222222222222222222222222222"),
                    },
                  },
                ],
              },
            },
            {
              Signature: {
                keyHash: fromHex("3333333333333333333333333333333333333333333333333333333333"),
              },
            },
            {
              Before: {
                time: 2000000n,
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(complex)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(eq(complex, decoded)).toBe(true)
    })

    it("should handle deeply nested recursion (5 levels deep)", () => {
      const veryDeep: MultisigScript = {
        AllOf: {
          scripts: [
            {
              AllOf: {
                scripts: [
                  {
                    AllOf: {
                      scripts: [
                        {
                          AllOf: {
                            scripts: [
                              {
                                AllOf: {
                                  scripts: [
                                    {
                                      Signature: {
                                        keyHash: fromHex("deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbe"),
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }

      const encoded = Data.withSchema(MultisigScriptSchema).toCBORHex(veryDeep)
      const decoded = Data.withSchema(MultisigScriptSchema).fromCBORHex(encoded)

      expect(decoded).toEqual(veryDeep)
    })
  })
})
