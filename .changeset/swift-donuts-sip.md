---
"@evolution-sdk/devnet": patch
"@evolution-sdk/aiken-uplc": patch
"@evolution-sdk/evolution": patch
---

# Remove SDK types and consolidate type system

This release removes the duplicate SDK-level type wrappers and consolidates the type system to use core types throughout the codebase.

## Breaking Changes

- **Removed SDK type modules**: Deleted redundant type wrappers including `sdk/Address.ts`, `sdk/AddressDetails.ts`, `sdk/Assets.ts`, `sdk/Credential.ts`, `sdk/Datum.ts`, `sdk/Delegation.ts`, `sdk/Network.ts`, `sdk/OutRef.ts`, `sdk/PolicyId.ts`, `sdk/PoolParams.ts`, `sdk/ProtocolParameters.ts`, `sdk/Relay.ts`, `sdk/RewardAddress.ts`, `sdk/Script.ts`, `sdk/UTxO.ts`, and `sdk/Unit.ts`

- **Direct core type usage**: All components now use core types directly instead of going through SDK wrappers, simplifying the type system and reducing maintenance burden

## Bug Fixes

- **Aiken UPLC evaluator**: Fixed incorrect RedeemerTag mappings in the Aiken WASM evaluator
  - Changed `cert: "publish"` → `cert: "cert"`
  - Changed `reward: "withdraw"` → `reward: "reward"`
  - Fixed `ex_units` to properly instantiate `Redeemer.ExUnits` class instead of plain objects
  - Changed `Number()` to `BigInt()` for ExUnits memory and steps values

- **TransactionHash type handling**: Fixed numerous type errors related to `TransactionHash` object usage across test files
  - Removed incorrect `.fromHex()` calls on `TransactionHash` objects
  - Added proper `.toHex()` conversions for string operations
  - Fixed length checks and string comparisons to use hex representation

## Internal Changes

- Simplified type imports across the codebase
- Reduced code duplication between SDK and core type definitions
- Improved type safety by using Effect Schema validation throughout
