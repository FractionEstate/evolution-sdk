/**
 * Evaluation Phase
 *
 * Executes UPLC validators to compute execution units (ExUnits) for redeemers.
 * Re-evaluation occurs every time the Balance phase completes with scripts present.
 *
 * @module Evaluation
 * @since 2.0.0
 */

import { Effect, Ref } from "effect"

import * as Bytes from "../../../core/Bytes.js"
import * as CostModel from "../../../core/CostModel.js"
import * as PolicyId from "../../../core/PolicyId.js"
import * as Transaction from "../../../core/Transaction.js"
import * as CoreUTxO from "../../../core/UTxO.js"
import type * as ProtocolParametersModule from "../../ProtocolParameters.js"
import * as EvaluationStateManager from "../EvaluationStateManager.js"
import {
  BuildOptionsTag,
  type EvaluationContext,
  PhaseContextTag,
  TransactionBuilderError,
  TxBuilderConfigTag,
  TxContext
} from "../TransactionBuilder.js"
import { assembleTransaction, buildTransactionInputs } from "../TxBuilderImpl.js"
import type { PhaseResult } from "./Phases.js"

/**
 * Convert ProtocolParameters cost models to CBOR bytes for evaluation.
 * 
 * Takes the cost models from protocol parameters (Record<string, number> format)
 * and converts them to the CBOR-encoded format expected by UPLC evaluators.
 */
const costModelsToCBOR = (
  protocolParams: ProtocolParametersModule.ProtocolParameters
): Effect.Effect<Uint8Array, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Convert Record<string, number> format to bigint arrays
    const plutusV1Costs = Object.values(protocolParams.costModels.PlutusV1).map((v) => BigInt(v))
    const plutusV2Costs = Object.values(protocolParams.costModels.PlutusV2).map((v) => BigInt(v))
    const plutusV3Costs = Object.values(protocolParams.costModels.PlutusV3).map((v) => BigInt(v))

    // Create CostModels instance
    const costModels = new CostModel.CostModels({
      PlutusV1: new CostModel.CostModel({ costs: plutusV1Costs }),
      PlutusV2: new CostModel.CostModel({ costs: plutusV2Costs }),
      PlutusV3: new CostModel.CostModel({ costs: plutusV3Costs })
    })

    // Encode to CBOR bytes
    return yield* Effect.try({
      try: () => CostModel.toCBOR(costModels),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to encode cost models to CBOR",
          cause: error
        })
    })
  })

/**
 * Evaluation Phase
 *
 * Executes UPLC validators to determine execution units (ExUnits) for script redeemers.
 * This phase is triggered after Balance when scripts are present in the transaction.
 *
 * **Flow:**
 * ```
 * Balance (balanced && hasScripts)
 *   ↓
 * Evaluation
 *   ├─ Build transaction CBOR
 *   ├─ Prepare evaluation context (cost models, slot config, etc.)
 *   ├─ Execute UPLC evaluator
 *   ├─ Match results to redeemers by tag+index
 *   ├─ Update redeemer ExUnits
 *   └─ Route to FeeCalculation (fee needs recalc with new ExUnits)
 * ```
 *
 * **Key Principles:**
 * - Re-evaluation happens every Balance pass (no change detection)
 * - Loop prevention via existing MAX_BALANCE_ATTEMPTS
 * - Evaluation errors fail immediately (no fallback)
 * - ExUnits affect transaction size → affect fees → may change balance
 * - Process repeats until transaction stabilizes or max attempts reached
 *
 * **Why Re-evaluation is Mandatory:**
 * Validators can check outputs, fees, or other transaction properties that change
 * after reselection or fee adjustments. Re-evaluation ensures ExUnits remain valid
 * for the final transaction structure.
 */
export const executeEvaluation = (): Effect.Effect<
  PhaseResult,
  TransactionBuilderError,
  BuildOptionsTag | TxContext | PhaseContextTag | TxBuilderConfigTag
> =>
  Effect.gen(function* () {
    yield* Effect.logDebug("[Evaluation] Starting UPLC evaluation")

    // Step 1: Get contexts
    const ctx = yield* TxContext
    const buildOptions = yield* BuildOptionsTag
    const buildCtxRef = yield* PhaseContextTag
    const buildCtx = yield* Ref.get(buildCtxRef)
    const config = yield* TxBuilderConfigTag
    const state = yield* Ref.get(ctx)

    // Step 2: Get evaluator from BuildOptions or fail
    // Note: The evaluator can come from either:
    // 1. BuildOptions.evaluator (explicit evaluator provided by user)
    // 2. Provider.evaluateTx (wrapped as Evaluator during build setup)
    // The resolution happens in TransactionBuilder.makeBuild via resolveEvaluator()
    const evaluator = buildOptions.evaluator
    
    if (!evaluator) {
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: "Script evaluation required but no evaluator provided in BuildOptions or config.provider",
          cause: { redeemerCount: state.redeemers.size }
        })
      )
    }

    // Step 2.5: Fetch full protocol parameters (needed for cost models and execution limits)
    if (!config.provider) {
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: "Script evaluation requires a provider to fetch full protocol parameters (cost models, execution limits)",
          cause: { redeemerCount: state.redeemers.size }
        })
      )
    }
    
    const fullProtocolParams = yield* config.provider.Effect.getProtocolParameters().pipe(
      Effect.mapError(
        (providerError) =>
          new TransactionBuilderError({
            message: "Failed to fetch full protocol parameters for evaluation",
            cause: providerError
          })
      )
    )

    // Step 3: Check if there are redeemers to evaluate
    if (state.redeemers.size === 0) {
      yield* Effect.logDebug("[Evaluation] No redeemers found - skipping evaluation")
      return { next: "feeCalculation" as const }
    }

    // Step 3.5: Check if redeemers already have exUnits (already evaluated)
    // If all redeemers have non-zero exUnits, skip re-evaluation to prevent infinite loops
    if (EvaluationStateManager.allRedeemersEvaluated(state.redeemers)) {
      yield* Effect.logDebug("[Evaluation] All redeemers already evaluated - skipping re-evaluation")
      return { next: "feeCalculation" as const }
    }

    yield* Effect.logDebug(`[Evaluation] Evaluating ${state.redeemers.size} redeemer(s)`)

    // Step 4: Build transaction for evaluation AND get input index mapping
    // We need to assemble the current transaction state into a Transaction object
    // IMPORTANT: We also need to know which input index corresponds to which UTxO
    // so we can match evaluation results back to our redeemers in state
    const inputIndexMapping = new Map<number, string>() // index -> "txHash#outputIndex"
    
    // Build inputs from selectedUtxos (this will sort them canonically)
    const sortedUtxos = Array.from(state.selectedUtxos.values()).sort((a, b) => {
      // MUST use same sorting as buildTransactionInputs: byte comparison of tx hash
      const hashA = a.transactionId.hash
      const hashB = b.transactionId.hash
      
      for (let i = 0; i < hashA.length; i++) {
        if (hashA[i] !== hashB[i]) {
          return hashA[i]! - hashB[i]!
        }
      }
      
      // If hashes equal, compare by output index
      return Number(a.index - b.index)
    })
    
    // Build the mapping while preserving the same order
    for (let i = 0; i < sortedUtxos.length; i++) {
      const utxo = sortedUtxos[i]!
      const key = CoreUTxO.toOutRefString(utxo)
      inputIndexMapping.set(i, key)
      yield* Effect.logDebug(`[Evaluation] Input ${i} maps to UTxO: ${key}`)
    }

    // Build mint index mapping: index → policyIdHex
    // Mint redeemers are indexed by sorted policy ID order
    const mintIndexMapping = new Map<number, string>()
    if (state.mint && state.mint.map.size > 0) {
      const sortedPolicyIds = Array.from(state.mint.map.keys())
        .map((pid) => PolicyId.toHex(pid))
        .sort()
      
      for (let i = 0; i < sortedPolicyIds.length; i++) {
        mintIndexMapping.set(i, sortedPolicyIds[i]!)
        yield* Effect.logDebug(`[Evaluation] Mint ${i} maps to policy: ${sortedPolicyIds[i]}`)
      }
    }
    
    const inputs = yield* buildTransactionInputs(sortedUtxos)
    const allOutputs = [...state.outputs, ...buildCtx.changeOutputs]
    const transaction = yield* assembleTransaction(inputs, allOutputs, buildCtx.calculatedFee)

    // Step 5: Serialize transaction to CBOR hex
    const txCborBytes = yield* Effect.try({
      try: () => Transaction.toCBORBytes(transaction),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to encode transaction to CBOR for evaluation",
          cause: error
        })
    })

    const txHex = Bytes.toHex(txCborBytes)
    
    // Debug: Log transaction details
    yield* Effect.logDebug(`[Evaluation] Transaction CBOR length: ${txHex.length} chars`)
    yield* Effect.logDebug(`[Evaluation] Has collateral return: ${!!transaction.body.collateralReturn}`)
    if (transaction.body.collateralReturn) {
      const assets = transaction.body.collateralReturn.assets
      yield* Effect.logDebug(`[Evaluation] Collateral return lovelace: ${assets.lovelace}`)
      if (assets.multiAsset) {
        const assetCount = assets.multiAsset.map.size
        yield* Effect.logDebug(`[Evaluation] Collateral return has ${assetCount} asset policies`)
      }
    }

    // Step 6: Prepare evaluation context
    // Encode cost models from full protocol parameters
    const costModelsCBOR = yield* costModelsToCBOR(fullProtocolParams)

    // Get slot configuration from BuildOptions (resolved from network or explicit override)
    const slotConfig = buildOptions.slotConfig ?? {
      zeroTime: 0n,
      zeroSlot: 0n,
      slotLength: 1000
    }

    const evaluationContext: EvaluationContext = {
      costModels: costModelsCBOR,
      maxTxExSteps: fullProtocolParams.maxTxExSteps,
      maxTxExMem: fullProtocolParams.maxTxExMem,
      slotConfig
    }

    // Step 7: Call evaluator
    // Pass the selected UTxOs AND reference inputs so Ogmios can resolve script hashes
    // Reference inputs are needed when scripts reference on-chain validators or datums
    const additionalUtxos = [
      ...Array.from(state.selectedUtxos.values()),
      ...state.referenceInputs
    ]
    
    const evalResults = yield* evaluator.evaluate(
      txHex,
      additionalUtxos, // UTxOs being spent + reference inputs (needed to resolve script hashes and datums)
      evaluationContext
    ).pipe(
      Effect.mapError(
        (evalError) =>
          new TransactionBuilderError({
            message: "Script evaluation failed",
            cause: evalError
          })
      )
    )

    yield* Effect.logDebug(`[Evaluation] Received ${evalResults.length} evaluation result(s)`)

    // Validation: If we have redeemers but received zero results, something went wrong
    if (state.redeemers.size > 0 && evalResults.length === 0) {
      yield* Effect.logError(
        `[Evaluation] Expected evaluation results for ${state.redeemers.size} redeemer(s) but received 0 results. ` +
        `This may indicate a provider schema parsing issue or network error.`
      )
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: `Evaluation returned zero results despite having ${state.redeemers.size} redeemer(s) to evaluate`,
          cause: new Error("Provider may have returned malformed response")
        })
      )
    }

    // Step 8: Match evaluation results to redeemers and update ExUnits
    // The evaluator returns results keyed by (tag, index) where index is the position in the transaction
    // Our state stores redeemers keyed by UTxO reference (txHash#outputIndex)
    // We built inputIndexMapping earlier to map from transaction position → UTxO reference

    // Match evaluation results to redeemers in state
    for (const evalRedeemer of evalResults) {
      if (evalRedeemer.redeemer_tag === "spend") {
        // For spend redeemers, map input index to UTxO reference
        const utxoRef = inputIndexMapping.get(evalRedeemer.redeemer_index)
        if (!utxoRef) {
          yield* Effect.logWarning(
            `[Evaluation] Could not map input index ${evalRedeemer.redeemer_index} to UTxO reference`
          )
          continue
        }

        const redeemer = state.redeemers.get(utxoRef)
        if (redeemer) {
          // Update redeemer with ExUnits from evaluation
          const updatedRedeemer = {
            ...redeemer,
            exUnits: {
              mem: BigInt(evalRedeemer.ex_units.mem),
              steps: BigInt(evalRedeemer.ex_units.steps)
            }
          }

          state.redeemers.set(utxoRef, updatedRedeemer)

          yield* Effect.logDebug(
            `[Evaluation] Updated redeemer at ${utxoRef} (spend:${evalRedeemer.redeemer_index}): ` +
              `mem=${evalRedeemer.ex_units.mem}, steps=${evalRedeemer.ex_units.steps}`
          )
        } else {
          yield* Effect.logWarning(
            `[Evaluation] No redeemer found in state for UTxO ${utxoRef}`
          )
        }
      } else if (evalRedeemer.redeemer_tag === "mint") {
        // For mint redeemers, map mint index to policy ID hex
        const policyIdHex = mintIndexMapping.get(evalRedeemer.redeemer_index)
        if (!policyIdHex) {
          yield* Effect.logWarning(
            `[Evaluation] Could not map mint index ${evalRedeemer.redeemer_index} to policy ID`
          )
          continue
        }

        const redeemer = state.redeemers.get(policyIdHex)
        if (redeemer) {
          // Update redeemer with ExUnits from evaluation
          const updatedRedeemer = {
            ...redeemer,
            exUnits: {
              mem: BigInt(evalRedeemer.ex_units.mem),
              steps: BigInt(evalRedeemer.ex_units.steps)
            }
          }

          state.redeemers.set(policyIdHex, updatedRedeemer)

          yield* Effect.logDebug(
            `[Evaluation] Updated redeemer for policy ${policyIdHex} (mint:${evalRedeemer.redeemer_index}): ` +
              `mem=${evalRedeemer.ex_units.mem}, steps=${evalRedeemer.ex_units.steps}`
          )
        } else {
          yield* Effect.logWarning(
            `[Evaluation] No redeemer found in state for policy ${policyIdHex}`
          )
        }
      } else {
        // For cert/reward redeemers, we'd need different logic
        // TODO: Implement matching for cert and reward redeemer types
        yield* Effect.logWarning(
          `[Evaluation] Redeemer type ${evalRedeemer.redeemer_tag} not yet supported for matching`
        )
      }
    }

    yield* Effect.logDebug("[Evaluation] UPLC evaluation complete - routing to FeeCalculation")

    // Step 9: Route to FeeCalculation
    // Fee must be recalculated because ExUnits affect transaction size
    return { next: "feeCalculation" as const }
  })
