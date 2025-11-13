import { FastCheck, Schema } from "effect"

import * as Bytes from "./Bytes.js"

export const Text = Schema.String

/**
 * Configuration for text transformations.
 *
 * @since 2.0.0
 * @category types
 */
export interface TextTransformationConfig {
  id: string
  to: Schema.Schema<string, string>
  from: Schema.Schema<Uint8Array, Uint8Array>
}

/**
 * Creates a text transformation schema.
 *
 * @since 2.0.0
 * @category utilities
 */
export const makeTextTransformation = (config: TextTransformationConfig) => {
  const { from: bytesSchema, id, to: inputSchema } = config
  return Schema.transform(bytesSchema, inputSchema, {
    strict: true,
    decode: (input) => new TextDecoder().decode(input),
    encode: (text) => new TextEncoder().encode(text)
  }).annotations({ identifier: id })
}

/**
 * Schema for converting between strings and hex representation of UTF-8 bytes.
 *
 * ```
 * text <-> hex
 * ```
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromBytes = makeTextTransformation({
  id: "Text.FromBytes",
  to: Text,
  from: Schema.Uint8ArrayFromSelf
})
// type t = typeof FromBytes.Type
// type e = typeof FromBytes.Encoded

export const FromHex = Schema.compose(
  Bytes.FromHex, // string → Uint8Array
  FromBytes // Uint8Array → string
)

// =============================================================================
// Text Length Validation Utilities
// =============================================================================

/**
 * Creates a schema that validates text length equals a specific value.
 *
 * @since 2.0.0
 * @category validation
 */
export const textLengthEquals = (length: number, identifier?: string) =>
  Schema.filter((text: string) => text.length === length, {
    message: () => `Expected text length ${length}`,
    identifier
  })

/**
 * Creates a curried filter that validates text length is within a range.
 * Preserves Context inference from the base schema.
 *
 * @since 2.0.0
 * @category composition
 */
export const textLengthBetween =
  (min: number, max: number, moduleName: string) =>
  <S extends Schema.Schema<any, string>>(baseSchema: S) =>
    baseSchema.pipe(
      Schema.filter(
        (text: string) => {
          const textLength = text.length
          return textLength >= min && textLength <= max
        },
        {
          message: () => `Must be between ${min} and ${max} characters`,
          identifier: `${moduleName}.LengthBetween${min}And${max}`
        }
      )
    )

/**
 * Creates a schema that validates text length is at least min.
 *
 * @since 2.0.0
 * @category validation
 */
export const textLengthMin = (min: number, identifier?: string) =>
  Schema.filter((text: string) => text.length >= min, {
    message: () => `Expected text length at least ${min}`,
    identifier
  })

/**
 * Creates a schema that validates text length is at most max.
 *
 * @since 2.0.0
 * @category validation
 */
export const textLengthMax = (max: number, identifier?: string) =>
  Schema.filter((text: string) => text.length <= max, {
    message: () => `Expected text length at most ${max}`,
    identifier
  })

// =============================================================================
// Text Transformation Utilities
// =============================================================================

// =============================================================================
// Unsafe Helper Functions
// =============================================================================

/**
 * Convert bytes to text (unsafe, no validation).
 *
 * @since 2.0.0
 * @category unsafe
 */
export const fromBytesUnsafe = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

/**
 * Convert text to bytes (unsafe, no validation).
 *
 * @since 2.0.0
 * @category unsafe
 */
export const toBytesUnsafe = (text: string): Uint8Array => new TextEncoder().encode(text)

/**
 * Convert hex to text (unsafe, no validation).
 *
 * @since 2.0.0
 * @category unsafe
 */
export const fromHexUnsafe = (hex: string): string => {
  const bytes = Bytes.fromHexUnsafe(hex)
  return fromBytesUnsafe(bytes)
}

/**
 * Convert text to hex (unsafe, no validation).
 *
 * @since 2.0.0
 * @category unsafe
 */
export const toHexUnsafe = (text: string): string => {
  const bytes = toBytesUnsafe(text)
  return Bytes.toHexUnsafe(bytes)
}

/**
 * FastCheck arbitrary for generating random text strings
 *
 * @since 2.0.0
 * @category testing
 */
export const arbitrary = FastCheck.string()

// =============================================================================
// Public (throwing) API
// =============================================================================

/**
 * Convert bytes to text
 *
 * @since 2.0.0
 * @category conversion
 */
export const fromBytes = Schema.decodeSync(FromBytes)

/**
 * Convert hex string to text
 *
 * @since 2.0.0
 * @category conversion
 */
export const fromHex = Schema.decodeSync(FromHex)

/**
 * Convert text to bytes
 *
 * @since 2.0.0
 * @category conversion
 */
export const toBytes = Schema.encodeSync(FromBytes)

/**
 * Convert text to hex string
 *
 * @since 2.0.0
 * @category conversion
 */
export const toHex = Schema.encodeSync(FromHex)
