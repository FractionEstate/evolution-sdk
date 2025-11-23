---
title: core/DRep.ts
nav_order: 48
parent: Modules
---

## DRep overview

---

<h2 class="text-delta">Table of contents</h2>

- [arbitrary](#arbitrary)
  - [arbitrary](#arbitrary-1)
- [constructors](#constructors)
  - [alwaysAbstain](#alwaysabstain)
  - [alwaysNoConfidence](#alwaysnoconfidence)
  - [fromKeyHash](#fromkeyhash)
  - [fromScriptHash](#fromscripthash)
- [encoding](#encoding)
  - [toCBORBytes](#tocborbytes)
  - [toCBORHex](#tocborhex)
- [model](#model)
  - [AlwaysAbstainDRep (class)](#alwaysabstaindrep-class)
    - [toJSON (method)](#tojson-method)
    - [toString (method)](#tostring-method)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method)
    - [[Equal.symbol] (method)](#equalsymbol-method)
    - [[Hash.symbol] (method)](#hashsymbol-method)
  - [AlwaysNoConfidenceDRep (class)](#alwaysnoconfidencedrep-class)
    - [toJSON (method)](#tojson-method-1)
    - [toString (method)](#tostring-method-1)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-1)
    - [[Equal.symbol] (method)](#equalsymbol-method-1)
    - [[Hash.symbol] (method)](#hashsymbol-method-1)
  - [DRep (type alias)](#drep-type-alias)
  - [KeyHashDRep (class)](#keyhashdrep-class)
    - [toJSON (method)](#tojson-method-2)
    - [toString (method)](#tostring-method-2)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-2)
    - [[Equal.symbol] (method)](#equalsymbol-method-2)
    - [[Hash.symbol] (method)](#hashsymbol-method-2)
  - [ScriptHashDRep (class)](#scripthashdrep-class)
    - [toJSON (method)](#tojson-method-3)
    - [toString (method)](#tostring-method-3)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-3)
    - [[Equal.symbol] (method)](#equalsymbol-method-3)
    - [[Hash.symbol] (method)](#hashsymbol-method-3)
- [parsing](#parsing)
  - [fromCBORBytes](#fromcborbytes)
  - [fromCBORHex](#fromcborhex)
- [pattern matching](#pattern-matching)
  - [match](#match)
- [predicates](#predicates)
  - [isDRep](#isdrep)
- [schemas](#schemas)
  - [DRep](#drep)
  - [FromCDDL](#fromcddl)
- [type guards](#type-guards)
  - [isAlwaysAbstainDRep](#isalwaysabstaindrep)
  - [isAlwaysNoConfidenceDRep](#isalwaysnoconfidencedrep)
  - [isKeyHashDRep](#iskeyhashdrep)
  - [isScriptHashDRep](#isscripthashdrep)
- [utils](#utils)
  - [CDDLSchema](#cddlschema)
  - [FromCBORBytes](#fromcborbytes-1)
  - [FromCBORHex](#fromcborhex-1)

---

# arbitrary

## arbitrary

FastCheck arbitrary for generating random DRep instances.

**Signature**

```ts
export declare const arbitrary: FastCheck.Arbitrary<
  KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep
>
```

Added in v2.0.0

# constructors

## alwaysAbstain

Create an AlwaysAbstainDRep.

**Signature**

```ts
export declare const alwaysAbstain: () => AlwaysAbstainDRep
```

Added in v2.0.0

## alwaysNoConfidence

Create an AlwaysNoConfidenceDRep.

**Signature**

```ts
export declare const alwaysNoConfidence: () => AlwaysNoConfidenceDRep
```

Added in v2.0.0

## fromKeyHash

Create a KeyHashDRep from a KeyHash.

**Signature**

```ts
export declare const fromKeyHash: (keyHash: KeyHash.KeyHash) => KeyHashDRep
```

Added in v2.0.0

## fromScriptHash

Create a ScriptHashDRep from a ScriptHash.

**Signature**

```ts
export declare const fromScriptHash: (scriptHash: ScriptHash.ScriptHash) => ScriptHashDRep
```

Added in v2.0.0

# encoding

## toCBORBytes

Encode DRep to CBOR bytes.

**Signature**

```ts
export declare const toCBORBytes: (drep: DRep, options?: CBOR.CodecOptions) => Uint8Array
```

Added in v2.0.0

## toCBORHex

Encode DRep to CBOR hex string.

**Signature**

```ts
export declare const toCBORHex: (drep: DRep, options?: CBOR.CodecOptions) => string
```

Added in v2.0.0

# model

## AlwaysAbstainDRep (class)

AlwaysAbstainDRep variant of DRep.
drep = [2]

**Signature**

```ts
export declare class AlwaysAbstainDRep
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

## AlwaysNoConfidenceDRep (class)

AlwaysNoConfidenceDRep variant of DRep.
drep = [3]

**Signature**

```ts
export declare class AlwaysNoConfidenceDRep
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

## DRep (type alias)

Type alias for DRep.

**Signature**

```ts
export type DRep = typeof DRep.Type
```

Added in v2.0.0

## KeyHashDRep (class)

KeyHashDRep variant of DRep.
drep = [0, addr_keyhash]

**Signature**

```ts
export declare class KeyHashDRep
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

## ScriptHashDRep (class)

ScriptHashDRep variant of DRep.
drep = [1, script_hash]

**Signature**

```ts
export declare class ScriptHashDRep
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

# parsing

## fromCBORBytes

Parse DRep from CBOR bytes.

**Signature**

```ts
export declare const fromCBORBytes: (bytes: Uint8Array, options?: CBOR.CodecOptions) => DRep
```

Added in v2.0.0

## fromCBORHex

Parse DRep from CBOR hex string.

**Signature**

```ts
export declare const fromCBORHex: (hex: string, options?: CBOR.CodecOptions) => DRep
```

Added in v2.0.0

# pattern matching

## match

Pattern match over DRep.

**Signature**

```ts
export declare const match: <A>(patterns: {
  KeyHashDRep: (keyHash: KeyHash.KeyHash) => A
  ScriptHashDRep: (scriptHash: ScriptHash.ScriptHash) => A
  AlwaysAbstainDRep: () => A
  AlwaysNoConfidenceDRep: () => A
}) => (drep: DRep) => A
```

Added in v2.0.0

# predicates

## isDRep

Check if the given value is a valid DRep

**Signature**

```ts
export declare const isDRep: (
  u: unknown,
  overrideOptions?: ParseOptions | number
) => u is KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep
```

Added in v2.0.0

# schemas

## DRep

Union schema for DRep representing different DRep types.

drep = [0, addr_keyhash] / [1, script_hash] / [2] / [3]

**Signature**

```ts
export declare const DRep: Schema.Union<
  [typeof KeyHashDRep, typeof ScriptHashDRep, typeof AlwaysAbstainDRep, typeof AlwaysNoConfidenceDRep]
>
```

Added in v2.0.0

## FromCDDL

CDDL schema for DRep with proper transformation.
drep = [0, addr_keyhash] / [1, script_hash] / [2] / [3]

**Signature**

```ts
export declare const FromCDDL: Schema.transformOrFail<
  Schema.Union<
    [
      Schema.Tuple2<Schema.Literal<[0n]>, typeof Schema.Uint8ArrayFromSelf>,
      Schema.Tuple2<Schema.Literal<[1n]>, typeof Schema.Uint8ArrayFromSelf>,
      Schema.Tuple<[Schema.Literal<[2n]>]>,
      Schema.Tuple<[Schema.Literal<[3n]>]>
    ]
  >,
  Schema.SchemaClass<
    KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
    KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
    never
  >,
  never
>
```

Added in v2.0.0

# type guards

## isAlwaysAbstainDRep

Check if DRep is an AlwaysAbstainDRep.

**Signature**

```ts
export declare const isAlwaysAbstainDRep: (drep: DRep) => drep is AlwaysAbstainDRep
```

Added in v2.0.0

## isAlwaysNoConfidenceDRep

Check if DRep is an AlwaysNoConfidenceDRep.

**Signature**

```ts
export declare const isAlwaysNoConfidenceDRep: (drep: DRep) => drep is AlwaysNoConfidenceDRep
```

Added in v2.0.0

## isKeyHashDRep

Check if DRep is a KeyHashDRep.

**Signature**

```ts
export declare const isKeyHashDRep: (drep: DRep) => drep is KeyHashDRep
```

Added in v2.0.0

## isScriptHashDRep

Check if DRep is a ScriptHashDRep.

**Signature**

```ts
export declare const isScriptHashDRep: (drep: DRep) => drep is ScriptHashDRep
```

Added in v2.0.0

# utils

## CDDLSchema

**Signature**

```ts
export declare const CDDLSchema: Schema.Union<
  [
    Schema.Tuple2<Schema.Literal<[0n]>, typeof Schema.Uint8ArrayFromSelf>,
    Schema.Tuple2<Schema.Literal<[1n]>, typeof Schema.Uint8ArrayFromSelf>,
    Schema.Tuple<[Schema.Literal<[2n]>]>,
    Schema.Tuple<[Schema.Literal<[3n]>]>
  ]
>
```

## FromCBORBytes

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
    Schema.Union<
      [
        Schema.Tuple2<Schema.Literal<[0n]>, typeof Schema.Uint8ArrayFromSelf>,
        Schema.Tuple2<Schema.Literal<[1n]>, typeof Schema.Uint8ArrayFromSelf>,
        Schema.Tuple<[Schema.Literal<[2n]>]>,
        Schema.Tuple<[Schema.Literal<[3n]>]>
      ]
    >,
    Schema.SchemaClass<
      KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
      KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
      never
    >,
    never
  >
>
```

## FromCBORHex

**Signature**

```ts
export declare const FromCBORHex: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transform<Schema.Schema<string, string, never>, Schema.Schema<Uint8Array, Uint8Array, never>>,
  Schema.transform<
    Schema.transformOrFail<
      typeof Schema.Uint8ArrayFromSelf,
      Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
      never
    >,
    Schema.transformOrFail<
      Schema.Union<
        [
          Schema.Tuple2<Schema.Literal<[0n]>, typeof Schema.Uint8ArrayFromSelf>,
          Schema.Tuple2<Schema.Literal<[1n]>, typeof Schema.Uint8ArrayFromSelf>,
          Schema.Tuple<[Schema.Literal<[2n]>]>,
          Schema.Tuple<[Schema.Literal<[3n]>]>
        ]
      >,
      Schema.SchemaClass<
        KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
        KeyHashDRep | ScriptHashDRep | AlwaysAbstainDRep | AlwaysNoConfidenceDRep,
        never
      >,
      never
    >
  >
>
```
