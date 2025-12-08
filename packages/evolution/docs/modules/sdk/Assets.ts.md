---
title: sdk/Assets.ts
nav_order: 137
parent: Modules
---

## Assets overview

---

<h2 class="text-delta">Table of contents</h2>

- [conversion](#conversion)
  - [fromCoreAssets](#fromcoreassets)
  - [fromCoreAssetsSchema](#fromcoreassetsschema)
  - [fromMint](#frommint)
  - [toCoreAssets](#tocoreassets)
  - [toCoreAssetsSchema](#tocoreassetsschema)
  - [toMint](#tomint)
- [helpers](#helpers)
  - [addLovelace](#addlovelace)
  - [getLovelace](#getlovelace)
  - [setLovelace](#setlovelace)
  - [subtractLovelace](#subtractlovelace)
- [schemas](#schemas)
  - [CoreAssetsFromAssets](#coreassetsfromassets)
  - [MintFromAssets](#mintfromassets)
- [utils](#utils)
  - [Assets (type alias)](#assets-type-alias)
  - [AssetsSchema](#assetsschema)
  - [add](#add)
  - [empty](#empty)
  - [filter](#filter)
  - [fromLovelace](#fromlovelace)
  - [getAsset](#getasset)
  - [getUnits](#getunits)
  - [hasAsset](#hasasset)
  - [isEmpty](#isempty)
  - [make](#make)
  - [merge](#merge)
  - [multiply](#multiply)
  - [negate](#negate)
  - [sortCanonical](#sortcanonical)
  - [subtract](#subtract)

---

# conversion

## fromCoreAssets

Convert core Assets (lovelace + optional MultiAsset) to SDK Assets format.

**Signature**

```ts
export declare const fromCoreAssets: (coreAssets: CoreAssets.Assets) => Assets
```

Added in v2.0.0

## fromCoreAssetsSchema

Convert Core Assets to SDK Assets format.

**Signature**

```ts
export declare const fromCoreAssetsSchema: (
  a: CoreAssets.Assets,
  overrideOptions?: ParseOptions
) => { readonly lovelace?: string | undefined } & { readonly [x: string]: string }
```

Added in v2.0.0

## fromMint

Convert Core Mint to SDK Assets format (without lovelace).

**Signature**

```ts
export declare const fromMint: (
  a: CoreMint.Mint,
  overrideOptions?: ParseOptions
) => { readonly lovelace?: string | undefined } & { readonly [x: string]: string }
```

Added in v2.0.0

## toCoreAssets

Convert SDK Assets format to core Assets (lovelace + optional MultiAsset).

**Signature**

```ts
export declare const toCoreAssets: (assets: Assets) => CoreAssets.Assets
```

Added in v2.0.0

## toCoreAssetsSchema

Convert SDK Assets to Core Assets.

**Signature**

```ts
export declare const toCoreAssetsSchema: (
  i: { readonly lovelace?: string | undefined } & { readonly [x: string]: string },
  overrideOptions?: ParseOptions
) => CoreAssets.Assets
```

Added in v2.0.0

## toMint

Convert SDK Assets to Core Mint (lovelace key will be rejected).

**Signature**

```ts
export declare const toMint: (
  i: { readonly lovelace?: string | undefined } & { readonly [x: string]: string },
  overrideOptions?: ParseOptions
) => CoreMint.Mint
```

Added in v2.0.0

# helpers

## addLovelace

Add a lovelace amount to Assets.

**Signature**

```ts
export declare const addLovelace: (assets: Assets, amount: bigint) => Assets
```

Added in v2.0.0

## getLovelace

Get the lovelace amount from Assets, defaulting to 0n if undefined.

**Signature**

```ts
export declare const getLovelace: (assets: Assets) => bigint
```

Added in v2.0.0

## setLovelace

Set the lovelace amount in Assets.

**Signature**

```ts
export declare const setLovelace: (assets: Assets, amount: bigint) => Assets
```

Added in v2.0.0

## subtractLovelace

Subtract a lovelace amount from Assets.

**Signature**

```ts
export declare const subtractLovelace: (assets: Assets, amount: bigint) => Assets
```

Added in v2.0.0

# schemas

## CoreAssetsFromAssets

Transform between Assets (SDK-friendly) and core Assets.

**Signature**

```ts
export declare const CoreAssetsFromAssets: Schema.transformOrFail<
  Schema.extend<
    Schema.Struct<{ lovelace: Schema.optional<typeof Schema.BigInt> }>,
    Schema.Record$<typeof Schema.String, typeof Schema.BigInt>
  >,
  Schema.SchemaClass<CoreAssets.Assets, CoreAssets.Assets, never>,
  never
>
```

Added in v2.0.0

## MintFromAssets

Transform between Assets (SDK-friendly) and Mint (Core).

**Signature**

```ts
export declare const MintFromAssets: Schema.transformOrFail<
  Schema.extend<
    Schema.Struct<{ lovelace: Schema.optional<typeof Schema.BigInt> }>,
    Schema.Record$<typeof Schema.String, typeof Schema.BigInt>
  >,
  Schema.SchemaClass<CoreMint.Mint, CoreMint.Mint, never>,
  never
>
```

Added in v2.0.0

# utils

## Assets (type alias)

**Signature**

```ts
export type Assets = typeof AssetsSchema.Type
```

## AssetsSchema

**Signature**

```ts
export declare const AssetsSchema: Schema.extend<
  Schema.Struct<{ lovelace: Schema.optional<typeof Schema.BigInt> }>,
  Schema.Record$<typeof Schema.String, typeof Schema.BigInt>
>
```

## add

**Signature**

```ts
export declare const add: (a: Assets, b: Assets) => Assets
```

## empty

**Signature**

```ts
export declare const empty: () => Assets
```

## filter

**Signature**

```ts
export declare const filter: (assets: Assets, predicate: (unit: string, amount: bigint) => boolean) => Assets
```

## fromLovelace

**Signature**

```ts
export declare const fromLovelace: (lovelace: bigint) => Assets
```

## getAsset

**Signature**

```ts
export declare const getAsset: (assets: Assets, unit: string) => bigint
```

## getUnits

**Signature**

```ts
export declare const getUnits: (assets: Assets) => Array<string>
```

## hasAsset

**Signature**

```ts
export declare const hasAsset: (assets: Assets, unit: string) => boolean
```

## isEmpty

**Signature**

```ts
export declare const isEmpty: (assets: Assets) => boolean
```

## make

**Signature**

```ts
export declare const make: (lovelace: bigint, tokens?: Record<string, bigint>) => Assets
```

## merge

**Signature**

```ts
export declare const merge: (...assets: Array<Assets>) => Assets
```

## multiply

Multiply all asset amounts by a factor.
Useful for calculating fees, rewards, or scaling asset amounts.

**Signature**

```ts
export declare const multiply: (assets: Assets, factor: bigint) => Assets
```

## negate

Negate all asset amounts.
Useful for calculating what needs to be subtracted or for representing debts.

**Signature**

```ts
export declare const negate: (assets: Assets) => Assets
```

## sortCanonical

Sort assets according to CBOR canonical ordering rules (RFC 7049 section 3.9).
Lovelace comes first, then assets sorted by policy ID length, then lexicographically.

**Signature**

```ts
export declare const sortCanonical: (assets: Assets) => Assets
```

## subtract

**Signature**

```ts
export declare const subtract: (a: Assets, b: Assets) => Assets
```
