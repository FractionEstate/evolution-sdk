import { Effect as Eff, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as Bytes from "./Bytes.js"
import * as CBOR from "./CBOR.js"
import * as KeyHash from "./KeyHash.js"
import * as ScriptHash from "./ScriptHash.js"

/**
 * KeyHashDRep variant of DRep.
 * drep = [0, addr_keyhash]
 *
 * @since 2.0.0
 * @category model
 */
export class KeyHashDRep extends Schema.TaggedClass<KeyHashDRep>()("KeyHashDRep", {
  keyHash: KeyHash.KeyHash
}) {
  toJSON() {
    return {
      _tag: "KeyHashDRep" as const,
      keyHash: this.keyHash.toJSON()
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return that instanceof KeyHashDRep && Equal.equals(this.keyHash, that.keyHash)
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.combine(Hash.hash("KeyHashDRep"))(Hash.hash(this.keyHash)))
  }
}

/**
 * ScriptHashDRep variant of DRep.
 * drep = [1, script_hash]
 *
 * @since 2.0.0
 * @category model
 */
export class ScriptHashDRep extends Schema.TaggedClass<ScriptHashDRep>()("ScriptHashDRep", {
  scriptHash: ScriptHash.ScriptHash
}) {
  toJSON() {
    return {
      _tag: "ScriptHashDRep" as const,
      scriptHash: this.scriptHash.toJSON()
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return that instanceof ScriptHashDRep && Equal.equals(this.scriptHash, that.scriptHash)
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.combine(Hash.hash("ScriptHashDRep"))(Hash.hash(this.scriptHash)))
  }
}

/**
 * AlwaysAbstainDRep variant of DRep.
 * drep = [2]
 *
 * @since 2.0.0
 * @category model
 */
export class AlwaysAbstainDRep extends Schema.TaggedClass<AlwaysAbstainDRep>()("AlwaysAbstainDRep", {}) {
  toJSON() {
    return {
      _tag: "AlwaysAbstainDRep" as const
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return that instanceof AlwaysAbstainDRep
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash("AlwaysAbstainDRep"))
  }
}

/**
 * AlwaysNoConfidenceDRep variant of DRep.
 * drep = [3]
 *
 * @since 2.0.0
 * @category model
 */
export class AlwaysNoConfidenceDRep extends Schema.TaggedClass<AlwaysNoConfidenceDRep>()("AlwaysNoConfidenceDRep", {}) {
  toJSON() {
    return {
      _tag: "AlwaysNoConfidenceDRep" as const
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return that instanceof AlwaysNoConfidenceDRep
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash("AlwaysNoConfidenceDRep"))
  }
}

/**
 * Union schema for DRep representing different DRep types.
 *
 * drep = [0, addr_keyhash] / [1, script_hash] / [2] / [3]
 *
 * @since 2.0.0
 * @category schemas
 */
export const DRep = Schema.Union(KeyHashDRep, ScriptHashDRep, AlwaysAbstainDRep, AlwaysNoConfidenceDRep)

/**
 * Type alias for DRep.
 *
 * @since 2.0.0
 * @category model
 */
export type DRep = typeof DRep.Type

export const CDDLSchema = Schema.Union(
  Schema.Tuple(Schema.Literal(0n), Schema.Uint8ArrayFromSelf),
  Schema.Tuple(Schema.Literal(1n), Schema.Uint8ArrayFromSelf),
  Schema.Tuple(Schema.Literal(2n)),
  Schema.Tuple(Schema.Literal(3n))
)

/**
 * CDDL schema for DRep with proper transformation.
 * drep = [0, addr_keyhash] / [1, script_hash] / [2] / [3]
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCDDL = Schema.transformOrFail(CDDLSchema, Schema.typeSchema(DRep), {
  strict: true,
  encode: (toA) =>
    Eff.gen(function* () {
      switch (toA._tag) {
        case "KeyHashDRep": {
          const keyHashBytes = yield* ParseResult.encode(KeyHash.FromBytes)(toA.keyHash)
          return [0n, keyHashBytes] as const
        }
        case "ScriptHashDRep": {
          const scriptHashBytes = yield* ParseResult.encode(ScriptHash.FromBytes)(toA.scriptHash)
          return [1n, scriptHashBytes] as const
        }
        case "AlwaysAbstainDRep":
          return [2n] as const
        case "AlwaysNoConfidenceDRep":
          return [3n] as const
      }
    }),
  decode: (fromA) =>
    Eff.gen(function* () {
      const [tag, ...rest] = fromA
      switch (tag) {
        case 0n: {
          const keyHash = yield* ParseResult.decode(KeyHash.FromBytes)(rest[0] as Uint8Array)
          return new KeyHashDRep({ keyHash })
        }
        case 1n: {
          const scriptHash = yield* ParseResult.decode(ScriptHash.FromBytes)(rest[0] as Uint8Array)
          return new ScriptHashDRep({ scriptHash })
        }
        case 2n:
          return new AlwaysAbstainDRep({})
        case 3n:
          return new AlwaysNoConfidenceDRep({})
        default:
          return yield* ParseResult.fail(
            new ParseResult.Type(Schema.typeSchema(DRep).ast, fromA, `Invalid DRep tag: ${tag}`)
          )
      }
    })
})

export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    CBOR.FromBytes(options), // Uint8Array → CBOR
    FromCDDL // CBOR → DRep
  )

export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    Bytes.FromHex, // string → Uint8Array
    FromCBORBytes(options) // Uint8Array → DRep
  )

/**
 * Check if the given value is a valid DRep
 *
 * @since 2.0.0
 * @category predicates
 */
export const isDRep = Schema.is(DRep)

/**
 * FastCheck arbitrary for generating random DRep instances.
 *
 * @since 2.0.0
 * @category arbitrary
 */
export const arbitrary = FastCheck.oneof(
  KeyHash.arbitrary.map((keyHash) => new KeyHashDRep({ keyHash })),
  ScriptHash.arbitrary.map((scriptHash) => new ScriptHashDRep({ scriptHash })),
  FastCheck.constant(new AlwaysAbstainDRep({})),
  FastCheck.constant(new AlwaysNoConfidenceDRep({}))
)

// ============================================================================
// Decoding Functions
// ============================================================================

/**
 * Parse DRep from CBOR bytes.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORBytes = (bytes: Uint8Array, options?: CBOR.CodecOptions): DRep =>
  Schema.decodeSync(FromCBORBytes(options))(bytes)

/**
 * Parse DRep from CBOR hex string.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromCBORHex = (hex: string, options?: CBOR.CodecOptions): DRep =>
  Schema.decodeSync(FromCBORHex(options))(hex)

// ============================================================================
// Encoding Functions
// ============================================================================

/**
 * Encode DRep to CBOR bytes.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytes = (drep: DRep, options?: CBOR.CodecOptions): Uint8Array =>
  Schema.encodeSync(FromCBORBytes(options))(drep)

/**
 * Encode DRep to CBOR hex string.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHex = (drep: DRep, options?: CBOR.CodecOptions): string =>
  Schema.encodeSync(FromCBORHex(options))(drep)

/**
 * Create a KeyHashDRep from a KeyHash.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromKeyHash = (keyHash: KeyHash.KeyHash): KeyHashDRep => new KeyHashDRep({ keyHash })

/**
 * Create a ScriptHashDRep from a ScriptHash.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromScriptHash = (scriptHash: ScriptHash.ScriptHash): ScriptHashDRep => new ScriptHashDRep({ scriptHash })

/**
 * Create an AlwaysAbstainDRep.
 *
 * @since 2.0.0
 * @category constructors
 */
export const alwaysAbstain = (): AlwaysAbstainDRep => new AlwaysAbstainDRep({})

/**
 * Create an AlwaysNoConfidenceDRep.
 *
 * @since 2.0.0
 * @category constructors
 */
export const alwaysNoConfidence = (): AlwaysNoConfidenceDRep => new AlwaysNoConfidenceDRep({})

/**
 * Pattern match over DRep.
 *
 * @since 2.0.0
 * @category pattern matching
 */
export const match =
  <A>(patterns: {
    KeyHashDRep: (keyHash: KeyHash.KeyHash) => A
    ScriptHashDRep: (scriptHash: ScriptHash.ScriptHash) => A
    AlwaysAbstainDRep: () => A
    AlwaysNoConfidenceDRep: () => A
  }) =>
  (drep: DRep) => {
    switch (drep._tag) {
      case "KeyHashDRep":
        return patterns.KeyHashDRep(drep.keyHash)
      case "ScriptHashDRep":
        return patterns.ScriptHashDRep(drep.scriptHash)
      case "AlwaysAbstainDRep":
        return patterns.AlwaysAbstainDRep()
      case "AlwaysNoConfidenceDRep":
        return patterns.AlwaysNoConfidenceDRep()
    }
  }

/**
 * Check if DRep is a KeyHashDRep.
 *
 * @since 2.0.0
 * @category type guards
 */
export const isKeyHashDRep = (drep: DRep): drep is KeyHashDRep => drep._tag === "KeyHashDRep"

/**
 * Check if DRep is a ScriptHashDRep.
 *
 * @since 2.0.0
 * @category type guards
 */
export const isScriptHashDRep = (drep: DRep): drep is ScriptHashDRep => drep._tag === "ScriptHashDRep"

/**
 * Check if DRep is an AlwaysAbstainDRep.
 *
 * @since 2.0.0
 * @category type guards
 */
export const isAlwaysAbstainDRep = (drep: DRep): drep is AlwaysAbstainDRep => drep._tag === "AlwaysAbstainDRep"

/**
 * Check if DRep is an AlwaysNoConfidenceDRep.
 *
 * @since 2.0.0
 * @category type guards
 */
export const isAlwaysNoConfidenceDRep = (drep: DRep): drep is AlwaysNoConfidenceDRep =>
  drep._tag === "AlwaysNoConfidenceDRep"
