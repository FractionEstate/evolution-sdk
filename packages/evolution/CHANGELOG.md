# @evolution-sdk/evolution

## 0.3.11

### Patch Changes

- [#122](https://github.com/IntersectMBO/evolution-sdk/pull/122) [`079fd98`](https://github.com/IntersectMBO/evolution-sdk/commit/079fd98c2a1457b2d0fa2417d6e29ef996b59411) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add propose and vote APIs: introduce new operations for creating governance proposals and casting votes, including supporting types, procedures, and validators.

## 0.3.10

### Patch Changes

- [#120](https://github.com/IntersectMBO/evolution-sdk/pull/120) [`ed9bdc0`](https://github.com/IntersectMBO/evolution-sdk/commit/ed9bdc07011bcc4875b61fdd6b4f8e4219bb67e4) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add governance and pool operation APIs to transaction builder

  This release adds comprehensive support for Conway-era governance operations and stake pool management:

  **New Delegation APIs**
  - `delegateToPool`: Delegate stake to a pool (with optional registration)
  - `delegateToDRep`: Delegate voting power to a DRep (with optional registration)
  - `delegateToPoolAndDRep`: Delegate to both pool and DRep simultaneously

  **DRep Operations**
  - `registerDRep`: Register as a Delegated Representative
  - `updateDRep`: Update DRep anchor/metadata
  - `deregisterDRep`: Deregister DRep and reclaim deposit

  **Constitutional Committee Operations**
  - `authCommitteeHot`: Authorize hot credential for committee member
  - `resignCommitteeCold`: Resign from constitutional committee

  **Stake Pool Operations**
  - `registerPool`: Register a new stake pool with parameters
  - `retirePool`: Retire a stake pool at specified epoch

  **Transaction Balance Improvements**
  - Proper accounting for certificate deposits and refunds
  - Withdrawal balance calculations
  - Minimum 1 input requirement enforcement (replay attack prevention)

## 0.3.9

### Patch Changes

- [#115](https://github.com/IntersectMBO/evolution-sdk/pull/115) [`0503b96`](https://github.com/IntersectMBO/evolution-sdk/commit/0503b968735bc221b3f4d005d5c97ac8a0a1c592) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### TxBuilder Composition API

  Add `compose()` and `getPrograms()` methods for modular transaction building:

  ```ts
  // Create reusable builder fragments
  const mintBuilder = client
    .newTx()
    .mintAssets({ policyId, assets: { tokenName: 1n }, redeemer })
    .attachScript({ script: mintingPolicy })

  const metadataBuilder = client.newTx().attachMetadata({ label: 674n, metadata: "Composed transaction" })

  // Compose multiple builders into one transaction
  const tx = await client
    .newTx()
    .payToAddress({ address, assets: { lovelace: 5_000_000n } })
    .compose(mintBuilder)
    .compose(metadataBuilder)
    .build()
  ```

  **Features:**
  - Merge operations from multiple builders into a single transaction
  - Snapshot accumulated operations with `getPrograms()` for inspection
  - Compose builders from different client instances
  - Works with all builder methods (payments, validity, metadata, minting, staking, etc.)

  ### Fixed Validity Interval Fee Calculation Bug

  Fixed bug where validity interval fields (`ttl` and `validityIntervalStart`) were not included during fee calculation, causing "insufficient fee" errors when using `setValidity()`.

  **Root Cause**: Validity fields were being added during transaction assembly AFTER fee calculation completed, causing the actual transaction to be 3-8 bytes larger than estimated.

  **Fix**: Convert validity Unix times to slots BEFORE the fee calculation loop and include them in the TransactionBody during size estimation.

  ### Error Type Corrections

  Corrected error types for pure constructor functions to use `never` instead of `TransactionBuilderError`:
  - `makeTxOutput` - creates TransactionOutput
  - `txOutputToTransactionOutput` - creates TransactionOutput
  - `mergeAssetsIntoUTxO` - creates UTxO
  - `mergeAssetsIntoOutput` - creates TransactionOutput
  - `buildTransactionInputs` - creates and sorts TransactionInputs

  ### Error Message Improvements

  Enhanced error messages throughout the builder to include underlying error details for better debugging.

## 0.3.8

### Patch Changes

- [#113](https://github.com/IntersectMBO/evolution-sdk/pull/113) [`7905507`](https://github.com/IntersectMBO/evolution-sdk/commit/79055076ab31214dc4c7462553484e9c2bcaf22c) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add `attachMetadata()` operation to TransactionBuilder for attaching transaction metadata according to CIP-10 standard.

  **Changes:**
  - Added `attachMetadata()` method to attach metadata with custom labels
  - Metadata labels are now bigint (unbounded positive integers) supporting CIP-20 messages (label 674) and custom labels
  - Automatic computation of auxiliaryDataHash in transaction body when metadata is present
  - Proper fee calculation accounting for auxiliary data size
  - TransactionMetadatum refactored to simple union type: `string | bigint | Uint8Array | Map | Array`
  - Added `NonNegativeInteger` schema to Numeric module for unbounded non-negative integers

  **Example:**

  ```typescript
  await client
    .newTx()
    .attachMetadata({
      label: 674n, // CIP-20 message label
      metadata: "Hello Cardano!"
    })
    .payToAddress({ address, assets })
    .build()
    .then((tx) => tx.sign().submit())
  ```

## 0.3.7

### Patch Changes

- [#112](https://github.com/IntersectMBO/evolution-sdk/pull/112) [`c59507e`](https://github.com/IntersectMBO/evolution-sdk/commit/c59507eafd942cd5bce1d3608c9c3e9c99a4cac8) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add transaction chaining support via `SignBuilder.chainResult()`
  - Add `chainResult()` method to `SignBuilder` for building dependent transactions
  - Returns `ChainResult` with `consumed`, `available` UTxOs and pre-computed `txHash`
  - Lazy evaluation with memoization - computed on first call, cached for subsequent calls
  - Add `signAndSubmit()` convenience method combining sign and submit in one call
  - Remove redundant `chain()`, `chainEffect()`, `chainEither()` methods from TransactionBuilder

- [#110](https://github.com/IntersectMBO/evolution-sdk/pull/110) [`9ddc79d`](https://github.com/IntersectMBO/evolution-sdk/commit/9ddc79dbc9b6667b3f2981dd06875878d9ad14f5) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### Native Scripts & Multi-Sig Support
  - **`addSigner` operation**: Add required signers to transactions for multi-sig and script validation
  - **Native script minting**: Full support for `ScriptAll`, `ScriptAny`, `ScriptNOfK`, `InvalidBefore`, `InvalidHereafter`
  - **Reference scripts**: Use native scripts via `readFrom` instead of attaching them to transactions
  - **Multi-sig spending**: Spend from native script addresses with multi-party signing
  - **Improved fee calculation**: Accurate fee estimation for transactions with native scripts and reference scripts

  ### API Changes
  - `UTxO.scriptRef` type changed from `ScriptRef` to `Script` for better type safety
  - `PayToAddressParams.scriptRef` renamed to `script` for consistency
  - Wallet `signTx` now accepts `referenceUtxos` context for native script signer detection
  - Client `signTx` auto-fetches reference UTxOs when signing transactions with reference inputs

- [#109](https://github.com/IntersectMBO/evolution-sdk/pull/109) [`0730f23`](https://github.com/IntersectMBO/evolution-sdk/commit/0730f2353490ff1fa75743cccc0d05b33cff1b23) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### TxBuilder setValidity API

  Add `setValidity()` method to TxBuilder for setting transaction validity intervals:

  ```ts
  client.newTx()
    .setValidity({
      from: Date.now(),           // Valid after this Unix time (optional)
      to: Date.now() + 300_000    // Expires after this Unix time (optional)
    })
    .payToAddress({ ... })
    .build()
  ```

  - Times are provided as Unix milliseconds and converted to slots during transaction assembly
  - At least one of `from` or `to` must be specified
  - Validates that `from < to` when both are provided

  ### slotConfig support for devnets

  Add `slotConfig` parameter to `createClient()` for custom slot configurations:

  ```ts
  const slotConfig = Cluster.getSlotConfig(devnetCluster)
  const client = createClient({
    network: 0,
    slotConfig,  // Custom slot config for devnet
    provider: { ... },
    wallet: { ... }
  })
  ```

  Priority chain for slot config resolution:
  1. `BuildOptions.slotConfig` (per-transaction override)
  2. `TxBuilderConfig.slotConfig` (client default)
  3. `SLOT_CONFIG_NETWORK[network]` (hardcoded fallback)

  ### Cluster.getSlotConfig helper

  Add `getSlotConfig()` helper to derive slot configuration from devnet cluster genesis:

  ```ts
  const slotConfig = Cluster.getSlotConfig(cluster)
  // Returns: { zeroTime, zeroSlot, slotLength }
  ```

## 0.3.6

### Patch Changes

- [#107](https://github.com/IntersectMBO/evolution-sdk/pull/107) [`1e1aec8`](https://github.com/IntersectMBO/evolution-sdk/commit/1e1aec88dfc726ff66809f51671d80b3f469eb5c) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### Added: Redeemer Labels for Script Debugging

  Added optional `label` property to redeemer operations (`collectFrom`, `withdraw`, `mint`, and stake operations) to help identify which script failed during evaluation.

  ```typescript
  client
    .newTx()
    .collectFrom({
      inputs: [utxo],
      redeemer: makeSpendRedeemer(999n),
      label: "coordinator-spend-utxo" // Shows in failure output
    })
    .withdraw({
      stakeCredential,
      amount: 0n,
      redeemer: makeWithdrawRedeemer([999n]),
      label: "coordinator-withdrawal"
    })
  ```

  When scripts fail, the `EvaluationError` now includes a structured `failures` array:

  ```typescript
  interface ScriptFailure {
    purpose: "spend" | "mint" | "withdraw" | "cert"
    index: number
    label?: string // User-provided label
    redeemerKey: string // e.g., "spend:0", "withdraw:0"
    utxoRef?: string // For spend failures
    credential?: string // For withdraw/cert failures
    policyId?: string // For mint failures
    validationError: string
    traces: string[]
  }
  ```

  ### Added: Stake Operations

  Full support for Conway-era stake operations:
  - `registerStake` - Register stake credential (RegCert)
  - `deregisterStake` - Deregister stake credential (UnregCert)
  - `delegateTo` - Delegate to pool and/or DRep (StakeDelegation, VoteDelegCert, StakeVoteDelegCert)
  - `registerAndDelegateTo` - Combined registration + delegation (StakeRegDelegCert, VoteRegDelegCert, StakeVoteRegDelegCert)
  - `withdraw` - Withdraw staking rewards (supports coordinator pattern with amount: 0n)

  All operations support script-controlled credentials with RedeemerBuilder for deferred redeemer resolution.

## 0.3.5

### Patch Changes

- [#105](https://github.com/IntersectMBO/evolution-sdk/pull/105) [`98b59fa`](https://github.com/IntersectMBO/evolution-sdk/commit/98b59fa49d5a4e454e242a9c400572677e2f986f) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add deferred redeemer construction for dynamic index resolution

  **RedeemerBuilder module** (`RedeemerBuilder.ts`):
  - `IndexedInput` type: `{ index: number, utxo: UTxO }` - provides the final sorted index and original UTxO after coin selection
  - Three modes for redeemer construction:
    - `Static`: Direct Data value when index not needed
    - `Self`: Per-input function `(input: IndexedInput) => Data` for single UTxO index
    - `Batch`: Multi-input function `(inputs: IndexedInput[]) => Data` for stake validator coordinator pattern
  - Type guards: `isSelfFn`, `isBatchBuilder`, `isStaticData`
  - Internal types: `DeferredRedeemer`, `toDeferredRedeemer`

  **Evaluation phase updates**:
  - Add `resolveDeferredRedeemers` to convert deferred redeemers after coin selection
  - Build `refToIndex` and `refToUtxo` mappings from sorted inputs
  - Invoke Self/Batch callbacks with resolved `IndexedInput` objects

  **Operations updates**:
  - `collectFrom` and `mintTokens` now accept `RedeemerArg` (Data | SelfRedeemerFn | BatchRedeemerBuilder)
  - Store deferred redeemers in `state.deferredRedeemers` for later resolution

  **Test coverage** (`TxBuilder.RedeemerBuilder.test.ts`):
  - Tests for all three modes with mint_multi_validator.ak spec

  **Architecture docs** (`redeemer-indexing.mdx`):
  - Document the circular dependency problem and deferred construction solution
  - Explain stake validator coordinator pattern with O(1) index lookup

## 0.3.4

### Patch Changes

- [#101](https://github.com/IntersectMBO/evolution-sdk/pull/101) [`aaf0882`](https://github.com/IntersectMBO/evolution-sdk/commit/aaf0882e280fad9769410a81419ebf1c6af48785) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### Core Module Enhancements

  **Mint Module**
  - Added `Mint.getByHex()` and `Mint.getAssetsByPolicyHex()` utilities for hex-based lookups
  - Fixed `Mint.insert`, `removePolicy`, `removeAsset`, and `get` to use content-based equality (`Equal.equals`) instead of reference equality for PolicyId/AssetName lookups

  **Fee Calculation**
  - Fixed `calculateFeeIteratively` to include mint field in fee calculation via TxContext access
  - Removed unnecessary 5000n fee buffer that caused fee overpayment

  **Transaction Builder**
  - Added `.mint()` method to TransactionBuilder for native token minting/burning
  - `.attachScript()` now accepts `{ script: CoreScript }` parameter format
  - Improved type safety by using Core types directly instead of SDK wrappers

  ### Devnet Package

  **Test Infrastructure**
  - Added `TxBuilder.Mint.test.ts` with devnet submit tests for minting and burning
  - Updated `TxBuilder.Scripts.test.ts` to use Core types (`PlutusV2.PlutusV2`) instead of SDK format
  - Refactored `createCoreTestUtxo` helper to accept Core `Script` types directly
  - Removed unused `createTestUtxo` (SDK format) helper
  - Added `Genesis.calculateUtxosFromConfig()` for retrieving initial UTxOs from genesis config
  - Replaced all `Buffer.from().toString("hex")` with `Text.toHex()` in tests

  ### Breaking Changes
  - `attachScript()` now requires `{ script: ... }` object format instead of passing script directly
  - Test helpers now use Core types exclusively

- [#103](https://github.com/IntersectMBO/evolution-sdk/pull/103) [`65b7259`](https://github.com/IntersectMBO/evolution-sdk/commit/65b7259b8b250b87d5420bca6458a5e862ba9406) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### Remove Buffer Usage from Source Code

  Replaced all `Buffer.from()` usage with `Bytes.fromHex()` and `Bytes.toHex()` from the core module for better cross-platform compatibility.

  **Files Updated:**
  - `TxBuilderImpl.ts` - Use `Bytes.toHex()` for key hash hex conversion in `buildFakeWitnessSet`
  - `Assets/index.ts` - Use `Bytes.fromHex()` for policy ID and asset name decoding
  - `MaestroEffect.ts` - Use `Bytes.fromHex()` for transaction CBOR conversion
  - `Ogmios.ts` - Use `Bytes.toHex()` for datum hash hex conversion
  - `KupmiosEffects.ts` - Use `Bytes.fromHex()` for datum hash and script bytes decoding

- [#104](https://github.com/IntersectMBO/evolution-sdk/pull/104) [`c26391a`](https://github.com/IntersectMBO/evolution-sdk/commit/c26391a3783a5dca95b2ab1b2af95c98c62e4966) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ### PlutusV3 Minting Support
  - Add PlutusV3 script minting with automatic script evaluation via Ogmios
  - Add `mintAssets` builder method for Plutus script-based minting policies
  - Add `attachScript` builder method for attaching Plutus scripts to transactions
  - Support both minting (positive amounts) and burning (negative amounts)

  ### Redeemer API Improvements
  - **Breaking**: Change `redeemer` parameter type from `string` (CBOR hex) to `Data.Data`
    - Affects `collectFrom()` and `mintAssets()` builder methods
    - Provides type-safe redeemer construction without manual CBOR encoding
    - Example: `redeemer: Data.constr(0n, [Data.int(1n)])` instead of hex strings

  ### Core Module Additions
  - Add `Redeemers` module with Conway CDDL-compliant encoding (array format)
  - Refactor `hashScriptData` to use proper module encoders for redeemers and datums
  - Add `Redeemers.toCBORBytes()` for script data hash computation

  ### Internal Improvements
  - Store `PlutusData.Data` directly in builder state instead of CBOR hex strings
  - Remove redundant CBOR hex encoding/decoding in transaction assembly
  - Add PlutusV3 minting devnet tests with real script evaluation

## 0.3.3

### Patch Changes

- [#98](https://github.com/IntersectMBO/evolution-sdk/pull/98) [`ef563f3`](https://github.com/IntersectMBO/evolution-sdk/commit/ef563f305879e6e7411d930a87733cc4e9f34314) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Migrate transaction builder and provider layer to use Core UTxO types throughout the SDK.

  ### New Core Types
  - **`Core.UTxO`** — Schema-validated UTxO with branded types (`TransactionHash`, `Address`, `Assets`)
  - **`Core.Assets`** — Enhanced with `merge`, `subtract`, `negate`, `getAsset`, `setAsset`, `hasAsset` operations
  - **`Core.Time`** — New module for slot/time conversions with `SlotConfig`, `Slot`, `UnixTime`
  - **`Core.Address`** — Added `getAddressDetails`, `getPaymentCredential`, `getStakingCredential` utilities

  ### SDK Changes
  - Provider methods (`getUtxos`, `getUtxoByUnit`, `getUtxosWithUnit`) now return `Core.UTxO.UTxO[]`
  - Client methods (`getWalletUtxos`, `newTx`) use Core UTxO internally
  - Transaction builder accepts `Core.UTxO.UTxO[]` for `availableUtxos`
  - `Genesis.calculateUtxosFromConfig` and `Genesis.queryUtxos` return Core UTxOs

  ### Rationale

  The SDK previously used a lightweight `{ txHash, outputIndex, address, assets }` record for UTxOs, requiring constant conversions when interfacing with the Core layer (transaction building, CBOR serialization). This caused:
  1. **Conversion overhead** — Every transaction build required converting SDK UTxOs to Core types
  2. **Type ambiguity** — `txHash: string` vs `TransactionHash`, `address: string` vs `Address` led to runtime errors
  3. **Inconsistent APIs** — Some methods returned Core types, others SDK types

  By standardizing on Core UTxO:
  - **Zero conversion** — UTxOs flow directly from provider → wallet → builder → transaction
  - **Type safety** — Branded types prevent mixing up transaction hashes, addresses, policy IDs
  - **Unified model** — Single UTxO representation across the entire SDK

  ### Migration

  ```typescript
  // Before
  const lovelace = Assets.getAsset(utxo.assets, "lovelace")
  const txId = utxo.txHash
  const idx = utxo.outputIndex
  const addr = utxo.address // string

  // After
  const lovelace = utxo.assets.lovelace
  const txId = Core.TransactionHash.toHex(utxo.transactionId)
  const idx = utxo.index // bigint
  const addr = Core.Address.toBech32(utxo.address) // or use Address directly
  ```

## 0.3.2

### Patch Changes

- [#88](https://github.com/IntersectMBO/evolution-sdk/pull/88) [`61ffded`](https://github.com/IntersectMBO/evolution-sdk/commit/61ffded47892f12bda6f538e8028b3fd64492187) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add CIP-30 message signing support with modular architecture

  This release introduces comprehensive CIP-30 `signData` and `verifyData` support, implementing the complete COSE Sign1 specification with a clean, modular structure:

  **New Features:**
  - Full CIP-30 message signing (`signData`) and verification (`verifyData`) implementation
  - COSE (CBOR Object Signing and Encryption) primitives per RFC 8152
  - Support for Ed25519 signatures with proper COSE key structures
  - Message hashing with BLAKE2b-256 for payload integrity
  - CIP-8 compliant address field handling
  - Complete test coverage with CSL compatibility tests

  **Module Structure:**
  - `message-signing/SignData.ts` - Main CIP-30 signData/verifyData API
  - `message-signing/Header.ts` - COSE header structures and operations
  - `message-signing/Label.ts` - COSE label types and algorithm identifiers
  - `message-signing/CoseSign1.ts` - COSE_Sign1 structure implementation
  - `message-signing/CoseKey.ts` - COSE key format support
  - `message-signing/Ed25519Key.ts` - Ed25519 key operations
  - `message-signing/Utils.ts` - Encoding and conversion utilities

  **Breaking Changes:**
  - Refactored `Bytes` module API:
    - Renamed `bytesEquals` to `equals` with stricter type signature (no longer accepts undefined)
    - Removed `Bytes.FromHex` schema in favor of Effect's built-in `Schema.Uint8ArrayFromHex`
    - Updated `fromHex`/`toHex` to use Effect's native schemas

  **Internal Improvements:**
  - Removed unused `Bytes` imports across 32 files
  - Updated all modules to use new Bytes API
  - Improved CBOR encoding/decoding with proper codec options
  - Enhanced type safety with Effect Schema compositions

## 0.3.1

### Patch Changes

- [#85](https://github.com/IntersectMBO/evolution-sdk/pull/85) [`5ee95bc`](https://github.com/IntersectMBO/evolution-sdk/commit/5ee95bc78220c9aa72bda42954b88e47c81a23eb) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ## hashPlutusData encoding options

  Add optional CBOR encoding options parameter to `hashPlutusData` function. This allows controlling how Plutus data is encoded before hashing, which affects the resulting datum hash.

  **Before:**

  ```typescript
  import { hashPlutusData } from "@evolution-sdk/evolution/utils/Hash"

  // Always uses indefinite-length encoding (CML_DATA_DEFAULT_OPTIONS)
  const hash = hashPlutusData(data)
  ```

  **After:**

  ```typescript
  import { Core } from "@evolution-sdk/evolution"
  import { hashPlutusData } from "@evolution-sdk/evolution/utils/Hash"

  const cborHex =
    "d87983486c6f76656c6163655820c3e43c6b8fb46068d4ef9746a934eba534873db0aacebdaf369c78ab23cb57751a004c4b40"
  const decoded = Core.Data.fromCBORHex(cborHex)

  // Indefinite-length (SDK default for Data)
  const indefiniteHash = hashPlutusData(decoded, Core.CBOR.CML_DATA_DEFAULT_OPTIONS)
  console.log("Hash:", Core.Bytes.toHex(indefiniteHash.hash))
  // b67b6e7d2497d4e87a240a080a109a905f73527a244775cc1e2a43f48202700f

  // Definite-length encoding
  const definiteHash = hashPlutusData(decoded, Core.CBOR.CML_DEFAULT_OPTIONS)
  console.log("Hash:", Core.Bytes.toHex(definiteHash.hash))
  // bc7eea92ba15710926e99904e746e5da739d77085b6192ddd87a0e7b4298e0c0

  // Aiken-compatible encoding
  const aikenHash = hashPlutusData(decoded, Core.CBOR.AIKEN_DEFAULT_OPTIONS)
  console.log("Hash:", Core.Bytes.toHex(aikenHash.hash))
  // b67b6e7d2497d4e87a240a080a109a905f73527a244775cc1e2a43f48202700f
  ```

## 0.3.0

### Minor Changes

- [#76](https://github.com/IntersectMBO/evolution-sdk/pull/76) [`1f0671c`](https://github.com/IntersectMBO/evolution-sdk/commit/1f0671c068d44c1f88e677eb2d8bb55312ff2c38) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Initial release of @evolution-sdk/devnet as a standalone package. Extracted from @evolution-sdk/evolution for better modularity and maintainability.

## 0.2.5

### Patch Changes

- [#70](https://github.com/IntersectMBO/evolution-sdk/pull/70) [`ea9ffbe`](https://github.com/IntersectMBO/evolution-sdk/commit/ea9ffbe11a8b6a8e97c1531c108d5467a7eda6a8) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - add blueprint module

## 0.2.4

### Patch Changes

- [#68](https://github.com/IntersectMBO/evolution-sdk/pull/68) [`5b735c8`](https://github.com/IntersectMBO/evolution-sdk/commit/5b735c856fac3562f0e5892bf84c841b1dc85281) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - ## TSchema Code Simplifications and Test Coverage

  ### Summary

  Added Literal options (index, flatInUnion) for better Union control. Simplified TSchema implementation by removing redundant code, extracting helpers, and optimizing algorithms. Added 7 missing round-trip tests for comprehensive coverage.

  ### New Features

  **Literal options for custom indices and flat unions:**

  ```typescript
  // Custom index for positioning in unions
  const Action = TSchema.Literal("withdraw", { index: 100 })

  // Flat in union - unwraps the Literal at the Union level
  const FlatUnion = TSchema.Union(
    TSchema.Literal("OptionA", { flatInUnion: true }),
    TSchema.Literal("OptionB", { flatInUnion: true })
  )

  // Before: Union wraps each literal
  // Constr(0, [Constr(0, [])]) for OptionA
  // Constr(1, [Constr(1, [])]) for OptionB

  // After: Literals are unwrapped at Union level
  // Constr(0, []) for OptionA
  // Constr(1, []) for OptionB

  // Note: TSchema.Literal("OptionA", "OptionB") creates a single schema
  // with multiple literal values, which is different from a Union of
  // separate Literal schemas. Use Union + flatInUnion for explicit control.
  ```

  **LiteralOptions interface:**

  ```typescript
  interface LiteralOptions {
    index?: number // Custom Constr index (default: auto-increment)
    flatInUnion?: boolean // Unwrap when used in Union (default: false)
  }

  // Overloaded signatures
  function Literal(...values: Literals): Literal<Literals>
  function Literal(...args: [...Literals, LiteralOptions]): Literal<Literals>
  ```

  ### Code Simplifications

  **Removed redundant OneLiteral function:**

  ```typescript
  // Before: Separate function for single literals
  const Action = TSchema.OneLiteral("withdraw")

  // After: Use Literal directly
  const Action = TSchema.Literal("withdraw")
  ```

  **Simplified Boolean validation:**

  ```typescript
  // Before: Two separate checks
  decode: ({ fields, index }) => {
    if (index !== 0n && index !== 1n) {
      throw new Error(`Expected constructor index to be 0 or 1, got ${index}`)
    }
    if (fields.length !== 0) {
      throw new Error("Expected a constructor with no fields")
    }
    return index === 1n
  }

  // After: Combined check with better error message
  decode: ({ fields, index }) => {
    if ((index !== 0n && index !== 1n) || fields.length !== 0) {
      throw new Error(
        `Expected constructor with index 0 or 1 and no fields, got index ${index} with ${fields.length} fields`
      )
    }
    return index === 1n
  }
  ```

  **Optimized collision detection (O(n²) → O(n)):**

  ```typescript
  // Before: Nested loops
  for (let i = 0; i < flatMembers.length; i++) {
    for (let j = i + 1; j < flatMembers.length; j++) {
      if (flatMembers[i].index === flatMembers[j].index) {
        // collision detected
      }
    }
  }

  // After: Map-based tracking
  const indexMap = new globalThis.Map<number, number>()
  for (const member of flatMembers) {
    if (indexMap.has(member.index)) {
      // collision detected
    }
    indexMap.set(member.index, member.position)
  }
  ```

  **Extracted helper functions:**
  - `getTypeName(value)` - Centralized type name logic for error messages
  - Simplified `getLiteralFieldValue` with ternary operators
  - Simplified tag field detection logic

  ### New Round-Trip Tests

  Added comprehensive test coverage for previously untested features:
  1. **UndefinedOr** - Both defined and undefined value encoding/decoding
  2. **Struct with custom index** - Validates custom Constr index is preserved
  3. **Struct with flatFields** - Verifies field merging into parent struct
  4. **Variant** - Multi-option tagged unions (Mint, Burn, Transfer)
  5. **TaggedStruct** - Default "\_tag" field and custom tagField names
  6. **flatInUnion Literals in Union** - Validates flat Literals with Structs
  7. **flatInUnion mixed types** - Literals and Structs with flatFields

## 0.2.3

### Patch Changes

- [#66](https://github.com/IntersectMBO/evolution-sdk/pull/66) [`29c3e4d`](https://github.com/IntersectMBO/evolution-sdk/commit/29c3e4d3bac9b35c1586c6a94d6aee037aeb6d62) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Fixed field ordering bug in TSchema.Struct encode function that caused fields to be swapped during CBOR encoding when using NullOr/UndefinedOr.

  **Before:**

  ```typescript
  const CredentialSchema = TSchema.Union(
    TSchema.Struct({ pubKeyHash: TSchema.ByteArray }, { flatFields: true }),
    TSchema.Struct({ scriptHash: TSchema.ByteArray }, { flatFields: true })
  )

  const AddressSchema = TSchema.Struct({
    paymentCredential: CredentialSchema,
    stakeCredential: TSchema.NullOr(TSchema.Integer)
  })

  const Foo = TSchema.Union(TSchema.Struct({ foo: AddressSchema }, { flatFields: true }))

  const input = {
    foo: {
      paymentCredential: { pubKeyHash: fromHex("deadbeef") },
      stakeCredential: null
    }
  }

  const encoded = Data.withSchema(Foo).toData(input)
  // BUG: Fields were swapped in innerStruct!
  // innerStruct.fields[0] = Constr(1, [])      // stakeCredential (null) - WRONG!
  // innerStruct.fields[1] = Constr(0, [...])   // paymentCredential - WRONG!
  ```

  **After:**

  ```typescript
  const CredentialSchema = TSchema.Union(
    TSchema.Struct({ pubKeyHash: TSchema.ByteArray }, { flatFields: true }),
    TSchema.Struct({ scriptHash: TSchema.ByteArray }, { flatFields: true })
  )

  const AddressSchema = TSchema.Struct({
    paymentCredential: CredentialSchema,
    stakeCredential: TSchema.NullOr(TSchema.Integer)
  })

  const Foo = TSchema.Union(TSchema.Struct({ foo: AddressSchema }, { flatFields: true }))

  const input = {
    foo: {
      paymentCredential: { pubKeyHash: fromHex("deadbeef") },
      stakeCredential: null
    }
  }

  const encoded = Data.withSchema(Foo).toData(input)
  // FIXED: Fields now in correct order matching schema!
  // innerStruct.fields[0] = Constr(0, [...])   // paymentCredential - CORRECT!
  // innerStruct.fields[1] = Constr(1, [])      // stakeCredential (null) - CORRECT!
  ```

## 0.2.2

### Patch Changes

- [#63](https://github.com/IntersectMBO/evolution-sdk/pull/63) [`7bb1da3`](https://github.com/IntersectMBO/evolution-sdk/commit/7bb1da32488c5a1a92a9c8b90e5aa4514e004232) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Improve `Variant` type inference with `PropertyKey` constraint

  The `Variant` helper now accepts `PropertyKey` (string | number | symbol) as variant keys instead of just strings, enabling more flexible discriminated union patterns.

  **Before:**

  ```typescript
  // Only string keys were properly typed
  const MyVariant = TSchema.Variant({
    Success: { value: TSchema.Integer },
    Error: { message: TSchema.ByteArray }
  })
  ```

  **After:**

  ```typescript
  // Now supports symbols and numbers as variant keys
  const MyVariant = TSchema.Variant({
    Success: { value: TSchema.Integer },
    Error: { message: TSchema.ByteArray }
  })
  // Type inference is improved, especially with const assertions
  ```

  Replace `@ts-expect-error` with `as any` following Effect patterns

  Improved code quality by replacing forbidden `@ts-expect-error` directives with explicit `as any` type assertions, consistent with Effect Schema's approach for dynamic object construction.

  Add comprehensive Cardano Address type support

  Added full CBOR encoding support for Cardano address structures with Aiken compatibility:

  ```typescript
  const Credential = TSchema.Variant({
    VerificationKey: { hash: TSchema.ByteArray },
    Script: { hash: TSchema.ByteArray }
  })

  const Address = TSchema.Struct({
    payment_credential: Credential,
    stake_credential: TSchema.UndefinedOr(
      TSchema.Variant({
        Inline: { credential: Credential },
        Pointer: {
          slot_number: TSchema.Integer,
          transaction_index: TSchema.Integer,
          certificate_index: TSchema.Integer
        }
      })
    )
  })

  // Creates proper CBOR encoding matching Aiken's output
  const address = Data.withSchema(Address).toData({
    payment_credential: { VerificationKey: { hash } },
    stake_credential: { Inline: { credential: { VerificationKey: { stakeHash } } } }
  })
  ```

- [#63](https://github.com/IntersectMBO/evolution-sdk/pull/63) [`844dfec`](https://github.com/IntersectMBO/evolution-sdk/commit/844dfeccb48c0af0ce0cebfc67e6cdcc67e28cc8) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add Aiken-compatible CBOR encoding with encodeMapAsPairs option and comprehensive test suite. PlutusData maps can now encode as arrays of pairs (Aiken style) or CBOR maps (CML style). Includes 72 Aiken reference tests and 40 TypeScript compatibility tests verifying identical encoding. Also fixes branded schema pattern in Data.ts for cleaner type inference and updates TSchema error handling test.

## 0.2.1

### Patch Changes

- [#61](https://github.com/IntersectMBO/evolution-sdk/pull/61) [`0dcf415`](https://github.com/IntersectMBO/evolution-sdk/commit/0dcf4155e7950ff46061100300355fb0a69e902d) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - upgrade modules

## 0.2.0

### Minor Changes

- [#24](https://github.com/no-witness-labs/evolution-sdk/pull/24) [`1503549`](https://github.com/no-witness-labs/evolution-sdk/commit/15035498c85286a661f1073fdd34423f01128b54) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Experimental release 1:
  - Introduce experimental modules and docs flow
  - Add runnable Data examples with MDX generation
  - ESM Next/Nextra configuration for docs
