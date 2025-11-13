/**
 * SDK PoolParams module - user-friendly types for pool registration parameters.
 *
 * @since 2.0.0
 * @module SDK/PoolParams
 */

import { Schema } from "effect"

import * as CorePoolParams from "../core/PoolParams.js"

/**
 * User-friendly pool registration parameters type (lightweight encoded form).
 *
 * @example
 * ```typescript
 * const params: PoolParams = {
 *   _tag: "PoolParams",
 *   operator: "pool1abc...",
 *   vrfKeyhash: "vrf1...",
 *   pledge: 1000000000n,
 *   cost: 340000000n,
 *   margin: { numerator: 5n, denominator: 100n },
 *   rewardAccount: "stake1...",
 *   poolOwners: ["keyhash1...", "keyhash2..."],
 *   relays: [],
 *   poolMetadata: null
 * }
 * ```
 *
 * @since 2.0.0
 * @category model
 */
export type PoolParams = typeof CorePoolParams.PoolParams.Encoded

/**
 * Convert from Core PoolParams to SDK PoolParams (encode to lightweight form).
 *
 * @since 2.0.0
 * @category conversions
 */
export const fromCore = Schema.encodeSync(CorePoolParams.PoolParams)

/**
 * Convert from SDK PoolParams to Core PoolParams (decode to strict form).
 *
 * @since 2.0.0
 * @category conversions
 */
export const toCore = Schema.decodeSync(CorePoolParams.PoolParams)
