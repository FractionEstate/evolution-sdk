/**
 * @fileoverview Blockfrost API schemas and transformation utilities
 * Internal module for Blockfrost provider implementation
 */

import { Schema } from "effect"

import * as CoreAddress from "../../../Address.js"
import * as CoreAssets from "../../../Assets/index.js"
import * as PoolKeyHash from "../../../PoolKeyHash.js"
import * as Redeemer from "../../../Redeemer.js"
import * as TransactionHash from "../../../TransactionHash.js"
import * as CoreUTxO from "../../../UTxO.js"
import type { EvalRedeemer } from "../../EvalRedeemer.js"
import type * as Provider from "../Provider.js"

// ============================================================================
// Blockfrost API Response Schemas
// ============================================================================

/**
 * Blockfrost protocol parameters response schema
 */
export const BlockfrostProtocolParameters = Schema.Struct({
  min_fee_a: Schema.Number,
  min_fee_b: Schema.Number,
  pool_deposit: Schema.String,
  key_deposit: Schema.String,
  min_utxo: Schema.String,
  max_tx_size: Schema.Number,
  max_val_size: Schema.optional(Schema.String),
  utxo_cost_per_word: Schema.optional(Schema.String),
  cost_models: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  price_mem: Schema.optional(Schema.Number),
  price_step: Schema.optional(Schema.Number),
  max_tx_ex_mem: Schema.optional(Schema.String),
  max_tx_ex_steps: Schema.optional(Schema.String),
  max_block_ex_mem: Schema.optional(Schema.String),
  max_block_ex_steps: Schema.optional(Schema.String),
  max_block_size: Schema.Number,
  collateral_percent: Schema.optional(Schema.Number),
  max_collateral_inputs: Schema.optional(Schema.Number),
  coins_per_utxo_size: Schema.optional(Schema.String),
  min_fee_ref_script_cost_per_byte: Schema.optional(Schema.Number)
})

export type BlockfrostProtocolParameters = Schema.Schema.Type<typeof BlockfrostProtocolParameters>

/**
 * Blockfrost UTxO amount schema (for multi-asset support)
 */
export const BlockfrostAmount = Schema.Struct({
  unit: Schema.String,
  quantity: Schema.String
})

export type BlockfrostAmount = Schema.Schema.Type<typeof BlockfrostAmount>

/**
 * Blockfrost UTxO response schema
 */
export const BlockfrostUTxO = Schema.Struct({
  tx_hash: Schema.String,
  tx_index: Schema.Number,
  output_index: Schema.Number,
  amount: Schema.Array(BlockfrostAmount),
  block: Schema.String,
  data_hash: Schema.NullOr(Schema.String),
  inline_datum: Schema.NullOr(Schema.String),
  reference_script_hash: Schema.NullOr(Schema.String)
})

export type BlockfrostUTxO = Schema.Schema.Type<typeof BlockfrostUTxO>

/**
 * Blockfrost delegation response schema
 */
export const BlockfrostDelegation = Schema.Struct({
  active: Schema.Boolean,
  pool_id: Schema.NullOr(Schema.String),
  live_stake: Schema.String,
  active_stake: Schema.String
})

export type BlockfrostDelegation = Schema.Schema.Type<typeof BlockfrostDelegation>

/**
 * Blockfrost transaction submit response schema
 */
export const BlockfrostSubmitResponse = Schema.String

export type BlockfrostSubmitResponse = Schema.Schema.Type<typeof BlockfrostSubmitResponse>

/**
 * Blockfrost datum response schema
 */
export const BlockfrostDatum = Schema.Struct({
  json_value: Schema.optional(Schema.Unknown),
  cbor: Schema.String
})

export type BlockfrostDatum = Schema.Schema.Type<typeof BlockfrostDatum>

/**
 * Blockfrost transaction evaluation response schema
 */
export const BlockfrostRedeemer = Schema.Struct({
  tx_index: Schema.Number,
  purpose: Schema.Literal("spend", "mint", "cert", "reward"),
  unit_mem: Schema.String,
  unit_steps: Schema.String,
  fee: Schema.String
})

/**
 * Blockfrost evaluation response schema (array format)
 * Used by /utils/txs/evaluate endpoint (CBOR body, no additional UTxOs)
 */
export const BlockfrostEvaluationResponse = Schema.Struct({
  result: Schema.Struct({
    EvaluationResult: Schema.Array(BlockfrostRedeemer)
  })
})

export type BlockfrostEvaluationResponse = Schema.Schema.Type<typeof BlockfrostEvaluationResponse>

/**
 * Schema for JSONWSP-wrapped Ogmios evaluation response
 * Used by /utils/txs/evaluate/utxos endpoint
 * Format: { type: "jsonwsp/response", result: { EvaluationResult: { "spend:0": { memory, steps } } } }
 */
export const JsonwspOgmiosEvaluationResponse = Schema.Struct({
  type: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  servicename: Schema.optional(Schema.String),
  methodname: Schema.optional(Schema.String),
  result: Schema.Struct({
    EvaluationResult: Schema.Record({
      key: Schema.String, // "spend:0", "mint:1", etc.
      value: Schema.Struct({
        memory: Schema.Number,
        steps: Schema.Number
      })
    })
  }),
  reflection: Schema.optional(Schema.Unknown)
})

export type JsonwspOgmiosEvaluationResponse = Schema.Schema.Type<typeof JsonwspOgmiosEvaluationResponse>

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform Blockfrost protocol parameters to Evolution SDK format
 */
export const transformProtocolParameters = (
  blockfrostParams: BlockfrostProtocolParameters
): Provider.ProtocolParameters => {
  return {
    minFeeA: blockfrostParams.min_fee_a,
    minFeeB: blockfrostParams.min_fee_b,
    poolDeposit: BigInt(blockfrostParams.pool_deposit),
    keyDeposit: BigInt(blockfrostParams.key_deposit),
    maxTxSize: blockfrostParams.max_tx_size,
    maxValSize: blockfrostParams.max_val_size ? Number(blockfrostParams.max_val_size) : 0,
    priceMem: blockfrostParams.price_mem || 0,
    priceStep: blockfrostParams.price_step || 0,
    maxTxExMem: blockfrostParams.max_tx_ex_mem ? BigInt(blockfrostParams.max_tx_ex_mem) : 0n,
    maxTxExSteps: blockfrostParams.max_tx_ex_steps ? BigInt(blockfrostParams.max_tx_ex_steps) : 0n,
    coinsPerUtxoByte: blockfrostParams.coins_per_utxo_size ? BigInt(blockfrostParams.coins_per_utxo_size) : 0n,
    collateralPercentage: blockfrostParams.collateral_percent || 0,
    maxCollateralInputs: blockfrostParams.max_collateral_inputs || 0,
    minFeeRefScriptCostPerByte: blockfrostParams.min_fee_ref_script_cost_per_byte || 0,
    drepDeposit: 0n, // Not provided by this endpoint
    govActionDeposit: 0n, // Not provided by this endpoint
    costModels: {
      PlutusV1: (blockfrostParams.cost_models?.PlutusV1 as Record<string, number>) || {},
      PlutusV2: (blockfrostParams.cost_models?.PlutusV2 as Record<string, number>) || {},
      PlutusV3: (blockfrostParams.cost_models?.PlutusV3 as Record<string, number>) || {}
    }
  }
}

/**
 * Transform Blockfrost amounts to Core Assets
 */
export const transformAmounts = (amounts: ReadonlyArray<BlockfrostAmount>): CoreAssets.Assets => {
  let lovelace = 0n
  const multiAssetEntries: Array<[string, bigint]> = []
  
  for (const amount of amounts) {
    if (amount.unit === "lovelace") {
      lovelace = BigInt(amount.quantity)
    } else {
      multiAssetEntries.push([amount.unit, BigInt(amount.quantity)])
    }
  }
  
  // Build Core Assets starting with lovelace
  let assets = CoreAssets.fromLovelace(lovelace)
  
  // Add multi-assets if any using hex strings
  for (const [unit, qty] of multiAssetEntries) {
    // Parse unit - policyId is first 56 chars, assetName is remainder
    const policyIdHex = unit.slice(0, 56)
    const assetNameHex = unit.slice(56)
    assets = CoreAssets.addByHex(assets, policyIdHex, assetNameHex, qty)
  }
  
  return assets
}

/**
 * Transform Blockfrost UTxO to Core UTxO
 */
export const transformUTxO = (blockfrostUtxo: BlockfrostUTxO, addressStr: string): CoreUTxO.UTxO => {
  const assets = transformAmounts(blockfrostUtxo.amount)
  const address = CoreAddress.fromBech32(addressStr)
  const transactionId = TransactionHash.fromHex(blockfrostUtxo.tx_hash)

  // TODO: Handle datum and script ref when Core types support them
  // let datumOption: Datum.Datum | undefined = undefined
  // if (blockfrostUtxo.inline_datum) {
  //   datumOption = { type: "inlineDatum", inline: blockfrostUtxo.inline_datum }
  // } else if (blockfrostUtxo.data_hash) {
  //   datumOption = { type: "datumHash", hash: blockfrostUtxo.data_hash }
  // }

  return new CoreUTxO.UTxO({
    transactionId,
    index: BigInt(blockfrostUtxo.output_index),
    address,
    assets
  })
}

/**
 * Transform Blockfrost delegation to delegation info
 */
export const transformDelegation = (blockfrostDelegation: BlockfrostDelegation): Provider.Delegation => {
  if (!blockfrostDelegation.active || !blockfrostDelegation.pool_id) {
    return { poolId: null, rewards: 0n }
  }

  const poolId = Schema.decodeSync(PoolKeyHash.FromHex)(blockfrostDelegation.pool_id)
  return { poolId, rewards: BigInt(blockfrostDelegation.active_stake) }
}

/**
 * Transform Blockfrost evaluation response to Evolution SDK format
 */
export const transformEvaluationResult = (
  blockfrostResponse: BlockfrostEvaluationResponse
): Array<EvalRedeemer> => {
  return blockfrostResponse.result.EvaluationResult.map((redeemer: Schema.Schema.Type<typeof BlockfrostRedeemer>) => {
    // Blockfrost uses "cert" and "reward" which match Core terminology
    const tag: Redeemer.RedeemerTag = redeemer.purpose as Redeemer.RedeemerTag
    
    return {
      ex_units: new Redeemer.ExUnits({
        mem: BigInt(redeemer.unit_mem),
        steps: BigInt(redeemer.unit_steps)
      }),
      redeemer_index: redeemer.tx_index,
      redeemer_tag: tag
    }
  })
}

/**
 * Transform JSONWSP-wrapped Ogmios evaluation response to Evolution SDK format
 * Used by /utils/txs/evaluate/utxos endpoint
 * Format: { result: { EvaluationResult: { "spend:0": { "memory": 1100, "steps": 160100 }, ... } } }
 */
export const transformJsonwspOgmiosEvaluationResult = (
  jsonwspResponse: JsonwspOgmiosEvaluationResponse
): Array<EvalRedeemer> => {
  const result: Array<EvalRedeemer> = []
  const evaluationResult = jsonwspResponse.result.EvaluationResult
  
  for (const [key, budget] of Object.entries(evaluationResult)) {
    // Parse "spend:0", "mint:1", etc.
    const [tag, indexStr] = key.split(":")
    const index = parseInt(indexStr, 10)
    
    result.push({
      ex_units: new Redeemer.ExUnits({
        mem: BigInt(budget.memory),
        steps: BigInt(budget.steps)
      }),
      redeemer_index: index,
      redeemer_tag: tag as any
    })
  }
  
  return result
}