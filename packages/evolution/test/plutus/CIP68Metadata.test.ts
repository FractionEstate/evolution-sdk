import { describe, expect, it } from "@effect/vitest"

import * as Data from "../../src/Data.js"
import * as CIP68Metadata from "../../src/plutus/CIP68Metadata.js"
import * as Text from "../../src/Text.js"

describe("CIP68 Metadata", () => {
  describe("CIP68Datum", () => {
    it("should create datum with empty metadata", () => {
      const datum = {
        metadata: 0n,
        version: 1n,
        extra: [],
      }
      const data = CIP68Metadata.Codec.toData(datum)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(3)
    })

    it("should create datum with metadata map", () => {
      const metadataMap = Data.map([
        [Text.toBytes("name"), Text.toBytes("Token")],
      ])
      const datum = {
        metadata: metadataMap,
        version: 1n,
        extra: [],
      }
      const data = CIP68Metadata.Codec.toData(datum)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(3)
    })

    it("should create datum with version 1 (NFT)", () => {
      const datum = {
        metadata: 0n,
        version: 1n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(decoded.version).toBe(1n)
    })

    it("should create datum with version 2", () => {
      const datum = {
        metadata: 0n,
        version: 2n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(decoded.version).toBe(2n)
    })

    it("should create datum with version 3 (RFT)", () => {
      const datum = {
        metadata: 0n,
        version: 3n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(decoded.version).toBe(3n)
    })

    it("should create datum with extra data", () => {
      const extraData = [100n, Text.toBytes("custom")]
      const datum = {
        metadata: 0n,
        version: 1n,
        extra: extraData,
      }
      const data = CIP68Metadata.Codec.toData(datum)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(3)
      expect(data.fields[2]).toHaveLength(2)
    })

    it("should round-trip simple datum", () => {
      const datum = {
        metadata: 0n,
        version: 1n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(decoded.metadata).toBe(0n)
      expect(decoded.version).toBe(1n)
      expect(decoded.extra).toEqual([])
    })

    it("should round-trip datum with metadata", () => {
      const metadataMap = Data.map([
        [Text.toBytes("name"), Text.toBytes("TestToken")],
        [Text.toBytes("image"), Text.toBytes("ipfs://test")],
      ])
      const datum = {
        metadata: metadataMap,
        version: 1n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(Data.equals(decoded.metadata, datum.metadata)).toBe(true)
      expect(decoded.version).toBe(1n)
      expect(decoded.extra).toEqual([])
    })

    it("should round-trip datum with extra data", () => {
      const extraData = [
        42n,
        Data.map([[Text.toBytes("key"), Text.toBytes("value")]]),
      ]
      const datum = {
        metadata: 0n,
        version: 2n,
        extra: extraData,
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(decoded.metadata).toBe(0n)
      expect(decoded.version).toBe(2n)
      expect(decoded.extra[0]).toBe(42n)
      expect(Data.equals(decoded.extra[1], extraData[1])).toBe(true)
    })

    it("should round-trip complex NFT metadata (222)", () => {
      const nftMetadata = Data.map([
        [Text.toBytes("name"), Text.toBytes("TestNFT")],
        [Text.toBytes("image"), Text.toBytes("ipfs://test/image.png")],
        [Text.toBytes("description"), Text.toBytes("This is a test token")],
      ])
      const datum = {
        metadata: nftMetadata,
        version: 1n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(Data.equals(decoded.metadata, datum.metadata)).toBe(true)
      expect(decoded.version).toBe(1n)
      expect(decoded.extra).toEqual([])
    })

    it("should round-trip FT metadata with decimals (333)", () => {
      const ftMetadata = Data.map([
        [Text.toBytes("name"), Text.toBytes("TestToken")],
        [Text.toBytes("decimals"), 6n],
        [Text.toBytes("ticker"), Text.toBytes("TEST")],
      ])
      const datum = {
        metadata: ftMetadata,
        version: 1n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(Data.equals(decoded.metadata, datum.metadata)).toBe(true)
      expect(decoded.version).toBe(1n)
      expect(decoded.extra).toEqual([])
    })

    it("should round-trip RFT metadata (444)", () => {
      const rftMetadata = Data.map([
        [Text.toBytes("name"), Text.toBytes("TestRFT")],
        [Text.toBytes("image"), Text.toBytes("ipfs://test/image.png")],
        [Text.toBytes("decimals"), 2n],
      ])
      const datum = {
        metadata: rftMetadata,
        version: 3n,
        extra: [],
      }
      const encoded = CIP68Metadata.Codec.toCBORHex(datum)
      const decoded = CIP68Metadata.Codec.fromCBORHex(encoded)
      expect(Data.equals(decoded.metadata, datum.metadata)).toBe(true)
      expect(decoded.version).toBe(3n)
      expect(decoded.extra).toEqual([])
    })
  })

  describe("Error Handling", () => {
    it("should reject invalid CBOR hex", () => {
      expect(() => CIP68Metadata.Codec.fromCBORHex("invalid")).toThrow()
    })

    it("should reject malformed CBOR", () => {
      expect(() => CIP68Metadata.Codec.fromCBORHex("ff")).toThrow()
    })

    it("should reject empty CBOR hex", () => {
      expect(() => CIP68Metadata.Codec.fromCBORHex("")).toThrow()
    })

    it("should reject CBOR with missing fields", () => {
      // Constructor with only 1 field instead of 3
      const invalidCBOR = "d8799f00ff"
      expect(() => CIP68Metadata.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject non-hex characters", () => {
      expect(() => CIP68Metadata.Codec.fromCBORHex("xyz!@#")).toThrow()
    })
  })
})
