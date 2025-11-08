import { describe, expect, it } from "vitest"

import * as Data from "../src/core/Data.js"
import * as TSchema from "../src/core/TSchema.js"

describe("TSchema.Struct with flat option", () => {
  describe("Default behavior (nested)", () => {
    it("should round-trip correctly with default nested behavior", () => {
      const MyUnion = TSchema.Union(
        TSchema.Struct({ value: TSchema.Integer }),
        TSchema.Struct({ other: TSchema.Integer })
      )

      const value = { value: 42n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)

      // Verify CBOR structure: nested should be Constr(0, [Constr(0, [42])])
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(0n)
      expect(rawData.fields[0]).toBeInstanceOf(Data.Constr)
      expect((rawData.fields[0] as Data.Constr).index).toBe(0n)
      expect((rawData.fields[0] as Data.Constr).fields[0]).toBe(42n)
    })
  })

  describe("Explicit index with implicit flat", () => {
    it("should round-trip correctly when index is specified (implicit flat)", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }, { index: 121 }))

      const value = { value: 99n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)

      // Verify CBOR structure: flat should be Constr(121, [99])
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(121n)
      expect(rawData.fields[0]).toBe(99n)
    })
  })

  describe("Explicit flat: true with custom index", () => {
    it("should round-trip correctly with explicit flat and custom index", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ amount: TSchema.Integer }, { index: 122, flat: true }))

      const value = { amount: 500n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)

      // Verify CBOR structure: flat should be Constr(122, [500])
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(122n)
      expect(rawData.fields[0]).toBe(500n)
    })
  })

  describe("Explicit flat: false with custom index", () => {
    it("should round-trip correctly when flat is explicitly disabled", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ data: TSchema.Integer }, { index: 10, flat: false }))

      const value = { data: 777n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)

      // Verify CBOR structure: nested should be Constr(0, [Constr(10, [777])])
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(0n) // Union position
      expect(rawData.fields[0]).toBeInstanceOf(Data.Constr)
      expect((rawData.fields[0] as Data.Constr).index).toBe(10n) // Custom struct index
      expect((rawData.fields[0] as Data.Constr).fields[0]).toBe(777n)
    })
  })

  describe("Just flat: true without index", () => {
    it("should round-trip correctly with flat: true and auto-index", () => {
      const MyUnion = TSchema.Union(
        TSchema.Struct({ other: TSchema.Integer }), // position 0, nested
        TSchema.Struct({ info: TSchema.Integer }, { flat: true }) // position 1, flat
      )

      const value = { info: 333n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)

      // Verify CBOR structure: flat should be Constr(1, [333])
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(1n)
      expect(rawData.fields[0]).toBe(333n)
    })
  })

  describe("Mixed union (nested + flat auto + flat custom)", () => {
    it("should round-trip all variants correctly in mixed union", () => {
      const MixedUnion = TSchema.Union(
        TSchema.Struct({ nested: TSchema.Integer }), // position 0, nested
        TSchema.Struct({ flatAuto: TSchema.Integer }, { flat: true }), // position 1, flat auto
        TSchema.Struct({ flatCustom: TSchema.Integer }, { index: 121, flat: true }) // flat custom 121
      )

      // Test nested member
      const nested = { nested: 111n }
      const nestedEncoded = Data.withSchema(MixedUnion).toCBORHex(nested)
      const nestedDecoded = Data.withSchema(MixedUnion).fromCBORHex(nestedEncoded)
      expect(nestedDecoded).toEqual(nested)
      
      const nestedRaw = Data.fromCBORHex(nestedEncoded) as Data.Constr
      expect(nestedRaw.index).toBe(0n)
      expect(nestedRaw.fields[0]).toBeInstanceOf(Data.Constr)

      // Test flat auto member
      const flatAuto = { flatAuto: 222n }
      const flatAutoEncoded = Data.withSchema(MixedUnion).toCBORHex(flatAuto)
      const flatAutoDecoded = Data.withSchema(MixedUnion).fromCBORHex(flatAutoEncoded)
      expect(flatAutoDecoded).toEqual(flatAuto)
      
      const flatAutoRaw = Data.fromCBORHex(flatAutoEncoded) as Data.Constr
      expect(flatAutoRaw.index).toBe(1n)
      expect(flatAutoRaw.fields[0]).toBe(222n)

      // Test flat custom member
      const flatCustom = { flatCustom: 333n }
      const flatCustomEncoded = Data.withSchema(MixedUnion).toCBORHex(flatCustom)
      const flatCustomDecoded = Data.withSchema(MixedUnion).fromCBORHex(flatCustomEncoded)
      expect(flatCustomDecoded).toEqual(flatCustom)
      
      const flatCustomRaw = Data.fromCBORHex(flatCustomEncoded) as Data.Constr
      expect(flatCustomRaw.index).toBe(121n)
      expect(flatCustomRaw.fields[0]).toBe(333n)
    })
  })

  describe("Collision detection", () => {
    it("should detect collision between flat member index and nested member position", () => {
      expect(() => {
        TSchema.Union(
          TSchema.Struct({ nested: TSchema.Integer }), // position 0
          TSchema.Struct({ flat: TSchema.Integer }, { index: 0, flat: true }) // collision with position 0
        )
      }).toThrow(/Index collision detected/)
    })

    it("should detect collision between flat member index and another nested member position", () => {
      expect(() => {
        TSchema.Union(
          TSchema.Struct({ first: TSchema.Integer }), // position 0
          TSchema.Struct({ second: TSchema.Integer }), // position 1
          TSchema.Struct({ flat: TSchema.Integer }, { index: 1, flat: true }) // collision with position 1
        )
      }).toThrow(/Index collision detected/)
    })

    it("should NOT throw when both members use custom indices without collision", () => {
      expect(() => {
        TSchema.Union(
          TSchema.Struct({ first: TSchema.Integer }, { index: 10, flat: false }), // nested with custom index 10
          TSchema.Struct({ second: TSchema.Integer }, { index: 20, flat: true }) // flat with custom index 20
        )
      }).not.toThrow()
    })

    it("should detect collision between two flat members with same custom index", () => {
      // This is the bug: two flat members with the same index would both encode to
      // Constr(100, [...]), making it impossible to distinguish them during decoding
      expect(() => {
        TSchema.Union(
          TSchema.Struct({ first: TSchema.Integer }, { index: 100, flat: true }),
          TSchema.Struct({ second: TSchema.Integer }, { index: 100, flat: true })
        )
      }).toThrow(/Index collision detected/)
    })
  })

  describe("CBOR encoding/decoding", () => {
    it("should round-trip through CBOR correctly for flat member", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }, { index: 121 }))

      const value = { value: 42n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)
    })

    it("should round-trip through CBOR correctly for nested member", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }))

      const value = { value: 42n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)
    })

    it("should produce smaller CBOR for flat encoding", () => {
      const NestedUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }))
      const FlatUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }, { flat: true }))

      const value1 = { value: 42n }
      const value2 = { value: 42n }

      const nestedCbor = Data.withSchema(NestedUnion).toCBORHex(value1)
      const flatCbor = Data.withSchema(FlatUnion).toCBORHex(value2)

      // Flat encoding should be shorter (no extra wrapper Constr)
      expect(flatCbor.length).toBeLessThan(nestedCbor.length)
    })
  })

  describe("Real-world use cases", () => {
    it("should handle governance actions pattern", () => {
      const GovernanceAction = TSchema.Union(
        TSchema.Struct({ paramChange: TSchema.Integer }, { index: 121 }), // ParameterChange
        TSchema.Struct({ hardFork: TSchema.Integer }, { index: 122 }), // HardForkInitiation
        TSchema.Struct({ treasuryWithdrawal: TSchema.Integer }, { index: 123 }) // TreasuryWithdrawals
      )

      // Test ParameterChange
      const paramChange = { paramChange: 100n }
      const paramEncoded = Data.withSchema(GovernanceAction).toCBORHex(paramChange)
      const paramDecoded = Data.withSchema(GovernanceAction).fromCBORHex(paramEncoded)
      expect(paramDecoded).toEqual(paramChange)
      
      const paramRaw = Data.fromCBORHex(paramEncoded) as Data.Constr
      expect(paramRaw.index).toBe(121n)
      expect(paramRaw.fields[0]).toBe(100n)

      // Test HardForkInitiation
      const hardFork = { hardFork: 200n }
      const hardForkEncoded = Data.withSchema(GovernanceAction).toCBORHex(hardFork)
      const hardForkDecoded = Data.withSchema(GovernanceAction).fromCBORHex(hardForkEncoded)
      expect(hardForkDecoded).toEqual(hardFork)
      
      const hardForkRaw = Data.fromCBORHex(hardForkEncoded) as Data.Constr
      expect(hardForkRaw.index).toBe(122n)
      expect(hardForkRaw.fields[0]).toBe(200n)

      // Test TreasuryWithdrawals
      const treasury = { treasuryWithdrawal: 300n }
      const treasuryEncoded = Data.withSchema(GovernanceAction).toCBORHex(treasury)
      const treasuryDecoded = Data.withSchema(GovernanceAction).fromCBORHex(treasuryEncoded)
      expect(treasuryDecoded).toEqual(treasury)
      
      const treasuryRaw = Data.fromCBORHex(treasuryEncoded) as Data.Constr
      expect(treasuryRaw.index).toBe(123n)
      expect(treasuryRaw.fields[0]).toBe(300n)
    })

    it("should handle script purposes pattern", () => {
      const ScriptPurpose = TSchema.Union(
        TSchema.Struct({ minting: TSchema.ByteArray }, { index: 0, flat: true }),
        TSchema.Struct({ spending: TSchema.ByteArray }, { index: 1, flat: true }),
        TSchema.Struct({ rewarding: TSchema.ByteArray }, { index: 2, flat: true })
      )

      // Test minting
      const minting = { minting: "deadbeef" }
      const mintEncoded = Data.withSchema(ScriptPurpose).toCBORHex(minting)
      const mintDecoded = Data.withSchema(ScriptPurpose).fromCBORHex(mintEncoded)
      expect(mintDecoded).toEqual(minting)
      
      const mintRaw = Data.fromCBORHex(mintEncoded) as Data.Constr
      expect(mintRaw.index).toBe(0n)
      expect(mintRaw.fields[0]).toBe("deadbeef")

      // Test spending
      const spending = { spending: "cafebabe" }
      const spendEncoded = Data.withSchema(ScriptPurpose).toCBORHex(spending)
      const spendDecoded = Data.withSchema(ScriptPurpose).fromCBORHex(spendEncoded)
      expect(spendDecoded).toEqual(spending)
      
      const spendRaw = Data.fromCBORHex(spendEncoded) as Data.Constr
      expect(spendRaw.index).toBe(1n)
      expect(spendRaw.fields[0]).toBe("cafebabe")

      // Test rewarding
      const rewarding = { rewarding: "feedface" }
      const rewardEncoded = Data.withSchema(ScriptPurpose).toCBORHex(rewarding)
      const rewardDecoded = Data.withSchema(ScriptPurpose).fromCBORHex(rewardEncoded)
      expect(rewardDecoded).toEqual(rewarding)
      
      const rewardRaw = Data.fromCBORHex(rewardEncoded) as Data.Constr
      expect(rewardRaw.index).toBe(2n)
      expect(rewardRaw.fields[0]).toBe("feedface")
    })
  })

  describe("Edge cases", () => {
    it("should handle empty struct", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({}), TSchema.Struct({ value: TSchema.Integer }))

      const value = {}
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)
      
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(0n)
      expect(rawData.fields[0]).toBeInstanceOf(Data.Constr)
      expect((rawData.fields[0] as Data.Constr).fields.length).toBe(0)
    })

    it("should handle struct with multiple fields", () => {
      const MyUnion = TSchema.Union(
        TSchema.Struct(
          {
            field1: TSchema.Integer,
            field2: TSchema.ByteArray,
            field3: TSchema.Boolean
          },
          { index: 100, flat: true }
        )
      )

      const value = { field1: 42n, field2: "deadbeef", field3: true }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)
      
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(100n)
      expect(rawData.fields.length).toBe(3)
      expect(rawData.fields[0]).toBe(42n)
      expect(rawData.fields[1]).toBe("deadbeef")
      // Boolean is encoded as Constr: true -> Constr(1, []), false -> Constr(0, [])
      expect(rawData.fields[2]).toBeInstanceOf(Data.Constr)
      expect((rawData.fields[2] as Data.Constr).index).toBe(1n)
    })

    it("should handle maximum index (127)", () => {
      const MyUnion = TSchema.Union(TSchema.Struct({ value: TSchema.Integer }, { index: 127 }))

      const value = { value: 42n }
      const encoded = Data.withSchema(MyUnion).toCBORHex(value)
      const decoded = Data.withSchema(MyUnion).fromCBORHex(encoded)

      expect(decoded).toEqual(value)
      
      const rawData = Data.fromCBORHex(encoded) as Data.Constr
      expect(rawData.index).toBe(127n)
      expect(rawData.fields[0]).toBe(42n)
    })
  })
})
