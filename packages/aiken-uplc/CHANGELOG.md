# @evolution-sdk/aiken-uplc

## 0.0.8

### Patch Changes

- Updated dependencies [[`63c8491`](https://github.com/IntersectMBO/evolution-sdk/commit/63c84919b79690dc3b108616bb84fbd3841f09b7)]:
  - @evolution-sdk/evolution@0.3.16

## 0.0.7

### Patch Changes

- Updated dependencies [[`d801fa1`](https://github.com/IntersectMBO/evolution-sdk/commit/d801fa1ce89c4cdea70cb19c4efa919446dadcaa)]:
  - @evolution-sdk/evolution@0.3.15

## 0.0.6

### Patch Changes

- Updated dependencies [[`d21109b`](https://github.com/IntersectMBO/evolution-sdk/commit/d21109b3f42bdee33f1c8e3ecf274ca04735f8f5)]:
  - @evolution-sdk/evolution@0.3.14

## 0.0.5

### Patch Changes

- Updated dependencies [[`2742e40`](https://github.com/IntersectMBO/evolution-sdk/commit/2742e40ea0e62cd75d2a958bed0b6ff6138ded59)]:
  - @evolution-sdk/evolution@0.3.13

## 0.0.4

### Patch Changes

- [#125](https://github.com/IntersectMBO/evolution-sdk/pull/125) [`8b8ade7`](https://github.com/IntersectMBO/evolution-sdk/commit/8b8ade75f51dd1103dcf4b3714f0012d8e430725) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - # Remove SDK types and consolidate type system

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

- Updated dependencies [[`15be602`](https://github.com/IntersectMBO/evolution-sdk/commit/15be602a53dfcf59b8f0ccec55081904eaf7ff89), [`8b8ade7`](https://github.com/IntersectMBO/evolution-sdk/commit/8b8ade75f51dd1103dcf4b3714f0012d8e430725)]:
  - @evolution-sdk/evolution@0.3.12

## 0.0.3

### Patch Changes

- Updated dependencies [[`079fd98`](https://github.com/IntersectMBO/evolution-sdk/commit/079fd98c2a1457b2d0fa2417d6e29ef996b59411)]:
  - @evolution-sdk/evolution@0.3.11

## 0.0.2

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

- Updated dependencies [[`ed9bdc0`](https://github.com/IntersectMBO/evolution-sdk/commit/ed9bdc07011bcc4875b61fdd6b4f8e4219bb67e4)]:
  - @evolution-sdk/evolution@0.3.10

## 0.0.1

### Patch Changes

- [#116](https://github.com/IntersectMBO/evolution-sdk/pull/116) [`59b6187`](https://github.com/IntersectMBO/evolution-sdk/commit/59b6187cc9d7080ed580341d92c7845d47125c7c) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Initial release of Aiken UPLC evaluator - a WASM-based plugin for local script evaluation in the Evolution SDK

- Updated dependencies [[`0503b96`](https://github.com/IntersectMBO/evolution-sdk/commit/0503b968735bc221b3f4d005d5c97ac8a0a1c592)]:
  - @evolution-sdk/evolution@0.3.9
