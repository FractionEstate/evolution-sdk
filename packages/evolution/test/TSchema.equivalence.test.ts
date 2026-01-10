import { describe, expect, it } from "vitest"

import { fromHex } from "../src/Bytes.js"
import * as TSchema from "../src/TSchema.js"

describe("TSchema Equivalence", () => {
  describe("Basic Types", () => {
    it("should compare ByteArray values", () => {
      const eq = TSchema.equivalence(TSchema.ByteArray)

      const a = fromHex("deadbeef")
      const b = fromHex("deadbeef")
      const c = fromHex("cafebabe")

      expect(eq(a, b)).toBe(true)
      expect(eq(a, c)).toBe(false)
    })

    it("should compare Integer values", () => {
      const eq = TSchema.equivalence(TSchema.Integer)

      expect(eq(42n, 42n)).toBe(true)
      expect(eq(42n, 43n)).toBe(false)
    })

    it("should compare Boolean values", () => {
      const eq = TSchema.equivalence(TSchema.Boolean)

      expect(eq(true, true)).toBe(true)
      expect(eq(false, false)).toBe(true)
      expect(eq(true, false)).toBe(false)
    })
  })

  describe("Complex Types", () => {
    it("should compare Struct values", () => {
      const Token = TSchema.Struct({
        policyId: TSchema.ByteArray,
        assetName: TSchema.ByteArray,
        amount: TSchema.Integer
      })
      const eq = TSchema.equivalence(Token)

      const a = {
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: 1000n
      }
      const b = {
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: 1000n
      }
      const c = {
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: 2000n
      }

      expect(eq(a, b)).toBe(true)
      expect(eq(a, c)).toBe(false)
    })

    it("should compare Array values", () => {
      const IntArray = TSchema.Array(TSchema.Integer)
      const eq = TSchema.equivalence(IntArray)

      const a = [1n, 2n, 3n]
      const b = [1n, 2n, 3n]
      const c = [1n, 2n, 4n]

      expect(eq(a, b)).toBe(true)
      expect(eq(a, c)).toBe(false)
    })

    it("should compare Map values", () => {
      const TokenMap = TSchema.Map(TSchema.ByteArray, TSchema.Integer)
      const eq = TSchema.equivalence(TokenMap)

      const a = new Map([
        [fromHex("deadbeef"), 1n],
        [fromHex("cafe"), 2n]
      ])
      const b = new Map([
        [fromHex("deadbeef"), 1n],
        [fromHex("cafe"), 2n]
      ])
      const c = new Map([
        [fromHex("deadbeef"), 1n],
        [fromHex("cafe"), 3n]
      ])

      expect(eq(a, b)).toBe(true)
      expect(eq(a, c)).toBe(false)
    })

    it("should compare Tuple values", () => {
      const AssetPair = TSchema.Tuple([TSchema.ByteArray, TSchema.Integer])
      const eq = TSchema.equivalence(AssetPair)

      const a: [Uint8Array, bigint] = [fromHex("deadbeef"), 1000n]
      const b: [Uint8Array, bigint] = [fromHex("deadbeef"), 1000n]
      const c: [Uint8Array, bigint] = [fromHex("deadbeef"), 2000n]

      expect(eq(a, b)).toBe(true)
      expect(eq(a, c)).toBe(false)
    })

    it("should compare NullOr values", () => {
      const MaybeInt = TSchema.NullOr(TSchema.Integer)
      const eq = TSchema.equivalence(MaybeInt)

      expect(eq(42n, 42n)).toBe(true)
      expect(eq(null, null)).toBe(true)
      expect(eq(42n, 43n)).toBe(false)
      expect(eq(42n, null)).toBe(false)
    })

    it("should compare Literal values", () => {
      const Action = TSchema.Literal("mint", "burn", "transfer")
      const eq = TSchema.equivalence(Action)

      expect(eq("mint", "mint")).toBe(true)
      expect(eq("burn", "burn")).toBe(true)
      expect(eq("mint", "burn")).toBe(false)
    })

    it("should compare Union values", () => {
      const MintRedeem = TSchema.Struct({
        policyId: TSchema.ByteArray,
        assetName: TSchema.ByteArray,
        amount: TSchema.Integer
      })

      const SpendRedeem = TSchema.Struct({
        address: TSchema.ByteArray,
        amount: TSchema.Integer
      })

      const RedeemAction = TSchema.Union(MintRedeem, SpendRedeem, TSchema.Integer)
      const eq = TSchema.equivalence(RedeemAction)

      const mint1 = {
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: 1000n
      }
      const mint2 = {
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: 1000n
      }
      const spend = {
        address: fromHex("deadbeef"),
        amount: 500n
      }

      expect(eq(mint1, mint2)).toBe(true)
      expect(eq(mint1, spend)).toBe(false)
      expect(eq(42n, 42n)).toBe(true)
      expect(eq(mint1, 42n)).toBe(false)
    })
  })

  describe("Nested Structures", () => {
    it("should compare complex nested schemas", () => {
      const Asset = TSchema.Struct({
        policyId: TSchema.ByteArray,
        assetName: TSchema.ByteArray
      })
      const TokenList = TSchema.Array(Asset)
      const Wallet = TSchema.Struct({
        owner: TSchema.ByteArray,
        tokens: TokenList,
        active: TSchema.Boolean,
        metadata: TSchema.NullOr(TSchema.Map(TSchema.ByteArray, TSchema.ByteArray))
      })

      const eq = TSchema.equivalence(Wallet)

      const wallet1 = {
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

      const wallet2 = {
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

      const wallet3 = {
        owner: fromHex("deadbeef"),
        tokens: [
          { policyId: fromHex("cafe01"), assetName: fromHex("deadbeef01") },
          { policyId: fromHex("cafe02"), assetName: fromHex("deadbeef02") }
        ],
        active: false, // Different
        metadata: new Map([
          [fromHex("cafe01"), fromHex("deadbeef01")],
          [fromHex("cafe02"), fromHex("deadbeef02")]
        ])
      }

      expect(eq(wallet1, wallet2)).toBe(true)
      expect(eq(wallet1, wallet3)).toBe(false)
    })
  })

  describe("Performance", () => {
    it("should be efficient for large structures", () => {
      const Asset = TSchema.Struct({
        policyId: TSchema.ByteArray,
        assetName: TSchema.ByteArray,
        amount: TSchema.Integer
      })
      const Portfolio = TSchema.Array(Asset)
      const eq = TSchema.equivalence(Portfolio)

      // Create large arrays
      const assets1 = Array.from({ length: 1000 }, (_, i) => ({
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: BigInt(i)
      }))

      const assets2 = Array.from({ length: 1000 }, (_, i) => ({
        policyId: fromHex("deadbeef"),
        assetName: fromHex("cafe"),
        amount: BigInt(i)
      }))

      const start = performance.now()
      const result = eq(assets1, assets2)
      const duration = performance.now() - start

      expect(result).toBe(true)
      expect(duration).toBeLessThan(100) // Should complete in less than 100ms
    })
  })
})
