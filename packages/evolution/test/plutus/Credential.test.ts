import { describe, expect, it } from "@effect/vitest"

import * as Bytes from "../../src/Bytes.js"
import * as Credential from "../../src/plutus/Credential.js"

describe("Plutus Credential", () => {
  describe("VerificationKeyHash", () => {
    it("should create valid verification key hash", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const data = Credential.VerificationKeyHashCodec.toData(hash)
      expect(data).toEqual(hash)
    })

    it("should round-trip through codec", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const encoded = Credential.VerificationKeyHashCodec.toCBORHex(hash)
      const decoded = Credential.VerificationKeyHashCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(hash)
    })
  })

  describe("ScriptHash", () => {
    it("should create valid script hash", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const data = Credential.ScriptHashCodec.toData(hash)
      expect(data).toEqual(hash)
    })

    it("should round-trip through codec", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const encoded = Credential.ScriptHashCodec.toCBORHex(hash)
      const decoded = Credential.ScriptHashCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(hash)
    })
  })

  describe("Credential", () => {
    it("should create VerificationKey credential", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const cred = { VerificationKey: { hash } }
      const data = Credential.CredentialCodec.toData(cred)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(1)
    })

    it("should create Script credential", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const cred = { Script: { hash } }
      const data = Credential.CredentialCodec.toData(cred)
      expect(data.index).toBe(1n)
      expect(data.fields).toHaveLength(1)
    })

    it("should round-trip VerificationKey credential", () => {
      const hash = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const cred = { VerificationKey: { hash } }
      const encoded = Credential.CredentialCodec.toCBORHex(cred)
      const decoded = Credential.CredentialCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(cred)
    })

    it("should round-trip Script credential", () => {
      const hash = Bytes.fromHex("0987654321fedcba0987654321fedcba0987654321fedcba0987654321")
      const cred = { Script: { hash } }
      const encoded = Credential.CredentialCodec.toCBORHex(cred)
      const decoded = Credential.CredentialCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(cred)
    })
  })

  describe("PaymentCredential", () => {
    it("should create VerificationKey payment credential", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const cred = { VerificationKey: { hash } }
      const data = Credential.PaymentCredentialCodec.toData(cred)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(1)
    })

    it("should create Script payment credential", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const cred = { Script: { hash } }
      const data = Credential.PaymentCredentialCodec.toData(cred)
      expect(data.index).toBe(1n)
      expect(data.fields).toHaveLength(1)
    })

    it("should round-trip payment credentials", () => {
      const hash = Bytes.fromHex("aabbccddee00112233445566778899aabbccddee00112233445566778899")
      const cred = { VerificationKey: { hash } }
      const encoded = Credential.PaymentCredentialCodec.toCBORHex(cred)
      const decoded = Credential.PaymentCredentialCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(cred)
    })
  })

  describe("StakeCredential", () => {
    it("should create Inline stake credential", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const stakeCred = {
        Inline: {
          credential: { VerificationKey: { hash } },
        },
      }
      const data = Credential.StakeCredentialCodec.toData(stakeCred)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(1)
    })

    it("should create Pointer stake credential", () => {
      const stakeCred = {
        Pointer: {
          slot_number: 12345n,
          transaction_index: 2n,
          certificate_index: 0n,
        },
      }
      const data = Credential.StakeCredentialCodec.toData(stakeCred)
      expect(data.index).toBe(1n)
      expect(data.fields).toHaveLength(3)
    })

    it("should round-trip Inline stake credential", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const stakeCred = {
        Inline: {
          credential: { Script: { hash } },
        },
      }
      const encoded = Credential.StakeCredentialCodec.toCBORHex(stakeCred)
      const decoded = Credential.StakeCredentialCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(stakeCred)
    })

    it("should round-trip Pointer stake credential", () => {
      const stakeCred = {
        Pointer: {
          slot_number: 999999n,
          transaction_index: 42n,
          certificate_index: 3n,
        },
      }
      const encoded = Credential.StakeCredentialCodec.toCBORHex(stakeCred)
      const decoded = Credential.StakeCredentialCodec.fromCBORHex(encoded)
      expect(decoded).toEqual(stakeCred)
    })
  })

  describe("Error Handling", () => {
    it("should reject invalid CBOR hex for VerificationKeyHash", () => {
      expect(() => Credential.VerificationKeyHashCodec.fromCBORHex("invalid")).toThrow()
    })

    it("should reject malformed CBOR for VerificationKeyHash", () => {
      expect(() => Credential.VerificationKeyHashCodec.fromCBORHex("ff")).toThrow()
    })

    it("should reject invalid CBOR hex for ScriptHash", () => {
      expect(() => Credential.ScriptHashCodec.fromCBORHex("notvalidhex")).toThrow()
    })

    it("should reject invalid CBOR hex for Credential", () => {
      expect(() => Credential.CredentialCodec.fromCBORHex("zzzz")).toThrow()
    })

    it("should reject malformed Credential constructor", () => {
      // Invalid constructor index (2 instead of 0 or 1)
      const invalidCBOR = "d8799f02581cabcdef1234567890abcdef1234567890abcdef1234567890abcdef12ff"
      expect(() => Credential.CredentialCodec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject invalid CBOR hex for PaymentCredential", () => {
      expect(() => Credential.PaymentCredentialCodec.fromCBORHex("!@#$")).toThrow()
    })

    it("should reject invalid CBOR hex for StakeCredential", () => {
      expect(() => Credential.StakeCredentialCodec.fromCBORHex("garbage")).toThrow()
    })

    it("should reject malformed StakeCredential Pointer with missing fields", () => {
      // Pointer with only 2 fields instead of 3
      const invalidCBOR = "d8799f011b000000000000303982ff"
      expect(() => Credential.StakeCredentialCodec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject empty CBOR hex", () => {
      expect(() => Credential.CredentialCodec.fromCBORHex("")).toThrow()
    })
  })
})
