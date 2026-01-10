/**
 * @fileoverview Effect-based Blockfrost provider functions
 * Internal module implementing all provider operations using Effect pattern
 */

import { Effect, Schedule, Schema } from "effect"

import * as CoreAddress from "../../../Address.js"
import * as Bytes from "../../../Bytes.js"
import type * as Credential from "../../../Credential.js"
import * as PlutusData from "../../../Data.js"
import type * as DatumOption from "../../../DatumOption.js"
import type * as RewardAddress from "../../../RewardAddress.js"
import * as Transaction from "../../../Transaction.js"
import * as TransactionHash from "../../../TransactionHash.js"
import type * as TransactionInput from "../../../TransactionInput.js"
import type * as CoreUTxO from "../../../UTxO.js"
import { ProviderError } from "../Provider.js"
import * as Blockfrost from "./Blockfrost.js"
import * as HttpUtils from "./HttpUtils.js"
import * as Ogmios from "./Ogmios.js"

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Apply rate limiting to an Effect by delaying execution
 */
const withRateLimit = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.delay(effect, "100 millis")

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create Blockfrost API headers with project ID
 */
const createHeaders = (projectId?: string) => ({
  ...(projectId ? { "project_id": projectId } : {}),
  "Content-Type": "application/json"
})

/**
 * Wrap HTTP errors into ProviderError
 */
const wrapError = (operation: string) => (error: unknown) =>
  new ProviderError({
    message: `Blockfrost ${operation} failed. ${(error as Error).message}`,
    cause: error
  })

/**
 * Convert address or credential to appropriate Blockfrost endpoint path
 */
const getAddressPath = (addressOrCredential: CoreAddress.Address | Credential.Credential): string => {
  // For Core Address, convert to bech32 string
  if (addressOrCredential instanceof CoreAddress.Address) {
    return CoreAddress.toBech32(addressOrCredential)
  }
  // For Credential, convert to string representation
  return addressOrCredential.toString()
}

// ============================================================================
// Blockfrost Effect Functions (Curry Pattern)
// ============================================================================

/**
 * Get protocol parameters from Blockfrost API
 * Returns: (baseUrl, projectId?) => Effect<ProtocolParameters, ProviderError>
 */
export const getProtocolParameters = (baseUrl: string, projectId?: string) =>
  withRateLimit(
    HttpUtils.get(
      `${baseUrl}/epochs/latest/parameters`,
      Blockfrost.BlockfrostProtocolParameters,
      createHeaders(projectId)
    ).pipe(
      Effect.map(Blockfrost.transformProtocolParameters),
      Effect.mapError(wrapError("getProtocolParameters"))
    )
  )

/**
 * Get UTxOs for an address or credential
 * Returns: (baseUrl, projectId?) => (addressOrCredential) => Effect<UTxO[], ProviderError>
 */
export const getUtxos = (baseUrl: string, projectId?: string) => 
  (addressOrCredential: CoreAddress.Address | Credential.Credential) => {
    const addressPath = getAddressPath(addressOrCredential)
    
    return withRateLimit(
      HttpUtils.get(
        `${baseUrl}/addresses/${addressPath}/utxos`,
        Schema.Array(Blockfrost.BlockfrostUTxO),
        createHeaders(projectId)
      ).pipe(
        Effect.map((utxos) => 
          utxos.map((utxo) => Blockfrost.transformUTxO(utxo, addressPath))
        ),
        Effect.mapError(wrapError("getUtxos"))
      )
    )
  }

/**
 * Get UTxOs with a specific unit (asset)
 * Returns: (baseUrl, projectId?) => (addressOrCredential, unit) => Effect<UTxO[], ProviderError>
 */
export const getUtxosWithUnit = (baseUrl: string, projectId?: string) =>
  (addressOrCredential: CoreAddress.Address | Credential.Credential, unit: string) => {
    const addressPath = getAddressPath(addressOrCredential)
    
    return withRateLimit(
      HttpUtils.get(
        `${baseUrl}/addresses/${addressPath}/utxos/${unit}`,
        Schema.Array(Blockfrost.BlockfrostUTxO),
        createHeaders(projectId)
      ).pipe(
        Effect.map((utxos) => 
          utxos.map((utxo) => Blockfrost.transformUTxO(utxo, addressPath))
        ),
        Effect.mapError(wrapError("getUtxosWithUnit"))
      )
    )
  }

/**
 * Get UTxO by unit (first occurrence)
 * Returns: (baseUrl, projectId?) => (unit) => Effect<UTxO, ProviderError>
 */
export const getUtxoByUnit = (baseUrl: string, projectId?: string) =>
  (unit: string) =>
    withRateLimit(
      HttpUtils.get(
        `${baseUrl}/assets/${unit}/addresses`,
        Schema.Array(Blockfrost.BlockfrostUTxO),
        createHeaders(projectId)
      ).pipe(
        Effect.flatMap((utxos) => {
          if (utxos.length === 0) {
            return Effect.fail(new ProviderError({
              message: `No UTxO found for unit ${unit}`,
              cause: "No UTxO found"
            }))
          }
          // Use the first address for the UTxO transformation
          const firstUtxo = utxos[0]
          return Effect.succeed(Blockfrost.transformUTxO(firstUtxo, "unknown"))
        }),
        Effect.mapError(wrapError("getUtxoByUnit"))
      )
    )

/**
 * Get UTxOs by transaction inputs (output references)
 * Returns: (baseUrl, projectId?) => (inputs) => Effect<UTxO[], ProviderError>
 */
export const getUtxosByOutRef = (baseUrl: string, projectId?: string) =>
  (inputs: ReadonlyArray<TransactionInput.TransactionInput>) => {
    // Blockfrost doesn't have a bulk endpoint, so we need to make individual calls
    const effects = inputs.map((input) =>
      withRateLimit(
        HttpUtils.get(
          `${baseUrl}/txs/${TransactionHash.toHex(input.transactionId)}/utxos`,
          Schema.Array(Blockfrost.BlockfrostUTxO),
          createHeaders(projectId)
        ).pipe(
          Effect.map((utxos) => 
            utxos
              .filter((utxo) => utxo.output_index === Number(input.index))
              .map((utxo) => Blockfrost.transformUTxO(utxo, "unknown"))
          ),
          Effect.mapError(wrapError("getUtxosByOutRef"))
        )
      )
    )
    
    return Effect.all(effects).pipe(
      Effect.map((arrays) => arrays.flat())
    )
  }

/**
 * Get delegation information for a reward address
 * Returns: (baseUrl, projectId?) => (rewardAddress) => Effect<Delegation, ProviderError>
 */
export const getDelegation = (baseUrl: string, projectId?: string) =>
  (rewardAddress: RewardAddress.RewardAddress) => {
    // Assume RewardAddress has a string representation
    const rewardAddressStr = String(rewardAddress)
    
    return withRateLimit(
      HttpUtils.get(
        `${baseUrl}/accounts/${rewardAddressStr}`,
        Blockfrost.BlockfrostDelegation,
        createHeaders(projectId)
      ).pipe(
        Effect.map(Blockfrost.transformDelegation),
        Effect.mapError(wrapError("getDelegation"))
      )
    )
  }

/**
 * Get datum by hash
 * Returns: (baseUrl, projectId?) => (datumHash) => Effect<PlutusData, ProviderError>
 */
export const getDatum = (baseUrl: string, projectId?: string) =>
  (datumHash: DatumOption.DatumHash) => {
    const datumHashHex = Bytes.toHex(datumHash.hash)
    return withRateLimit(
      HttpUtils.get(
        `${baseUrl}/scripts/datum/${datumHashHex}`,
        Blockfrost.BlockfrostDatum,
        createHeaders(projectId)
      ).pipe(
        Effect.flatMap((datum) => {
          // Parse CBOR hex to PlutusData
          return Effect.try({
            try: () => Schema.decodeSync(PlutusData.FromCBORHex())(datum.cbor),
            catch: (error) => new ProviderError({ message: "Failed to parse datum CBOR", cause: error })
          })
        }),
        Effect.mapError(wrapError("getDatum"))
      )
    )
  }

/**
 * Await transaction confirmation
 * Returns: (baseUrl, projectId?) => (txHash, checkInterval?) => Effect<boolean, ProviderError>
 */
export const awaitTx = (baseUrl: string, projectId?: string) =>
  (txHash: TransactionHash.TransactionHash, checkInterval: number = 5000) => {
    const txHashHex = TransactionHash.toHex(txHash)
    const checkTx = withRateLimit(
      HttpUtils.get(
        `${baseUrl}/txs/${txHashHex}`,
        Schema.Struct({ hash: Schema.String }),
        createHeaders(projectId)
      ).pipe(
        Effect.map(() => true),
        Effect.mapError(wrapError("awaitTx"))
      )
    )

    // Poll every checkInterval milliseconds until transaction is found
    const pollSchedule = Schedule.fixed(`${checkInterval} millis`).pipe(
      Schedule.compose(Schedule.recurs(60)) // Max 60 attempts (5 minutes with 5s interval)
    )

    return Effect.retry(checkTx, pollSchedule).pipe(
      Effect.orElse(() => Effect.succeed(false)) // Return false if not found after max attempts
    )
  }

/**
 * Submit transaction
 * Returns: (baseUrl, projectId?) => (tx) => Effect<TransactionHash, ProviderError>
 */
export const submitTx = (baseUrl: string, projectId?: string) =>
  (tx: Transaction.Transaction) => {
    // Convert Transaction to CBOR bytes for submission
    const cborBytes = Transaction.toCBORBytes(tx)
    
    // Create headers without Content-Type (will be set by postUint8Array)
    const headers = projectId ? { "project_id": projectId } : undefined
    
    return withRateLimit(
      HttpUtils.postUint8Array(
        `${baseUrl}/tx/submit`,
        cborBytes,
        Blockfrost.BlockfrostSubmitResponse,
        headers
      ).pipe(
        Effect.flatMap((txHashHex) => {
          // Parse transaction hash from hex string
          return Effect.try({
            try: () => Schema.decodeSync(TransactionHash.FromHex)(txHashHex),
            catch: (error) => new ProviderError({ message: "Failed to parse transaction hash", cause: error })
          })
        }),
        Effect.mapError(wrapError("submitTx"))
      )
    )
  }

/**
 * Evaluate transaction
 * Returns: (baseUrl, projectId?) => (tx, additionalUTxOs?) => Effect<EvalRedeemer[], ProviderError>
 */
export const evaluateTx = (baseUrl: string, projectId?: string) =>
  (tx: Transaction.Transaction, additionalUTxOs?: Array<CoreUTxO.UTxO>) => {
    // Convert Transaction to CBOR hex for evaluation
    const txCborHex = Transaction.toCBORHex(tx)
    
    // If additional UTxOs provided, use the /utils/txs/evaluate/utxos endpoint with JSON payload
    if (additionalUTxOs && additionalUTxOs.length > 0) {
      // Create headers with application/json content-type
      const headers = {
        ...(projectId ? { "project_id": projectId } : {}),
        "Content-Type": "application/json"
      }
      
      // Use Ogmios format for additional UTxOs
      const additionalUtxoSet = Ogmios.toOgmiosUTxOs(additionalUTxOs).map(utxo => {
        const txIn = {
          txId: utxo.transaction.id,
          index: utxo.index
        }
        
        const txOut: Record<string, unknown> = {
          address: utxo.address,
          value: utxo.value
        }
        
        // Add datum if present
        if (utxo.datum) {
          txOut.datum = utxo.datum
        } else if (utxo.datumHash) {
          txOut.datumHash = utxo.datumHash
        }
        
        return [txIn, txOut]
      })
      
      const payload = {
        cbor: txCborHex, // Transaction CBOR (hex)
        additionalUtxoSet
      }
      
      return withRateLimit(
        HttpUtils.postJson(
          `${baseUrl}/utils/txs/evaluate/utxos`,
          payload,
          Blockfrost.JsonwspOgmiosEvaluationResponse,
          headers
        ).pipe(
          Effect.map(Blockfrost.transformJsonwspOgmiosEvaluationResult),
          Effect.mapError(wrapError("evaluateTx"))
        )
      )
    }
    
    // Otherwise use the simpler /utils/txs/evaluate endpoint with CBOR body
    const txBytes = Transaction.toCBORBytes(tx)
    
    // Create headers with application/cbor content-type
    const headers = {
      ...(projectId ? { "project_id": projectId } : {}),
      "Content-Type": "application/cbor"
    }
    
    return withRateLimit(
      HttpUtils.postUint8Array(
        `${baseUrl}/utils/txs/evaluate`,
        txBytes,
        Blockfrost.BlockfrostEvaluationResponse,
        headers
      ).pipe(
        Effect.map(Blockfrost.transformEvaluationResult),
        Effect.mapError(wrapError("evaluateTx"))
      )
    )
  }