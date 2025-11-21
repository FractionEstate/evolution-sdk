import type { SchemaAST } from "effect"
import { Effect, ParseResult, Schema } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"

import * as Data from "./Data.js"

/**
 * Known tag field names for auto-detection in discriminated unions.
 * Fields with these names containing Literal values will be automatically
 * stripped during encoding and injected during decoding.
 */
const KNOWN_TAG_FIELDS = ["_tag", "type", "kind", "variant"] as const

/**
 * Helper to detect if a schema field contains a Literal value
 * Used for auto-detection of tag fields in discriminated unions
 */
const getLiteralFieldValue = (schema: Schema.Schema.Any, fieldName: string): any | undefined => {
  const ast = schema.ast

  // Check if this is a Struct (TypeLiteral or Transformation to TypeLiteral)
  let typeLiteral: any
  if (ast._tag === "TypeLiteral") {
    typeLiteral = ast
  } else if (ast._tag === "Transformation" && (ast as any).to._tag === "TypeLiteral") {
    typeLiteral = (ast as any).to
  } else {
    return undefined
  }

  // Find the property signature for this field name
  const propertySignatures = typeLiteral.propertySignatures || []
  const propSig = propertySignatures.find((sig: any) => sig.name === fieldName)
  if (!propSig) return undefined

  // Check if the property type is a Literal or a Transformation to Literal
  const propType = propSig.type

  // Direct Literal (Schema.Literal)
  if (propType._tag === "Literal") {
    return (propType as any).literal
  }

  // TSchema.Literal (Transformation from Constr to Literal)
  if (propType._tag === "Transformation") {
    const transformTo = (propType as any).to
    if (transformTo._tag === "Literal") {
      return (transformTo as any).literal
    }
  }

  return undefined
}

export interface ByteArray extends Schema.Schema<Uint8Array, Uint8Array, never> {}

/**
 * Schema transformations between TypeScript types and Plutus Data
 *
 * This module provides bidirectional transformations:
 * 1. TypeScript types => Plutus Data type => CBOR hex
 * 2. CBOR hex => Plutus Data type => TypeScript types
 *
 * It also exports utility functions for working with schemas:
 * - `equivalence`: Creates optimized equality comparison functions
 * - `is`: Type guard for schema validation
 * - `compose`: Combines schemas
 * - `filter`: Adds refinements to schemas
 */

/**
 * ByteArray schema for PlutusData - runtime Uint8Array, encoded as hex string.
 *
 * @since 2.0.0
 * @category schemas
 */
export const ByteArray: ByteArray = Schema.typeSchema(Data.ByteArray)

export interface Integer extends Schema.SchemaClass<bigint, bigint, never> {}

/**
 * Integer schema that represents Data.Int for PlutusData.
 * This enables withSchema compatibility by using the Data type schema directly.
 *
 * @since 2.0.0
 * @category schemas
 */
export const Integer: Integer = Schema.typeSchema(Data.IntSchema)

export interface Literal<Literals extends NonEmptyReadonlyArray<SchemaAST.LiteralValue>>
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

export interface OneLiteral<Single extends Exclude<SchemaAST.LiteralValue, null | bigint>>
  extends Schema.transform<Schema.SchemaClass<Data.Constr, Data.Constr, never>, Schema.Literal<[Single]>> {}

export const OneLiteral = <Single extends Exclude<SchemaAST.LiteralValue, null | bigint>>(
  self: Single
): OneLiteral<Single> =>
  Schema.transform(Schema.typeSchema(Data.Constr), Schema.Literal(self), {
    strict: true,

    encode: (_value) => new Data.Constr({ index: 0n, fields: [] }),

    decode: (_value) => self
  })

export interface Array<S extends Schema.Schema.Any> extends Schema.Array$<S> {}

/**
 * Creates a schema for arrays - just passes through to Schema.Array directly
 *
 * @since 1.0.0
 */
export const Array = <S extends Schema.Schema.Any>(items: S): Array<S> => Schema.Array(items)

export interface Map<K extends Schema.Schema.Any, V extends Schema.Schema.Any>
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

export interface NullOr<S extends Schema.Schema.All>
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

export interface UndefineOr<S extends Schema.Schema.Any>
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

export interface Boolean
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

export interface Struct<Fields extends Schema.Struct.Fields>
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
  flatInUnion?: boolean
  /**
   * When used as a field in a parent Struct, controls whether this Struct's fields
   * should be spread (merged) into the parent's field array.
   * - true: Inner Struct fields are merged directly into parent
   * - false: Inner Struct is kept as a nested Constr
   *
   * Default: false
   *
   * Note: This only applies when the Struct is a field value, not when used in Union.
   */
  flatFields?: boolean
  /**
   * Name of a field to treat as a discriminant tag (e.g., "_tag", "type").
   *
   * Auto-detection: Fields named "_tag", "type", "kind", or "variant" containing
   * Literal values are automatically stripped from CBOR encoding and injected during decoding.
   *
   * This option allows you to:
   * - Explicitly specify a custom tag field name
   * - Disable auto-detection with `tagField: false`
   *
   * Default: auto-detect from KNOWN_TAG_FIELDS
   */
  tagField?: string | false
}

/**
 * Creates a schema for struct types using Plutus Data Constructor
 * Objects are represented as a constructor with index (default 0) and fields as an array
 *
 * @since 2.0.0
 */
export const Struct = <Fields extends Schema.Struct.Fields>(
  fields: Fields,
  options: StructOptions = {}
): Struct<Fields> => {
  const { flatFields, flatInUnion, index = 0, tagField } = options

  // flatInUnion defaults to true when index is specified
  const isFlatInUnion = flatInUnion ?? options.index !== undefined
  const isFlatFields = flatFields ?? false

  // Auto-detect tag field: find a field with a known tag name that contains a Literal
  let detectedTagField: string | undefined
  if (tagField !== false) {
    const explicitTag = typeof tagField === "string" ? tagField : undefined
    if (explicitTag) {
      detectedTagField = explicitTag
    } else {
      // Auto-detect from known tag field names
      for (const knownTag of KNOWN_TAG_FIELDS) {
        const fieldSchema = (fields as any)[knownTag]
        if (fieldSchema) {
          // Check if this field is a Literal (either TSchema.Literal or Schema.Literal)
          const ast = fieldSchema.ast
          if (ast._tag === "Literal") {
            detectedTagField = knownTag
            break
          }
          // Also check for transformed literals (TSchema.Literal)
          if (ast._tag === "Transformation") {
            const toAST = (ast as any).to
            if (toAST._tag === "Literal") {
              detectedTagField = knownTag
              break
            }
          }
        }
      }
    }
  }

  return Schema.transform(Schema.typeSchema(Data.Constr), Schema.Struct(fields), {
    strict: false,
    encode: (encodedStruct) => {
      // encodedStruct is the result of Schema.Struct(fields), which has already transformed all fields

      // Use Object.keys(fields) to preserve schema definition order
      // rather than Object.entries(encodedStruct) which would use runtime object order
      const orderedKeys = Object.keys(fields).filter((key) => key !== detectedTagField)
      const fieldValues = orderedKeys.map((key) => encodedStruct[key as keyof typeof encodedStruct]) as ReadonlyArray<Data.Data>

      // Check if any field values are Constrs with flatFields:true
      // If so, spread their fields into this Struct's field array
      const finalFields = new globalThis.Array<Data.Data>()

      for (const fieldValue of fieldValues) {
        // Check if this field is a Constr from a flatFields Struct
        if (fieldValue instanceof Data.Constr && (fieldValue as any)["__flatFields__"] === true) {
          // Spread its fields into the parent
          finalFields.push(...fieldValue.fields)
        } else {
          finalFields.push(fieldValue)
        }
      }

      const constr = new Data.Constr({
        index: BigInt(index),
        fields: finalFields
      })

      // Mark this Constr if it was created with flatFields so parent can detect it
      if (isFlatFields) {
        ;(constr as any)["__flatFields__"] = true
      }

      return constr
    },
    decode: (fromA) => {
      const keys = Object.keys(fields)
      const fieldSchemas = Object.values(fields) as ReadonlyArray<Schema.Schema.Any>
      const result = {} as Record<string, Data.Data>

      let fieldIndex = 0
      keys.forEach((key, keyIndex) => {
        // Skip the tag field during decoding - we'll inject it after
        if (key === detectedTagField) {
          return
        }

        const fieldSchema = fieldSchemas[keyIndex]
        const fieldAnnotations = fieldSchema.ast.annotations

        // Check if this field is a flatFields Struct
        const isFieldFlat = fieldAnnotations?.["TSchema.flatFields"] === true

        if (isFieldFlat && fieldSchema.ast._tag === "Transformation") {
          // This is a flat Struct - we need to reconstruct it from multiple fields
          // Get the inner Struct fields count
          const transformAST = fieldSchema.ast as any
          const toAST = transformAST.to

          // For a Struct, the number of fields is the number of property signatures
          const propertySignatures = (
            toAST._tag === "TypeLiteral" ? toAST.propertySignatures : []
          ) as ReadonlyArray<any>
          const numInnerFields = propertySignatures.length

          // Extract the fields for this nested Struct
          const nestedFields = fromA.fields.slice(fieldIndex, fieldIndex + numInnerFields)

          // Reconstruct as a Constr for the nested Struct to decode
          const nestedConstr = new Data.Constr({
            index: 0n, // flatFields Structs don't preserve their index
            fields: nestedFields
          })

          result[key] = nestedConstr
          fieldIndex += numInnerFields
        } else {
          // Regular field - take one value from the fields array
          result[key] = fromA.fields[fieldIndex]
          fieldIndex++
        }
      })

      // Inject the tag field if detected
      // We need to inject it as the ENCODED form (Constr), not the decoded form (literal string),
      // because Effect Schema will decode it using the field schema
      if (detectedTagField && fields[detectedTagField]) {
        const tagSchema = fields[detectedTagField]
        const ast = tagSchema.ast

        // Extract the Literal value and convert it to its encoded Constr form
        let literalValue: any
        if (ast._tag === "Literal") {
          // Schema.Literal
          literalValue = (ast as any).literal
        } else if (ast._tag === "Transformation") {
          // TSchema.Literal (transform from Constr to Literal)
          const toAST = (ast as any).to
          if (toAST._tag === "Literal") {
            literalValue = (toAST as any).literal
          }
        }

        // Encode the literal value as a Constr - TSchema.Literal encodes to Constr(index: 0, fields: [])
        // Schema.Literal would also encode the same way (for a single literal value)
        if (literalValue !== undefined) {
          result[detectedTagField] = new Data.Constr({ index: 0n, fields: [] })
        }
      }

      return result as { [K in keyof Schema.Struct.Encoded<Fields>]: Schema.Struct.Encoded<Fields>[K] }
    }
  }).annotations({
    identifier: "TSchema.Struct",
    // Store the custom index in annotations so Union can detect it
    // Store explicitly even if index is 0, to distinguish from default
    ["TSchema.customIndex"]: options.index !== undefined ? index : undefined,
    // Store flatInUnion setting so Union knows whether to unwrap this Struct
    ["TSchema.flatInUnion"]: isFlatInUnion,
    // Store flatFields for recursive detection
    ["TSchema.flatFields"]: isFlatFields
  })
}

export interface Union<Members extends ReadonlyArray<Schema.Schema.Any>>
  extends Schema.transformOrFail<
    Schema.SchemaClass<Data.Constr, Data.Constr, never>,
    Schema.SchemaClass<Schema.Schema.Type<Members[number]>, Schema.Schema.Type<Members[number]>, never>,
    never
  > {}

/**
 * Creates a schema for union types using Plutus Data Constructor
 * Unions are represented as a constructor with index 0, 1, 2... and fields as an array
 *
 * Members marked with flat: true will be encoded directly using their index
 * instead of being wrapped in an additional Constr layer.
 *
 * @since 2.0.0
 */
export const Union = <Members extends ReadonlyArray<Schema.Schema.Any>>(...members: Members): Union<Members> => {
  // Auto-detect tag field from KNOWN_TAG_FIELDS
  let detectedTagField: string | undefined
  const tagValues = new globalThis.Map<string, { value: any; memberIndex: number }>()

  for (const tagFieldName of KNOWN_TAG_FIELDS) {
    let allHaveTag = true
    const currentTagValues = new globalThis.Map<string, { value: any; memberIndex: number }>()

    for (let i = 0; i < members.length; i++) {
      const literalValue = getLiteralFieldValue(members[i], tagFieldName)
      if (literalValue === undefined) {
        allHaveTag = false
        break
      }

      // Check for duplicate tag values
      const literalKey = JSON.stringify(literalValue)
      if (currentTagValues.has(literalKey)) {
        const existing = currentTagValues.get(literalKey)!
        throw new Error(
          `Union members must have unique tag values. Duplicate value ${literalKey} found in field "${tagFieldName}" at member indices ${existing.memberIndex} and ${i}.`
        )
      }
      currentTagValues.set(literalKey, { value: literalValue, memberIndex: i })
    }

    if (allHaveTag) {
      detectedTagField = tagFieldName
      tagValues.clear()
      currentTagValues.forEach((v: { value: any; memberIndex: number }, k: string) => tagValues.set(k, v))
      break
    }
  }

  // If members use different tag field names, that's an error
  if (!detectedTagField) {
    const usedTagFields = new Set<string>()
    for (const member of members) {
      for (const tagFieldName of KNOWN_TAG_FIELDS) {
        if (getLiteralFieldValue(member, tagFieldName) !== undefined) {
          usedTagFields.add(tagFieldName)
        }
      }
    }
    if (usedTagFields.size > 1) {
      throw new Error(
        `Union members must use the same tag field name. Found multiple: ${globalThis.Array.from(usedTagFields).join(", ")}`
      )
    }
  }

  // Extract member metadata from annotations
  const memberInfos = members.map((member, position) => {
    const customIndex = member.ast.annotations?.["TSchema.customIndex"] as number | undefined
    const isFlatInUnion = (member.ast.annotations?.["TSchema.flatInUnion"] as boolean | undefined) ?? false

    return {
      schema: member,
      position, // Position in the members array
      customIndex, // Custom index if set, undefined otherwise
      isFlat: isFlatInUnion // Whether this member should be flat in the union
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
        // Find which member matches this value (WITH tag field - schemas expect it)
        const matchedIndex = members.findIndex((schema) => Schema.is(schema)(value))

        if (matchedIndex === -1) {
          const memberNames = getMemberNames()
          const actualType =
            typeof value === "bigint"
              ? "bigint"
              : typeof value === "object" && value !== null && (value as unknown) instanceof globalThis.Map
                ? "Map"
                : typeof value === "object" && value !== null && globalThis.Array.isArray(value)
                  ? "array"
                  : typeof value

          return yield* Effect.fail(
            new ParseResult.Type(
              Schema.Union(...members).ast,
              value,
              `Invalid value for Union: received ${actualType} (${String(value)}), expected ${memberNames.join(" or ")}`
            )
          )
        }

        const memberInfo = memberInfos[matchedIndex]

        // Encode the full value - if members are Structs with tag fields,
        // they will handle filtering out the tag field themselves
        const encodedValue = yield* ParseResult.encode(memberInfo.schema as Schema.Schema<any, any, never>)(value)

        // If the member is flat, use its encoded value directly (unwrap the Constr)
        if (memberInfo.isFlat && encodedValue instanceof Data.Constr) {
          // Recursively unwrap nested flat Constrs (for nested flatFields support)
          const unwrapNestedFlat = (constr: Data.Constr): Data.Constr => {
            // If this Constr has exactly one field and that field is also a flat Constr, unwrap it
            if (
              constr.fields.length === 1 &&
              constr.fields[0] instanceof Data.Constr &&
              (constr.fields[0] as any)["__flatFields__"] === true
            ) {
              // Recursively unwrap
              return unwrapNestedFlat(constr.fields[0] as Data.Constr)
            }
            return constr
          }

          const unwrapped = unwrapNestedFlat(encodedValue)

          // If the member has a custom index, use it; otherwise use position
          const customIdx = memberInfo.customIndex
          const finalIndex = customIdx !== undefined ? BigInt(customIdx) : BigInt(memberInfo.position)

          return new Data.Constr({
            index: finalIndex,
            fields: unwrapped.fields
          })
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
        return Effect.gen(function* () {
          const decoded = yield* ParseResult.decode(flatMember.schema)(value)

          // Inject tag field if detected
          if (detectedTagField && typeof decoded === "object" && decoded !== null) {
            const tagValue = getLiteralFieldValue(flatMember.schema, detectedTagField)
            if (tagValue !== undefined) {
              return {
                ...decoded,
                [detectedTagField]: tagValue
              }
            }
          }

          return decoded
        })
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
      return Effect.gen(function* () {
        let decoded
        if (value.fields.length === 0) {
          // This is likely a Boolean-like case where the original Constr had no fields
          // Reconstruct the original Constr structure
          decoded = yield* ParseResult.decode(member)(new Data.Constr({ index: 0n, fields: [] }))
        } else if (value.fields.length === 1) {
          // This could be either a primitive value or a Constr that was flattened
          decoded = yield* ParseResult.decode(member)(value.fields[0])
        } else {
          // Multiple fields - reconstruct as a Constr with index 0
          // This handles cases where the original Constr had multiple fields
          decoded = yield* ParseResult.decode(member)(new Data.Constr({ index: 0n, fields: [...value.fields] }))
        }

        // Inject tag field if detected
        if (detectedTagField && typeof decoded === "object" && decoded !== null) {
          const tagValue = getLiteralFieldValue(member, detectedTagField)
          if (tagValue !== undefined) {
            return {
              ...decoded,
              [detectedTagField]: tagValue
            }
          }
        }

        return decoded
      })
    }
  }).annotations({
    identifier: "TSchema.Union",
    message: (issue) => {
      const memberNames = getMemberNames()
      const actual = issue.actual
      const actualType =
        typeof actual === "bigint"
          ? "bigint"
          : typeof actual === "object" && actual !== null && actual instanceof globalThis.Map
            ? "Map"
            : typeof actual === "object" && actual !== null && globalThis.Array.isArray(actual)
              ? "array"
              : typeof actual

      const actualStr =
        typeof actual === "bigint"
          ? String(actual)
          : typeof actual === "object"
            ? String(actual)
            : JSON.stringify(actual)

      return `Invalid value for Union: received ${actualType} (${actualStr}), expected ${memberNames.join(" or ")}`
    }
  }) as Union<Members>
}

export interface Tuple<Elements extends Schema.TupleType.Elements> extends Schema.Tuple<Elements> {}
/**
 * Creates a schema for tuple types - just passes through to Schema.Tuple directly
 *
 * @since 2.0.0
 */
export const Tuple = <Elements extends Schema.TupleType.Elements>(element: [...Elements]): Tuple<Elements> =>
  Schema.Tuple(...element).annotations({
    identifier: "Tuple"
  }) as Tuple<Elements>

/**
 * Creates a variant (tagged union) schema for Aiken-style enum types.
 *
 * This is a convenience helper that creates properly discriminated TypeScript types
 * while maintaining single-level CBOR encoding compatible with Aiken.
 *
 * @param variants - Object mapping variant names to their field schemas
 * @returns Union schema with discriminated types
 *
 * @since 2.0.0
 * @category constructors
 */
export const Variant = <const Variants extends Record<PropertyKey, Schema.Struct.Fields>>(
  variants: Variants
): Union<
  ReadonlyArray<
    {
      [K in keyof Variants]: Struct<{ readonly [P in K]: Struct<Variants[K]> }>
    }[keyof Variants]
  >
> => {
  return Union(
    ...(Object.entries(variants).map(([name, fields], index) =>
      Struct(
        {
          [name]: Struct(fields, { flatFields: true })
        } as any,
        { flatInUnion: true, index }
      )
    ) as any)
  )
}

/**
 * Creates a tagged struct - a shortcut for creating a Struct with a Literal tag field.
 *
 * This is a convenience helper that makes it easy to create structs with discriminator fields,
 * commonly used in discriminated unions.
 *
 * @param tagValue - The literal value for the tag (e.g., "Circle", "User")
 * @param fields - The struct fields (excluding the tag field)
 * @param options - Struct options (tagField defaults to "_tag", plus flatInUnion, index, etc.)
 * @returns Struct schema with the tag field
 *
 * @since 2.0.0
 * @category constructors
 */
export const TaggedStruct = <
  TagValue extends string,
  Fields extends Schema.Struct.Fields,
  TagField extends string = "_tag"
>(
  tagValue: TagValue,
  fields: Fields,
  options?: StructOptions & { tagField?: TagField }
): Struct<{ [K in TagField]: OneLiteral<TagValue> } & Fields> => {
  const tagField = (options?.tagField ?? "_tag") as TagField

  return Struct(
    {
      [tagField]: Literal(tagValue),
      ...fields
    } as { [K in TagField]: OneLiteral<TagValue> } & Fields,
    { ...options, tagField }
  )
}

export const compose = Schema.compose

export const filter = Schema.filter

export const is = Schema.is

/**
 * Creates an equivalence function for a schema that can compare two values for equality.
 *
 * This leverages Effect Schema's built-in equivalence generation, which creates
 * optimized equality checks based on the schema structure.
 *
 * @since 2.0.0
 * @category combinators
 */
export const equivalence = Schema.equivalence
