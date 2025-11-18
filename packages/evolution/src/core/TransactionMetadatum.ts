import { Data, Equal, FastCheck, Hash, Schema } from "effect"

import * as CBOR from "./CBOR.js"
import * as Function from "./Function.js"

/**
 * Error class for transaction metadatum related operations.
 *
 * @since 2.0.0
 * @category errors
 */
export class TransactionMetadatumError extends Data.TaggedError("TransactionMetadatumError")<{
  message?: string
  cause?: unknown
}> {}

/**
 * Encoded type for transaction metadata (wire format with string for bigint)
 *
 * @since 2.0.0
 * @category model
 */
export type TransactionMetadatumVariantsEncoded =
  | { readonly _tag: "TextMetadatum"; readonly value: string }
  | { readonly _tag: "IntMetadatum"; readonly value: string }
  | { readonly _tag: "BytesMetadatum"; readonly value: Uint8Array }
  | {
      readonly _tag: "MetadatumMap"
      readonly value: ReadonlyArray<readonly [TransactionMetadatumVariantsEncoded, TransactionMetadatumVariantsEncoded]>
    }
  | { readonly _tag: "ArrayMetadatum"; readonly value: ReadonlyArray<TransactionMetadatumVariantsEncoded> }

/**
 * Runtime type for transaction metadata (bigint at runtime)
 *
 * @since 2.0.0
 * @category model
 */
export type TransactionMetadatumVariants = TextMetadatum | IntMetadatum | BytesMetadatum | MetadatumMap | ArrayMetadatum

/**
 * Schema for text-based transaction metadata.
 *
 * @since 2.0.0
 * @category schemas
 */
export class TextMetadatum extends Schema.TaggedClass<TextMetadatum>("TextMetadatum")("TextMetadatum", {
  value: Schema.String
}) {}

/**
 * Schema for integer-based transaction metadata.
 * Encoded as string, runtime as bigint
 *
 * @since 2.0.0
 * @category schemas
 */
export class IntMetadatum extends Schema.TaggedClass<IntMetadatum>("IntMetadatum")("IntMetadatum", {
  value: Schema.BigInt
}) {}

/**
 * Schema for bytes-based transaction metadata.
 *
 * @since 2.0.0
 * @category schemas
 */
export class BytesMetadatum extends Schema.TaggedClass<BytesMetadatum>("BytesMetadatum")("BytesMetadatum", {
  value: Schema.Uint8ArrayFromSelf
}) {}

/**
 * Schema for map-based transaction metadata.
 *
 * @since 2.0.0
 * @category schemas
 */
export class MetadatumMap extends Schema.TaggedClass<MetadatumMap>("MetadatumMap")("MetadatumMap", {
  value: Schema.Map({
    key: Schema.suspend(
      (): Schema.Schema<TransactionMetadatumVariants, TransactionMetadatumVariantsEncoded> =>
        TransactionMetadatumVariants
    ),
    value: Schema.suspend(
      (): Schema.Schema<TransactionMetadatumVariants, TransactionMetadatumVariantsEncoded> =>
        TransactionMetadatumVariants
    )
  })
}) {}

/**
 * Schema for array-based transaction metadata.
 *
 * @since 2.0.0
 * @category schemas
 */
export class ArrayMetadatum extends Schema.TaggedClass<ArrayMetadatum>("ArrayMetadatum")("ArrayMetadatum", {
  value: Schema.Array(
    Schema.suspend(
      (): Schema.Schema<TransactionMetadatumVariants, TransactionMetadatumVariantsEncoded> =>
        TransactionMetadatumVariants
    )
  )
}) {}

/**
 * Union schema for all types of transaction metadata.
 *
 * @since 2.0.0
 * @category schemas
 */
export const TransactionMetadatumVariants: Schema.Schema<
  TransactionMetadatumVariants,
  TransactionMetadatumVariantsEncoded
> = Schema.Union(TextMetadatum, IntMetadatum, BytesMetadatum, ArrayMetadatum, MetadatumMap).annotations({
  identifier: "TransactionMetadatum",
  description: "A transaction metadata value supporting text, integers, bytes, arrays, and maps"
})

// Add Equal/Hash implementations to variant classes
// @ts-expect-error - Adding Equal symbol to prototype
TextMetadatum.prototype[Equal.symbol] = function (that: unknown): boolean {
  return that instanceof TextMetadatum && this.value === that.value
}
// @ts-expect-error - Adding Hash symbol to prototype
TextMetadatum.prototype[Hash.symbol] = function (): number {
  return Hash.string(this.value)
}

// @ts-expect-error - Adding Equal symbol to prototype
IntMetadatum.prototype[Equal.symbol] = function (that: unknown): boolean {
  return that instanceof IntMetadatum && this.value === that.value
}
// @ts-expect-error - Adding Hash symbol to prototype
IntMetadatum.prototype[Hash.symbol] = function (): number {
  return Hash.number(Number(this.value))
}

// @ts-expect-error - Adding Equal symbol to prototype
BytesMetadatum.prototype[Equal.symbol] = function (that: unknown): boolean {
  if (!(that instanceof BytesMetadatum)) return false
  if (this.value.length !== that.value.length) return false
  for (let i = 0; i < this.value.length; i++) {
    if (this.value[i] !== that.value[i]) return false
  }
  return true
}
// @ts-expect-error - Adding Hash symbol to prototype
BytesMetadatum.prototype[Hash.symbol] = function (): number {
  let h = Hash.string("BytesMetadatum")
  for (let i = 0; i < this.value.length; i++) {
    h = Hash.combine(h)(Hash.number(this.value[i]))
  }
  return h
}

// @ts-expect-error - Adding Equal symbol to prototype
ArrayMetadatum.prototype[Equal.symbol] = function (that: unknown): boolean {
  if (!(that instanceof ArrayMetadatum)) return false
  if (this.value.length !== that.value.length) return false
  for (let i = 0; i < this.value.length; i++) {
    if (!Equal.equals(this.value[i], that.value[i])) return false
  }
  return true
}
// @ts-expect-error - Adding Hash symbol to prototype
ArrayMetadatum.prototype[Hash.symbol] = function (): number {
  let h = Hash.string("ArrayMetadatum")
  for (const item of this.value) {
    h = Hash.combine(h)(Hash.hash(item))
  }
  return h
}

// @ts-expect-error - Adding Equal symbol to prototype
MetadatumMap.prototype[Equal.symbol] = function (that: unknown): boolean {
  if (!(that instanceof MetadatumMap)) return false
  if (this.value.size !== that.value.size) return false
  for (const [key, val] of this.value.entries()) {
    let found = false
    for (const [bKey, bVal] of that.value.entries()) {
      if (Equal.equals(key, bKey)) {
        if (!Equal.equals(val, bVal)) return false
        found = true
        break
      }
    }
    if (!found) return false
  }
  return true
}
// @ts-expect-error - Adding Hash symbol to prototype
MetadatumMap.prototype[Hash.symbol] = function (): number {
  let h = Hash.string("MetadatumMap")
  const entries = Array.from(this.value.entries())
  entries.sort((a, b) => Hash.hash(a[0]) - Hash.hash(b[0]))
  for (const [key, val] of entries) {
    h = Hash.combine(h)(Hash.hash(key))
    h = Hash.combine(h)(Hash.hash(val))
  }
  return h
}

export class TransactionMetadatum extends Schema.Class<TransactionMetadatum>("TransactionMetadatum")({
  variants: TransactionMetadatumVariants
}) {}

/**
 * Type representing the CDDL-compatible format for transaction metadata.
 *
 * @since 2.0.0
 * @category model
 */
export type CDDLSchema = bigint | string | Uint8Array | ReadonlyArray<CDDLSchema> | ReadonlyMap<CDDLSchema, CDDLSchema>

/**
 * Schema for CDDL-compatible transaction metadata format.
 *
 * @since 2.0.0
 * @category schemas
 */
export const CDDLSchema: Schema.Schema<CDDLSchema> = Schema.Union(
  Schema.String,
  Schema.BigIntFromSelf,
  Schema.Uint8ArrayFromSelf,
  Schema.Array(Schema.suspend((): Schema.Schema<CDDLSchema> => CDDLSchema)),
  Schema.ReadonlyMapFromSelf({
    key: Schema.suspend((): Schema.Schema<CDDLSchema> => CDDLSchema),
    value: Schema.suspend((): Schema.Schema<CDDLSchema> => CDDLSchema)
  })
).annotations({
  identifier: "TransactionMetadatum.CDDLSchema",
  description: "CDDL-compatible format for transaction metadata"
})

type encode = (
  toI: TextMetadatum | IntMetadatum | BytesMetadatum | MetadatumMap | ArrayMetadatum,
  toA: TextMetadatum | IntMetadatum | BytesMetadatum | MetadatumMap | ArrayMetadatum
) => CDDLSchema
const encode: encode = (toI, toA) => {
  switch (toI._tag) {
    case "TextMetadatum":
      return toI.value
    case "IntMetadatum":
      return toI.value
    case "BytesMetadatum":
      return toI.value
    case "ArrayMetadatum":
      return toI.value.map((item) => encode(item, toA))
    case "MetadatumMap": {
      const map = new Map<CDDLSchema, CDDLSchema>()
      for (const [key, value] of toI.value.entries()) {
        map.set(encode(key, toA), encode(value, toA))
      }
      return map
    }
  }
}

type decode = (
  fromA: CDDLSchema,
  fromI: CDDLSchema
) => TextMetadatum | IntMetadatum | BytesMetadatum | MetadatumMap | ArrayMetadatum
const decode: decode = (fromA, fromI) => {
  if (typeof fromA === "string") {
    return new TextMetadatum({ value: fromA })
  } else if (typeof fromA === "bigint") {
    return new IntMetadatum({ value: fromA })
  } else if (fromA instanceof Uint8Array) {
    return new BytesMetadatum({ value: fromA })
  } else if (Array.isArray(fromA)) {
    return new ArrayMetadatum({ value: fromA.map((item) => decode(item, fromI)) })
  } else if (fromA instanceof Map) {
    const map = new Map()
    for (const [key, value] of fromA.entries()) {
      map.set(decode(key, fromI), decode(value, fromI))
    }
    return new MetadatumMap({ value: map })
  }
  throw new TransactionMetadatumError({ message: "Invalid CDDL format" })
}

export const FromCDDL = Schema.transform(CDDLSchema, Schema.typeSchema(TransactionMetadatumVariants), {
  strict: true,
  encode,
  decode
}).annotations({
  identifier: "TransactionMetadatum.FromCDDL",
  description: "Transforms CDDL schema to TransactionMetadatum"
})

/**
 * Schema transformer for TransactionMetadatum from CBOR bytes.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromBytes(options), FromCDDL).annotations({
    identifier: "TransactionMetadatum.FromCBORBytes",
    description: "Transforms CBOR bytes to TransactionMetadatum"
  })

/**
 * Schema transformer for TransactionMetadatum from CBOR hex string.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromHex(options), FromCBORBytes(options)).annotations({
    identifier: "TransactionMetadatum.FromCBORHex",
    description: "Transforms CBOR hex string to TransactionMetadatum"
  })

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two TransactionMetadatum instances are equal.
 *
 * @since 2.0.0
 * @category utilities
 */
export const equals = (a: TransactionMetadatumVariants, b: TransactionMetadatumVariants): boolean => {
  if (a._tag !== b._tag) return false

  switch (a._tag) {
    case "TextMetadatum":
      return a.value === (b as TextMetadatum).value
    case "IntMetadatum":
      return a.value === (b as IntMetadatum).value
    case "BytesMetadatum":
      return (
        a.value.length === (b as BytesMetadatum).value.length &&
        a.value.every((byte, i) => byte === (b as BytesMetadatum).value[i])
      )
    case "ArrayMetadatum": {
      const bArray = b as ArrayMetadatum
      return a.value.length === bArray.value.length && a.value.every((item, i) => equals(item, bArray.value[i]))
    }
    case "MetadatumMap": {
      const bMap = b as MetadatumMap
      if (a.value.size !== bMap.value.size) return false
      for (const [key, value] of a.value.entries()) {
        const bValue = Array.from(bMap.value.entries()).find(([bKey]) => equals(key, bKey))?.[1]
        if (!bValue || !equals(value, bValue)) return false
      }
      return true
    }
  }
}

/**
 * FastCheck arbitrary for generating random TransactionMetadatum instances.
 *
 * @since 2.0.0
 * @category testing
 */
const I64_MIN = -(1n << 63n)
const I64_MAX = (1n << 63n) - 1n
const int64Arbitrary = FastCheck.bigInt({ min: I64_MIN, max: I64_MAX })

export const arbitrary: FastCheck.Arbitrary<TransactionMetadatumVariants> = FastCheck.oneof(
  FastCheck.string().map((value) => new TextMetadatum({ value })),
  int64Arbitrary.map((value) => new IntMetadatum({ value })),
  FastCheck.uint8Array({ minLength: 1, maxLength: 10 }).map((value) => new BytesMetadatum({ value })),
  FastCheck.array(
    FastCheck.oneof(
      FastCheck.string().map((value) => new TextMetadatum({ value })),
      int64Arbitrary.map((value) => new IntMetadatum({ value }))
    ),
    { maxLength: 3 }
  ).map((value) => new ArrayMetadatum({ value })),
  FastCheck.uniqueArray(
    FastCheck.tuple(
      FastCheck.string().map((value) => new TextMetadatum({ value })),
      int64Arbitrary.map((value) => new IntMetadatum({ value }))
    ),
    {
      maxLength: 3,
      selector: ([key]) => key.value // Ensure unique keys by their string value
    }
  ).map((entries) => {
    const map = new Map()
    for (const [key, value] of entries) {
      map.set(key, value)
    }
    return new MetadatumMap({ value: map })
  })
)

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a TransactionMetadatum from CBOR bytes.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORBytes = Function.makeCBORDecodeSync(
  FromCDDL,
  TransactionMetadatumError,
  "TransactionMetadatum.fromCBORBytes"
)

/**
 * Parse a TransactionMetadatum from CBOR hex string.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORHex = Function.makeCBORDecodeHexSync(
  FromCDDL,
  TransactionMetadatumError,
  "TransactionMetadatum.fromCBORHex"
)

// ============================================================================
// Encoding Functions
// ============================================================================

/**
 * Convert a TransactionMetadatum to CBOR bytes.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytes = Function.makeCBOREncodeSync(
  FromCDDL,
  TransactionMetadatumError,
  "TransactionMetadatum.toCBORBytes"
)

/**
 * Convert a TransactionMetadatum to CBOR hex string.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHex = Function.makeCBOREncodeHexSync(
  FromCDDL,
  TransactionMetadatumError,
  "TransactionMetadatum.toCBORHex"
)

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TextMetadatum from a string value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const text = (value: string): TextMetadatum => new TextMetadatum({ value })

/**
 * Create an IntMetadatum from a bigint value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const int = (value: bigint): IntMetadatum => new IntMetadatum({ value })

/**
 * Create a BytesMetadatum from a Uint8Array value.
 *
 * @since 2.0.0
 * @category constructors
 */
export const bytes = (value: Uint8Array): BytesMetadatum => new BytesMetadatum({ value })

/**
 * Create an ArrayMetadatum from an array of TransactionMetadatum values.
 *
 * @since 2.0.0
 * @category constructors
 */
export const array = (value: Array<TransactionMetadatumVariants>): ArrayMetadatum => new ArrayMetadatum({ value })

/**
 * Create a MetadatumMap from a Map of TransactionMetadatum key-value pairs.
 *
 * @since 2.0.0
 * @category constructors
 */
export const map = (value: Map<TransactionMetadatumVariants, TransactionMetadatumVariants>): MetadatumMap =>
  new MetadatumMap({ value })

// ============================================================================
// Effect Namespace - Effect-based Error Handling
// ============================================================================

/**
 * Effect-based error handling variants for functions that can fail.
 *
 * @since 2.0.0
 * @category effect
 */
export namespace Either {
  /**
   * Parse a TransactionMetadatum from CBOR bytes with Effect error handling.
   *
   * @since 2.0.0
   * @category parsing
   */
  export const fromCBORBytes = Function.makeCBORDecodeEither(FromCDDL, TransactionMetadatumError)

  /**
   * Parse a TransactionMetadatum from CBOR hex string with Effect error handling.
   *
   * @since 2.0.0
   * @category parsing
   */
  export const fromCBORHex = Function.makeCBORDecodeHexEither(FromCDDL, TransactionMetadatumError)

  /**
   * Convert a TransactionMetadatum to CBOR bytes with Effect error handling.
   *
   * @since 2.0.0
   * @category encoding
   */
  export const toCBORBytes = Function.makeCBOREncodeEither(FromCDDL, TransactionMetadatumError)

  /**
   * Convert a TransactionMetadatum to CBOR hex string with Effect error handling.
   *
   * @since 2.0.0
   * @category encoding
   */
  export const toCBORHex = Function.makeCBOREncodeHexEither(FromCDDL, TransactionMetadatumError)
}
