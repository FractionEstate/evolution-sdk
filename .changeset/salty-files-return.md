---
"@evolution-sdk/devnet": patch
"@evolution-sdk/evolution": patch
---

### PlutusV3 Minting Support

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
