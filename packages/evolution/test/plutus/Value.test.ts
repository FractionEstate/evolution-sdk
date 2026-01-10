import { describe, expect, it } from "@effect/vitest"

import * as Bytes from "../../src/Bytes.js"
import * as Value from "../../src/plutus/Value.js"
import * as Text from "../../src/Text.js"

describe("Plutus Value", () => {
  describe("PolicyId", () => {
    it("should create valid policy ID", () => {
      const policyId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const data = Value.PolicyIdCodec.toData(policyId)
      expect(data).toEqual(policyId)
    })

    it("should round-trip through codec", () => {
      const policyId = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const encoded = Value.PolicyIdCodec.toCBORHex(policyId)
      const decoded = Value.PolicyIdCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(policyId)
    })
  })

  describe("AssetName", () => {
    it("should create valid asset name", () => {
      const assetName = Text.toBytes("TokenName")
      const data = Value.AssetNameCodec.toData(assetName)
      expect(data).toEqual(assetName)
    })

    it("should round-trip through codec", () => {
      const assetName = Text.toBytes("MyToken")
      const encoded = Value.AssetNameCodec.toCBORHex(assetName)
      const decoded = Value.AssetNameCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(assetName)
    })

    it("should handle empty asset name", () => {
      const assetName = new Uint8Array()
      const encoded = Value.AssetNameCodec.toCBORHex(assetName)
      const decoded = Value.AssetNameCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(assetName)
    })
  })

  describe("Lovelace", () => {
    it("should create valid lovelace amount", () => {
      const lovelace = 1000000n
      const data = Value.LovelaceCodec.toData(lovelace)
      expect(data).toBe(lovelace)
    })

    it("should round-trip through codec", () => {
      const lovelace = 5000000n
      const encoded = Value.LovelaceCodec.toCBORHex(lovelace)
      const decoded = Value.LovelaceCodec.fromCBORHex(encoded)
      expect(decoded).toBe(lovelace)
    })

    it("should handle zero lovelace", () => {
      const lovelace = 0n
      const encoded = Value.LovelaceCodec.toCBORHex(lovelace)
      const decoded = Value.LovelaceCodec.fromCBORHex(encoded)
      expect(decoded).toBe(lovelace)
    })
  })

  describe("Value", () => {
    it("should create empty value", () => {
      const value = new Map()
      const data = Value.Codec.toData(value)
      expect(data.size).toBe(0)
    })

    it("should create value with single policy and asset", () => {
      const policyId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const assetName = Text.toBytes("Token")
      const assetsMap = new Map([[assetName, 100n]])
      const value = new Map([[policyId, assetsMap]])

      const data = Value.Codec.toData(value)
      expect(data.size).toBe(1)
    })

    it("should create value with multiple assets under one policy", () => {
      const policyId = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const assetsMap = new Map([
        [Text.toBytes("TokenA"), 50n],
        [Text.toBytes("TokenB"), 100n],
        [Text.toBytes("TokenC"), 150n],
      ])
      const value = new Map([[policyId, assetsMap]])

      const data = Value.Codec.toData(value)
      expect(data.size).toBe(1)
    })

    it("should create value with multiple policies", () => {
      const policy1 = Bytes.fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const policy2 = Bytes.fromHex("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")

      const assetsMap1 = new Map([[Text.toBytes("AssetA1"), 100n]])
      const assetsMap2 = new Map([[Text.toBytes("AssetA2"), 200n]])

      const value = new Map([
        [policy1, assetsMap1],
        [policy2, assetsMap2],
      ])

      const data = Value.Codec.toData(value)
      expect(data.size).toBe(2)
    })

    it("should round-trip empty value", () => {
      const value = new Map()
      const encoded = Value.Codec.toCBORHex(value)
      const decoded = Value.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(value)
    })

    it("should round-trip single policy value", () => {
      const policyId = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const assetsMap = new Map([[Text.toBytes("NFT"), 1n]])
      const value = new Map([[policyId, assetsMap]])

      const encoded = Value.Codec.toCBORHex(value)
      const decoded = Value.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(value)
    })

    it("should round-trip complex multi-asset value", () => {
      const policy1 = Text.toBytes("policy_one_example_for_test28")
      const policy2 = Text.toBytes("policy_two_example_for_test28")

      const assetsMap1 = new Map([
        [new Uint8Array(), 1000n], // empty asset name (ADA-like)
        [Text.toBytes("TokenA"), 50n],
      ])
      const assetsMap2 = new Map([
        [Text.toBytes("TokenB"), 100n],
        [Text.toBytes("TokenC"), 150n],
      ])

      const value = new Map([
        [policy1, assetsMap1],
        [policy2, assetsMap2],
      ])

      const encoded = Value.Codec.toCBORHex(value)
      const decoded = Value.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(value)
    })

    it("should handle large quantities", () => {
      const policyId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const assetsMap = new Map([[Text.toBytes("Token"), 1000000000000n]])
      const value = new Map([[policyId, assetsMap]])

      const encoded = Value.Codec.toCBORHex(value)
      const decoded = Value.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(value)
    })
  })

  describe("Error Handling", () => {
    it("should reject invalid CBOR hex for PolicyId", () => {
      expect(() => Value.PolicyIdCodec.fromCBORHex("invalid")).toThrow()
    })

    it("should reject malformed CBOR for PolicyId", () => {
      expect(() => Value.PolicyIdCodec.fromCBORHex("ff")).toThrow()
    })

    it("should reject invalid CBOR hex for AssetName", () => {
      expect(() => Value.AssetNameCodec.fromCBORHex("notvalid")).toThrow()
    })

    it("should reject invalid CBOR hex for Lovelace", () => {
      expect(() => Value.LovelaceCodec.fromCBORHex("xyz")).toThrow()
    })

    it("should reject malformed CBOR for Lovelace", () => {
      expect(() => Value.LovelaceCodec.fromCBORHex("ff")).toThrow()
    })

    it("should reject invalid CBOR hex for Value", () => {
      expect(() => Value.Codec.fromCBORHex("garbage")).toThrow()
    })

    it("should reject malformed Value map structure", () => {
      // Invalid map structure
      const invalidCBOR = "9f"
      expect(() => Value.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject empty CBOR hex", () => {
      expect(() => Value.Codec.fromCBORHex("")).toThrow()
    })

    it("should reject non-hex characters", () => {
      expect(() => Value.PolicyIdCodec.fromCBORHex("ghijkl")).toThrow()
    })
  })
})
