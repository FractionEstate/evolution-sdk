import { Effect as Eff, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as CBOR from "./CBOR.js"
import * as Data from "./Data.js"
import * as Redeemer from "./Redeemer.js"

/**
 * Helper for array equality using element-by-element comparison.
 */
const arrayEquals = <A>(a: ReadonlyArray<A>, b: ReadonlyArray<A>): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!Equal.equals(a[i], b[i])) return false
  }
  return true
}

/**
 * Helper for array hashing using element hashes.
 */
const arrayHash = <A>(arr: ReadonlyArray<A>): number => {
  let hash = 0
  for (const item of arr) {
    hash = Hash.combine(hash)(Hash.hash(item))
  }
  return hash
}

/**
 * Encoding format for redeemers collection.
 *
 * Conway CDDL supports two formats:
 * ```
 * ; Flat Array support is included for backwards compatibility and
 * ; will be removed in the next era. It is recommended for tools to
 * ; adopt using a Map instead of Array going forward.
 * redeemers =
 *   [ + redeemer ]
 *   / { + [tag : redeemer_tag, index : uint .size 4] => [ data : plutus_data, ex_units : ex_units ] }
 * ```
 *
 * - "array": Legacy flat array format - backwards compatible, will be deprecated
 * - "map": New map format - recommended for Conway+
 *
 * @since 2.0.0
 * @category model
 */
export type Format = "array" | "map"

/**
 * Redeemers collection based on Conway CDDL specification.
 *
 * Represents a collection of redeemers that can be encoded in either array or map format.
 *
 * @since 2.0.0
 * @category model
 */
export class Redeemers extends Schema.TaggedClass<Redeemers>()("Redeemers", {
  values: Schema.Array(Redeemer.Redeemer)
}) {
  toJSON() {
    return {
      _tag: "Redeemers" as const,
      values: this.values.map((r) => r.toJSON())
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return that instanceof Redeemers && arrayEquals(this.values, that.values)
  }

  [Hash.symbol](): number {
    return Hash.cached(this, arrayHash(this.values))
  }
}

/**
 * CDDL schema for Redeemers in array format.
 *
 * `redeemers = [ + redeemer ]`
 *
 * @since 2.0.0
 * @category schemas
 */
export const ArrayCDDLSchema = Schema.Array(Redeemer.CDDLSchema)

/**
 * CDDL transformation schema for Redeemers array format.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromArrayCDDL = Schema.transformOrFail(ArrayCDDLSchema, Schema.typeSchema(Redeemers), {
  strict: true,
  encode: (toA) => Eff.all(toA.values.map((r) => ParseResult.encode(Redeemer.FromCDDL)(r))),
  decode: (fromA) =>
    Eff.gen(function* () {
      const values = yield* Eff.all(fromA.map((tuple) => ParseResult.decode(Redeemer.FromCDDL)(tuple)))
      return new Redeemers({ values })
    })
})

/**
 * Map key schema: `[tag, index]`
 *
 * @since 2.0.0
 * @category schemas
 */
const MapKeyCDDLSchema = Schema.Tuple(CBOR.Integer, CBOR.Integer)

/**
 * Map value schema: `[data, ex_units]`
 *
 * @since 2.0.0
 * @category schemas
 */
const MapValueCDDLSchema = Schema.Tuple(Data.CDDLSchema, Schema.Tuple(CBOR.Integer, CBOR.Integer))

/**
 * CDDL schema for Redeemers in map format.
 *
 * `{ + [tag, index] => [data, ex_units] }`
 *
 * @since 2.0.0
 * @category schemas
 */
export const MapCDDLSchema = Schema.Map({
  key: MapKeyCDDLSchema,
  value: MapValueCDDLSchema
})

/**
 * CDDL transformation schema for Redeemers map format.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromMapCDDL = Schema.transformOrFail(MapCDDLSchema, Schema.typeSchema(Redeemers), {
  strict: true,
  encode: (toA) =>
    Eff.gen(function* () {
      const entries: Array<
        readonly [
          readonly [bigint, bigint],
          readonly [Schema.Schema.Type<typeof Data.CDDLSchema>, readonly [bigint, bigint]]
        ]
      > = []
      for (const r of toA.values) {
        const tagInteger = Redeemer.tagToInteger(r.tag)
        const dataCBOR = yield* ParseResult.encode(Data.FromCDDL)(r.data)
        entries.push([
          [tagInteger, r.index],
          [dataCBOR, [r.exUnits.mem, r.exUnits.steps]]
        ])
      }
      return new Map(entries)
    }),
  decode: (fromA) =>
    Eff.gen(function* () {
      const values: Array<Redeemer.Redeemer> = []
      for (const [[tagInteger, index], [dataCBOR, [mem, steps]]] of fromA.entries()) {
        const tag = Redeemer.integerToTag(tagInteger)
        const data = yield* ParseResult.decode(Data.FromCDDL)(dataCBOR)
        values.push(new Redeemer.Redeemer({ data, exUnits: new Redeemer.ExUnits({ mem, steps }), index, tag }))
      }
      return new Redeemers({ values })
    })
})

/**
 * Default CDDL schema for Redeemers (array format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const CDDLSchema = ArrayCDDLSchema

/**
 * Default CDDL transformation (array format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCDDL = FromArrayCDDL

/**
 * CBOR bytes transformation schema for Redeemers (array format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromBytes(options), FromArrayCDDL).annotations({
    identifier: "Redeemers.FromCBORBytes",
    title: "Redeemers from CBOR Bytes",
    description: "Transforms CBOR bytes to Redeemers using array format"
  })

/**
 * CBOR hex transformation schema for Redeemers (array format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(Schema.Uint8ArrayFromHex, FromCBORBytes(options)).annotations({
    identifier: "Redeemers.FromCBORHex",
    title: "Redeemers from CBOR Hex",
    description: "Transforms CBOR hex string to Redeemers using array format"
  })

/**
 * CBOR bytes transformation schema for Redeemers (map format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORBytesMap = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromBytes(options), FromMapCDDL).annotations({
    identifier: "Redeemers.FromCBORBytesMap",
    title: "Redeemers from CBOR Bytes (Map)",
    description: "Transforms CBOR bytes to Redeemers using map format"
  })

/**
 * CBOR hex transformation schema for Redeemers (map format).
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORHexMap = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(Schema.Uint8ArrayFromHex, FromCBORBytesMap(options)).annotations({
    identifier: "Redeemers.FromCBORHexMap",
    title: "Redeemers from CBOR Hex (Map)",
    description: "Transforms CBOR hex string to Redeemers using map format"
  })

/**
 * FastCheck arbitrary for Redeemers.
 *
 * @since 2.0.0
 * @category arbitrary
 */
export const arbitrary = FastCheck.array(Redeemer.arbitrary, { maxLength: 5 }).map(
  (values) => new Redeemers({ values })
)

/**
 * Parse Redeemers from CBOR bytes (array format).
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORBytes = (bytes: Uint8Array, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORBytes(options))(bytes)

/**
 * Parse Redeemers from CBOR hex string (array format).
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORHex = (hex: string, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORHex(options))(hex)

/**
 * Parse Redeemers from CBOR bytes (map format).
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORBytesMap = (bytes: Uint8Array, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORBytesMap(options))(bytes)

/**
 * Parse Redeemers from CBOR hex string (map format).
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORHexMap = (hex: string, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORHexMap(options))(hex)

/**
 * Encode Redeemers to CBOR bytes (array format).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytes = (data: Redeemers, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORBytes(options))(data)

/**
 * Encode Redeemers to CBOR hex string (array format).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHex = (data: Redeemers, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORHex(options))(data)

/**
 * Encode Redeemers to CBOR bytes (map format).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytesMap = (data: Redeemers, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORBytesMap(options))(data)

/**
 * Encode Redeemers to CBOR hex string (map format).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHexMap = (data: Redeemers, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORHexMap(options))(data)
