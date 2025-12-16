import { Core } from "@evolution-sdk/evolution"
import * as CoreAddress from "@evolution-sdk/evolution/core/Address"
import * as CoreData from "@evolution-sdk/evolution/core/Data"
import * as CoreDatumOption from "@evolution-sdk/evolution/core/DatumOption"
import * as CorePlutusV1 from "@evolution-sdk/evolution/core/PlutusV1"
import * as CorePlutusV2 from "@evolution-sdk/evolution/core/PlutusV2"
import * as CorePlutusV3 from "@evolution-sdk/evolution/core/PlutusV3"
import * as CoreScript from "@evolution-sdk/evolution/core/Script"
import * as CoreScriptRef from "@evolution-sdk/evolution/core/ScriptRef"
import * as CoreTransactionHash from "@evolution-sdk/evolution/core/TransactionHash"
import * as CoreUTxO from "@evolution-sdk/evolution/core/UTxO"
import type * as Assets from "@evolution-sdk/evolution/sdk/Assets"
import type * as Datum from "@evolution-sdk/evolution/sdk/Datum"
import type * as Script from "@evolution-sdk/evolution/sdk/Script"
import type * as UTxO from "@evolution-sdk/evolution/sdk/UTxO"

// Alias for Core.Assets
const CoreAssets = Core.Assets

/**
 * Options for creating a test UTxO.
 */
export type CreateTestUtxoOptions = {
  /**
   * The address of the UTxO. Defaults to a test address.
   * @default "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae"
   */
  address?: string
  /**
   * Optional datum to attach to the UTxO.
   */
  datumOption?: Datum.Datum
  /**
   * The amount of lovelace in the UTxO.
   */
  lovelace: bigint
  /**
   * Optional native assets to include in the UTxO.
   * Map of policyId+assetName (hex encoded) to quantity.
   */
  nativeAssets?: Record<string, bigint>
  /**
   * The output index. Defaults to 0.
   * @default 0
   */
  outputIndex?: number
  /**
   * Optional reference script to attach to the UTxO.
   */
  scriptRef?: Script.Script
  /**
   * The transaction hash. Defaults to 64 zeros.
   * @default "0".repeat(64)
   */
  txHash?: string
}

/**
 * Default test address used when no address is provided.
 */
const DEFAULT_TEST_ADDRESS =
  "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae"

/**
 * Creates a test UTxO with the specified parameters (SDK format).
 */
export const createTestUtxo = (options: CreateTestUtxoOptions): UTxO.UTxO => {
  const {
    address = DEFAULT_TEST_ADDRESS,
    datumOption,
    lovelace,
    nativeAssets,
    outputIndex = 0,
    scriptRef,
    txHash = "0".repeat(64)
  } = options

  // Ensure txHash is 64 hex characters (convert short IDs to valid hex)
  const paddedTxHash = txHash.length === 64 && /^[0-9a-fA-F]+$/.test(txHash)
    ? txHash
    : Array.from(txHash)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
        .padEnd(64, '0')

  const assets: Assets.Assets = nativeAssets
    ? { lovelace, ...nativeAssets }
    : { lovelace }

  return {
    address,
    assets,
    datumOption,
    outputIndex,
    scriptRef,
    txHash: paddedTxHash
  }
}

/**
 * Options for creating a Core test UTxO.
 */
export type CreateCoreTestUtxoOptions = {
  /**
   * The bech32 address of the UTxO. Defaults to a test address.
   */
  address?: string
  /**
   * The amount of lovelace in the UTxO.
   */
  lovelace: bigint
  /**
   * Optional native assets to include in the UTxO.
   * Map of "policyIdHex + assetNameHex" (56 hex chars policyId + rest is assetName) to quantity.
   */
  nativeAssets?: Record<string, bigint>
  /**
   * The output index. Defaults to 0.
   */
  index?: number | bigint
  /**
   * The transaction hash (64 hex chars). Defaults to 64 zeros.
   */
  transactionId?: string
  /**
   * Optional datum option for the UTxO.
   */
  datumOption?: Datum.Datum
  /**
   * Optional reference script.
   */
  scriptRef?: Script.Script
}

/**
 * Creates a Core UTxO with the specified parameters.
 */
export const createCoreTestUtxo = (options: CreateCoreTestUtxoOptions): CoreUTxO.UTxO => {
  const {
    address = DEFAULT_TEST_ADDRESS,
    datumOption,
    index: rawIndex = 0,
    lovelace,
    nativeAssets,
    scriptRef,
    transactionId = "0".repeat(64)
  } = options
  
  // Convert bigint to number if needed
  const index = typeof rawIndex === "bigint" ? Number(rawIndex) : rawIndex

  // Ensure transactionId is 64 hex characters
  const paddedTxId = transactionId.length === 64 && /^[0-9a-fA-F]+$/.test(transactionId)
    ? transactionId
    : Array.from(transactionId)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
        .padEnd(64, '0')

  // Build Core Assets
  let assets = CoreAssets.fromLovelace(lovelace)
  
  if (nativeAssets) {
    for (const [unit, quantity] of Object.entries(nativeAssets)) {
      // Parse unit: first 56 chars are policy ID, rest is asset name
      const policyIdHex = unit.slice(0, 56)
      const assetNameHex = unit.slice(56)
      assets = CoreAssets.addByHex(assets, policyIdHex, assetNameHex, quantity)
    }
  }

  // Convert SDK datumOption to Core DatumOption
  let coreDatumOption: CoreDatumOption.DatumHash | CoreDatumOption.InlineDatum | undefined
  if (datumOption) {
    if (datumOption.type === "inlineDatum" && datumOption.inline) {
      // Parse CBOR hex to Core PlutusData
      const plutusData = CoreData.fromCBORHex(datumOption.inline)
      coreDatumOption = new CoreDatumOption.InlineDatum({ data: plutusData })
    } else if (datumOption.type === "datumHash" && datumOption.hash) {
      coreDatumOption = new CoreDatumOption.DatumHash({ 
        hash: new Uint8Array(datumOption.hash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      })
    }
  }

  // Convert SDK Script to Core ScriptRef
  let coreScriptRef: CoreScriptRef.ScriptRef | undefined
  if (scriptRef) {
    // Convert SDK script format { type: "PlutusV2", script: "hex" } to Core Script
    let coreScript: CoreScript.Script
    switch (scriptRef.type) {
      case "PlutusV1":
        coreScript = new CorePlutusV1.PlutusV1({ 
          bytes: new Uint8Array(scriptRef.script.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
        })
        break
      case "PlutusV2":
        coreScript = new CorePlutusV2.PlutusV2({ 
          bytes: new Uint8Array(scriptRef.script.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
        })
        break
      case "PlutusV3":
        coreScript = new CorePlutusV3.PlutusV3({ 
          bytes: new Uint8Array(scriptRef.script.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
        })
        break
      default:
        throw new Error(`Unsupported script type for scriptRef: ${(scriptRef as Script.Script).type}`)
    }
    // Convert Script to ScriptRef bytes (CBOR-encoded script)
    const scriptBytes = CoreScript.toCBOR(coreScript)
    coreScriptRef = new CoreScriptRef.ScriptRef({ bytes: scriptBytes })
  }

  return new CoreUTxO.UTxO({
    transactionId: CoreTransactionHash.fromHex(paddedTxId),
    index: BigInt(index),
    address: CoreAddress.fromBech32(address),
    assets,
    scriptRef: coreScriptRef,
    datumOption: coreDatumOption
  })
}
