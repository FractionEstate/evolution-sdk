// Effect-TS imports
import { Effect, Ref, Schema } from "effect"
import type * as Array from "effect/Array"

// Core imports
import type * as CoreAddress from "../../core/Address.js"
import * as CoreAssets from "../../core/Assets/index.js"
import * as Bytes32 from "../../core/Bytes32.js"
import * as PlutusData from "../../core/Data.js"
import * as DatumOption from "../../core/DatumOption.js"
import * as Ed25519Signature from "../../core/Ed25519Signature.js"
import type * as PlutusV1 from "../../core/PlutusV1.js"
import type * as PlutusV2 from "../../core/PlutusV2.js"
import type * as PlutusV3 from "../../core/PlutusV3.js"
import * as Redeemer from "../../core/Redeemer.js"
import * as Transaction from "../../core/Transaction.js"
import * as TransactionBody from "../../core/TransactionBody.js"
import * as TransactionHash from "../../core/TransactionHash.js"
import * as TransactionInput from "../../core/TransactionInput.js"
import * as TransactionWitnessSet from "../../core/TransactionWitnessSet.js"
import * as TxOut from "../../core/TxOut.js"
import * as CoreUTxO from "../../core/UTxO.js"
import * as VKey from "../../core/VKey.js"
// SDK imports (for conversion utilities)
import * as Address from "../Address.js"
import type * as Datum from "../Datum.js"
// Internal imports
import type { UnfrackOptions } from "./TransactionBuilder.js"
import { TransactionBuilderError, TxContext } from "./TransactionBuilder.js"
import * as Unfrack from "./Unfrack.js"

// ============================================================================
// TransactionBuilder Effect Programs Implementation
// ============================================================================

/**
 * This file contains the program creators that generate ProgramSteps.
 * ProgramSteps are deferred Effects executed during build() with fresh state.
 *
 * Architecture:
 * - Program creators return deferred Effects (ProgramSteps)
 * - Programs access TxContext (single unified Context) containing config, state, and options
 * - Programs are executed with fresh state on each build() call
 * - No state mutation between builds - complete isolation
 * - No prop drilling - everything accessible via single Context
 */

// ============================================================================
// Helper Functions - Address Utilities
// ============================================================================

/**
 * Check if an address is a script address (payment credential is ScriptHash).
 * Works with Core Address type.
 *
 * @since 2.0.0
 * @category helpers
 */
export const isScriptAddressCore = (address: CoreAddress.Address): boolean => {
  return address.paymentCredential._tag === "ScriptHash"
}

/**
 * Check if an address string is a script address (payment credential is ScriptHash).
 * Parses the address to extract its structure and checks the payment credential type.
 *
 * @since 2.0.0
 * @category helpers
 */
export const isScriptAddress = (address: string): Effect.Effect<boolean, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Parse address to structure
    const addressStructure = yield* Effect.try({
      try: () => Address.toCoreAddress(address),
      catch: (error) =>
        new TransactionBuilderError({
          message: `Failed to parse address: ${address}`,
          cause: error
        })
    })

    // Check if payment credential is a script hash
    return addressStructure.paymentCredential._tag === "ScriptHash"
  })

/**
 * Filter UTxOs to find those locked by scripts (script-locked UTxOs).
 *
 * @since 2.0.0
 * @category helpers
 */
export const filterScriptUtxos = (
  utxos: ReadonlyArray<CoreUTxO.UTxO>
): Effect.Effect<ReadonlyArray<CoreUTxO.UTxO>, TransactionBuilderError> =>
  Effect.gen(function* () {
    const scriptUtxos: Array<CoreUTxO.UTxO> = []

    for (const utxo of utxos) {
      // Core UTxO has address as Address class, check directly
      if (isScriptAddressCore(utxo.address)) {
        scriptUtxos.push(utxo)
      }
    }

    return scriptUtxos
  })

// ============================================================================
// Helper Functions - Asset Utilities
// ============================================================================

/**
 * Calculate total assets from a set of UTxOs.
 *
 * @since 2.0.0
 * @category helpers
 */
export const calculateTotalAssets = (utxos: ReadonlyArray<CoreUTxO.UTxO> | Set<CoreUTxO.UTxO>): CoreAssets.Assets => {
  const utxoArray = (globalThis.Array.isArray(utxos) ? utxos : globalThis.Array.from(utxos)) as ReadonlyArray<CoreUTxO.UTxO>
  return utxoArray.reduce((total: CoreAssets.Assets, utxo: CoreUTxO.UTxO) => CoreAssets.merge(total, utxo.assets), CoreAssets.zero)
}

/**
 * Calculate reference script fees using tiered pricing.
 * 
 * Reference scripts stored on-chain incur additional fees based on their size:
 * - First 25KB:  15 lovelace/byte
 * - Next 25KB:   25 lovelace/byte
 * - Next 150KB: 100 lovelace/byte
 * - Maximum: 200KB total
 * 
 * @param referenceInputs - UTxOs containing reference scripts
 * @returns Total reference script fee in lovelace
 * 
 * @since 2.0.0
 * @category helpers
 */
export const calculateReferenceScriptFee = (
  referenceInputs: ReadonlyArray<CoreUTxO.UTxO>
): Effect.Effect<bigint, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Calculate total reference script size in bytes
    let totalScriptSize = 0
    
    for (const utxo of referenceInputs) {
      if (utxo.scriptRef) {
        // Get script CBOR bytes length from Core Script type
        // Core scripts have a 'bytes' property with the raw script bytes
        const scriptBytes = utxo.scriptRef.bytes.length
        totalScriptSize += scriptBytes
      }
    }
    
    // No reference scripts = no fee
    if (totalScriptSize === 0) {
      return 0n
    }
    
    // Check maximum size limit (200KB)
    if (totalScriptSize > 200_000) {
      return yield* Effect.fail(
        new TransactionBuilderError({
          message: `Total reference script size (${totalScriptSize} bytes) exceeds maximum limit of 200,000 bytes`
        })
      )
    }
    
    // Calculate tiered fees
    let fee = 0n
    let remainingSize = totalScriptSize
    let tierIndex = 0
    const tierPrices = [15, 25, 100] // lovelace per byte for each tier
    const tierSize = 25_000 // 25KB per tier
    
    while (remainingSize > 0 && tierIndex < 3) {
      const bytesInThisTier = Math.min(remainingSize, tierSize)
      const tierFee = BigInt(Math.ceil(bytesInThisTier * tierPrices[tierIndex]!))
      fee += tierFee
      
      remainingSize -= tierSize
      tierIndex++
    }
    
    return fee
  })

// ============================================================================
// Helper Functions - Output Construction
// ============================================================================

/**
 * Convert SDK Datum to core DatumOption.
 * Parses CBOR hex strings for inline datums and hashes for datum references.
 *
 * @since 2.0.0
 * @category helpers
 */
export const makeDatumOption = (datum: Datum.Datum): Effect.Effect<DatumOption.DatumOption, TransactionBuilderError> =>
  Effect.gen(function* () {
    if (datum.type === "inlineDatum") {
      // Parse PlutusData from CBOR hex using Schema
      const plutusData = yield* Schema.decodeUnknown(PlutusData.FromCBORHex())(datum.inline)
      return new DatumOption.InlineDatum({ data: plutusData })
    }

    if (datum.type === "datumHash") {
      // Parse datum hash from hex string to Uint8Array using Schema
      const hashBytes = yield* Schema.decodeUnknown(Bytes32.BytesFromHex)(datum.hash)
      return new DatumOption.DatumHash({ hash: hashBytes })
    }

    return yield* Effect.fail(
      new TransactionBuilderError({
        message: `Unknown datum type: ${(datum as any).type}`
      })
    )
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: `Failed to parse datum: ${JSON.stringify(datum)}`,
          cause: error
        })
    )
  )

/**
 * Create a TransactionOutput from user-friendly parameters.
 * Uses Core types directly.
 *
 * TransactionOutput represents an output being created in a transaction.
 *
 * @since 2.0.0
 * @category helpers
 */
export const makeTxOutput = (params: {
  address: CoreAddress.Address
  assets: CoreAssets.Assets
  datum?: Datum.Datum
  scriptRef?: any // TODO: Add ScriptRef type
}): Effect.Effect<TxOut.TransactionOutput, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Address is already a Core Address type
    const address = params.address

    // Convert datum if provided
    let datumOption: DatumOption.DatumOption | undefined
    if (params.datum) {
      datumOption = yield* makeDatumOption(params.datum)
    }

    // Create Core TransactionOutput
    const output = new TxOut.TransactionOutput({
      address,
      assets: params.assets,
      datumOption,
      scriptRef: params.scriptRef
    })

    return output
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: `Failed to create TxOutput`,
          cause: error
        })
    )
  )

/**
 * Convert parameters to core TransactionOutput.
 * This is an internal conversion function used during transaction assembly.
 * Now uses Core Assets directly.
 *
 * @since 2.0.0
 * @category helpers
 * @internal
 */
export const txOutputToTransactionOutput = (params: {
  address: CoreAddress.Address
  assets: CoreAssets.Assets
  datum?: Datum.Datum
  scriptRef?: any // TODO: Add ScriptRef type
}): Effect.Effect<TxOut.TransactionOutput, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Address is already a Core Address type
    const address = params.address

    // Convert datum if provided
    let datumOption: DatumOption.DatumOption | undefined
    if (params.datum) {
      datumOption = yield* makeDatumOption(params.datum)
    }

    // Create TransactionOutput (unified format with assets)
    const output = new TxOut.TransactionOutput({
      address,
      assets: params.assets,
      datumOption,
      scriptRef: params.scriptRef
    })

    return output
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: `Failed to create transaction output`,
          cause: error
        })
    )
  )

/**
 * Merge additional assets into an existing UTxO.
 * Creates a new UTxO with combined assets from the original UTxO and additional assets.
 *
 * Use case: Draining wallet by merging leftover into an existing payment output.
 *
 * @since 2.0.0
 * @category helpers
 */
export const mergeAssetsIntoUTxO = (
  utxo: CoreUTxO.UTxO,
  additionalAssets: CoreAssets.Assets
): Effect.Effect<CoreUTxO.UTxO, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Merge assets using Core Assets helper
    const mergedAssets = CoreAssets.merge(utxo.assets, additionalAssets)
    // Create new UTxO with merged assets
    return new CoreUTxO.UTxO({
      transactionId: utxo.transactionId,
      index: utxo.index,
      address: utxo.address,
      assets: mergedAssets,
      datumOption: utxo.datumOption,
      scriptRef: utxo.scriptRef
    })
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Failed to merge assets into UTxO",
          cause: error
        })
    )
  )

/**
 * Merge additional assets into an existing TransactionOutput.
 * Creates a new output with combined assets from the original output and leftover assets.
 *
 * Use case: Draining wallet by merging leftover into an existing payment output.
 *
 * @since 2.0.0
 * @category helpers
 */
export const mergeAssetsIntoOutput = (
  output: TxOut.TransactionOutput,
  additionalAssets: CoreAssets.Assets
): Effect.Effect<TxOut.TransactionOutput, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Merge assets using Core Assets helper
    const mergedAssets = CoreAssets.merge(output.assets, additionalAssets)

    // Create new output with merged assets, preserving optional fields
    const newOutput = new TxOut.TransactionOutput({
      address: output.address,
      assets: mergedAssets,
      datumOption: output.datumOption,
      scriptRef: output.scriptRef
    })
    return newOutput
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Failed to merge assets into output",
          cause: error
        })
    )
  )

// ============================================================================
// Transaction Assembly
// ============================================================================

/**
 * Convert an array of UTxOs to an array of TransactionInputs.
 * Inputs are sorted by txHash then outputIndex for deterministic ordering.
 * Uses Core UTxO types directly.
 *
 * @since 2.0.0
 * @category assembly
 */
export const buildTransactionInputs = (
  utxos: ReadonlyArray<CoreUTxO.UTxO>
): Effect.Effect<ReadonlyArray<TransactionInput.TransactionInput>, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Convert each Core UTxO to TransactionInput
    const inputs: Array<TransactionInput.TransactionInput> = []

    for (const utxo of utxos) {
      // Create TransactionInput directly from Core UTxO fields
      const input = new TransactionInput.TransactionInput({
        transactionId: utxo.transactionId,
        index: utxo.index
      })

      inputs.push(input)
    }

    // Sort inputs for deterministic ordering:
    // First by transaction hash, then by output index
    inputs.sort((a, b) => {
      // Compare transaction hashes (byte arrays)
      const hashA = a.transactionId.hash
      const hashB = b.transactionId.hash

      for (let i = 0; i < hashA.length; i++) {
        if (hashA[i] !== hashB[i]) {
          return hashA[i] - hashB[i]
        }
      }

      // If hashes are equal, compare by index
      return Number(a.index - b.index)
    })

    return inputs
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Failed to build transaction inputs",
          cause: error
        })
    )
  )

/**
 * Assemble a Transaction from inputs, outputs, and calculated fee.
 * Creates TransactionBody with all required fields.
 *
 * Uses Core TransactionOutput directly.
 *
 * This is minimal assembly with accurate fee:
 * - Build witness set with redeemers and signatures (Step 4 - future)
 * - Run script evaluation to fill ExUnits (Step 5 - future)
 * - Add change output (Step 6 - future)
 *
 * @since 2.0.0
 * @category assembly
 */
export const assembleTransaction = (
  inputs: ReadonlyArray<TransactionInput.TransactionInput>,
  outputs: ReadonlyArray<TxOut.TransactionOutput>,
  fee: bigint
): Effect.Effect<Transaction.Transaction, TransactionBuilderError, TxContext> =>
  Effect.gen(function* () {
    // Get state ref to access scripts and redeemers
    const stateRef = yield* TxContext
    const state = yield* Ref.get(stateRef)

    yield* Effect.logDebug(`[Assembly] Building transaction with ${inputs.length} inputs, ${outputs.length} outputs`)
    yield* Effect.logDebug(`[Assembly] Scripts in state: ${state.scripts.size}`)
    yield* Effect.logDebug(`[Assembly] Redeemers in state: ${state.redeemers.size}`)

    // Outputs are already Core TransactionOutputs
    const transactionOutputs = outputs as Array<TxOut.TransactionOutput>

    // Build collateral inputs if present
    let collateralInputs: Array.NonEmptyReadonlyArray<TransactionInput.TransactionInput> | undefined
    let collateralReturn: TxOut.TransactionOutput | undefined
    let totalCollateral: bigint | undefined

    if (state.collateral) {
      yield* Effect.logDebug(
        `[Assembly] Adding collateral: ${state.collateral.inputs.length} inputs, ` +
          `total ${state.collateral.totalAmount} lovelace`
      )

      // Collateral phase guarantees at least one input for script transactions
      collateralInputs = (yield* buildTransactionInputs(state.collateral.inputs)) as Array.NonEmptyReadonlyArray<TransactionInput.TransactionInput>
      totalCollateral = state.collateral.totalAmount

      // Collateral return is already a Core TransactionOutput
      if (state.collateral.returnOutput) {
        yield* Effect.logDebug(
          `[Assembly] Collateral return lovelace: ${state.collateral.returnOutput.assets.lovelace}`
        )
        collateralReturn = state.collateral.returnOutput
      }
    }

    // Convert reference inputs from UTxOs to TransactionInputs (only if there are any)
    let referenceInputs:
      | readonly [TransactionInput.TransactionInput, ...Array<TransactionInput.TransactionInput>]
      | undefined
    if (state.referenceInputs.length > 0) {
      const refInputs = yield* buildTransactionInputs(state.referenceInputs)
      referenceInputs = refInputs as readonly [
        TransactionInput.TransactionInput,
        ...Array<TransactionInput.TransactionInput>,
      ]
    }

    // Create TransactionBody with calculated fee
    const body = new TransactionBody.TransactionBody({
      inputs: inputs as Array<TransactionInput.TransactionInput>,
      outputs: transactionOutputs,
      fee, // Now using actual calculated fee, not placeholder
      collateralInputs, // Collateral inputs from Collateral phase
      collateralReturn, // Collateral return output from Collateral phase
      totalCollateral, // Total collateral amount from Collateral phase
      referenceInputs // Reference inputs for reading on-chain data (undefined if none)
      // Optional fields omitted for now:
      // - ttl: will be set if setValidityRange is called
      // - certificates: will be set if certificate operations added
      // - withdrawals: will be set if withdrawal operations added
      // - auxiliaryDataHash: will be set if metadata added
      // - validityIntervalStart: will be set if setValidityRange is called
      // - mint: will be set if mint/burn operations added
      // - scriptDataHash: will be calculated when building witness set
      // - collateralInputs: will be set during witness building
      // - requiredSigners: will be set if addSigner is called
      // - networkId: will be set from config
      // - collateralReturn: will be calculated during witness building
      // - totalCollateral: will be calculated during witness building
      // - votingProcedures: N/A for transaction building
      // - proposalProcedures: N/A for transaction building
      // - currentTreasuryValue: N/A for transaction building
      // - donation: N/A for transaction building
    })

    // Populate witness set with scripts and redeemers from state
    const plutusV1Scripts: Array<PlutusV1.PlutusV1> = []
    const plutusV2Scripts: Array<PlutusV2.PlutusV2> = []
    const plutusV3Scripts: Array<PlutusV3.PlutusV3> = []
    const nativeScripts: Array<any> = [] // TODO: Add native script type

    // Group scripts by type
    for (const [scriptHash, coreScript] of state.scripts) {
      yield* Effect.logDebug(`[Assembly] Processing script with hash: ${scriptHash}, type: ${coreScript._tag}`)

      switch (coreScript._tag) {
        case "PlutusV1":
          plutusV1Scripts.push(coreScript) // Push whole script object, not just bytes
          break
        case "PlutusV2":
          plutusV2Scripts.push(coreScript) // Push whole script object, not just bytes
          break
        case "PlutusV3":
          plutusV3Scripts.push(coreScript) // Push whole script object, not just bytes
          break
        case "NativeScript":
          nativeScripts.push(coreScript)
          break
      }
    }

    // Build redeemers array from state
    const redeemers: Array<Redeemer.Redeemer> = []

    // Create a mapping from UTxO reference (txHash#outputIndex) to input index
    const inputIndexMap = new Map<string, number>()
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]!
      const txHashHex = TransactionHash.toHex(input.transactionId)
      const key = `${txHashHex}#${input.index}`
      yield* Effect.logDebug(`[Assembly] Input ${i}: ${key}`)
      inputIndexMap.set(key, i)
    }

    yield* Effect.logDebug(`[Assembly] Input index map has ${inputIndexMap.size} entries`)
    yield* Effect.logDebug(`[Assembly] Redeemer map keys: ${globalThis.Array.from(state.redeemers.keys()).join(", ")}`)

    // Build redeemers with correct indices
    for (const [key, redeemerData] of state.redeemers) {
      yield* Effect.logDebug(`[Assembly] Processing redeemer for key: ${key}`)

      // Find the index of this input
      const inputIndex = inputIndexMap.get(key)
      if (inputIndex === undefined) {
        yield* Effect.logWarning(`[Assembly] Could not find input index for redeemer key: ${key}`)
        continue
      }

      // Parse the redeemer data from CBOR hex
      const plutusData = PlutusData.fromCBORHex(redeemerData.data)

      yield* Effect.logDebug(
        `[Assembly] Redeemer exUnits before creating: mem=${redeemerData.exUnits?.mem ?? 0n}, steps=${redeemerData.exUnits?.steps ?? 0n}`
      )

      // Create proper Redeemer object
      const redeemer = new Redeemer.Redeemer({
        tag: redeemerData.tag, // "spend", "mint", "cert", or "reward"
        index: BigInt(inputIndex), // Use actual input index
        data: plutusData,
        exUnits: redeemerData.exUnits
          ? new Redeemer.ExUnits({ mem: redeemerData.exUnits.mem, steps: redeemerData.exUnits.steps })
          : new Redeemer.ExUnits({ mem: 0n, steps: 0n }) // will be updated by script evaluation
      })

      yield* Effect.logDebug(
        `[Assembly] Created redeemer: tag=${redeemer.tag}, index=${redeemer.index}, exUnits=[${redeemer.exUnits.mem}, ${redeemer.exUnits.steps}]`
      )

      redeemers.push(redeemer)
    }

    // Extract plutus data (datums) from selected UTxOs
    const plutusDataArray: Array<PlutusData.Data> = []
    for (const utxo of state.selectedUtxos) {
      if (utxo.datumOption?._tag === "InlineDatum") {
        // Inline datum contains PlutusData directly
        plutusDataArray.push(utxo.datumOption.data)
        yield* Effect.logDebug(`[Assembly] Extracted inline datum from UTxO`)
      }
    }

    yield* Effect.logDebug(`[Assembly] WitnessSet populated:`)
    yield* Effect.logDebug(`  - PlutusV2 scripts: ${plutusV2Scripts.length}`)
    yield* Effect.logDebug(`  - Redeemers: ${redeemers.length}`)
    yield* Effect.logDebug(`  - Plutus data: ${plutusDataArray.length}`)

    // Create witness set with scripts and redeemers
    const witnessSet = new TransactionWitnessSet.TransactionWitnessSet({
      vkeyWitnesses: [],
      nativeScripts,
      bootstrapWitnesses: [],
      plutusV1Scripts,
      plutusData: plutusDataArray,
      redeemers,
      plutusV2Scripts,
      plutusV3Scripts
    })

    // Create Transaction
    const transaction = new Transaction.Transaction({
      body,
      witnessSet,
      isValid: true, // Assume valid until script evaluation proves otherwise
      auxiliaryData: null // Will be set if metadata operations added
    })

    return transaction
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Failed to assemble transaction",
          cause: error
        })
    )
  )

// ============================================================================
// Fee Calculation
// ============================================================================

/**
 * Calculate the size of a transaction in bytes for fee estimation.
 * Uses CBOR serialization to get accurate size.
 *
 * @since 2.0.0
 * @category fee-calculation
 */
export const calculateTransactionSize = (
  transaction: Transaction.Transaction
): Effect.Effect<number, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Serialize transaction to CBOR bytes using sync function
    const cborBytes = yield* Effect.try({
      try: () => Transaction.toCBORBytes(transaction),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to encode transaction to CBOR",
          cause: error
        })
    })

    return cborBytes.length
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Failed to calculate transaction size",
          cause: error
        })
    )
  )

/**
 * Calculate minimum transaction fee based on protocol parameters.
 *
 * Formula: minFee = txSizeInBytes × minFeeCoefficient + minFeeConstant
 *
 * @since 2.0.0
 * @category fee-calculation
 */
export const calculateMinimumFee = (
  transactionSizeBytes: number,
  protocolParams: {
    minFeeCoefficient: bigint // minFeeA
    minFeeConstant: bigint // minFeeB
  }
): bigint => {
  const { minFeeCoefficient, minFeeConstant } = protocolParams

  return BigInt(transactionSizeBytes) * minFeeCoefficient + minFeeConstant
}

/**
 * Extract payment key hash from a Cardano address.
 * Returns null if address has script credential or no payment credential.
 *
 * @since 2.0.0
 * @category fee-calculation
 * @internal
 */
export const extractPaymentKeyHash = (address: string): Effect.Effect<Uint8Array | null, TransactionBuilderError> =>
  Effect.gen(function* () {
    const addressStructure = yield* Effect.try({
      try: () => Address.toCoreAddress(address),
      catch: (error) =>
        new TransactionBuilderError({
          message: `Failed to parse address ${address}`,
          cause: error
        })
    })

    // Check if payment credential is a KeyHash
    if (addressStructure.paymentCredential?._tag === "KeyHash" && addressStructure.paymentCredential.hash) {
      return addressStructure.paymentCredential.hash
    }

    return null
  })

/**
 * Extract payment key hash from a Core Address.
 * Returns null if address has script credential or no payment credential.
 *
 * @since 2.0.0
 * @category fee-calculation
 * @internal
 */
const extractPaymentKeyHashFromCore = (address: CoreAddress.Address): Uint8Array | null => {
  // Check if payment credential is a KeyHash
  if (address.paymentCredential._tag === "KeyHash" && address.paymentCredential.hash) {
    return address.paymentCredential.hash
  }
  return null
}

/**
 * Build a fake VKeyWitness for fee estimation.
 * Creates a witness with 32-byte vkey and 64-byte signature (96 bytes total).
 * This matches CML's approach for accurate witness size calculation.
 *
 * @since 2.0.0
 * @category fee-calculation
 * @internal
 */
const buildFakeVKeyWitness = (
  keyHash: Uint8Array
): Effect.Effect<TransactionWitnessSet.VKeyWitness, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Pad key hash to 32 bytes for vkey (Ed25519 public key size)
    const vkeyBytes = new Uint8Array(32)
    vkeyBytes.set(keyHash.slice(0, Math.min(keyHash.length, 32)))

    // Create 64-byte dummy signature (Ed25519 signature size)
    const signatureBytes = new Uint8Array(64)

    const vkey = yield* Effect.try({
      try: () => new VKey.VKey({ bytes: vkeyBytes }),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to create fake VKey",
          cause: error
        })
    })

    const signature = yield* Effect.try({
      try: () => new Ed25519Signature.Ed25519Signature({ bytes: signatureBytes }),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to create fake signature",
          cause: error
        })
    })

    return new TransactionWitnessSet.VKeyWitness({
      vkey,
      signature
    })
  })

/**
 * Build a fake witness set for fee estimation from transaction inputs.
 * Extracts unique payment key hashes from input addresses and creates
 * fake witnesses to accurately estimate witness set size in CBOR.
 *
 * @since 2.0.0
 * @category fee-calculation
 */
export const buildFakeWitnessSet = (
  inputUtxos: ReadonlyArray<CoreUTxO.UTxO>
): Effect.Effect<TransactionWitnessSet.TransactionWitnessSet, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Extract unique key hashes from input addresses (Core Address)
    const keyHashesSet = new Set<string>()
    const keyHashes: Array<Uint8Array> = []

    for (const utxo of inputUtxos) {
      const keyHash = extractPaymentKeyHashFromCore(utxo.address)
      if (keyHash) {
        const keyHashHex = Buffer.from(keyHash).toString("hex")
        if (!keyHashesSet.has(keyHashHex)) {
          keyHashesSet.add(keyHashHex)
          keyHashes.push(keyHash)
        }
      }
    }

    // Build fake witnesses for each unique key hash
    const vkeyWitnesses: Array<TransactionWitnessSet.VKeyWitness> = []
    for (const keyHash of keyHashes) {
      const witness = yield* buildFakeVKeyWitness(keyHash)
      vkeyWitnesses.push(witness)
    }

    return new TransactionWitnessSet.TransactionWitnessSet({
      vkeyWitnesses,
      nativeScripts: [],
      bootstrapWitnesses: [],
      plutusV1Scripts: [],
      plutusData: [],
      redeemers: [],
      plutusV2Scripts: [],
      plutusV3Scripts: []
    })
  })

/**
 * Calculate transaction fee iteratively until stable.
 *
 * Algorithm:
 * 1. Build fake witness set from input UTxOs for accurate size estimation
 * 2. Build transaction with fee = 0
 * 3. Calculate size and fee
 * 4. Rebuild transaction with calculated fee
 * 5. If size changed, recalculate (usually converges in 1-2 iterations)
 *
 * @since 2.0.0
 * @category fee-calculation
 */
export const calculateFeeIteratively = (
  inputUtxos: ReadonlyArray<CoreUTxO.UTxO>,
  inputs: ReadonlyArray<TransactionInput.TransactionInput>,
  outputs: ReadonlyArray<TxOut.TransactionOutput>,
  redeemers: Map<
    string,
    {
      readonly tag: "spend" | "mint" | "cert" | "reward"
      readonly data: string
      readonly exUnits?: { readonly mem: bigint; readonly steps: bigint }
    }
  >,
  protocolParams: {
    minFeeCoefficient: bigint
    minFeeConstant: bigint
    priceMem?: number
    priceStep?: number
  }
): Effect.Effect<bigint, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Build fake witness set once for accurate size estimation
    const fakeWitnessSet = yield* buildFakeWitnessSet(inputUtxos)

    // Outputs are already Core TransactionOutputs
    const transactionOutputs = outputs as Array<TxOut.TransactionOutput>

    let currentFee = 0n
    let previousSize = 0
    let previousFee = 0n
    let iterations = 0
    const maxIterations = 10 // Increase to ensure convergence

    while (iterations < maxIterations) {
      // Build transaction with current fee estimate
      const body = new TransactionBody.TransactionBody({
        inputs: inputs as Array<TransactionInput.TransactionInput>,
        outputs: transactionOutputs,
        fee: currentFee
      })

      const transaction = new Transaction.Transaction({
        body,
        witnessSet: fakeWitnessSet, // Use fake witness set for accurate size
        isValid: true,
        auxiliaryData: null
      })

      // Calculate size
      const size = yield* calculateTransactionSize(transaction)

      // Calculate base fee based on size
      const baseFee = calculateMinimumFee(size, {
        minFeeCoefficient: protocolParams.minFeeCoefficient,
        minFeeConstant: protocolParams.minFeeConstant
      })

      // Calculate ExUnits cost from redeemers (if pricing available)
      let exUnitsCost = 0n
      if (protocolParams.priceMem && protocolParams.priceStep) {
        for (const [_, redeemerData] of redeemers) {
          if (redeemerData.exUnits) {
            const memCost = BigInt(Math.ceil(protocolParams.priceMem * Number(redeemerData.exUnits.mem)))
            const stepsCost = BigInt(Math.ceil(protocolParams.priceStep * Number(redeemerData.exUnits.steps)))
            exUnitsCost += memCost + stepsCost
          }
        }
      }

      const calculatedFee = baseFee + exUnitsCost

      // Check if fully converged: fee is stable AND size is stable
      if (currentFee === previousFee && size === previousSize && currentFee >= calculatedFee) {
        if (iterations > 1) {
          yield* Effect.logDebug(
            `Fee converged after ${iterations} iterations: ${currentFee} lovelace (tx size: ${size} bytes)`
          )
        }
        return currentFee
      }

      // Update for next iteration
      previousFee = currentFee
      currentFee = calculatedFee
      previousSize = size
      iterations++
    }

    // Didn't converge within max iterations - return the calculated fee
    yield* Effect.logDebug(`Fee calculation reached max iterations (${maxIterations}): ${currentFee} lovelace`)
    return currentFee
  }).pipe(
    Effect.mapError(
      (error) =>
        new TransactionBuilderError({
          message: "Fee calculation failed to converge",
          cause: error
        })
    )
  )

// ============================================================================
// Balance Verification for Re-selection Loop
// ============================================================================

/**
 * Verify if selected UTxOs can cover outputs + fee for ALL assets.
 * Used by the re-selection loop to determine if more UTxOs are needed.
 *
 * Checks both lovelace AND native assets (tokens/NFTs) to ensure complete balance.
 *
 * @since 2.0.0
 * @category fee-calculation
 */
export const verifyTransactionBalance = (
  selectedUtxos: ReadonlyArray<CoreUTxO.UTxO>,
  outputs: ReadonlyArray<TxOut.TransactionOutput>,
  fee: bigint
): { sufficient: boolean; shortfall: bigint; change: bigint } => {
  // Sum all input assets using Core Assets
  const totalInputAssets = selectedUtxos.reduce(
    (acc, utxo) => CoreAssets.merge(acc, utxo.assets),
    CoreAssets.zero
  )

  // Sum all output assets using Core Assets
  const totalOutputAssets = outputs.reduce(
    (acc, output) => CoreAssets.merge(acc, output.assets),
    CoreAssets.zero
  )

  // Add fee to required lovelace
  const requiredAssets = CoreAssets.withLovelace(
    totalOutputAssets,
    totalOutputAssets.lovelace + fee
  )

  // Calculate balance for ALL assets: inputs - (outputs + fee)
  const balance = CoreAssets.subtract(totalInputAssets, requiredAssets)

  // Check if ANY asset is negative (insufficient)
  let hasShortfall = false
  let lovelaceShortfall = 0n

  // Check lovelace
  const balanceLovelace = balance.lovelace
  if (balanceLovelace < 0n) {
    hasShortfall = true
    lovelaceShortfall = -balanceLovelace
  }

  // Check all native assets using Core Assets helpers
  for (const unit of CoreAssets.getUnits(balance)) {
    if (unit !== "lovelace") {
      const amount = CoreAssets.getByUnit(balance, unit)
      if (amount < 0n) {
        hasShortfall = true
        // For native asset shortfalls, we still return lovelace shortfall
        // since coin selection will need to find UTxOs with both lovelace AND the missing asset
        // Add some lovelace buffer to encourage selection of UTxOs with native assets
        lovelaceShortfall = lovelaceShortfall > 0n ? lovelaceShortfall : 100_000n
        break
      }
    }
  }

  return {
    sufficient: !hasShortfall,
    shortfall: lovelaceShortfall,
    change: balanceLovelace > 0n ? balanceLovelace : 0n
  }
}

// ============================================================================
// Balance Validation
// ============================================================================

/**
 * Validate that inputs cover outputs plus fee.
 * This is the ONLY validation for minimal build - no coin selection.
 *
 * @since 2.0.0
 * @category validation
 */
export const validateTransactionBalance = (params: {
  totalInputAssets: CoreAssets.Assets
  totalOutputAssets: CoreAssets.Assets
  fee: bigint
}): Effect.Effect<void, TransactionBuilderError> =>
  Effect.gen(function* () {
    const { fee, totalInputAssets, totalOutputAssets } = params

    // Calculate total outputs including fee (outputs + fee)
    const totalRequired = CoreAssets.withLovelace(
      totalOutputAssets,
      totalOutputAssets.lovelace + fee
    )

    // Check each asset using Core Assets helpers
    for (const unit of CoreAssets.getUnits(totalRequired)) {
      const requiredAmount = CoreAssets.getByUnit(totalRequired, unit)
      const availableAmount = CoreAssets.getByUnit(totalInputAssets, unit)

      if (availableAmount < requiredAmount) {
        const shortfall = requiredAmount - availableAmount

        return yield* Effect.fail(
          new TransactionBuilderError({
            message: `Insufficient ${unit}: need ${requiredAmount}, have ${availableAmount} (short by ${shortfall})`,
            cause: {
              unit,
              required: String(requiredAmount),
              available: String(availableAmount),
              shortfall: String(shortfall)
            }
          })
        )
      }
    }

    // All assets covered
  })

/**
 * Calculate leftover assets (will become excess fee in minimal build).
 *
 * @since 2.0.0
 * @category validation
 */
export const calculateLeftoverAssets = (params: {
  totalInputAssets: CoreAssets.Assets
  totalOutputAssets: CoreAssets.Assets
  fee: bigint
}): CoreAssets.Assets => {
  const { fee, totalInputAssets, totalOutputAssets } = params

  // Start with inputs, subtract outputs using Core Assets
  const afterOutputs = CoreAssets.subtract(totalInputAssets, totalOutputAssets)
  // Subtract fee from lovelace
  const leftover = CoreAssets.withLovelace(afterOutputs, afterOutputs.lovelace - fee)

  // Filter out zero or negative amounts using Core Assets filter
  return CoreAssets.filter(leftover, (_unit, amount) => amount > 0n)
}

/**
 * Calculate minimum ADA required for a UTxO based on its actual CBOR size.
 * Uses the Babbage-era formula: coinsPerUtxoByte * utxoSize.
 *
 * This function creates a temporary TransactionOutput, encodes it to CBOR,
 * and calculates the exact size to determine the minimum lovelace required.
 *
 * @since 2.0.0
 * @category change
 */
export const calculateMinimumUtxoLovelace = (params: {
  address: CoreAddress.Address
  assets: CoreAssets.Assets
  datum?: Datum.Datum
  scriptRef?: any
  coinsPerUtxoByte: bigint
}): Effect.Effect<bigint, TransactionBuilderError> =>
  Effect.gen(function* () {
    // Create a temporary TransactionOutput to calculate its CBOR size
    const tempOutput = yield* txOutputToTransactionOutput({
      address: params.address,
      assets: params.assets,
      datum: params.datum,
      scriptRef: params.scriptRef
    })

    // Encode to CBOR bytes to get the actual size
    const cborBytes = yield* Effect.try({
      try: () => TxOut.toCBORBytes(tempOutput),
      catch: (error) =>
        new TransactionBuilderError({
          message: "Failed to encode output to CBOR for min UTxO calculation",
          cause: error
        })
    })

    // Calculate minimum lovelace: coinsPerUtxoByte * size
    return params.coinsPerUtxoByte * BigInt(cborBytes.length)
  })

/**
 * Create change output(s) for leftover assets.
 *
 * When unfracking is disabled (default):
 * 1. Check if leftover assets exist
 * 2. Calculate minimum ADA required for change output
 * 3. If leftover lovelace < minimum, cannot create change (warning)
 * 4. Create single output with all leftover assets to change address
 *
 * When unfracking is enabled:
 * 1. Apply Unfrack.It optimization strategies
 * 2. Bundle tokens into optimally-sized UTxOs
 * 3. Isolate fungible tokens if configured
 * 4. Group NFTs by policy if configured
 * 5. Roll up or subdivide ADA-only UTxOs
 * 6. Return multiple change outputs for optimal wallet structure
 *
 * @since 2.0.0
 * @category change
 */
export const createChangeOutput = (params: {
  leftoverAssets: CoreAssets.Assets
  changeAddress: CoreAddress.Address
  coinsPerUtxoByte: bigint
  unfrackOptions?: UnfrackOptions
}): Effect.Effect<ReadonlyArray<TxOut.TransactionOutput>, TransactionBuilderError> =>
  Effect.gen(function* () {
    const { changeAddress, coinsPerUtxoByte, leftoverAssets, unfrackOptions } = params

    // If no leftover, no change needed
    if (CoreAssets.isEmpty(leftoverAssets)) {
      yield* Effect.logDebug(`[createChangeOutput] No leftover assets, skipping change`)
      return []
    }

    // If unfracking is enabled, use Unfrack module
    if (unfrackOptions) {
      const unfrackedOutputs = yield* Unfrack.createUnfrackedChangeOutputs(
        changeAddress,
        leftoverAssets,
        unfrackOptions,
        coinsPerUtxoByte
      ).pipe(
        Effect.mapError(
          (error) =>
            new TransactionBuilderError({
              message: `Failed to create unfracked change outputs: ${error.message}`,
              cause: error
            })
        )
      )

      yield* Effect.logDebug(`[createChangeOutput] Created ${unfrackedOutputs.length} unfracked change outputs`)
      return unfrackedOutputs
    }

    // Default behavior: single change output using accurate CBOR-based calculation
    // Calculate minimum UTxO using actual CBOR encoding size
    const minLovelace = yield* calculateMinimumUtxoLovelace({
      address: changeAddress,
      assets: leftoverAssets,
      coinsPerUtxoByte
    })

    // Check if we have enough lovelace for change
    const leftoverLovelace = leftoverAssets.lovelace

    yield* Effect.logDebug(
      `[createChangeOutput] Leftover: ${leftoverLovelace} lovelace, MinUTxO: ${minLovelace} lovelace`
    )

    if (leftoverLovelace < minLovelace) {
      // Not enough lovelace to create valid change output
      // This is not an error - just means leftover becomes extra fee
      yield* Effect.logDebug(
        `[createChangeOutput] Insufficient lovelace for change (${leftoverLovelace} < ${minLovelace}), returning empty`
      )
      return []
    }

    // Create change output using Core TransactionOutput
    const changeOutput = yield* makeTxOutput({
      address: changeAddress,
      assets: leftoverAssets
    })

    yield* Effect.logDebug(`[createChangeOutput] Created 1 change output with ${leftoverLovelace} lovelace`)

    return [changeOutput]
  })
