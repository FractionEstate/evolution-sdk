---
title: core/SignData.ts
nav_order: 109
parent: Modules
---

## SignData overview

COSE (RFC 8152) message signing for Cardano.

Implements CIP-30 wallet API and CIP-8 message signing using COSE_Sign1 structures.
Compatible with all major Cardano wallets.

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [API](#api)
  - [signData](#signdata)
  - [verifyData](#verifydata)
- [Constructors](#constructors)
  - [coseSign1BuilderNew](#cosesign1buildernew)
  - [headerMapNew](#headermapnew)
  - [headersNew](#headersnew)
  - [labelFromAlgorithmId](#labelfromalgorithmid)
  - [labelFromCurveType](#labelfromcurvetype)
  - [labelFromInt](#labelfromint)
  - [labelFromKeyType](#labelfromkeytype)
  - [labelFromText](#labelfromtext)
- [Conversion](#conversion)
  - [coseSign1FromCBORBytes](#cosesign1fromcborbytes)
  - [coseSign1FromCBORHex](#cosesign1fromcborhex)
  - [coseSign1ToCBORBytes](#cosesign1tocborbytes)
  - [coseSign1ToCBORHex](#cosesign1tocborhex)
  - [headerMapFromCBORBytes](#headermapfromcborbytes)
  - [headerMapFromCBORHex](#headermapfromcborhex)
  - [headerMapToCBORBytes](#headermaptocborbytes)
  - [headerMapToCBORHex](#headermaptocborhex)
- [Model](#model)
  - [COSEKey (class)](#cosekey-class)
    - [toJSON (method)](#tojson-method)
    - [toString (method)](#tostring-method)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method)
    - [[Equal.symbol] (method)](#equalsymbol-method)
    - [[Hash.symbol] (method)](#hashsymbol-method)
  - [COSESign1 (class)](#cosesign1-class)
    - [toJSON (method)](#tojson-method-1)
    - [toString (method)](#tostring-method-1)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-1)
    - [[Equal.symbol] (method)](#equalsymbol-method-1)
    - [[Hash.symbol] (method)](#hashsymbol-method-1)
    - [signedData (method)](#signeddata-method)
  - [COSESign1Builder (class)](#cosesign1builder-class)
    - [toJSON (method)](#tojson-method-2)
    - [toString (method)](#tostring-method-2)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-2)
    - [[Equal.symbol] (method)](#equalsymbol-method-2)
    - [[Hash.symbol] (method)](#hashsymbol-method-2)
    - [setExternalAad (method)](#setexternalaad-method)
    - [makeDataToSign (method)](#makedatatosign-method)
    - [build (method)](#build-method)
  - [EdDSA25519Key (class)](#eddsa25519key-class)
    - [toJSON (method)](#tojson-method-3)
    - [toString (method)](#tostring-method-3)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-3)
    - [[Equal.symbol] (method)](#equalsymbol-method-3)
    - [[Hash.symbol] (method)](#hashsymbol-method-3)
    - [setPrivateKey (method)](#setprivatekey-method)
    - [isForSigning (method)](#isforsigning-method)
    - [isForVerifying (method)](#isforverifying-method)
    - [build (method)](#build-method-1)
  - [HeaderMap (class)](#headermap-class)
    - [toJSON (method)](#tojson-method-4)
    - [toString (method)](#tostring-method-4)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-4)
    - [[Equal.symbol] (method)](#equalsymbol-method-4)
    - [[Hash.symbol] (method)](#hashsymbol-method-4)
    - [setAlgorithmId (method)](#setalgorithmid-method)
    - [algorithmId (method)](#algorithmid-method)
    - [setKeyId (method)](#setkeyid-method)
    - [keyId (method)](#keyid-method)
    - [setHeader (method)](#setheader-method)
    - [header (method)](#header-method)
    - [keys (method)](#keys-method)
  - [Headers (class)](#headers-class)
    - [toJSON (method)](#tojson-method-5)
    - [toString (method)](#tostring-method-5)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-5)
    - [[Equal.symbol] (method)](#equalsymbol-method-5)
    - [[Hash.symbol] (method)](#hashsymbol-method-5)
  - [Label (class)](#label-class)
    - [toJSON (method)](#tojson-method-6)
    - [toString (method)](#tostring-method-6)
    - [[Inspectable.NodeInspectSymbol] (method)](#inspectablenodeinspectsymbol-method-6)
    - [[Equal.symbol] (method)](#equalsymbol-method-6)
    - [[Hash.symbol] (method)](#hashsymbol-method-6)
    - [asInt (method)](#asint-method)
    - [asText (method)](#astext-method)
- [Schemas](#schemas)
  - [COSEKeyFromCBORBytes](#cosekeyfromcborbytes)
  - [COSESign1FromCBORBytes](#cosesign1fromcborbytes-1)
  - [COSESign1FromCBORHex](#cosesign1fromcborhex-1)
  - [HeaderMapFromCBORBytes](#headermapfromcborbytes-1)
  - [HeaderMapFromCBORHex](#headermapfromcborhex-1)
- [Testing](#testing)
  - [arbitraryPayload](#arbitrarypayload)
- [Types](#types)
  - [Payload (type alias)](#payload-type-alias)
  - [SignedMessage (type alias)](#signedmessage-type-alias)
- [Utilities](#utilities)
  - [fromHex](#fromhex)
  - [fromText](#fromtext)
  - [toHex](#tohex)
  - [toText](#totext)

---

# API

## signData

Sign data with a private key using COSE_Sign1.

Implements CIP-30 `api.signData()` specification. Creates a COSE_Sign1 structure with:

- Protected headers: algorithm (EdDSA), address
- Unprotected headers: hashed (false)
- Payload: NOT pre-hashed
- Returns CBOR-encoded COSE_Sign1 and COSE_Key

**Signature**

```ts
export declare const signData: (
  addressHex: string,
  payload: Payload,
  privateKey: PrivateKey.PrivateKey
) => SignedMessage
```

Added in v2.0.0

## verifyData

Verify a COSE_Sign1 signed message.

Validates CIP-30 signatures by verifying:

- Payload matches signed data
- Address matches protected headers
- Algorithm is EdDSA
- Public key hash matches provided key hash
- Ed25519 signature is cryptographically valid

**Signature**

```ts
export declare const verifyData: (
  addressHex: string,
  keyHash: string,
  payload: Payload,
  signedMessage: SignedMessage
) => boolean
```

Added in v2.0.0

# Constructors

## coseSign1BuilderNew

Create a new COSESign1Builder.

**Signature**

```ts
export declare const coseSign1BuilderNew: (
  headers: Headers,
  payload: Uint8Array,
  hashPayload: boolean
) => COSESign1Builder
```

Added in v2.0.0

## headerMapNew

Create an empty HeaderMap.

**Signature**

```ts
export declare const headerMapNew: () => HeaderMap
```

Added in v2.0.0

## headersNew

Create Headers with protected and unprotected maps.

**Signature**

```ts
export declare const headersNew: (protectedHeaders: HeaderMap, unprotectedHeaders: HeaderMap) => Headers
```

Added in v2.0.0

## labelFromAlgorithmId

Create a Label from AlgorithmId.

**Signature**

```ts
export declare const labelFromAlgorithmId: (alg: AlgorithmId) => Label
```

Added in v2.0.0

## labelFromCurveType

Create a Label from CurveType.

**Signature**

```ts
export declare const labelFromCurveType: (crv: CurveType) => Label
```

Added in v2.0.0

## labelFromInt

Create a Label from an integer.

**Signature**

```ts
export declare const labelFromInt: (value: bigint) => Label
```

Added in v2.0.0

## labelFromKeyType

Create a Label from KeyType.

**Signature**

```ts
export declare const labelFromKeyType: (kty: KeyType) => Label
```

Added in v2.0.0

## labelFromText

Create a Label from a text string.

**Signature**

```ts
export declare const labelFromText: (value: string) => Label
```

Added in v2.0.0

# Conversion

## coseSign1FromCBORBytes

Decode COSESign1 from CBOR bytes.

**Signature**

```ts
export declare const coseSign1FromCBORBytes: (bytes: Uint8Array, options?: CBOR.CodecOptions) => COSESign1
```

Added in v2.0.0

## coseSign1FromCBORHex

Decode COSESign1 from CBOR hex.

**Signature**

```ts
export declare const coseSign1FromCBORHex: (hex: string, options?: CBOR.CodecOptions) => COSESign1
```

Added in v2.0.0

## coseSign1ToCBORBytes

Encode COSESign1 to CBOR bytes.

**Signature**

```ts
export declare const coseSign1ToCBORBytes: (coseSign1: COSESign1, options?: CBOR.CodecOptions) => Uint8Array
```

Added in v2.0.0

## coseSign1ToCBORHex

Encode COSESign1 to CBOR hex.

**Signature**

```ts
export declare const coseSign1ToCBORHex: (coseSign1: COSESign1, options?: CBOR.CodecOptions) => string
```

Added in v2.0.0

## headerMapFromCBORBytes

Decode HeaderMap from CBOR bytes.

**Signature**

```ts
export declare const headerMapFromCBORBytes: (bytes: Uint8Array, options?: CBOR.CodecOptions) => HeaderMap
```

Added in v2.0.0

## headerMapFromCBORHex

Decode HeaderMap from CBOR hex.

**Signature**

```ts
export declare const headerMapFromCBORHex: (hex: string, options?: CBOR.CodecOptions) => HeaderMap
```

Added in v2.0.0

## headerMapToCBORBytes

Encode HeaderMap to CBOR bytes.

**Signature**

```ts
export declare const headerMapToCBORBytes: (headerMap: HeaderMap, options?: CBOR.CodecOptions) => Uint8Array
```

Added in v2.0.0

## headerMapToCBORHex

Encode HeaderMap to CBOR hex.

**Signature**

```ts
export declare const headerMapToCBORHex: (headerMap: HeaderMap, options?: CBOR.CodecOptions) => string
```

Added in v2.0.0

# Model

## COSEKey (class)

COSE key representation (RFC 8152).

**Signature**

```ts
export declare class COSEKey
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

## COSESign1 (class)

COSE_Sign1 structure (RFC 8152) - signed message.

**Signature**

```ts
export declare class COSESign1
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

### signedData (method)

Get the signed data (Sig_structure as per RFC 8152).

**Signature**

```ts
signedData(externalAad: Uint8Array = new Uint8Array()): Uint8Array
```

Added in v2.0.0

## COSESign1Builder (class)

Builder for creating COSE_Sign1 structures.

**Signature**

```ts
export declare class COSESign1Builder
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

### setExternalAad (method)

Set external additional authenticated data.

**Signature**

```ts
setExternalAad(aad: Uint8Array): this
```

Added in v2.0.0

### makeDataToSign (method)

Create the data that needs to be signed (Sig_structure).

**Signature**

```ts
makeDataToSign(): Uint8Array
```

Added in v2.0.0

### build (method)

Build the final COSESign1 structure with the provided signature.

**Signature**

```ts
build(signature: Ed25519Signature.Ed25519Signature): COSESign1
```

Added in v2.0.0

## EdDSA25519Key (class)

Ed25519 key for signing and verification.

**Signature**

```ts
export declare class EdDSA25519Key
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

### setPrivateKey (method)

Set the private key for signing.

**Signature**

```ts
setPrivateKey(privateKey: PrivateKey.PrivateKey): this
```

Added in v2.0.0

### isForSigning (method)

Check if key can be used for signing.

**Signature**

```ts
isForSigning(): boolean
```

Added in v2.0.0

### isForVerifying (method)

Check if key can be used for verification.

**Signature**

```ts
isForVerifying(): boolean
```

Added in v2.0.0

### build (method)

Build a COSEKey from this Ed25519 key.

**Signature**

```ts
build(): COSEKey
```

Added in v2.0.0

## HeaderMap (class)

Map of COSE header labels to values (RFC 8152).

**Signature**

```ts
export declare class HeaderMap
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

### setAlgorithmId (method)

Set algorithm identifier header.

**Signature**

```ts
setAlgorithmId(alg: AlgorithmId): this
```

Added in v2.0.0

### algorithmId (method)

Get algorithm identifier header.

**Signature**

```ts
algorithmId(): AlgorithmId | undefined
```

Added in v2.0.0

### setKeyId (method)

Set key ID header.

**Signature**

```ts
setKeyId(kid: Uint8Array): this
```

Added in v2.0.0

### keyId (method)

Get key ID header.

**Signature**

```ts
keyId(): Uint8Array | undefined
```

Added in v2.0.0

### setHeader (method)

Set custom header.

**Signature**

```ts
setHeader(label: Label, value: CBOR.CBOR): this
```

Added in v2.0.0

### header (method)

Get custom header.

**Signature**

```ts
header(label: Label): CBOR.CBOR | undefined
```

Added in v2.0.0

### keys (method)

Get all header label keys.

**Signature**

```ts
keys(): ReadonlyArray<Label>
```

Added in v2.0.0

## Headers (class)

COSE protected and unprotected headers (RFC 8152).

**Signature**

```ts
export declare class Headers
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

## Label (class)

COSE header label - can be an integer or text string (RFC 8152).

**Signature**

```ts
export declare class Label
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

### asInt (method)

Get the integer value (throws if label is text).

**Signature**

```ts
asInt(): bigint
```

Added in v2.0.0

### asText (method)

Get the text value (throws if label is integer).

**Signature**

```ts
asText(): string
```

Added in v2.0.0

# Schemas

## COSEKeyFromCBORBytes

CBOR bytes transformation schema for COSEKey.
Encodes COSEKey as a CBOR Map compatible with CSL.

**Signature**

```ts
export declare const COSEKeyFromCBORBytes: (
  options?: CBOR.CodecOptions
) => Schema.transformOrFail<
  Schema.transformOrFail<
    typeof Schema.Uint8ArrayFromSelf,
    Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
    never
  >,
  Schema.SchemaClass<COSEKey, COSEKey, never>,
  never
>
```

Added in v2.0.0

## COSESign1FromCBORBytes

CBOR bytes transformation schema for COSESign1.

**Signature**

```ts
export declare const COSESign1FromCBORBytes: (
  options?: CBOR.CodecOptions
) => Schema.transformOrFail<
  Schema.transformOrFail<
    typeof Schema.Uint8ArrayFromSelf,
    Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
    never
  >,
  Schema.SchemaClass<COSESign1, COSESign1, never>,
  never
>
```

Added in v2.0.0

## COSESign1FromCBORHex

CBOR hex transformation schema for COSESign1.

**Signature**

```ts
export declare const COSESign1FromCBORHex: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transform<Schema.Schema<string, string, never>, Schema.Schema<Uint8Array, Uint8Array, never>>,
  Schema.transformOrFail<
    Schema.transformOrFail<
      typeof Schema.Uint8ArrayFromSelf,
      Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
      never
    >,
    Schema.SchemaClass<COSESign1, COSESign1, never>,
    never
  >
>
```

Added in v2.0.0

## HeaderMapFromCBORBytes

CBOR bytes transformation schema for HeaderMap.

**Signature**

```ts
export declare const HeaderMapFromCBORBytes: (
  options?: CBOR.CodecOptions
) => Schema.transformOrFail<
  Schema.transformOrFail<
    typeof Schema.Uint8ArrayFromSelf,
    Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
    never
  >,
  Schema.SchemaClass<HeaderMap, HeaderMap, never>,
  never
>
```

Added in v2.0.0

## HeaderMapFromCBORHex

CBOR hex transformation schema for HeaderMap.

**Signature**

```ts
export declare const HeaderMapFromCBORHex: (
  options?: CBOR.CodecOptions
) => Schema.transform<
  Schema.transform<Schema.Schema<string, string, never>, Schema.Schema<Uint8Array, Uint8Array, never>>,
  Schema.transformOrFail<
    Schema.transformOrFail<
      typeof Schema.Uint8ArrayFromSelf,
      Schema.declare<CBOR.CBOR, CBOR.CBOR, readonly [], never>,
      never
    >,
    Schema.SchemaClass<HeaderMap, HeaderMap, never>,
    never
  >
>
```

Added in v2.0.0

# Testing

## arbitraryPayload

FastCheck arbitrary for generating random Payload instances.

**Signature**

```ts
export declare const arbitraryPayload: FastCheck.Arbitrary<Uint8Array>
```

Added in v2.0.0

# Types

## Payload (type alias)

Payload type - raw binary data to be signed.

The payload is NOT pre-hashed before signing (per CIP-8).

**Signature**

```ts
export type Payload = Uint8Array
```

Added in v2.0.0

## SignedMessage (type alias)

Signed message result (CIP-30 DataSignature format).

Contains CBOR-encoded COSE_Sign1 (signature) and COSE_Key (public key).

**Signature**

```ts
export type SignedMessage = {
  readonly signature: Uint8Array
  readonly key: Uint8Array
}
```

Added in v2.0.0

# Utilities

## fromHex

Convert hex string to Payload.

**Signature**

```ts
export declare const fromHex: (hex: string) => Payload
```

Added in v2.0.0

## fromText

Convert text to Payload (UTF-8 encoding).

**Signature**

```ts
export declare const fromText: (text: string) => Payload
```

Added in v2.0.0

## toHex

Convert Payload to hex string.

**Signature**

```ts
export declare const toHex: (payload: Payload) => string
```

Added in v2.0.0

## toText

Convert Payload to text (UTF-8 decoding).

**Signature**

```ts
export declare const toText: (payload: Payload) => string
```

Added in v2.0.0
