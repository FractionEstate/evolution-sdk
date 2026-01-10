---
title: Transaction.ts
nav_order: 171
parent: Modules
---

## Transaction overview

---

<h2 class="text-delta">Table of contents</h2>

- [model](#model)
  - [Transaction (class)](#transaction-class)
    - [toJSON (method)](#tojson-method)
    - [toString (method)](#tostring-method)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method)
    - [[Equal.symbol] (method)](#equalsymbol-method)
    - [[Hash.symbol] (method)](#hashsymbol-method)
- [utils](#utils)
  - [CDDLSchema](#cddlschema)
  - [FromCBORBytes](#fromcborbytes)
  - [FromCBORHex](#fromcborhex)
  - [FromCDDL](#fromcddl)
  - [arbitrary](#arbitrary)
  - [fromCBORBytes](#fromcborbytes-1)
  - [fromCBORHex](#fromcborhex-1)
  - [toCBORBytes](#tocborbytes)
  - [toCBORHex](#tocborhex)

---

# model

## Transaction (class)

Transaction based on Conway CDDL specification

CDDL: transaction =
[transaction_body, transaction_witness_set, bool, auxiliary_data / nil]

**Signature**

```ts
export declare class Transaction
```

Added in v2.0.0

### toJSON (method)

**Signature**

```ts
toJSON()
```

### toString (method)

**Signature**

```ts
toString(): string
```

### [Inspectable.NodeInspectSymbol] (method)

**Signature**

```ts
[Inspectable.NodeInspectSymbol](): unknown
```

### [Equal.symbol] (method)

**Signature**

```ts
[Equal.symbol](that: unknown): boolean
```

### [Hash.symbol] (method)

**Signature**

```ts
[Hash.symbol](): number
```

# utils

## CDDLSchema

Conway CDDL schema for Transaction tuple structure.

CDDL: transaction = [transaction_body, transaction_witness_set, bool, auxiliary_data / nil]

**Signature**

```ts
export declare const CDDLSchema: Schema.Tuple<
  [
    Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
    Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
    typeof Schema.Boolean,
    Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>
  ]
>
```

## FromCBORBytes

CBOR bytes transformation schema for Transaction.

**Signature**

```ts
export declare const FromCBORBytes: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transformOrFail<
    typeof Schema.Uint8ArrayFromSelf,
    Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
    never
  >,
  Schema.transformOrFail<
    Schema.Tuple<
      [
        Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
        Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
        typeof Schema.Boolean,
        Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>
      ]
    >,
    Schema.SchemaClass<Transaction, Transaction, never>,
    never
  >
>
```

## FromCBORHex

CBOR hex transformation schema for Transaction.

**Signature**

```ts
export declare const FromCBORHex: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transform<
    Schema.Schema<Uint8Array, string, never>,
    Schema.transformOrFail<
      typeof Schema.Uint8ArrayFromSelf,
      Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
      never
    >
  >,
  Schema.transformOrFail<
    Schema.Tuple<
      [
        Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
        Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
        typeof Schema.Boolean,
        Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>
      ]
    >,
    Schema.SchemaClass<Transaction, Transaction, never>,
    never
  >
>
```

## FromCDDL

Transform between CDDL tuple and Transaction class.

**Signature**

```ts
export declare const FromCDDL: Schema.transformOrFail<
  Schema.Tuple<
    [
      Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
      Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
      typeof Schema.Boolean,
      Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>
    ]
  >,
  Schema.SchemaClass<Transaction, Transaction, never>,
  never
>
```

## arbitrary

**Signature**

```ts
export declare const arbitrary: FastCheck.Arbitrary<Transaction>
```

## fromCBORBytes

**Signature**

```ts
export declare const fromCBORBytes: (bytes: Uint8Array, options?: CBOR.CodecOptions) => Transaction
```

## fromCBORHex

**Signature**

```ts
export declare const fromCBORHex: (hex: string, options?: CBOR.CodecOptions) => Transaction
```

## toCBORBytes

**Signature**

```ts
export declare const toCBORBytes: (data: Transaction, options?: CBOR.CodecOptions) => any
```

## toCBORHex

**Signature**

```ts
export declare const toCBORHex: (data: Transaction, options?: CBOR.CodecOptions) => string
```
