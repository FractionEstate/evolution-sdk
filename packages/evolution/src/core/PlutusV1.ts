import { Equal, FastCheck, Hash, Inspectable, Schema } from "effect"

import * as CBOR from "./CBOR.js"

/**
 * Plutus V1 script wrapper (raw bytes).
 *
 * @since 2.0.0
 * @category model
 */
export class PlutusV1 extends Schema.TaggedClass<PlutusV1>("PlutusV1")("PlutusV1", {
  bytes: Schema.Uint8ArrayFromHex
}) {
  /**
   * Convert to JSON representation.
   *
   * @since 2.0.0
   * @category conversions
   */
  toJSON() {
    return {
      _tag: "PlutusV1",
      bytes: this.bytes
    }
  }

  /**
   * Convert to string representation.
   *
   * @since 2.0.0
   * @category conversions
   */
  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  /**
   * Custom inspect for Node.js REPL.
   *
   * @since 2.0.0
   * @category conversions
   */
  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  /**
   * Structural equality check.
   *
   * @since 2.0.0
   * @category equality
   */
  [Equal.symbol](that: unknown): boolean {
    return that instanceof PlutusV1 && Equal.equals(this.bytes, that.bytes)
  }

  /**
   * Hash code generation.
   *
   * @since 2.0.0
   * @category hashing
   */
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash(this.bytes))
  }
}

/**
 * CDDL schema for PlutusV1 scripts as raw bytes.
 *
 * @since 2.0.0
 * @category schemas
 */
export const CDDLSchema = CBOR.ByteArray

/**
 * CDDL transformation schema for PlutusV1.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCDDL = Schema.transform(CDDLSchema, Schema.typeSchema(PlutusV1), {
  strict: true,
  encode: (toI) => toI.bytes,
  decode: (fromA) => new PlutusV1({ bytes: fromA })
})

/**
 * FastCheck arbitrary for PlutusV1.
 *
 * @since 2.0.0
 * @category arbitrary
 */
export const arbitrary: FastCheck.Arbitrary<PlutusV1> = FastCheck.uint8Array({ minLength: 1, maxLength: 512 }).map(
  (script) => new PlutusV1({ bytes: script })
)
