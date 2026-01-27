---
title: utils/Hash.ts
nav_order: 190
parent: Modules
---

## Hash overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [RedeemersFormat (type alias)](#redeemersformat-type-alias)
  - [computeTotalExUnits](#computetotalexunits)
  - [hashAuxiliaryData](#hashauxiliarydata)
  - [hashScriptData](#hashscriptdata)
  - [hashTransaction](#hashtransaction)

---

# utils

## RedeemersFormat (type alias)

Format for encoding redeemers in the script data hash.

- "array": Legacy format `[ + redeemer ]` (Shelley-Babbage)
- "map": Conway format `{ + [tag, index] => [data, ex_units] }`

**Signature**

```ts
export type RedeemersFormat = "array" | "map"
```

## computeTotalExUnits

Compute total ex_units by summing over redeemers.

**Signature**

```ts
export declare const computeTotalExUnits: (redeemers: ReadonlyArray<Redeemer.Redeemer>) => Redeemer.ExUnits
```

## hashAuxiliaryData

Compute hash of auxiliary data (tag 259) per ledger rules.

**Signature**

```ts
export declare const hashAuxiliaryData: (aux: AuxiliaryData.AuxiliaryData) => AuxiliaryDataHash.AuxiliaryDataHash
```

## hashScriptData

Compute script_data_hash using standard module encoders.

The payload format per CDDL spec is raw concatenation (not a CBOR structure):

```
redeemers_bytes || datums_bytes || language_views_bytes
```

**Signature**

```ts
export declare const hashScriptData: (
  redeemers: ReadonlyArray<Redeemer.Redeemer>,
  costModels: CostModel.CostModels,
  datums?: ReadonlyArray<Data.Data>,
  format?: RedeemersFormat,
  options?: CBOR.CodecOptions
) => ScriptDataHash.ScriptDataHash
```

## hashTransaction

Compute the transaction body hash (blake2b-256 over CBOR of body).

**Signature**

```ts
export declare const hashTransaction: (body: TransactionBody.TransactionBody) => TransactionHash.TransactionHash
```
