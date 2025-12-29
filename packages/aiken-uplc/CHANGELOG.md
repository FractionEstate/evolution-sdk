# @evolution-sdk/aiken-uplc

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
