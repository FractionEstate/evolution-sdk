---
title: sdk/builders/phases/utils.ts
nav_order: 173
parent: Modules
---

## utils overview

Shared utilities for transaction builder phases

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utilities](#utilities)
  - [calculateCertificateBalance](#calculatecertificatebalance)
  - [calculateWithdrawals](#calculatewithdrawals)

---

# utilities

## calculateCertificateBalance

Calculate certificate deposits and refunds from a list of certificates.

Certificates with deposits (money OUT):

- RegCert: Stake registration deposit
- RegDrepCert: DRep registration deposit
- RegPoolCert: Pool registration deposit (PoolRegistration)
- StakeRegDelegCert: Combined stake registration + delegation deposit
- VoteRegDelegCert: Combined vote registration + delegation deposit
- StakeVoteRegDelegCert: Combined stake + vote registration + delegation deposit

Certificates with refunds (money IN):

- UnregCert: Stake deregistration refund
- UnregDrepCert: DRep deregistration refund
- RetirePoolCert: Pool retirement refund (PoolRetirement)

**Signature**

```ts
export declare function calculateCertificateBalance(
  certificates: ReadonlyArray<Certificate.Certificate>,
  poolDeposits: ReadonlyMap<string, bigint>
): { deposits: bigint; refunds: bigint }
```

Added in v2.0.0

## calculateWithdrawals

Calculate total withdrawal amount from a map of reward accounts to withdrawal amounts.

**Signature**

```ts
export declare function calculateWithdrawals(withdrawals: ReadonlyMap<unknown, bigint>): bigint
```

Added in v2.0.0
