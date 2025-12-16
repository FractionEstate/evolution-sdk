---
title: sdk/builders/operations/Mint.ts
nav_order: 154
parent: Modules
---

## Mint overview

Mint operation - creates minting transactions for native tokens.

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [programs](#programs)
  - [createMintProgram](#createmintprogram)

---

# programs

## createMintProgram

Creates a ProgramStep for mintAssets operation.
Adds minting information to the transaction and tracks redeemers by PolicyId.

Implementation:

1. Validates that only native tokens are being minted (no lovelace)
2. Converts SDK Assets to Core.Mint structure
3. Merges with existing mint state
4. Tracks redeemer information for script-based minting policies (by PolicyId)

**Signature**

```ts
export declare const createMintProgram: (
  params: MintTokensParams
) => Effect.Effect<undefined, TransactionBuilderError, TxContext>
```

Added in v2.0.0
