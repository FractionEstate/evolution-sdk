import { FastCheck, Schema } from "effect"

import * as Bytes from "./Bytes.js"
import * as Text from "./Text.js"

/**
 * Constants for Text128 validation.
 * text .size (0 .. 128)
 *
 * @since 2.0.0
 * @category constants
 */
export const TEXT128_MIN_LENGTH = 0
export const TEXT128_MAX_LENGTH = 128

/**
 * Schema for Text128 representing a variable-length text string (0-128 chars).
 * text .size (0 .. 128)
 * Follows the Conway-era CDDL specification.
 *
 * @since 2.0.0
 * @category schemas
 */
export const Text128 = Text.Text.pipe(Text.textLengthBetween(TEXT128_MIN_LENGTH, TEXT128_MAX_LENGTH, "Text128"))

export type Text128 = typeof Text128.Type

export const FromVariableBytes = Text.makeTextTransformation({
  id: "Text128.FromBytes",
  to: Text128,
  from: Schema.Uint8ArrayFromSelf
})

export const FromVariableHex = Schema.compose(
  Bytes.BytesFromHexLenient,
  FromVariableBytes // Uint8Array -> Text128
).annotations({
  identifier: "Text128.FromHex"
})

/**
 * Check if the given value is a valid Text128
 *
 * @since 2.0.0
 * @category predicates
 */
export const isText128 = Schema.is(Text128)

/**
 * FastCheck arbitrary for generating random Text128 instances.
 *
 * @since 2.0.0
 * @category arbitrary
 */
export const arbitrary = FastCheck.string({
  minLength: TEXT128_MIN_LENGTH,
  maxLength: TEXT128_MAX_LENGTH
}).map((text) => text as Text128)

// ============================================================================
// Root Functions
// ============================================================================

/**
 * Parse Text128 from bytes (unsafe)
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromBytes = (bytes: Uint8Array): Text128 => Schema.decodeSync(FromVariableBytes)(bytes)

/**
 * Parse Text128 from hex string (unsafe)
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromHex = (hex: string): Text128 => Schema.decodeSync(FromVariableHex)(hex)

/**
 * Encode Text128 to bytes (unsafe)
 *
 * @since 2.0.0
 * @category encoding
 */
export const toBytes = (text: Text128): Uint8Array => Schema.encodeSync(FromVariableBytes)(text)

/**
 * Encode Text128 to hex string (unsafe)
 *
 * @since 2.0.0
 * @category encoding
 */
export const toHex = (text: Text128): string => Schema.encodeSync(FromVariableHex)(text)
