import type * as CoreAddress from "../../../core/Address.js"
import type * as CoreAssets from "../../../core/Assets/index.js"
import type * as UTxO from "../../../core/UTxO.js"
import type * as Datum from "../../Datum.js"
import type * as Script from "../../Script.js"

// ============================================================================
// Operation Parameter Types
// ============================================================================

export interface PayToAddressParams {
  readonly address: CoreAddress.Address // Mandatory: Recipient address (Core Address object)
  readonly assets: CoreAssets.Assets // Mandatory: ADA and/or native tokens to send
  readonly datum?: Datum.Datum // Optional: Datum to attach for script addresses
  readonly scriptRef?: Script.Script // Optional: Reference script to attach
}

export interface CollectFromParams {
  readonly inputs: ReadonlyArray<UTxO.UTxO> // Mandatory: UTxOs to consume as inputs
  readonly redeemer?: string
}

export interface ReadFromParams {
  readonly referenceInputs: ReadonlyArray<UTxO.UTxO> // Mandatory: UTxOs to read as reference inputs
}

export interface MintTokensParams {
  readonly assets: CoreAssets.Assets // Mandatory: Tokens to mint (excluding lovelace)
  readonly redeemer?: string // Optional: Redeemer for minting script
}