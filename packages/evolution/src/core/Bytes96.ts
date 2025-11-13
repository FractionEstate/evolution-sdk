/**
 * Bytes96 module provides utilities for handling fixed-length and variable-length byte arrays.
 *
 * @since 2.0.0
 */
import { Schema } from "effect"

import * as Bytes from "./Bytes.js"

/**
 * Constant bytes length
 *
 * @since 2.0.0
 * @category constants
 */
export const BYTES_LENGTH = 96

export const BytesSchema = Schema.Uint8ArrayFromSelf.pipe(Bytes.bytesLengthEquals(BYTES_LENGTH))

export const HexSchema = Bytes.HexSchema.pipe(Bytes.hexLengthEquals(BYTES_LENGTH))

/**
 * Schema transformation for fixed-length bytes
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromHex = Bytes.makeBytesTransformation({
  id: `Bytes${BYTES_LENGTH}.Bytes${BYTES_LENGTH}FromHex`,
  stringSchema: HexSchema,
  uint8ArraySchema: BytesSchema,
  decode: Bytes.fromHexUnsafe,
  encode: Bytes.toHexUnsafe
})

export const VariableBytes = Schema.Uint8ArrayFromSelf.pipe(Bytes.bytesLengthBetween(0, BYTES_LENGTH))

/**
 * Schema transformation for variable-length bytes (0..BYTES_LENGTH).
 *
 * @since 2.0.0
 * @category schemas
 */
export const VariableBytesFromHex = Bytes.makeBytesTransformation({
  id: `Bytes${BYTES_LENGTH}.VariableBytes${BYTES_LENGTH}FromHex`,
  stringSchema: Bytes.HexLenientSchema.pipe(Bytes.hexLengthBetween(0, BYTES_LENGTH)),
  uint8ArraySchema: VariableBytes,
  decode: Bytes.fromHexLenient,
  encode: Bytes.toHexLenientUnsafe
})

export const equals = Bytes.equals

// =============================================================================
// Public (throwing) API
// =============================================================================

/**
 * Decode fixed-length hex into bytes.
 *
 * @since 2.0.0
 * @category decoding
 */
export const fromHex = Schema.decodeSync(FromHex)

/**
 * Encode fixed-length bytes to hex.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toHex = Schema.encodeSync(FromHex)

/**
 * Decode variable-length hex (0..BYTES_LENGTH) into bytes.
 *
 * @since 2.0.0
 * @category decoding
 */
export const fromVariableHex = Schema.decodeSync(VariableBytesFromHex)

/**
 * Encode variable-length bytes (0..BYTES_LENGTH) to hex.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toVariableHex = Schema.encodeSync(VariableBytesFromHex)
