# @evolution-sdk/devnet

## 1.1.4

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

- Updated dependencies [[`aaf0882`](https://github.com/IntersectMBO/evolution-sdk/commit/aaf0882e280fad9769410a81419ebf1c6af48785), [`65b7259`](https://github.com/IntersectMBO/evolution-sdk/commit/65b7259b8b250b87d5420bca6458a5e862ba9406), [`c26391a`](https://github.com/IntersectMBO/evolution-sdk/commit/c26391a3783a5dca95b2ab1b2af95c98c62e4966)]:
  - @evolution-sdk/evolution@0.3.4

## 1.1.3

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

- Updated dependencies [[`ef563f3`](https://github.com/IntersectMBO/evolution-sdk/commit/ef563f305879e6e7411d930a87733cc4e9f34314)]:
  - @evolution-sdk/evolution@0.3.3

## 1.1.2

### Patch Changes

- [#93](https://github.com/IntersectMBO/evolution-sdk/pull/93) [`7edb423`](https://github.com/IntersectMBO/evolution-sdk/commit/7edb4237059b39815241823cf46ce3bf128e7600) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Fix module resolution error by moving @noble/hashes from peerDependencies to dependencies. This resolves the "Package subpath './blake2' is not defined by exports" error when users install the package.

- Updated dependencies [[`61ffded`](https://github.com/IntersectMBO/evolution-sdk/commit/61ffded47892f12bda6f538e8028b3fd64492187)]:
  - @evolution-sdk/evolution@0.3.2

## 1.1.1

### Patch Changes

- Updated dependencies [[`5ee95bc`](https://github.com/IntersectMBO/evolution-sdk/commit/5ee95bc78220c9aa72bda42954b88e47c81a23eb)]:
  - @evolution-sdk/evolution@0.3.1

## 1.1.0

### Minor Changes

- [#80](https://github.com/IntersectMBO/evolution-sdk/pull/80) [`b52e9c7`](https://github.com/IntersectMBO/evolution-sdk/commit/b52e9c7a0b21c166fe9c3463539a1ff277035ee8) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - **Restructured module exports** for better modularity and clarity:
  - Replaced monolithic `Devnet` and `DevnetDefault` exports with granular named exports: `Cluster`, `Config`, `Container`, `Genesis`, and `Images`
  - Renamed types: `DevNetCluster` → `Cluster.Cluster`, `DevNetContainer` → `Container.Container`
  - Moved `DEFAULT_SHELLEY_GENESIS` from `DevnetDefault` to `Config` module

  **New Features:**
  - **Genesis module** - Calculate and query genesis UTxOs with Cardano's `initialFundsPseudoTxIn` algorithm:
    - `calculateUtxosFromConfig()` - Deterministically compute genesis UTxOs from Shelley genesis configuration using blake2b-256 hashing
    - `queryUtxos()` - Query actual genesis UTxOs from running node via cardano-cli
    - Provides predictable UTxO structure for testing without node interaction
  - **Images module** - Docker image management utilities:
    - `isAvailable()` - Check if Docker image exists locally
    - `pull()` - Pull Docker images with progress logging
    - `ensureAvailable()` - Conditionally pull images only when needed

  **Improvements:**
  - Enhanced error handling with specific error reasons (`address_conversion_failed`, `utxo_query_failed`, `utxo_parse_failed`, `image_inspection_failed`, `image_pull_failed`)
  - All operations provide both Effect-based and Promise-based APIs for flexibility
  - Improved test coverage with descriptive cluster names for easier debugging
  - Full Effect error channel integration throughout the package

  **Breaking Changes:**

  Migration required for existing devnet users:

  ```typescript
  // Before
  import { Devnet, DevnetDefault } from "@evolution-sdk/devnet"

  const cluster = await Devnet.Cluster.make()
  const config = DevnetDefault.DEFAULT_SHELLEY_GENESIS

  // After
  import { Cluster, Config } from "@evolution-sdk/devnet"

  const cluster = await Cluster.make()
  const config = Config.DEFAULT_SHELLEY_GENESIS
  ```

  All module functionality remains the same, only import syntax has changed to use destructured named exports from the main package.

## 1.0.0

### Minor Changes

- [#76](https://github.com/IntersectMBO/evolution-sdk/pull/76) [`1f0671c`](https://github.com/IntersectMBO/evolution-sdk/commit/1f0671c068d44c1f88e677eb2d8bb55312ff2c38) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Initial release of @evolution-sdk/devnet as a standalone package. Extracted from @evolution-sdk/evolution for better modularity and maintainability.

### Patch Changes

- Updated dependencies [[`1f0671c`](https://github.com/IntersectMBO/evolution-sdk/commit/1f0671c068d44c1f88e677eb2d8bb55312ff2c38)]:
  - @evolution-sdk/evolution@0.3.0

## 0.2.5

### Minor Changes

- Initial release of @evolution-sdk/devnet as a standalone package
- Extracted from @evolution-sdk/evolution for better modularity
- Full Docker-based local Cardano devnet support
- Configurable genesis parameters and network settings
- Optional Kupo and Ogmios service integration
- Effect-based API for type-safe async operations
- Deterministic genesis UTxO calculation
- Comprehensive test suite included
