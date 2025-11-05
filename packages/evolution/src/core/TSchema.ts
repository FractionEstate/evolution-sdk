import type { SchemaAST } from "effect"
import { Effect, ParseResult, Schema } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import * as Data from "./Data.js"

export interface ByteArray extends Schema.Schema<string, string, never> {}

/**
 * Schema transformations between TypeScript types and Plutus Data
 *
 * This module provides bidirectional transformations:
 * 1. TypeScript types => Plutus Data type => CBOR hex
 * 2. CBOR hex => Plutus Data type => TypeScript types
 */

/**
 * ByteArray schema for PlutusData hex strings.
 * Since Data.ByteArray is now hex string based, this is just an alias to it.
 *
 * @since 2.0.0
 * @category schemas
 */
export const ByteArray: ByteArray = Data.ByteArray

/**
 * HexString schema that transforms hex string to ByteArray for PlutusData.
 * This transforms from hex string to Uint8Array (runtime Data type) and back.
 *
 * @since 2.0.0
 * @category schemas
 */
export const HexString = Schema.transform(Schema.Uint8ArrayFromSelf, Schema.String, {
  strict: true,
  encode: (hex: string) => {
    // Convert hex string to Uint8Array
    if (hex.length % 2 !== 0) {
      throw new Error("Invalid hex string length")
    }
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  },
  decode: (bytes: Uint8Array) => {
    // Convert Uint8Array to hex string
    return globalThis.Array.from(bytes, (byte: number) => byte.toString(16).padStart(2, "0")).join("")
  }
})

export interface Integer extends Schema.SchemaClass<bigint, bigint, never> {}

/**
 * Integer schema that represents Data.Int for PlutusData.
 * This enables withSchema compatibility by using the Data type schema directly.
 *
 * @since 2.0.0
 * @category schemas
 */
export const Integer: Integer = Schema.typeSchema(Data.IntSchema)

interface Literal<Literals extends NonEmptyReadonlyArray<SchemaAST.LiteralValue>>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.Literal<[...Literals]>> {}

/**
 * Creates a schema for literal types with Plutus Data Constructor transformation
 *
 * @since 2.0.0
 */
export const Literal = <Literals extends NonEmptyReadonlyArray<Exclude<SchemaAST.LiteralValue, null | bigint>>>(
  ...self: Literals
): Literal<Literals> =>
  Schema.transform(Schema.typeSchema(Data.Constr), Schema.Literal(...self), {
    strict: true,
    encode: (value) => new Data.Constr({ index: BigInt(self.indexOf(value)), fields: [] }),
    decode: (value) => self[Number(value.index)]
  })

interface OneLiteral<Single extends Exclude<SchemaAST.LiteralValue, null | bigint>>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.Literal<[Single]>> {}

export const OneLiteral = <Single extends Exclude<SchemaAST.LiteralValue, null | bigint>>(
  self: Single
): OneLiteral<Single> =>
  Schema.transform(Schema.typeSchema(Data.Constr), Schema.Literal(self), {
    strict: true,

    encode: (_value) => new Data.Constr({ index: 0n, fields: [] }),

    decode: (_value) => self
  })

interface Array<S extends Schema.Schema.Any> extends Schema.Array$<S> {}

/**
 * Creates a schema for arrays - just passes through to Schema.Array directly
 *
 * @since 1.0.0
 */
export const Array = <S extends Schema.Schema.Any>(items: S): Array<S> => Schema.Array(items)

interface Map<K extends Schema.Schema.Any, V extends Schema.Schema.Any>
  extends Schema.transform<
    Schema.SchemaClass<globalThis.Map<Data.Data, Data.Data>, globalThis.Map<Data.Data, Data.Data>, never>,
    Schema.MapFromSelf<K, V>
  > {}

/**
 * Creates a schema for maps with Plutus Map type annotation
 * Maps are represented as a list of constructor pairs, where each pair
 * is a constructor with index 0 and fields [key, value]
 *
 * @since 1.0.0
 */
export const Map = <K extends Schema.Schema.Any, V extends Schema.Schema.Any>(key: K, value: V): Map<K, V> =>
  Schema.transform(Schema.typeSchema(Data.MapSchema), Schema.MapFromSelf({ key, value }), {
    strict: false,
    encode: (tsMap) => {
      // Transform TypeScript Map<K_TS, V_TS> to Data Map<K_Data, V_Data>
      // The individual key/value transformations are handled by the schema framework
      return new globalThis.Map([...tsMap])
    },
    decode: (dataMap) => {
      // Transform Data Map<K_Data, V_Data> to TypeScript Map<K_TS, V_TS>
      // The individual key/value transformations are handled by the schema framework
      return new globalThis.Map([...dataMap])
    }
  })

interface NullOr<S extends Schema.Schema.All>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.NullOr<S>> {}

/**
 * Creates a schema for nullable types that transforms to/from Plutus Data Constructor
 * Represents optional values as:
 * - Just(value) with index 0
 * - Nothing with index 1
 *
 * @since 2.0.0
 */
export const NullOr = <S extends Schema.Schema.All>(self: S): NullOr<S> =>
  Schema.transform(Schema.typeSchema(Data.Constr), Schema.NullOr(self), {
    strict: true,
    encode: (value) =>
      value === null ? new Data.Constr({ index: 1n, fields: [] }) : new Data.Constr({ index: 0n, fields: [value] }),
    decode: (value) => (value.index === 1n ? null : (value.fields[0] as Schema.Schema.Type<S>))
  })

interface UndefineOr<S extends Schema.Schema.Any>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.UndefinedOr<S>> {}

/**
 * Creates a schema for undefined types that transforms to/from Plutus Data Constructor
 * Represents optional values as:
 * - Just(value) with index 0
 * - Nothing with index 1
 *
 * @since 2.0.0
 */
export const UndefinedOr = <S extends Schema.Schema.Any>(self: S): UndefineOr<S> =>
  Schema.transform(Schema.typeSchema(Data.Constr), Schema.UndefinedOr(self), {
    strict: true,
    encode: (value) =>
      value === undefined
        ? new Data.Constr({ index: 1n, fields: [] })
        : new Data.Constr({ index: 0n, fields: [value] }),
    decode: (value) => (value.index === 1n ? undefined : (value.fields[0] as Schema.Schema.Type<S>))
  })

interface Boolean
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, typeof Schema.Boolean> {}

/**
 * Schema for boolean values using Plutus Data Constructor
 * - False with index 0
 * - True with index 1
 *
 * @since 2.0.0
 */
export const Boolean: Boolean = Schema.transform(
  Schema.typeSchema(Data.Constr),
  Schema.Boolean.annotations({
    identifier: "TSchema.Boolean"
  }),
  {
    strict: true,
    encode: (boolean) =>
      boolean ? new Data.Constr({ index: 1n, fields: [] }) : new Data.Constr({ index: 0n, fields: [] }),
    decode: ({ fields, index }) => {
      if (index !== 0n && index !== 1n) {
        throw new Error(`Expected constructor index to be 0 or 1, got ${index}`)
      }
      if (fields.length !== 0) {
        throw new Error("Expected a constructor with no fields")
      }
      return index === 1n
    }
  }
).annotations({
  identifier: "TSchema.BooleanFromConstr"
})

interface Struct<Fields extends Schema.Struct.Fields>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.Struct<Fields>> {}

/**
 * Options for Struct schema
 */
export interface StructOptions {
  /**
   * Custom Constr index for this struct (default: 0)
   * Useful when creating union variants with specific indices
   */
  index?: number
  /**
   * When used in a Union, controls whether this Struct should be "flattened" (unwrapped).
   * - true: Encodes as Constr(index, [fields]) directly
   * - false: Encodes as Constr(unionPos, [Constr(index, [fields])]) (nested)
   * 
   * Default: true when index is specified, false otherwise
   */
  flat?: boolean
}

/**
 * Creates a schema for struct types using Plutus Data Constructor
 * Objects are represented as a constructor with index (default 0) and fields as an array
 *
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Default: nested in Union, index 0
 * TSchema.Struct({ name: TSchema.ByteArray, age: TSchema.Integer })
 * ```
 *
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Flat union variants with custom indices
 * TSchema.Struct({ amount: TSchema.Integer }, { index: 121, flat: true })
 * TSchema.Struct({ amount: TSchema.Integer }, { index: 122, flat: true })
 * ```
 * 
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Custom index but stay nested (advanced use case)
 * TSchema.Struct({ data: TSchema.Integer }, { index: 10, flat: false })
 * ```
 *
 * @since 2.0.0
 */
export const Struct = <Fields extends Schema.Struct.Fields>(
  fields: Fields,
  options: StructOptions = {}
): Struct<Fields> => {
  const { flat, index = 0 } = options
  
  // Default: flat is true when index is explicitly set, false otherwise
  const isFlat = flat ?? (options.index !== undefined)

  return Schema.transform(Schema.typeSchema(Data.Constr), Schema.Struct(fields), {
    strict: false,
    encode: (encodedStruct) => {
      // encodedStruct is the result of Schema.Struct(fields), which has already transformed all fields
      return new Data.Constr({
        index: BigInt(index),
        fields: Object.values(encodedStruct)
      })
    },
    decode: (fromA) => {
      const keys = Object.keys(fields)
      const result = {} as Record<string, Data.Data>
      keys.forEach((key, index) => {
        result[key] = fromA.fields[index]
      })
      return result as { [K in keyof Schema.Struct.Encoded<Fields>]: Schema.Struct.Encoded<Fields>[K] }
    }
  }).annotations({
    identifier: "TSchema.Struct",
    // Store the custom index in annotations so Union can detect it
    // Store explicitly even if index is 0, to distinguish from default
    ["TSchema.customIndex"]: options.index !== undefined ? index : undefined,
    // Store flat setting so Union knows whether to unwrap this Struct
    ["TSchema.flat"]: isFlat
  })
}

interface Union<Members extends ReadonlyArray<Schema.Schema.Any>>
  extends Schema.transformOrFail<
    Schema.SchemaClass<Data.Constr, Data.Constr, never>,
    Schema.SchemaClass<Schema.Schema.Type<[...Members][number]>, Schema.Schema.Type<[...Members][number]>, never>,
    never
  > {}

/**
 * Creates a schema for union types using Plutus Data Constructor
 * Unions are represented as a constructor with index 0, 1, 2... and fields as an array
 *
 * Members marked with flat: true will be encoded directly using their index
 * instead of being wrapped in an additional Constr layer.
 *
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Standard union with auto indices (nested)
 * TSchema.Union(
 *   TSchema.Struct({ a: TSchema.Integer }),
 *   TSchema.Struct({ b: TSchema.Integer })
 * )
 * // Encodes to: Constr(0, [Constr(0, [a])]) or Constr(1, [Constr(0, [b])])
 * ```
 *
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Union with flat Structs (single-level encoding)
 * TSchema.Union(
 *   TSchema.Struct({ amount: TSchema.Integer }, { index: 121, flat: true }),
 *   TSchema.Struct({ amount: TSchema.Integer }, { index: 122, flat: true })
 * )
 * // Encodes to: Constr(121, [amount]) or Constr(122, [amount]) - single level!
 * ```
 * 
 * @example
 * ```typescript
 * import { TSchema } from "@evolution-sdk/evolution"
 * 
 * // Mixed union: some nested, some flat
 * TSchema.Union(
 *   TSchema.Struct({ a: TSchema.Integer }),  // nested, auto index 0
 *   TSchema.Struct({ b: TSchema.Integer }, { flat: true }),  // flat, auto index 1
 *   TSchema.Struct({ c: TSchema.Integer }, { index: 100, flat: true })  // flat, custom index 100
 * )
 * ```
 *
 * @since 2.0.0
 */
export const Union = <Members extends ReadonlyArray<Schema.Schema.Any>>(...members: Members): Union<Members> => {
  // Extract member metadata from annotations
  const memberInfos = members.map((member, position) => {
    const customIndex = member.ast.annotations?.["TSchema.customIndex"] as number | undefined
    const isFlat = (member.ast.annotations?.["TSchema.flat"] as boolean | undefined) ?? false
    
    return {
      schema: member,
      position,           // Position in the members array
      customIndex,        // Custom index if set, undefined otherwise
      isFlat              // Whether this member should be flat in the union
    }
  })

  // Detect index collisions
  // Collisions can occur in two scenarios:
  // 1. A flat member's index equals the position of a non-flat member
  // 2. Two flat members have the same index (both would encode to same Constr index)
  const collisions = new globalThis.Array<{
    type: "flat-to-nested" | "flat-to-flat"
    position1: number
    position2: number
    conflictingIndex: number
  }>()

  memberInfos.forEach((member1, pos1) => {
    if (member1.isFlat) {
      const index1 = member1.customIndex ?? member1.position
      
      // Check for flat-to-nested collisions
      memberInfos.forEach((member2, pos2) => {
        if (!member2.isFlat && index1 === member2.position) {
          collisions.push({
            type: "flat-to-nested",
            position1: pos1,
            position2: pos2,
            conflictingIndex: index1
          })
        }
      })
      
      // Check for flat-to-flat collisions (only check positions after current to avoid duplicates)
      memberInfos.forEach((member2, pos2) => {
        if (pos2 > pos1 && member2.isFlat) {
          const index2 = member2.customIndex ?? member2.position
          if (index1 === index2) {
            collisions.push({
              type: "flat-to-flat",
              position1: pos1,
              position2: pos2,
              conflictingIndex: index1
            })
          }
        }
      })
    }
  })

  if (collisions.length > 0) {
    const collisionDetails = collisions
      .map((collision) => {
        if (collision.type === "flat-to-nested") {
          return `flat member at position ${collision.position1} with index ${collision.conflictingIndex} conflicts with nested member at position ${collision.position2}`
        } else {
          return `flat members at positions ${collision.position1} and ${collision.position2} both use index ${collision.conflictingIndex}`
        }
      })
      .join("; ")

    const errorMessage =
      `[TSchema.Union] Index collision detected: ${collisionDetails}. ` +
      `Flat members' indices must not equal the array position of nested members, and each flat member must have a unique index. ` +
      `Recommendation: Use indices 100+ for flat members to avoid collision with auto-indices, or set flat: false.`

    throw new Error(errorMessage)
  }

  // Get readable names for each member schema for better error messages
  const getMemberNames = () => {
    return members.map((member, index) => {
      const ast = member.ast
      if (ast._tag === "Transformation" && ast.annotations && ast.annotations["identifier"]) {
        const identifier = ast.annotations["identifier"] as string
        return identifier.replace("TSchema.", "").toLowerCase()
      }
      return `option ${index + 1}`
    })
  }

  return Schema.transformOrFail(Schema.typeSchema(Data.Constr), Schema.typeSchema(Schema.Union(...members)), {
    strict: false,
    encode: (value) =>
      Effect.gen(function* () {
        // Find which member matches this value
        const matchedIndex = members.findIndex((schema) => Schema.is(schema)(value))

        if (matchedIndex === -1) {
          const memberNames = getMemberNames()
          const actualType =
            typeof value === "bigint"
              ? "bigint"
              : typeof value === "object" && value !== null && (value as unknown) instanceof Map
                ? "Map"
                : typeof value === "object" && value !== null && globalThis.Array.isArray(value)
                  ? "array"
                  : typeof value

          return yield* Effect.fail(
            new ParseResult.Type(
              Schema.Union(...members).ast,
              value,
              `Invalid value for Union: received ${actualType} (${JSON.stringify(value)}), expected ${memberNames.join(" or ")}`
            )
          )
        }

        const memberInfo = memberInfos[matchedIndex]
        const encodedValue = yield* ParseResult.encode(memberInfo.schema as Schema.Schema<any, any, never>)(value)

        // If the member is flat, use its encoded value directly (unwrap the Constr)
        if (memberInfo.isFlat && encodedValue instanceof Data.Constr) {
          // If the member has no custom index, we need to use the auto index
          if (memberInfo.customIndex === undefined) {
            return new Data.Constr({
              index: BigInt(memberInfo.position),
              fields: encodedValue.fields
            })
          }
          // Return the encoded Constr as-is (it already has the custom index)
          return encodedValue
        }

        // Otherwise, wrap in Union's Constr with auto index (position)
        return new Data.Constr({
          index: BigInt(memberInfo.position),
          fields: [encodedValue]
        })
      }),
    decode: (value, _, ast) => {
      // Try to find a flat member with matching index first
      const flatMemberIndex = Number(value.index)
      const flatMember = memberInfos.find((m) => {
        const memberIndex = m.customIndex ?? m.position
        return m.isFlat && memberIndex === flatMemberIndex
      })

      if (flatMember) {
        // This is a flat Struct, decode it directly (no unwrapping needed)
        return ParseResult.decode(flatMember.schema)(value)
      }

      // Otherwise, use standard Union decoding with auto index
      const memberIndex = Number(value.index)

      // Check if index is valid for the members array
      if (memberIndex < 0 || memberIndex >= members.length) {
        return ParseResult.fail(
          new ParseResult.Type(
            ast,
            value,
            `Invalid union index: ${memberIndex}. Expected index between 0 and ${members.length - 1}`
          )
        )
      }

      // Get the member schema for this index
      const member = members[memberIndex] as Schema.Schema<any, any, never>

      // If the member schema expects a Data.Constr (like Boolean),
      // we need to reconstruct the original Constr structure
      // For primitive types, we use the first field
      if (value.fields.length === 0) {
        // This is likely a Boolean-like case where the original Constr had no fields
        // Reconstruct the original Constr structure
        return ParseResult.decode(member)(new Data.Constr({ index: 0n, fields: [] }))
      } else if (value.fields.length === 1) {
        // This could be either a primitive value or a Constr that was flattened
        return ParseResult.decode(member)(value.fields[0])
      } else {
        // Multiple fields - reconstruct as a Constr with index 0
        // This handles cases where the original Constr had multiple fields
        return ParseResult.decode(member)(new Data.Constr({ index: 0n, fields: [...value.fields] }))
      }
    }
  }).annotations({
    identifier: "TSchema.Union",
    message: (issue) => {
      const memberNames = getMemberNames()
      const actual = issue.actual
      const actualType =
        typeof actual === "bigint"
          ? "bigint"
          : typeof actual === "object" && actual !== null && (actual as unknown) instanceof Map
            ? "Map"
            : typeof actual === "object" && actual !== null && globalThis.Array.isArray(actual)
              ? "array"
              : typeof actual

      return `Invalid value for Union: received ${actualType} (${JSON.stringify(actual)}), expected ${memberNames.join(" or ")}`
    }
  }) as Union<Members>
}

interface Tuple<Elements extends Schema.TupleType.Elements> extends Schema.Tuple<Elements> {}
/**
 * Creates a schema for tuple types - just passes through to Schema.Tuple directly
 *
 * @since 2.0.0
 */
export const Tuple = <Elements extends Schema.TupleType.Elements>(element: [...Elements]): Tuple<Elements> =>
  Schema.Tuple(...element).annotations({
    identifier: "Tuple"
  }) as Tuple<Elements>

export const compose = Schema.compose

export const filter = Schema.filter

export const is = Schema.is
