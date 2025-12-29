---
"@evolution-sdk/devnet": patch
"@evolution-sdk/aiken-uplc": patch
"@evolution-sdk/evolution": patch
"docs": patch
---

Add governance and pool operation APIs to transaction builder

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
