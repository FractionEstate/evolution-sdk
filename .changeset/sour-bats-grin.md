---
"@evolution-sdk/evolution": patch
---

### Provider Improvements: Full UTxO Resolution with Scripts and Datums

**Blockfrost Provider:**
- Added pagination support for `getUtxos` and `getUtxosWithUnit` (handles addresses with >100 UTxOs)
- Full UTxO resolution now fetches reference scripts and resolves datum hashes
- Updated `BlockfrostDelegation` schema to match actual `/accounts/{stake_address}` endpoint response
- Added `BlockfrostAssetAddress` and `BlockfrostTxUtxos` schemas for proper endpoint handling
- Improved `evaluateTx` to always use the more reliable `/utils/txs/evaluate/utxos` JSON endpoint
- Added `EvaluationFailure` handling in evaluation response schema
- Fixed delegation transformation to use `withdrawable_amount` for rewards
- Added Conway era governance parameters (`drep_deposit`, `gov_action_deposit`) to protocol params

**Kupmios Provider:**
- Removed unnecessary double CBOR encoding for Plutus scripts (Kupo returns properly encoded scripts)

**PoolKeyHash:**
- Added `FromBech32` schema for parsing pool IDs in bech32 format (pool1...)
- Added `fromBech32` and `toBech32` helper functions

**Transaction Builder:**
- Added `passAdditionalUtxos` option to control UTxO passing to provider evaluators (default: false to avoid OverlappingAdditionalUtxo errors)
- Added `scriptDataFormat` option to choose between Conway-era array format and Babbage-era map format for redeemers
- Fixed cost model detection to check reference scripts (not just witness set scripts) for Plutus version detection
