import { describe, expect, it } from "vitest"

import * as Bytes from "../src/core/Bytes.js"
import { fromHex } from "../src/core/Bytes.js"
import * as Data from "../src/core/Data.js"
import * as TSchema from "../src/core/TSchema.js"

/**
 * Tests for TypeTaggedSchema module functionality -
 * focusing on schema definition, encoding, and decoding
 */
describe("TypeTaggedSchema Tests", () => {
  describe("Basic Types", () => {
    describe("ByteArray Schema", () => {
      it("should encode/decode ByteArray", () => {
        const eq = TSchema.equivalence(TSchema.ByteArray)
        const input = fromHex("deadbeef")
        const encoded = Data.withSchema(TSchema.ByteArray).toCBORHex(input)
        const decoded = Data.withSchema(TSchema.ByteArray).fromCBORHex(encoded)

        expect(encoded).toEqual("44deadbeef")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should fail on invalid hex string", () => {
        expect(() => Data.withSchema(TSchema.ByteArray).toCBORHex(fromHex("not-hex"))).toThrow()
      })
    })

    describe("Integer Schema", () => {
      it("should encode/decode Integer", () => {
        const eq = TSchema.equivalence(TSchema.Integer)
        const input = 42n
        const encoded = Data.withSchema(TSchema.Integer).toCBORHex(input)
        const decoded = Data.withSchema(TSchema.Integer).fromCBORHex(encoded)

        expect(encoded).toEqual("182a")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should fail on non-bigint", () => {
        expect(() =>
          // @ts-ignore intentional misuse
          Data.encodeDataOrThrow(42, TSchema.Integer)
        ).toThrow()
      })
    })

    describe("Boolean Schema", () => {
      it("should encode/decode true", () => {
        const eq = TSchema.equivalence(TSchema.Boolean)
        const input = true
        const encoded = Data.withSchema(TSchema.Boolean).toCBORHex(input)
        const decoded = Data.withSchema(TSchema.Boolean).fromCBORHex(encoded)

        expect(encoded).toEqual("d87a80")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should encode/decode false", () => {
        const eq = TSchema.equivalence(TSchema.Boolean)
        const input = false
        const encoded = Data.withSchema(TSchema.Boolean).toCBORHex(input)
        const decoded = Data.withSchema(TSchema.Boolean).fromCBORHex(encoded)

        expect(encoded).toEqual("d87980")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should fail on invalid format", () => {
        const invalidInput = "d87a01" // Invalid boolean
        expect(() => Data.withSchema(TSchema.Boolean).fromCBORHex(invalidInput)).toThrow()
      })
    })
  })

  describe("Complex Types", () => {
    describe("Array Schema", () => {
      it("should encode/decode arrays", () => {
        const IntArray = TSchema.Array(TSchema.Integer)
        const eq = TSchema.equivalence(IntArray)

        const input = [1n, 2n, 3n]
        const encoded = Data.withSchema(IntArray).toCBORHex(input)
        const decoded = Data.withSchema(IntArray).fromCBORHex(encoded)

        expect(encoded).toEqual("9f010203ff")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should handle empty arrays", () => {
        const IntArray = TSchema.Array(TSchema.Integer)
        const eq = TSchema.equivalence(IntArray)

        const input: Array<bigint> = []
        const encoded = Data.withSchema(IntArray).toCBORHex(input)
        const decoded = Data.withSchema(IntArray).fromCBORHex(encoded)

        expect(encoded).toEqual("80")
        expect(eq(decoded, input)).toBe(true)
      })
    })

    describe("Map Schema", () => {
      it("should encode/decode maps", () => {
        const TokenMap = TSchema.Map(TSchema.ByteArray, TSchema.Integer)
        type TokenMap = typeof TokenMap.Type
        const eq = TSchema.equivalence(TokenMap)

        const input: TokenMap = new Map([
          [fromHex("deadbeef"), 1n],
          [fromHex("cafe"), 2n]
        ])

        const encoded = Data.withSchema(TokenMap).toCBORHex(input)
        const decoded = Data.withSchema(TokenMap).fromCBORHex(encoded)

        expect(eq(decoded, input)).toBe(true)
      })

      it("should handle empty maps", () => {
        const TokenMap = TSchema.Map(TSchema.ByteArray, TSchema.Integer)
        type TokenMap = typeof TokenMap.Type
        const eq = TSchema.equivalence(TokenMap)

        const input: TokenMap = new Map()
        const encoded = Data.withSchema(TokenMap).toCBORHex(input)
        const decoded = Data.withSchema(TokenMap).fromCBORHex(encoded)

        expect(eq(decoded, input)).toBe(true)
      })

      it("should deterministically encode Maps regardless of insertion order", () => {
        const TokenMap = TSchema.Map(TSchema.ByteArray, TSchema.Integer)
        type TokenMap = typeof TokenMap.Type

        // Create two maps with same entries but different insertion order
        const map1: TokenMap = new Map([
          [fromHex("deadbeef"), 1n],
          [fromHex("cafe"), 2n],
          [fromHex("babe"), 3n]
        ])

        const map2: TokenMap = new Map([
          [fromHex("cafe"), 2n],
          [fromHex("babe"), 3n],
          [fromHex("deadbeef"), 1n]
        ])

        const encoded1 = Data.withSchema(TokenMap, { mode: "canonical" }).toCBORHex(map1)
        const encoded2 = Data.withSchema(TokenMap, { mode: "canonical" }).toCBORHex(map2)

        // The CBOR outputs should be identical if sorting is working correctly
        expect(encoded1).toEqual(encoded2)

        // Note: Default Map equivalence considers insertion order, so these are NOT equivalent
        // even though they have the same content. This is expected behavior.
        // If you need content-based comparison, decode from the canonical CBOR.
      })

      it("should handle key integer and value bytearray", () => {
        const IntegerByteArrayMap = TSchema.Map(TSchema.Integer, TSchema.ByteArray)
        type IntegerByteArrayMap = typeof IntegerByteArrayMap.Type
        const eq = TSchema.equivalence(IntegerByteArrayMap)
        const input: IntegerByteArrayMap = new Map([
          [3209n, fromHex("3131")],
          [249218490182n, fromHex("32323232")]
        ])
        const encoded = Data.withSchema(IntegerByteArrayMap).toCBORHex(input)
        const decoded = Data.withSchema(IntegerByteArrayMap).fromCBORHex(encoded)

        expect(encoded).toEqual("bf190c894231311b0000003a06945f464432323232ff")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should handle complex map with mixed types", () => {
        const ComplexMap = TSchema.Map(
          TSchema.ByteArray,
          TSchema.Union(TSchema.Integer, TSchema.ByteArray, TSchema.Boolean)
        )
        type ComplexMap = typeof ComplexMap.Type
        const eq = TSchema.equivalence(ComplexMap)

        const input: ComplexMap = new Map()
        input.set(fromHex("deadbeef01"), 42n)
        input.set(fromHex("deadbeef02"), fromHex("cafe"))
        input.set(fromHex("deadbeef03"), true)

        const encoded = Data.withSchema(ComplexMap).toCBORHex(input)
        const decoded = Data.withSchema(ComplexMap).fromCBORHex(encoded)

        expect(eq(decoded, input)).toBe(true)
        expect(decoded instanceof Map).toBe(true)
        expect(decoded.size).toBe(3)

        // Since Map keys are Uint8Array, we need to find by comparing bytes
        const entries = Array.from(decoded.entries())
        const getValue = (hexKey: string) => {
          const keyBytes = fromHex(hexKey)
          const entry = entries.find(([k]) => Bytes.equals(k, keyBytes))
          return entry?.[1]
        }

        expect(getValue("deadbeef01")).toBe(42n)
        expect(getValue("deadbeef02")).toEqual(fromHex("cafe"))
        expect(getValue("deadbeef03")).toBe(true)
      })
    })

    describe("Struct Schema", () => {
      it("should encode/decode structs", () => {
        const Token = TSchema.Struct({
          policyId: TSchema.ByteArray,
          assetName: TSchema.ByteArray,
          amount: TSchema.Integer
        })

        type Token = typeof Token.Type
        const eq = TSchema.equivalence(Token)

        const input: Token = { policyId: fromHex("deadbeef"), assetName: fromHex("cafe"), amount: 1000n }

        const encoded = Data.withSchema(Token).toCBORHex(input)
        const decoded = Data.withSchema(Token).fromCBORHex(encoded)

        expect(encoded).toEqual("d8799f44deadbeef42cafe1903e8ff")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should handle nested structs", () => {
        const Asset = TSchema.Struct({ policyId: TSchema.ByteArray, assetName: TSchema.ByteArray })
        const Token = TSchema.Struct({ asset: Asset, amount: TSchema.Integer })
        type Token = typeof Token.Type
        const eq = TSchema.equivalence(Token)

        const input: Token = { asset: { policyId: fromHex("deadbeef"), assetName: fromHex("cafe") }, amount: 1000n }
        const encoded = Data.withSchema(Token).toCBORHex(input)
        const decoded = Data.withSchema(Token).fromCBORHex(encoded)

        expect(eq(decoded, input)).toBe(true)
      })
    })

    describe("Tuple Schema", () => {
      it("should encode/decode tuples", () => {
        const AssetPair = TSchema.Tuple([TSchema.ByteArray, TSchema.Integer])
        type AssetPair = typeof AssetPair.Type
        const eq = TSchema.equivalence(AssetPair)

        const input: AssetPair = [fromHex("deadbeef"), 1000n]
        const encoded = Data.withSchema(AssetPair).toCBORHex(input)
        const decoded = Data.withSchema(AssetPair).fromCBORHex(encoded)

        expect(encoded).toEqual("9f44deadbeef1903e8ff")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should handle heterogeneous tuples", () => {
        const Mixed = TSchema.Tuple([TSchema.ByteArray, TSchema.Integer, TSchema.Boolean])
        type Mixed = typeof Mixed.Type
        const eq = TSchema.equivalence(Mixed)

        const input: Mixed = [fromHex("deadbeef"), 1000n, true]
        const encoded = Data.withSchema(Mixed).toCBORHex(input)
        const decoded = Data.withSchema(Mixed).fromCBORHex(encoded)

        expect(eq(decoded, input)).toBe(true)
      })
    })

    describe("Nullable Schema", () => {
      it("should encode/decode non-null values", () => {
        const MaybeInt = TSchema.NullOr(TSchema.Integer)
        const eq = TSchema.equivalence(MaybeInt)

        const input = 42n
        const encoded = Data.withSchema(MaybeInt).toCBORHex(input)
        const decoded = Data.withSchema(MaybeInt).fromCBORHex(encoded)

        expect(encoded).toEqual("d8799f182aff")
        expect(eq(decoded, input)).toBe(true)
      })

      it("should encode/decode null values", () => {
        const MaybeInt = TSchema.NullOr(TSchema.Integer)

        const input = null
        const encoded = Data.withSchema(MaybeInt).toCBORHex(input)
        const decoded = Data.withSchema(MaybeInt).fromCBORHex(encoded)

        expect(encoded).toEqual("d87a80")
        expect(decoded).toBeNull()
      })

      it("should preserve field order in structs with NullOr fields (regression test)", () => {
        // Regression test for field ordering bug with NullOr/UndefinedOr
        const CredentialSchema = TSchema.Union(
          TSchema.Struct({ pubKeyHash: TSchema.ByteArray }, { flatFields: true }),
          TSchema.Struct({ scriptHash: TSchema.ByteArray }, { flatFields: true })
        )

        const AddressSchema = TSchema.Struct({
          paymentCredential: CredentialSchema,
          stakeCredential: TSchema.NullOr(TSchema.Integer)
        })

        const Foo = TSchema.Union(
          TSchema.Struct({ foo: AddressSchema }, { flatFields: true })
        )

        const input = {
          foo: {
            paymentCredential: { pubKeyHash: fromHex("deadbeef") },
            stakeCredential: null
          }
        }

        const encoded = Data.withSchema(Foo).toData(input)
        const decoded = Data.withSchema(Foo).fromData(encoded)

        // Verify roundtrip
        expect(decoded).toEqual(input)

        // Verify field order in CBOR: paymentCredential should be field 0, stakeCredential field 1
        const innerStruct = (encoded.fields[0] as Data.Constr).fields[0] as Data.Constr
        expect(innerStruct.fields.length).toBe(2)
        expect(innerStruct.fields[0]).toBeInstanceOf(Data.Constr) // paymentCredential
        expect(innerStruct.fields[1]).toBeInstanceOf(Data.Constr) // stakeCredential (null)
        expect((innerStruct.fields[1] as Data.Constr).index).toBe(1n) // null is Constr(1, [])
      })
    })

    describe("Literal Schema", () => {
      it("should encode/decode literals", () => {
        const Action = TSchema.Literal("mint", "burn", "transfer")
        const eq = TSchema.equivalence(Action)

        const input = "mint"
        const encoded = Data.withSchema(Action).toCBORHex(input)
        const decoded = Data.withSchema(Action).fromCBORHex(encoded)

        expect(encoded).toEqual("d87980")
        expect(eq(decoded, input)).toBe(true)

        const input2 = "burn"
        const encoded2 = Data.withSchema(Action).toCBORHex(input2)
        const decoded2 = Data.withSchema(Action).fromCBORHex(encoded2)

        expect(encoded2).toEqual("d87a80")
        expect(eq(decoded2, input2)).toBe(true)
      })

      it("should fail on invalid literal", () => {
        const Action = TSchema.Literal("mint", "burn")
        expect(() =>
          // @ts-ignore intentional misuse
          Data.withSchema(Action).toCBORHex("invalid")
        ).toThrow()
      })
    })

    describe("Union Schema", () => {
      it("should encode/decode union types", () => {
        const MintRedeem = TSchema.Struct({
          policyId: TSchema.ByteArray,
          assetName: TSchema.ByteArray,
          amount: TSchema.Integer
        })
        type MintRedeem = typeof MintRedeem.Type

        const SpendRedeem = TSchema.Struct({ address: TSchema.ByteArray, amount: TSchema.Integer })
        type SpendRedeem = typeof SpendRedeem.Type

        const RedeemAction = TSchema.Union(MintRedeem, SpendRedeem, TSchema.Integer)
        const eq = TSchema.equivalence(RedeemAction)

        // Test MintRedeem
        const mintInput: MintRedeem = { policyId: fromHex("deadbeef"), assetName: fromHex("cafe"), amount: 1000n }
        const mintEncoded = Data.withSchema(RedeemAction).toCBORHex(mintInput)
        const mintDecoded = Data.withSchema(RedeemAction).fromCBORHex(mintEncoded)

        expect(mintEncoded).toEqual("d8799fd8799f44deadbeef42cafe1903e8ffff")
        expect(eq(mintDecoded, mintInput)).toBe(true)

        // Test SpendRedeem
        const spendInput: SpendRedeem = { address: fromHex("deadbeef"), amount: 500n }
        const spendEncoded = Data.withSchema(RedeemAction).toCBORHex(spendInput)
        const spendDecoded = Data.withSchema(RedeemAction).fromCBORHex(spendEncoded)

        expect(spendEncoded).toEqual("d87a9fd8799f44deadbeef1901f4ffff")
        expect(eq(spendDecoded, spendInput)).toBe(true)

        // Test Integer
        const intInput = 42n
        const intEncoded = Data.withSchema(RedeemAction).toCBORHex(intInput)
        const intDecoded = Data.withSchema(RedeemAction).fromCBORHex(intEncoded)

        expect(intEncoded).toEqual("d87b9f182aff")
        expect(eq(intDecoded, intInput)).toBe(true)
      })
    })
  })

  describe("Complex Combinations", () => {
    it("should handle complex nested schemas", () => {
      const Asset = TSchema.Struct({ policyId: TSchema.ByteArray, assetName: TSchema.ByteArray })
      const TokenList = TSchema.Array(Asset)
      const Wallet = TSchema.Struct({
        owner: TSchema.ByteArray,
        tokens: TokenList,
        active: TSchema.Boolean,
        metadata: TSchema.NullOr(TSchema.Map(TSchema.ByteArray, TSchema.ByteArray))
      })
      type Wallet = typeof Wallet.Type
      const eq = TSchema.equivalence(Wallet)

      const input: Wallet = {
        owner: fromHex("deadbeef"),
        tokens: [
          { policyId: fromHex("cafe01"), assetName: fromHex("deadbeef01") },
          { policyId: fromHex("cafe02"), assetName: fromHex("deadbeef02") }
        ],
        active: true,
        metadata: new Map([
          [fromHex("cafe01"), fromHex("deadbeef01")],
          [fromHex("cafe02"), fromHex("deadbeef02")]
        ])
      }

      const encoded = Data.withSchema(Wallet).toCBORHex(input)
      const decoded = Data.withSchema(Wallet).fromCBORHex(encoded)

      expect(eq(decoded, input)).toBe(true)
    })
  })

  describe("Error Handling", () => {
    it("should provide helpful error messages for decoding failures", () => {
      const TestStruct = TSchema.Struct({ field1: TSchema.Integer, field2: TSchema.ByteArray })

      const invalidData = "d87a9f010203d87a9f010203" // Invalid ByteArray

      expect(() => Data.withSchema(TestStruct).fromCBORHex(invalidData)).toThrow()
    })

    it("should throw comprehensible errors for schema mismatches", () => {
      const StringSchema = TSchema.ByteArray
      const IntegerData = "d87a9f010203" // Invalid Integer

      expect(() => Data.withSchema(StringSchema).fromCBORHex(IntegerData)).toThrow()

      const BooleanData = "d87a80" // Invalid Boolean
      expect(() => Data.withSchema(TSchema.Integer).fromCBORHex(BooleanData)).toThrow()
    })
  })
})
