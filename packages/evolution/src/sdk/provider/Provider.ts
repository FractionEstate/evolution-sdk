import type { Effect } from "effect"
import { Context, Data } from "effect"

import type * as Address from "../Address.js"
import type * as Credential from "../Credential.js"
import type * as Delegation from "../Delegation.js"
import type { EvalRedeemer } from "../EvalRedeemer.js"
import type * as OutRef from "../OutRef.js"
import type * as ProtocolParameters from "../ProtocolParameters.js"
import type * as RewardAddress from "../RewardAddress.js"
import type { EffectToPromiseAPI } from "../Type.js"
import type { UTxO } from "../UTxO.js"

/**
 * Error class for provider-related operations.
 * Represents failures when communicating with blockchain providers or fetching data.
 *
 * @since 2.0.0
 * @category errors
 */
export class ProviderError extends Data.TaggedError("ProviderError")<{
  readonly cause: unknown
  readonly message: string
}> {}

/**
 * Effect-based provider interface for blockchain data access and submission.
 * Provides methods to query UTxOs, protocol parameters, delegation info, and submit transactions.
 *
 * @since 2.0.0
 * @category model
 */
export interface ProviderEffect {
  /**
   * Retrieve current protocol parameters from the blockchain.
   */
  readonly getProtocolParameters: () => Effect.Effect<ProtocolParameters.ProtocolParameters, ProviderError>
  /**
   * Query UTxOs at a given address or by credential.
   */
  readonly getUtxos: (addressOrCredential: Address.Address | Credential.Credential) => Effect.Effect<Array<UTxO>, ProviderError>
  /**
   * Query UTxOs at a given address or credential filtered by specific unit.
   */
  readonly getUtxosWithUnit: (
    addressOrCredential: Address.Address | Credential.Credential,
    unit: string
  ) => Effect.Effect<Array<UTxO>, ProviderError>
  /**
   * Query a single UTxO by its unit identifier.
   */
  readonly getUtxoByUnit: (unit: string) => Effect.Effect<UTxO, ProviderError>
  /**
   * Query UTxOs by their output references.
   */
  readonly getUtxosByOutRef: (outRefs: ReadonlyArray<OutRef.OutRef>) => Effect.Effect<Array<UTxO>, ProviderError>
  /**
   * Query delegation info for a reward address.
   */
  readonly getDelegation: (
    rewardAddress: RewardAddress.RewardAddress
  ) => Effect.Effect<Delegation.Delegation, ProviderError>
  /**
   * Query a datum by its hash.
   */
  readonly getDatum: (datumHash: string) => Effect.Effect<string, ProviderError>
  /**
   * Wait for a transaction to be confirmed on the blockchain.
   */
  readonly awaitTx: (txHash: string, checkInterval?: number) => Effect.Effect<boolean, ProviderError>
  /**
   * Submit a signed transaction to the blockchain.
   */
  readonly submitTx: (cbor: string) => Effect.Effect<string, ProviderError>
  /**
   * Evaluate a transaction to determine script execution costs.
   */
  readonly evaluateTx: (tx: string, additionalUTxOs?: Array<UTxO>) => Effect.Effect<Array<EvalRedeemer>, ProviderError>
}

/**
 * Context tag for ProviderEffect dependency injection.
 * Use this to require a provider in your Effect computations.
 *
 * @since 2.0.0
 * @category model
 */
export const ProviderEffect: Context.Tag<ProviderEffect, ProviderEffect> =
  Context.GenericTag<ProviderEffect>("@evolution/ProviderService")

/**
 * Promise-based provider interface for blockchain data access and submission.
 * Auto-generated wrapper around ProviderEffect with promise-based methods.
 *
 * @since 2.0.0
 * @category model
 */
export interface Provider extends EffectToPromiseAPI<ProviderEffect> {
  readonly Effect: ProviderEffect
}
