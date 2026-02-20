import { describe, expect, it } from "@effect/vitest"

import * as Bytes from "../../src/Bytes.js"
import * as OutputReference from "../../src/plutus/OutputReference.js"

describe("Plutus OutputReference", () => {
  describe("TransactionId", () => {
    it("should create valid transaction ID", () => {
      const txId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const data = OutputReference.TransactionIdCodec.toData(txId)
      expect(data).toEqual(txId)
    })

    it("should round-trip through codec", () => {
      const txId = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
      const encoded = OutputReference.TransactionIdCodec.toCBORHex(txId)
      const decoded = OutputReference.TransactionIdCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(txId)
    })
  })

  describe("OutputReference", () => {
    it("should create output reference with index 0", () => {
      const txId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const outRef = {
        transaction_id: txId,
        output_index: 0n
      }
      const data = OutputReference.Codec.toData(outRef)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should create output reference with positive index", () => {
      const txId = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321")
      const outRef = {
        transaction_id: txId,
        output_index: 5n
      }
      const data = OutputReference.Codec.toData(outRef)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should round-trip output reference with index 0", () => {
      const txId = Bytes.fromHex("1111111111111111111111111111111111111111111111111111111111111111")
      const outRef = {
        transaction_id: txId,
        output_index: 0n
      }
      const encoded = OutputReference.Codec.toCBORHex(outRef)
      const decoded = OutputReference.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(outRef)
    })

    it("should round-trip output reference with max safe integer index", () => {
      const txId = Bytes.fromHex("2222222222222222222222222222222222222222222222222222222222222222")
      const outRef = {
        transaction_id: txId,
        output_index: 42n
      }
      const encoded = OutputReference.Codec.toCBORHex(outRef)
      const decoded = OutputReference.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(outRef)
    })

    it("should round-trip output reference with large index", () => {
      const txId = Bytes.fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const outRef = {
        transaction_id: txId,
        output_index: 9999n
      }
      const encoded = OutputReference.Codec.toCBORHex(outRef)
      const decoded = OutputReference.Codec.fromCBORHex(encoded)
      expect(decoded).toEqual(outRef)
    })

    it("should handle different transaction IDs with same index", () => {
      const txId1 = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
      const txId2 = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321")

      const outRef1 = {
        transaction_id: txId1,
        output_index: 1n
      }
      const outRef2 = {
        transaction_id: txId2,
        output_index: 1n
      }

      const encoded1 = OutputReference.Codec.toCBORHex(outRef1)
      const encoded2 = OutputReference.Codec.toCBORHex(outRef2)

      expect(encoded1).not.toBe(encoded2)

      const decoded1 = OutputReference.Codec.fromCBORHex(encoded1)
      const decoded2 = OutputReference.Codec.fromCBORHex(encoded2)

      expect(decoded1).toEqual(outRef1)
      expect(decoded2).toEqual(outRef2)
    })

    it("should handle same transaction ID with different indices", () => {
      const txId = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const outRef1 = {
        transaction_id: txId,
        output_index: 0n
      }
      const outRef2 = {
        transaction_id: txId,
        output_index: 1n
      }

      const encoded1 = OutputReference.Codec.toCBORHex(outRef1)
      const encoded2 = OutputReference.Codec.toCBORHex(outRef2)

      expect(encoded1).not.toBe(encoded2)

      const decoded1 = OutputReference.Codec.fromCBORHex(encoded1)
      const decoded2 = OutputReference.Codec.fromCBORHex(encoded2)

      expect(decoded1).toEqual(outRef1)
      expect(decoded2).toEqual(outRef2)
    })
  })

  describe("Error Handling", () => {
    it("should reject invalid CBOR hex for TransactionId", () => {
      expect(() => OutputReference.TransactionIdCodec.fromCBORHex("invalid")).toThrow()
    })

    it("should reject malformed CBOR for TransactionId", () => {
      expect(() => OutputReference.TransactionIdCodec.fromCBORHex("ff")).toThrow()
    })

    it("should reject invalid CBOR hex for OutputReference", () => {
      expect(() => OutputReference.Codec.fromCBORHex("notvalid")).toThrow()
    })

    it("should reject malformed OutputReference with missing fields", () => {
      // Constructor with only 1 field instead of 2
      const invalidCBOR = "d8799f5820abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ff"
      expect(() => OutputReference.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject OutputReference with invalid transaction ID length", () => {
      // Transaction ID with wrong length (not 32 bytes)
      const invalidCBOR = "d8799f5810abcdef123456780000ff"
      expect(() => OutputReference.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject empty CBOR hex", () => {
      expect(() => OutputReference.Codec.fromCBORHex("")).toThrow()
    })

    it("should reject non-hex characters", () => {
      expect(() => OutputReference.Codec.fromCBORHex("xyz123")).toThrow()
    })
  })
})
