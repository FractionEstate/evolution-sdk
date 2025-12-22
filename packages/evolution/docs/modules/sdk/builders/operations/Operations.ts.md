---
title: sdk/builders/operations/Operations.ts
nav_order: 156
parent: Modules
---

## Operations overview

---

<h2 class="text-delta">Table of contents</h2>

- [governance](#governance)
  - [AuthCommitteeHotParams (interface)](#authcommitteehotparams-interface)
  - [DeregisterDRepParams (interface)](#deregisterdrepparams-interface)
  - [RegisterDRepParams (interface)](#registerdrepparams-interface)
  - [ResignCommitteeColdParams (interface)](#resigncommitteecoldparams-interface)
  - [UpdateDRepParams (interface)](#updatedrepparams-interface)
- [pool](#pool)
  - [RegisterPoolParams (interface)](#registerpoolparams-interface)
  - [RetirePoolParams (interface)](#retirepoolparams-interface)
- [staking](#staking)
  - [DelegateToParams (interface)](#delegatetoparams-interface)
  - [DeregisterStakeParams (interface)](#deregisterstakeparams-interface)
  - [RegisterAndDelegateToParams (interface)](#registeranddelegatetoparams-interface)
  - [RegisterStakeParams (interface)](#registerstakeparams-interface)
  - [WithdrawParams (interface)](#withdrawparams-interface)
- [utils](#utils)
  - [CollectFromParams (interface)](#collectfromparams-interface)
  - [MintTokensParams (interface)](#minttokensparams-interface)
  - [PayToAddressParams (interface)](#paytoaddressparams-interface)
  - [ReadFromParams (interface)](#readfromparams-interface)
- [validity](#validity)
  - [ValidityParams (interface)](#validityparams-interface)

---

# governance

## AuthCommitteeHotParams (interface)

Parameters for authorizing a committee hot credential.

Authorizes a hot credential to act on behalf of a cold committee credential.
The cold credential is kept offline for security; the hot credential signs
governance actions.

**Signature**

```ts
export interface AuthCommitteeHotParams {
  /** The cold credential (offline, secure) */
  readonly coldCredential: Credential.Credential
  /** The hot credential to authorize (online, signing) */
  readonly hotCredential: Credential.Credential
  /** Redeemer for script-controlled cold credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
}
```

Added in v2.0.0

## DeregisterDRepParams (interface)

Parameters for deregistering as a DRep.

Removes DRep registration and reclaims the deposit.

**Signature**

```ts
export interface DeregisterDRepParams {
  /** The DRep credential to deregister */
  readonly drepCredential: Credential.Credential
  /** Redeemer for script-controlled DRep credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
}
```

Added in v2.0.0

## RegisterDRepParams (interface)

Parameters for registering as a DRep.

Registers a credential as a Delegated Representative for governance.
Requires paying a deposit.

**Signature**

```ts
export interface RegisterDRepParams {
  /** The credential to register as a DRep */
  readonly drepCredential: Credential.Credential
  /** Optional metadata anchor (URL + hash) */
  readonly anchor?: Anchor.Anchor
}
```

Added in v2.0.0

## ResignCommitteeColdParams (interface)

Parameters for resigning from the constitutional committee.

Submits a resignation from committee membership.

**Signature**

```ts
export interface ResignCommitteeColdParams {
  /** The cold credential resigning */
  readonly coldCredential: Credential.Credential
  /** Optional anchor with resignation rationale */
  readonly anchor?: Anchor.Anchor
  /** Redeemer for script-controlled cold credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
}
```

Added in v2.0.0

## UpdateDRepParams (interface)

Parameters for updating DRep metadata.

Updates the anchor (metadata URL + hash) for a registered DRep.

**Signature**

```ts
export interface UpdateDRepParams {
  /** The DRep credential to update */
  readonly drepCredential: Credential.Credential
  /** New metadata anchor (URL + hash) */
  readonly anchor?: Anchor.Anchor
  /** Redeemer for script-controlled DRep credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
}
```

Added in v2.0.0

# pool

## RegisterPoolParams (interface)

Parameters for registering a stake pool.

Registers a new stake pool with the specified parameters.
Also used for updating existing pool parameters.

**Signature**

```ts
export interface RegisterPoolParams {
  /** Complete pool parameters including operator, VRF key, costs, etc. */
  readonly poolParams: PoolParams.PoolParams
}
```

Added in v2.0.0

## RetirePoolParams (interface)

Parameters for retiring a stake pool.

Announces pool retirement effective at the specified epoch.

**Signature**

```ts
export interface RetirePoolParams {
  /** The pool key hash of the pool to retire */
  readonly poolKeyHash: PoolKeyHash.PoolKeyHash
  /** Epoch at which retirement takes effect */
  readonly epoch: EpochNo.EpochNo
}
```

Added in v2.0.0

# staking

## DelegateToParams (interface)

Parameters for delegating stake and/or voting power.

Supports three delegation modes:

- **Stake only**: Provide `poolKeyHash` to delegate to a stake pool
- **Vote only**: Provide `drep` to delegate voting power (Conway)
- **Both**: Provide both for combined stake + vote delegation

**Signature**

```ts
export interface DelegateToParams {
  /** The stake credential delegating */
  readonly stakeCredential: Credential.Credential
  /** Pool to delegate stake to (optional) */
  readonly poolKeyHash?: PoolKeyHash.PoolKeyHash
  /** DRep to delegate voting power to (optional, Conway) */
  readonly drep?: DRep.DRep
  /** Redeemer for script-controlled stake credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## DeregisterStakeParams (interface)

Parameters for deregistering a stake credential.

Removes a stake credential from the chain and reclaims the deposit.
Must withdraw all rewards before deregistering.

**Signature**

```ts
export interface DeregisterStakeParams {
  /** The stake credential to deregister */
  readonly stakeCredential: Credential.Credential
  /** Redeemer for script-controlled stake credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## RegisterAndDelegateToParams (interface)

Parameters for registering AND delegating in a single certificate.

Combines registration and delegation into one certificate, saving fees.
Available in Conway era onwards.

**Signature**

```ts
export interface RegisterAndDelegateToParams {
  /** The stake credential to register and delegate */
  readonly stakeCredential: Credential.Credential
  /** Pool to delegate stake to (optional) */
  readonly poolKeyHash?: PoolKeyHash.PoolKeyHash
  /** DRep to delegate voting power to (optional) */
  readonly drep?: DRep.DRep
  /** Redeemer for script-controlled stake credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## RegisterStakeParams (interface)

Parameters for registering a stake credential.

Registers a stake credential on-chain, enabling delegation and rewards.
Requires paying a deposit (currently 2 ADA on mainnet).

**Signature**

```ts
export interface RegisterStakeParams {
  /** The stake credential to register (key hash or script hash) */
  readonly stakeCredential: Credential.Credential
  /** Redeemer for script-controlled stake credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## WithdrawParams (interface)

Parameters for withdrawing staking rewards.

Withdraws accumulated rewards from a stake credential.
Use amount: 0n to trigger a stake validator without withdrawing rewards
(useful for the coordinator pattern).

**Signature**

```ts
export interface WithdrawParams {
  /** The stake credential to withdraw from */
  readonly stakeCredential: Credential.Credential
  /** Amount of lovelace to withdraw */
  readonly amount: bigint
  /** Redeemer for script-controlled stake credentials */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

# utils

## CollectFromParams (interface)

Parameters for collectFrom operation.

The redeemer supports three modes:

- **Static**: Direct `Data` value when index isn't needed
- **Self**: `(input: IndexedInput) => Data` callback for per-input redeemers
- **Batch**: `{ all: (inputs) => Data, inputs: UTxO[] }` for multi-input coordination

**Signature**

```ts
export interface CollectFromParams {
  /** UTxOs to consume as transaction inputs */
  readonly inputs: ReadonlyArray<UTxO.UTxO>
  /** Optional redeemer for script-locked UTxOs (static, self, or batch mode) */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## MintTokensParams (interface)

Parameters for mint operation.

The redeemer supports three modes:

- **Static**: Direct `Data` value when index isn't needed
- **Self**: `(input: IndexedInput) => Data` callback (index is policy index)
- **Batch**: `{ all: (inputs) => Data, inputs: UTxO[] }` for multi-policy coordination

**Signature**

```ts
export interface MintTokensParams {
  /** Tokens to mint (positive) or burn (negative), excluding lovelace */
  readonly assets: CoreAssets.Assets
  /** Optional redeemer for Plutus minting policies (static, self, or batch mode) */
  readonly redeemer?: RedeemerBuilder.RedeemerArg
  /** Optional label for debugging script failures - identifies this operation in error messages */
  readonly label?: string
}
```

Added in v2.0.0

## PayToAddressParams (interface)

**Signature**

```ts
export interface PayToAddressParams {
  readonly address: CoreAddress.Address
  readonly assets: CoreAssets.Assets
  readonly datum?: CoreDatumOption.DatumOption
  readonly scriptRef?: CoreScriptRef.ScriptRef
}
```

## ReadFromParams (interface)

**Signature**

```ts
export interface ReadFromParams {
  readonly referenceInputs: ReadonlyArray<UTxO.UTxO> // Mandatory: UTxOs to read as reference inputs
}
```

# validity

## ValidityParams (interface)

Parameters for setting transaction validity interval.

Both bounds are optional:

- `from`: Transaction is valid after this time (validityIntervalStart)
- `to`: Transaction expires after this time (ttl)

Times are in Unix milliseconds and will be converted to slots based on network config.

**Signature**

```ts
export interface ValidityParams {
  /** Transaction valid after this Unix time (milliseconds). Converted to slot. */
  readonly from?: Time.UnixTime
  /** Transaction expires after this Unix time (milliseconds). Converted to slot. */
  readonly to?: Time.UnixTime
}
```

Added in v2.0.0
