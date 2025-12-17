/**
 * Collect operation - adds UTxOs as transaction inputs.
 *
 * @module operations/Collect
 * @since 2.0.0
 */

import { Effect, Ref } from "effect"

import * as CoreAssets from "../../../core/Assets/index.js"
import * as UTxO from "../../../core/UTxO.js"
import { TransactionBuilderError, TxContext } from "../TransactionBuilder.js"
import { calculateTotalAssets, filterScriptUtxos } from "../TxBuilderImpl.js"
import type { CollectFromParams } from "./Operations.js"

/**
 * Creates a ProgramStep for collectFrom operation.
 * Adds UTxOs as transaction inputs, validates script requirements, and tracks assets.
 *
 * Implementation:
 * 1. Validates that inputs array is not empty
 * 2. Checks if any inputs are script-locked (require redeemers)
 * 3. Validates redeemer is provided for script-locked UTxOs
 * 4. Adds UTxOs to state.selectedUtxos
 * 5. Tracks redeemer information for script spending
 * 6. Updates total input assets for balancing
 *
 * @since 2.0.0
 * @category programs
 */
export const createCollectFromProgram = (params: CollectFromParams) =>
  Effect.gen(function* () {
    const ctx = yield* TxContext

    // 1. Validate inputs exist
    if (params.inputs.length === 0) {
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: "No inputs provided to collectFrom"
        })
      )
    }

    // 2. Filter script-locked UTxOs
    const scriptUtxos = yield* filterScriptUtxos(params.inputs)

    // 3. Validate redeemer for script UTxOs
    if (scriptUtxos.length > 0 && !params.redeemer) {
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: `Redeemer required for ${scriptUtxos.length} script-locked UTxO(s)`
        })
      )
    }

    // 4. Add UTxOs to selected inputs and track redeemers and input assets
    const inputAssets = calculateTotalAssets(params.inputs)

    yield* Ref.update(ctx, (state) => {
      let newRedeemers = state.redeemers

      // 5. Track redeemer information if spending from scripts
      if (params.redeemer && scriptUtxos.length > 0) {
        newRedeemers = new Map(state.redeemers)
        scriptUtxos.forEach((utxo) => {
          const inputKey = UTxO.toOutRefString(utxo)
          newRedeemers.set(inputKey, {
            tag: "spend",
            data: params.redeemer!,
            exUnits: undefined
          })
        })
      }

      return {
        ...state,
        selectedUtxos: [...state.selectedUtxos, ...params.inputs],
        redeemers: newRedeemers,
        totalInputAssets: CoreAssets.merge(state.totalInputAssets, inputAssets)
      }
    })
  })
