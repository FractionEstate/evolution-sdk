import { Effect as Eff, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as AssetName from "./AssetName.js"
import * as Bytes from "./Bytes.js"
import * as CBOR from "./CBOR.js"
import * as Coin from "./Coin.js"
import * as MultiAsset from "./MultiAsset.js"
import * as PolicyId from "./PolicyId.js"
import * as PositiveCoin from "./PositiveCoin.js"

/**
 * Assets representing both ADA and native tokens.
 *
 * This is a simplified, unified structure where:
 * - `coin` always represents the ADA/Lovelace amount
 * - `multiAsset` optionally contains native tokens
 *
 * CDDL spec: `value = coin / [coin, multiasset<positive_coin>]`
 *
 * @since 2.0.0
 * @category model
 */
export class Assets extends Schema.Class<Assets>("Assets")({
  lovelace: Coin.Coin,
  multiAsset: Schema.optional(MultiAsset.MultiAsset)
}) {
  toJSON() {
    return {
      lovelace: this.lovelace.toString(),
      multiAsset: this.multiAsset?.toJSON()
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return (
      that instanceof Assets &&
      Equal.equals(this.lovelace, that.lovelace) &&
      ((this.multiAsset === undefined && that.multiAsset === undefined) ||
        (this.multiAsset !== undefined &&
          that.multiAsset !== undefined &&
          Equal.equals(this.multiAsset, that.multiAsset)))
    )
  }

  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash(this.lovelace) ^ Hash.hash(this.multiAsset))
  }
}

/**
 * Create Assets containing only ADA/Lovelace.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromLovelace = (lovelace: Coin.Coin): Assets => new Assets({ lovelace })

/**
 * Create Assets containing ADA and native tokens.
 *
 * @since 2.0.0
 * @category constructors
 */
export const withMultiAsset = (lovelace: Coin.Coin, multiAsset: MultiAsset.MultiAsset): Assets =>
  new Assets({ lovelace, multiAsset })

/**
 * Create a single asset (policy + asset name + quantity) with optional ADA.
 *
 * @since 2.0.0
 * @category constructors
 */
export const fromAsset = (
  policyId: PolicyId.PolicyId,
  assetName: AssetName.AssetName,
  quantity: PositiveCoin.PositiveCoin,
  lovelace: Coin.Coin = 0n
): Assets => {
  const assetMap = new Map([[assetName, quantity]])
  const multiAsset = new MultiAsset.MultiAsset({ map: new Map([[policyId, assetMap]]) })
  return new Assets({ lovelace, multiAsset })
}

/**
 * Empty Assets with zero ADA and no tokens.
 *
 * @since 2.0.0
 * @category constants
 */
export const zero: Assets = new Assets({ lovelace: 0n })

// ============================================================================
// Inspection
// ============================================================================

/**
 * Extract the ADA/Lovelace amount.
 *
 * @since 2.0.0
 * @category inspection
 */
export const lovelaceOf = (assets: Assets): Coin.Coin => assets.lovelace

/**
 * Check if Assets contains native tokens.
 *
 * @since 2.0.0
 * @category inspection
 */
export const hasMultiAsset = (assets: Assets): boolean => assets.multiAsset !== undefined

/**
 * Get the MultiAsset if present.
 *
 * @since 2.0.0
 * @category inspection
 */
export const getMultiAsset = (assets: Assets): MultiAsset.MultiAsset | undefined => assets.multiAsset

/**
 * Check if Assets is zero (no ADA and no tokens).
 *
 * @since 2.0.0
 * @category inspection
 */
export const isZero = (assets: Assets): boolean => assets.lovelace === 0n && !hasMultiAsset(assets)

/**
 * Get quantity of a specific asset.
 *
 * @since 2.0.0
 * @category inspection
 */
export const quantityOf = (assets: Assets, policyId: PolicyId.PolicyId, assetName: AssetName.AssetName): bigint => {
  if (!assets.multiAsset) return 0n
  const assetMap = assets.multiAsset.map.get(policyId)
  if (!assetMap) return 0n
  return assetMap.get(assetName) ?? 0n
}

/**
 * Get all policy IDs in the Assets.
 *
 * @since 2.0.0
 * @category inspection
 */
export const policies = (assets: Assets): Array<PolicyId.PolicyId> => {
  if (!assets.multiAsset) return []
  return Array.from(assets.multiAsset.map.keys())
}

/**
 * Get all tokens for a specific policy.
 *
 * @since 2.0.0
 * @category inspection
 */
export const tokens = (assets: Assets, policyId: PolicyId.PolicyId): Map<AssetName.AssetName, bigint> => {
  if (!assets.multiAsset) return new Map()
  return assets.multiAsset.map.get(policyId) ?? new Map()
}

// ============================================================================
// Combining
// ============================================================================

/**
 * Add two Assets together.
 * Combines ADA amounts and merges MultiAssets.
 *
 * @since 2.0.0
 * @category combining
 */
export const merge = (a: Assets, b: Assets): Assets => {
  const totalLovelace = Coin.add(a.lovelace, b.lovelace)

  // Both have no multiAsset
  if (!a.multiAsset && !b.multiAsset) {
    return new Assets({ lovelace: totalLovelace })
  }

  // Only a has multiAsset
  if (a.multiAsset && !b.multiAsset) {
    return new Assets({ lovelace: totalLovelace, multiAsset: a.multiAsset })
  }

  // Only b has multiAsset
  if (!a.multiAsset && b.multiAsset) {
    return new Assets({ lovelace: totalLovelace, multiAsset: b.multiAsset })
  }

  // Both have multiAsset
  if (a.multiAsset && b.multiAsset) {
    const merged = MultiAsset.merge(a.multiAsset, b.multiAsset)
    return new Assets({ lovelace: totalLovelace, multiAsset: merged })
  }

  return new Assets({ lovelace: totalLovelace })
}

/**
 * Add a single asset to Assets.
 *
 * @since 2.0.0
 * @category combining
 */
export const add = (
  assets: Assets,
  policyId: PolicyId.PolicyId,
  assetName: AssetName.AssetName,
  quantity: bigint
): Assets => {
  const toAdd = fromAsset(policyId, assetName, quantity as PositiveCoin.PositiveCoin, 0n)
  return merge(assets, toAdd)
}

/**
 * Negate all quantities (ADA and tokens).
 *
 * @since 2.0.0
 * @category combining
 */
export const negate = (assets: Assets): Assets => {
  const negatedLovelace = -assets.lovelace

  if (!assets.multiAsset) {
    return new Assets({ lovelace: negatedLovelace })
  }

  const negatedMap = new Map<PolicyId.PolicyId, MultiAsset.AssetMap>()
  for (const [policyId, assetMap] of assets.multiAsset.map.entries()) {
    const negatedAssets = new Map<AssetName.AssetName, PositiveCoin.PositiveCoin>()
    for (const [assetName, quantity] of assetMap.entries()) {
      negatedAssets.set(assetName, -quantity as PositiveCoin.PositiveCoin)
    }
    negatedMap.set(policyId, negatedAssets)
  }

  return new Assets({
    lovelace: negatedLovelace,
    multiAsset: new MultiAsset.MultiAsset({ map: negatedMap })
  })
}

/**
 * Get Assets without the ADA/Lovelace component.
 *
 * @since 2.0.0
 * @category combining
 */
export const withoutLovelace = (assets: Assets): Assets => {
  if (!assets.multiAsset) {
    return zero
  }
  return new Assets({ lovelace: 0n, multiAsset: assets.multiAsset })
}

// ============================================================================
// Transforming
// ============================================================================

/**
 * Flatten Assets into a list of [PolicyId, AssetName, Quantity] tuples.
 *
 * @since 2.0.0
 * @category transforming
 */
export const flatten = (assets: Assets): Array<[PolicyId.PolicyId, AssetName.AssetName, bigint]> => {
  if (!assets.multiAsset) return []

  const result: Array<[PolicyId.PolicyId, AssetName.AssetName, bigint]> = []
  for (const [policyId, assetMap] of assets.multiAsset.map.entries()) {
    for (const [assetName, quantity] of assetMap.entries()) {
      result.push([policyId, assetName, quantity])
    }
  }
  return result
}

/**
 * Convert Assets to a nested Map structure.
 *
 * @since 2.0.0
 * @category transforming
 */
export const toDict = (assets: Assets): Map<PolicyId.PolicyId, Map<AssetName.AssetName, bigint>> => {
  if (!assets.multiAsset) return new Map()
  return new Map(assets.multiAsset.map)
}

// ============================================================================
// CBOR Encoding/Decoding
// ============================================================================

/**
 * CDDL schema type for Assets
 *
 * @since 2.0.0
 * @category schemas
 */
export const CDDLSchema = Schema.Union(
  CBOR.Integer,
  Schema.Tuple(
    CBOR.Integer,
    Schema.encodedSchema(
      MultiAsset.FromCDDL // MultiAsset CDDL structure
    )
  )
)

/**
 * CDDL schema for Assets.
 *
 * CDDL: `value = coin / [coin, multiasset<positive_coin>]`
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCDDL = Schema.transformOrFail(CDDLSchema, Schema.typeSchema(Assets), {
  strict: true,
  encode: (assets) =>
    Eff.gen(function* () {
      if (assets.multiAsset === undefined) {
        return assets.lovelace
      } else {
        const outerMap = new Map<Uint8Array, Map<Uint8Array, bigint>>()

        for (const [policyId, assetMap] of assets.multiAsset.map.entries()) {
          const policyIdBytes = yield* ParseResult.encode(PolicyId.FromBytes)(policyId)
          const innerMap = new Map<Uint8Array, bigint>()

          for (const [assetName, amount] of assetMap.entries()) {
            const assetNameBytes = yield* ParseResult.encode(AssetName.FromBytes)(assetName)
            innerMap.set(assetNameBytes, amount)
          }

          outerMap.set(policyIdBytes, innerMap)
        }

        return [assets.lovelace, outerMap] as const
      }
    }),
  decode: (fromA) =>
    Eff.gen(function* () {
      if (typeof fromA === "bigint") {
        return new Assets({
          lovelace: yield* ParseResult.decodeUnknown(Schema.typeSchema(Coin.Coin))(fromA)
        })
      } else {
        const [coinAmount, multiAssetCddl] = fromA

        const result = new Map<PolicyId.PolicyId, MultiAsset.AssetMap>()

        for (const [policyIdBytes, assetMapCddl] of multiAssetCddl.entries()) {
          const policyId = yield* ParseResult.decode(PolicyId.FromBytes)(policyIdBytes)

          const assetMap = new Map<AssetName.AssetName, PositiveCoin.PositiveCoin>()
          for (const [assetNameBytes, amount] of assetMapCddl.entries()) {
            const assetName = yield* ParseResult.decode(AssetName.FromBytes)(assetNameBytes)
            const positiveCoin = yield* ParseResult.decodeUnknown(Schema.typeSchema(PositiveCoin.PositiveCoinSchema))(amount)
            assetMap.set(assetName, positiveCoin)
          }

          result.set(policyId, assetMap)
        }

        return new Assets({
          lovelace: yield* ParseResult.decodeUnknown(Schema.typeSchema(Coin.Coin))(coinAmount),
          multiAsset: new MultiAsset.MultiAsset({ map: result })
        })
      }
    })
})

/**
 * CBOR bytes transformation schema for Assets.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    CBOR.FromBytes(options), // Uint8Array → CBOR
    FromCDDL // CBOR → Assets
  ).annotations({
    identifier: "Assets.FromCBORBytes",
    title: "Assets from CBOR Bytes",
    description: "Transforms CBOR bytes to Assets"
  })

/**
 * CBOR hex transformation schema for Assets.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    Bytes.FromHex, // string → Uint8Array
    FromCBORBytes(options) // Uint8Array → Assets
  ).annotations({
    identifier: "Assets.FromCBORHex",
    title: "Assets from CBOR Hex",
    description: "Transforms CBOR hex string to Assets"
  })

/**
 * @since 2.0.0
 * @category arbitrary
 */
export const arbitrary: FastCheck.Arbitrary<Assets> = FastCheck.oneof(
  Coin.arbitrary.map((lovelace) => new Assets({ lovelace }, { disableValidation: true })),
  FastCheck.record({ lovelace: Coin.arbitrary, multiAsset: MultiAsset.arbitrary }).map(
    ({ lovelace, multiAsset }) => new Assets({ lovelace, multiAsset }, { disableValidation: true })
  )
)

/**
 * Parse Assets from CBOR bytes.
 *
 * @since 2.0.0
 * @category decoding
 */
export const fromCBORBytes = (bytes: Uint8Array, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORBytes(options))(bytes)

/**
 * Parse Assets from CBOR hex string.
 *
 * @since 2.0.0
 * @category decoding
 */
export const fromCBORHex = (hex: string, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORHex(options))(hex)

/**
 * Encode Assets to CBOR bytes.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytes = (data: Assets, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORBytes(options))(data)

/**
 * Encode Assets to CBOR hex string.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHex = (data: Assets, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORHex(options))(data)
