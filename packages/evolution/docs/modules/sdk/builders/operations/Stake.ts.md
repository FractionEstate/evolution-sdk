---
title: sdk/builders/operations/Stake.ts
nav_order: 160
parent: Modules
---

## Stake overview

Stake operations - register, deregister stake credentials and withdraw rewards.

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [programs](#programs)
  - [createDelegateToProgram](#createdelegatetoprogram)
  - [createDeregisterStakeProgram](#createderegisterstakeprogram)
  - [createRegisterAndDelegateToProgram](#createregisteranddelegatetoprogram)
  - [createRegisterStakeProgram](#createregisterstakeprogram)
  - [createWithdrawProgram](#createwithdrawprogram)

---

# programs

## createDelegateToProgram

Creates a ProgramStep for delegateTo operation.
Adds delegation certificate(s) to the transaction.

Supports three modes:

- Pool only: Creates StakeDelegation certificate
- DRep only: Creates VoteDelegCert certificate (Conway)
- Both: Creates StakeVoteDelegCert certificate (Conway)

For script-controlled credentials, tracks redeemer for evaluation.

**Signature**

```ts
export declare const createDelegateToProgram: (
  params: DelegateToParams
) => Effect.Effect<undefined, TransactionBuilderError, TxContext>
```

Added in v2.0.0

## createDeregisterStakeProgram

Creates a ProgramStep for deregisterStake operation.
Adds an UnregCert (Conway-era) certificate to the transaction.
Requires keyDeposit from protocol parameters for the refund.

For script-controlled credentials, tracks redeemer for evaluation.

**Signature**

```ts
export declare const createDeregisterStakeProgram: (
  params: DeregisterStakeParams
) => Effect.Effect<undefined, TransactionBuilderError, TxContext | TxBuilderConfigTag>
```

Added in v2.0.0

## createRegisterAndDelegateToProgram

Creates a ProgramStep for registerAndDelegateTo operation.
Combines registration and delegation into a single certificate, saving fees.

Supports three modes:

- Pool only: Creates StakeRegDelegCert certificate
- DRep only: Creates VoteRegDelegCert certificate (Conway)
- Both: Creates StakeVoteRegDelegCert certificate (Conway)

For script-controlled credentials, tracks redeemer for evaluation.

**Signature**

```ts
export declare const createRegisterAndDelegateToProgram: (
  params: RegisterAndDelegateToParams
) => Effect.Effect<undefined, TransactionBuilderError, TxContext | TxBuilderConfigTag>
```

Added in v2.0.0

## createRegisterStakeProgram

Creates a ProgramStep for registerStake operation.
Adds a RegCert (Conway-era) certificate to the transaction.
Requires keyDeposit from protocol parameters.

**Signature**

```ts
export declare const createRegisterStakeProgram: (
  params: RegisterStakeParams
) => Effect.Effect<undefined, TransactionBuilderError, TxContext | TxBuilderConfigTag>
```

Added in v2.0.0

## createWithdrawProgram

Creates a ProgramStep for withdraw operation.
Adds a withdrawal entry to the transaction.

For script-controlled credentials, tracks redeemer for evaluation.
Use amount: 0n to trigger stake validator without withdrawing (coordinator pattern).

**Signature**

```ts
export declare const createWithdrawProgram: (
  params: WithdrawParams,
  config: TxBuilderConfig
) => Effect.Effect<undefined, TransactionBuilderError, TxContext>
```

Added in v2.0.0
