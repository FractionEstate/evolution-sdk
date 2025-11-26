import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { PlutusBlueprint } from "../src/blueprint/types.js"
import blueprintJson from "./spec/plutus.json"

describe("Blueprint", () => {
  describe("CIP-57 Blueprint Deserialization", () => {
    it("should deserialize plutus.json into PlutusBlueprint schema", () => {
      // Use imported blueprint JSON

      // Decode using Effect Schema
      const result = Schema.decodeUnknownSync(PlutusBlueprint)(blueprintJson)

      // Verify preamble
      expect(result.preamble.title).toBe("evolution-sdk/spec")
      expect(result.preamble.plutusVersion).toBe("v3")
      expect(result.preamble.compiler?.name).toBe("Aiken")
      expect(result.preamble.compiler?.version).toBe("v1.1.19+e525483")

      // Verify validators exist
      expect(result.validators).toBeDefined()
      expect(result.validators.length).toBeGreaterThan(0)

      // Verify definitions exist
      expect(result.definitions).toBeDefined()
      expect(Object.keys(result.definitions).length).toBeGreaterThan(0)
    })

    it("should correctly parse validator with datum and redeemer schemas", () => {
      const result = Schema.decodeUnknownSync(PlutusBlueprint)(blueprintJson)

      // Find the mint_policy.spend validator
      const spendValidator = result.validators.find(
        (v) => v.title === "mint.mint_policy.spend"
      )

      expect(spendValidator).toBeDefined()
      expect(spendValidator?.datum).toBeDefined()
      expect(spendValidator?.redeemer).toBeDefined()

      // Verify datum schema reference
      expect(spendValidator?.datum?.schema).toHaveProperty("$ref")

      // Verify redeemer schema reference  
      expect(spendValidator?.redeemer?.schema).toHaveProperty("$ref")
    })

    it("should validate type safety with malformed blueprint data", () => {
      const malformedBlueprint = {
        preamble: {
          title: "test",
          version: "1.0.0",
          plutusVersion: "invalid-version", // Invalid enum value
        },
        validators: [],
        definitions: {},
      }

      // Should throw ParseError for invalid data
      expect(() => {
        Schema.decodeUnknownSync(PlutusBlueprint)(malformedBlueprint)
      }).toThrow()
    })

    it("should validate required fields are present", () => {
      const incompleteBlueprint = {
        preamble: {
          // Missing required 'title' field
          version: "1.0.0",
          plutusVersion: "v3",
        },
        validators: [],
        definitions: {},
      }

      // Should throw ParseError for missing required fields
      expect(() => {
        Schema.decodeUnknownSync(PlutusBlueprint)(incompleteBlueprint)
      }).toThrow()
    })

    it("should parse complex nested definitions", () => {
      const result = Schema.decodeUnknownSync(PlutusBlueprint)(blueprintJson)

      // Verify complex types exist in definitions
      expect(result.definitions["mint/SpendDatum"]).toBeDefined()
      expect(result.definitions["mint/MintRedeemer"]).toBeDefined()
      expect(result.definitions["cardano/address/Credential"]).toBeDefined()
      expect(result.definitions["Option$ByteArray"]).toBeDefined()
    })

    it("should roundtrip encode and decode blueprint", () => {
      // Decode
      const decoded = Schema.decodeUnknownSync(PlutusBlueprint)(blueprintJson)

      // Encode back
      const encoded = Schema.encodeSync(PlutusBlueprint)(decoded)

      // Decode again
      const reDecoded = Schema.decodeUnknownSync(PlutusBlueprint)(encoded)

      // Should match
      expect(reDecoded.preamble.title).toBe(decoded.preamble.title)
      expect(reDecoded.validators.length).toBe(decoded.validators.length)
      expect(Object.keys(reDecoded.definitions).length).toBe(
        Object.keys(decoded.definitions).length
      )
    })
  })
})
