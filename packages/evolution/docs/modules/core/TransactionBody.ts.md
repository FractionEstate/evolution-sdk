---
title: core/TransactionBody.ts
nav_order: 116
parent: Modules
---

## TransactionBody overview

---

<h2 class="text-delta">Table of contents</h2>

- [arbitrary](#arbitrary)
  - [arbitrary](#arbitrary-1)
- [conversion](#conversion)
  - [fromCBORBytes](#fromcborbytes)
  - [fromCBORHex](#fromcborhex)
  - [toCBORBytes](#tocborbytes)
  - [toCBORHex](#tocborhex)
- [model](#model)
  - [TransactionBody (class)](#transactionbody-class)
    - [toJSON (method)](#tojson-method)
    - [toString (method)](#tostring-method)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method)
    - [[Equal.symbol] (method)](#equalsymbol-method)
    - [[Hash.symbol] (method)](#hashsymbol-method)
- [schemas](#schemas)
  - [CDDLSchema](#cddlschema)
  - [FromCBORBytes](#fromcborbytes-1)
  - [FromCBORHex](#fromcborhex-1)
- [utils](#utils)
  - [FromCDDL](#fromcddl)
  - [isTransactionBody](#istransactionbody)

---

# arbitrary

## arbitrary

FastCheck arbitrary for generating random TransactionBody instances.
Used for property-based testing to generate valid test data.

Generates basic TransactionBody instances with required fields (inputs, outputs, fee)
and optionally includes some other common fields.

**Signature**

```ts
export declare const arbitrary: FastCheck.Arbitrary<TransactionBody>
```

Added in v2.0.0

# conversion

## fromCBORBytes

Convert CBOR bytes to TransactionBody.

**Signature**

```ts
export declare const fromCBORBytes: (bytes: Uint8Array, options?: CBOR.CodecOptions) => TransactionBody
```

Added in v2.0.0

## fromCBORHex

Convert CBOR hex string to TransactionBody.

**Signature**

```ts
export declare const fromCBORHex: (hex: string, options?: CBOR.CodecOptions) => TransactionBody
```

Added in v2.0.0

## toCBORBytes

Convert TransactionBody to CBOR bytes.

**Signature**

```ts
export declare const toCBORBytes: (data: TransactionBody, options?: CBOR.CodecOptions) => any
```

Added in v2.0.0

## toCBORHex

Convert TransactionBody to CBOR hex string.

**Signature**

```ts
export declare const toCBORHex: (data: TransactionBody, options?: CBOR.CodecOptions) => string
```

Added in v2.0.0

# model

## TransactionBody (class)

TransactionBody

```
transaction_body =
  {   0  : set<transaction_input>
  ,   1  : [* transaction_output]
  ,   2  : coin
  , ? 3  : slot_no
  , ? 4  : certificates
  , ? 5  : withdrawals
  , ? 7  : auxiliary_data_hash
  , ? 8  : slot_no
  , ? 9  : mint
  , ? 11 : script_data_hash
  , ? 13 : nonempty_set<transaction_input>
  , ? 14 : required_signers
  , ? 15 : network_id
  , ? 16 : transaction_output
  , ? 17 : coin
  , ? 18 : nonempty_set<transaction_input>
  , ? 19 : voting_procedures
  , ? 20 : proposal_procedures
  , ? 21 : coin
  , ? 22 : positive_coin
  }
```

**Signature**

```ts
export declare class TransactionBody
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

Custom hash implementation for TransactionBody.
Only hashes frequently-changing fields for performance.

**Signature**

```ts
[Hash.symbol](): number
```

Added in v2.0.0

# schemas

## CDDLSchema

CDDL schema for TransactionBody struct structure.

**Signature**

```ts
export declare const CDDLSchema: Schema.MapFromSelf<
  typeof Schema.BigIntFromSelf,
  Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>
>
```

Added in v2.0.0

## FromCBORBytes

CBOR bytes transformation schema for TransactionBody.
Transforms between CBOR bytes and TransactionBody using Conway CDDL specification.

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
    Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
    Schema.SchemaClass<TransactionBody, TransactionBody, never>,
    never
  >
>
```

Added in v2.0.0

## FromCBORHex

CBOR hex transformation schema for TransactionBody.
Transforms between CBOR hex string and TransactionBody using Conway CDDL specification.

**Signature**

```ts
export declare const FromCBORHex: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transform<
    Schema.transform<Schema.Schema<string, string, never>, Schema.Schema<Uint8Array, Uint8Array, never>>,
    Schema.transformOrFail<
      typeof Schema.Uint8ArrayFromSelf,
      Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
      never
    >
  >,
  Schema.transformOrFail<
    Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
    Schema.SchemaClass<TransactionBody, TransactionBody, never>,
    never
  >
>
```

Added in v2.0.0

# utils

## FromCDDL

**Signature**

```ts
export declare const FromCDDL: Schema.transformOrFail<
  Schema.MapFromSelf<typeof Schema.BigIntFromSelf, Schema.Schema<CBOR.CBOR, CBOR.CBOR, never>>,
  Schema.SchemaClass<TransactionBody, TransactionBody, never>,
  never
>
```

## isTransactionBody

**Signature**

```ts
export declare const isTransactionBody: (u: unknown, overrideOptions?: ParseOptions | number) => u is TransactionBody
```
