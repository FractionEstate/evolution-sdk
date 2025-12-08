---
title: sdk/Address.ts
nav_order: 135
parent: Modules
---

## Address overview

SDK Address module - user-friendly Bech32 string representation

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [Address (type alias)](#address-type-alias)
  - [fromCoreAddress](#fromcoreaddress)
  - [toCoreAddress](#tocoreaddress)

---

# utils

## Address (type alias)

**Signature**

```ts
export type Address = string
```

## fromCoreAddress

**Signature**

```ts
export declare const fromCoreAddress: (a: CoreAddress.Address, overrideOptions?: ParseOptions) => string
```

## toCoreAddress

**Signature**

```ts
export declare const toCoreAddress: (i: string, overrideOptions?: ParseOptions) => CoreAddress.Address
```
