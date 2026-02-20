import { describe, expect, it } from "@effect/vitest"

import * as Bytes from "../../src/Bytes.js"
import * as Address from "../../src/plutus/Address.js"

describe("Plutus Address", () => {
  describe("Address with payment credential only", () => {
    it("should create address with VerificationKey payment credential", () => {
      const hash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const addr = {
        payment_credential: { VerificationKey: { hash } },
        stake_credential: undefined
      }
      const data = Address.Codec.toData(addr)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should create address with Script payment credential", () => {
      const hash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const addr = {
        payment_credential: { Script: { hash } },
        stake_credential: undefined
      }
      const data = Address.Codec.toData(addr)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should round-trip address without stake credential", () => {
      const hash = Bytes.fromHex("1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
      const addr = {
        payment_credential: { VerificationKey: { hash } },
        stake_credential: undefined
      }
      const encoded = Address.Codec.toCBORHex(addr)
      const decoded = Address.Codec.fromCBORHex(encoded)
      expect(decoded.payment_credential).toEqual(addr.payment_credential)
      expect(decoded.stake_credential).toBe(undefined)
    })
  })

  describe("Address with payment and stake credentials", () => {
    it("should create address with both credentials", () => {
      const paymentHash = Bytes.fromHex("abcdef1234567890abcdef1234567890abcdef1234567890abcdef12")
      const stakeHash = Bytes.fromHex("fedcba0987654321fedcba0987654321fedcba0987654321fedcba09")
      const addr = {
        payment_credential: { VerificationKey: { hash: paymentHash } },
        stake_credential: {
          Inline: {
            credential: { VerificationKey: { hash: stakeHash } }
          }
        }
      }
      const data = Address.Codec.toData(addr)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should create address with Pointer stake credential", () => {
      const hash = Bytes.fromHex("aabbccddee00112233445566778899aabbccddee00112233445566778899")
      const addr = {
        payment_credential: { Script: { hash } },
        stake_credential: {
          Pointer: {
            slot_number: 12345n,
            transaction_index: 2n,
            certificate_index: 0n
          }
        }
      }
      const data = Address.Codec.toData(addr)
      expect(data.index).toBe(0n)
      expect(data.fields).toHaveLength(2)
    })

    it("should round-trip address with Inline stake credential", () => {
      const paymentHash = Bytes.fromHex("1111111111111111111111111111111111111111111111111111111111")
      const stakeHash = Bytes.fromHex("2222222222222222222222222222222222222222222222222222222222")
      const addr = {
        payment_credential: { VerificationKey: { hash: paymentHash } },
        stake_credential: {
          Inline: {
            credential: { Script: { hash: stakeHash } }
          }
        }
      }
      const encoded = Address.Codec.toCBORHex(addr)
      const decoded = Address.Codec.fromCBORHex(encoded)
      expect(decoded.payment_credential).toEqual(addr.payment_credential)
      expect(decoded.stake_credential).toEqual(addr.stake_credential)
    })

    it("should round-trip address with Pointer stake credential", () => {
      const hash = Bytes.fromHex("3333333333333333333333333333333333333333333333333333333333")
      const addr = {
        payment_credential: { Script: { hash } },
        stake_credential: {
          Pointer: {
            slot_number: 999999n,
            transaction_index: 42n,
            certificate_index: 7n
          }
        }
      }
      const encoded = Address.Codec.toCBORHex(addr)
      const decoded = Address.Codec.fromCBORHex(encoded)
      expect(decoded.payment_credential).toEqual(addr.payment_credential)
      expect(decoded.stake_credential).toEqual(addr.stake_credential)
    })
  })

  describe("Address with mixed credential types", () => {
    it("should create address with Script payment and VerificationKey stake", () => {
      const paymentHash = Bytes.fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      const stakeHash = Bytes.fromHex("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
      const addr = {
        payment_credential: { Script: { hash: paymentHash } },
        stake_credential: {
          Inline: {
            credential: { VerificationKey: { hash: stakeHash } }
          }
        }
      }
      const encoded = Address.Codec.toCBORHex(addr)
      const decoded = Address.Codec.fromCBORHex(encoded)
      expect(decoded.payment_credential).toEqual(addr.payment_credential)
      expect(decoded.stake_credential).toEqual(addr.stake_credential)
    })

    it("should create address with VerificationKey payment and Script stake", () => {
      const paymentHash = Bytes.fromHex("cccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
      const stakeHash = Bytes.fromHex("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")
      const addr = {
        payment_credential: { VerificationKey: { hash: paymentHash } },
        stake_credential: {
          Inline: {
            credential: { Script: { hash: stakeHash } }
          }
        }
      }
      const encoded = Address.Codec.toCBORHex(addr)
      const decoded = Address.Codec.fromCBORHex(encoded)
      expect(decoded.payment_credential).toEqual(addr.payment_credential)
      expect(decoded.stake_credential).toEqual(addr.stake_credential)
    })
  })

  describe("Error Handling", () => {
    it("should reject invalid CBOR hex", () => {
      expect(() => Address.Codec.fromCBORHex("invalid")).toThrow()
    })

    it("should reject malformed CBOR", () => {
      expect(() => Address.Codec.fromCBORHex("ff")).toThrow()
    })

    it("should reject empty CBOR hex", () => {
      expect(() => Address.Codec.fromCBORHex("")).toThrow()
    })

    it("should reject CBOR with missing fields", () => {
      // Constructor with only 1 field instead of 2
      const invalidCBOR = "d8799fd8799f00581cabcdef1234567890abcdef1234567890abcdef1234567890abcdef12ffff"
      expect(() => Address.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject CBOR with invalid payment credential", () => {
      // Invalid credential constructor index
      const invalidCBOR = "d8799fd8799f05581cabcdef1234567890abcdef1234567890abcdef1234567890abcdef12ffd87a80ff"
      expect(() => Address.Codec.fromCBORHex(invalidCBOR)).toThrow()
    })

    it("should reject non-hex characters", () => {
      expect(() => Address.Codec.fromCBORHex("ghijklmnop")).toThrow()
    })
  })
})
