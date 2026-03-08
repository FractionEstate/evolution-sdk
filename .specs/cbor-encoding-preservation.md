# CBOR Encoding Preservation

**Status**: DRAFT  
**Version**: 1.0.0  
**Owners**: @jonathan  

## Abstract

Defines how the Evolution SDK preserves original CBOR encoding choices (integer widths, definite/indefinite containers, map key ordering) across decode → domain object → re-encode cycles. Preserving byte-level fidelity prevents transaction ID drift and signature invalidation.

## Purpose and Scope

**Covers**: The `CBOR.ts` decoder/encoder, `FromBytes` schema, and every `FromCDDL` transform that bridges CBOR AST ↔ domain types.

**Does not cover**: The existing `addVKeyWitnessesBytes` byte-splice path (that already preserves bytes by never decoding the body). Does not change the public API surface of any module.

**Target**: All CBOR-encoded types in `packages/evolution/src/` that use the `Schema.compose(CBOR.FromBytes, FromCDDL)` pipeline.

## Introduction

A Cardano transaction ID is `blake2b-256(body_bytes)`. If `decode → re-encode` changes even one byte, the txId changes and every existing signature breaks.

Today, Evolution's CBOR codec re-encodes using configurable options (`CodecOptions`) rather than replaying the original encoding. This loses non-canonical choices made by the original serializer (e.g., CML uses non-minimal integer widths, other wallets may use indefinite-length containers).

CML solves this with auto-generated `*Encoding` structs (~35 fields per type, ~200+ encoding fields per era) and `orig_deser_order` arrays. This works but requires massive codegen and per-type boilerplate.

The Evolution SDK solves this with a single mechanism: a per-node encoding metadata tree attached via Symbol property during decode, replayed during encode, falling back to `CodecOptions`-driven encoding when metadata is absent.

### Key Insight

`CBORValueSchema` (the intermediate schema in every `FromBytes` ↔ `FromCDDL` compose boundary) is `Schema.declare(...)` — a passthrough validator that preserves object identity. Symbols on Maps and Arrays survive through `Schema.compose` without cloning.

## Functional Specification

### 1. CodecOptions: Preserve Mode

`CodecOptions` gains a third discriminant:

```ts
export type CodecOptions =
  | { readonly mode: "preserve" }
  | { readonly mode: "canonical"; readonly mapsAsObjects?: boolean; readonly encodeMapAsPairs?: boolean }
  | {
      readonly mode: "custom"
      readonly useIndefiniteArrays: boolean
      readonly useIndefiniteMaps: boolean
      readonly useDefiniteForEmpty: boolean
      readonly sortMapKeys: boolean
      readonly useMinimalEncoding: boolean
      readonly mapsAsObjects?: boolean
      readonly encodeMapAsPairs?: boolean
    }

export const PRESERVE_OPTIONS: CodecOptions = { mode: "preserve" } as const
```

**Precedence rules:**

| Mode | Encoder behavior |
|------|------------------|
| `"preserve"` | Use encoding metadata when present. Missing metadata falls back to CML defaults (minimal encoding, definite containers, no key sorting). |
| `"canonical"` | Ignore metadata unconditionally. Produce RFC 8949 §4.2.1 canonical bytes. |
| `"custom"` | Ignore metadata unconditionally. Use the explicit custom settings. |

The decoder always captures encoding metadata regardless of mode — it is zero-cost (reading what is already in the byte stream).

**Default parameter change:** All `fromCBORBytes`, `toCBORBytes`, `FromCBORBytes`, `FromCBORHex`, and `CBOR.FromBytes` default parameters change from `CML_DEFAULT_OPTIONS` to `PRESERVE_OPTIONS`.

This is backward-compatible: when no metadata is present (fresh objects, or first run before this feature lands), `"preserve"` falls back to CML defaults — identical to current behavior.

### 2. Encoding Metadata Types

```ts
/** Width of an integer argument: inline (0), 1-byte, 2-byte, 4-byte, or 8-byte. */
type Sz = 0 | 1 | 2 | 4 | 8

/** Container length encoding. */
type LenEncoding =
  | { readonly tag: "indefinite" }
  | { readonly tag: "definite"; readonly sz: Sz }

/** Chunked byte/text string encoding. */
type StringEncoding =
  | { readonly tag: "definite"; readonly sz: Sz }
  | { readonly tag: "indefinite"; readonly chunks: ReadonlyArray<{ readonly length: number; readonly sz: Sz }> }

/**
 * Per-node tree capturing how each CBOR value was originally serialized.
 * Every field is optional — absent means "use CodecOptions default".
 */
type CBOREncoding = {
  readonly lenEncoding?: LenEncoding        // arrays, maps
  readonly valueEncoding?: Sz               // unsigned/negative integers, tags
  readonly stringEncoding?: StringEncoding   // byte strings, text strings
  readonly keyOrder?: ReadonlyArray<CBOR>    // maps: original key insertion order
  readonly tagEncoding?: Sz                  // CBOR tag number width
  readonly children?: ReadonlyArray<CBOREncoding | undefined>  // arrays and tag values
  readonly entries?: ReadonlyArray<          // maps
    readonly [CBOREncoding | undefined, CBOREncoding | undefined]
  >
}
```

### 3. Symbol Key

```ts
export const kEncoding: unique symbol = Symbol.for("evolution.cbor.encoding")
```

`Symbol.for` is used rather than a local `Symbol()` so that encoding metadata survives across module boundaries (e.g., monorepo or bundled duplicate modules).

### 4. Decoder Changes (`internalDecodeSync`)

Each `decode*At` function returns an additional `encoding` field alongside `item` and `newOffset`:

```ts
type DecodeAtResult<T = CBOR> = {
  item: T
  newOffset: number
  encoding?: CBOREncoding
}
```

**Capturing rules**:

| CBOR type | What to capture |
|-----------|----------------|
| Unsigned/negative integer | `valueEncoding`: the `Sz` implied by `additionalInfo` ≥ 24 (24→1, 25→2, 26→4, 27→8). Values < 24 always encode as inline, so `valueEncoding` is `0` (or omitted). |
| Byte string (definite) | `stringEncoding.sz`: header width |
| Byte string (indefinite) | `stringEncoding.chunks`: length and sz per chunk |
| Text string | Same as byte string |
| Array (definite) | `lenEncoding: { tag: "definite", sz }`, `children` recursively |
| Array (indefinite) | `lenEncoding: { tag: "indefinite" }`, `children` recursively |
| Map (definite) | `lenEncoding: { tag: "definite", sz }`, `keyOrder` = insertion order, `entries` = `[keyEnc, valEnc]` per pair |
| Map (indefinite) | `lenEncoding: { tag: "indefinite" }`, same fields |
| Tag | `tagEncoding`: tag number width. `children[0]` = inner value encoding |

**Attachment**: After each top-level `decodeItemAt` call returns, if the decoded value is an object (Map, Array, Tag, or BoundedBytes), the encoding tree is attached:

```ts
if (encoding !== undefined && typeof item === "object" && item !== null) {
  (item as any)[kEncoding] = encoding
}
```

Primitives (bigint, string, boolean, null, undefined, number) cannot carry Symbol properties. Their encoding lives on the parent's `children`/`entries` tree.

### 5. Encoder Changes (`internalEncodeSync`)

```ts
export const internalEncodeSync = (value: CBOR, options: CodecOptions): Uint8Array => {
  // Only read metadata in preserve mode
  const encoding: CBOREncoding | undefined =
    options.mode === "preserve" && typeof value === "object" && value !== null
      ? (value as any)[kEncoding]
      : undefined
  return internalEncodeWithMetadata(value, options, encoding)
}
```

The `encoding` parameter is only read when `mode === "preserve"`. In `"canonical"` and `"custom"` modes, `encoding` is always `undefined` — metadata is unconditionally ignored.

The new `internalEncodeWithMetadata` function mirrors existing `encode*Sync` functions but checks `encoding` fields first (only reachable in preserve mode):

- **Integers**: If `encoding.valueEncoding` is set, use that specific `Sz`.
- **Byte/text strings**: If `encoding.stringEncoding` is set, replay chunk structure or definite-length `Sz`.
- **Arrays**: If `encoding.lenEncoding` is `{ tag: "indefinite" }`, emit `0x9f...0xff`. Otherwise use definite header with `sz`. Recursively pass `encoding.children[i]` to each element.
- **Maps**: If `encoding.lenEncoding` is indefinite, emit `0xbf...0xff`. Emit keys in `encoding.keyOrder` order. Recursively pass `encoding.entries[i][0]`/`encoding.entries[i][1]` to keys/values.
- **Tags**: If `encoding.tagEncoding` is set, use that `Sz` for the tag number.
- **Fallback**: If any encoding field is `undefined`, fall back to CML defaults (minimal encoding, definite containers, no key sorting).

### 6. Schema Layer: `FromBytes`

The `FromBytes` transform changes to thread encoding on both sides:

```ts
export const FromBytes = (options: CodecOptions) =>
  Schema.transformOrFail(Schema.Uint8ArrayFromSelf, CBORValueSchema, {
    strict: true,
    decode: (fromA, _, ast) =>
      E.try({
        try: () => internalDecodeSync(fromA, options),
        // kEncoding is already on the returned CBOR value
        catch: (error) => new ParseResult.Type(ast, fromA, `...`)
      }),
    encode: (toI, _, ast, toA) =>
      E.try({
        try: () => {
          // If the CBOR AST value has encoding metadata, use it.
          // Also check toA (the original value before FromCDDL encoding)
          // for cases where FromCDDL threads encoding to its output.
          const enc = (toI as any)?.[kEncoding] ?? (toA as any)?.[kEncoding]
          if (enc && typeof toI === "object" && toI !== null && !(toI as any)[kEncoding]) {
            (toI as any)[kEncoding] = enc
          }
          return internalEncodeSync(toI, options)
        },
        catch: (error) => new ParseResult.Type(ast, toI, `...`)
      })
  })
```

### 7. FromCDDL Threading Pattern

Every `FromCDDL` transform follows this pattern:

**Decode** (CBOR AST → domain object):
```ts
decode: (fromA) =>
  Eff.gen(function* () {
    const map = fromA as Map<bigint, CBOR.CBOR>
    // ... existing field extraction ...
    const result = new DomainType(fields, { disableValidation: true })
    // Thread encoding from CBOR AST to domain object
    const enc = (map as any)[kEncoding]
    if (enc !== undefined) (result as any)[kEncoding] = enc
    return result
  })
```

**Encode** (domain object → CBOR AST):
```ts
encode: (toI, _, _ast, toA) =>
  Eff.gen(function* () {
    const record = new Map<bigint, CBOR.CBOR>()
    // ... existing field construction ...
    // Thread encoding from domain object (toA) to CBOR AST
    const enc = (toA as any)[kEncoding]
    if (enc !== undefined) (record as any)[kEncoding] = enc
    return record
  })
```

The `toA` parameter in `encode` is the **original domain object before transformation** — it carries the encoding that was attached during decode.

### 8. Map Key Order Invalidation

When a `FromCDDL.encode` adds or removes map keys compared to the original:

```ts
// Guard: only replay keyOrder if key set hasn't changed
const enc = (toA as any)[kEncoding] as CBOREncoding | undefined
if (enc?.keyOrder) {
  const originalKeyCount = enc.keyOrder.length
  const currentKeyCount = record.size
  if (originalKeyCount !== currentKeyCount) {
    // Key set changed — drop keyOrder, fall back to CodecOptions
    const { keyOrder: _, ...restEnc } = enc
    if (Object.keys(restEnc).length > 0) {
      (record as any)[kEncoding] = restEnc
    }
    // else: no encoding metadata left, full fallback
  } else {
    (record as any)[kEncoding] = enc
  }
}
```

This matches CML's behavior: when `orig_deser_order` count differs from field count, fall back to ascending order.

### 9. Co-Signing (Adding New Witnesses)

When adding vkey witnesses to an existing `TransactionWitnessSet`:

1. The witness set's map encoding (definite/indefinite, key order) is preserved from the original decode.
2. Existing witnesses keep their per-element encoding in `children`.
3. New witnesses get `undefined` encoding → canonical fallback.
4. The inner array's encoding `children` is extended with `undefined` entries for new elements.

This produces byte-identical output for all existing data while new data uses canonical encoding.

### 10. Implementation Order

1. **CBOR.ts — types**: Add `CBOREncoding`, `LenEncoding`, `StringEncoding`, `Sz`, `kEncoding` exports. Add `mode: "preserve"` to `CodecOptions` union. Add `PRESERVE_OPTIONS` constant.
2. **CBOR.ts — decoder**: Modify `decodeItemAt` and each `decode*At` to return `encoding` fields. Attach `kEncoding` Symbol on decoded objects. Capture is unconditional (all modes).
3. **CBOR.ts — encoder**: Add `internalEncodeWithMetadata`. Modify `internalEncodeSync` to read `kEncoding` only when `mode === "preserve"`, ignore otherwise.
4. **CBOR.ts — `FromBytes`**: Use `toA` 4th parameter in encode to thread encoding. Change default options to `PRESERVE_OPTIONS`.
5. **All modules — default parameter change**: Replace `CML_DEFAULT_OPTIONS` with `PRESERVE_OPTIONS` in all `FromCBORBytes`, `FromCBORHex`, `fromCBORBytes`, `toCBORBytes`, etc. default parameters.
6. **TransactionWitnessSet.ts — `FromCDDL`**: Thread `kEncoding` in both decode and encode.
7. **TransactionBody.ts — `FromCDDL`**: Thread `kEncoding` in both decode and encode, with key order invalidation guard.
8. **Transaction.ts — `FromCDDL`**: Thread `kEncoding` for the outer transaction tuple.
9. **Remaining modules**: AuxiliaryData, NativeScripts, Redeemers, BootstrapWitness, etc.
10. **Property test**: Flip `_proof-property.test.ts` from `not.toBe` to `toBe`.

### Examples

**Non-canonical indefinite witness set → decode → add witness → re-encode**:
```
Original (hex): bf1a000000009f9f440102030444aabbccddff9f440506070844eeff1122ffffff
                ^^                                                              ^^ indefinite map
                  ^^^^^^^^^^  4-byte key 0 (non-minimal)
                              ^^ ^^                      ^^ ^^ indefinite arrays
                                 ^^ ^^                      ^^ indefinite pairs

After adding witness [090a0b0c, 33445566]:
bf1a000000009f9f440102030444aabbccddff9f440506070844eeff1122ff8244090a0b0c4433445566ffff
                                                                ^^ new pair: definite (canonical)
```

Existing encoding is preserved byte-for-byte. New data uses canonical encoding.

## Appendix

### Appendix A: Why Symbol, Not WeakMap

WeakMap keys must be objects. CBOR AST values include primitives (bigint, string). A WeakMap for the top-level container works, but the child references in array/map entries require per-item metadata anyway. Symbol properties on objects give O(1) direct access with no external state, and are invisible to `JSON.stringify`, `Object.keys`, `for...in`, and `Equal.symbol` comparisons.

### Appendix B: Why Schema.declare Matters

`Schema.declare` creates a validation-only schema that does NOT clone the input object. The existing `CBORValueSchema` at CBOR.ts:460 is already `Schema.declare(...)`. This means:

1. `FromBytes.decode` produces a `Map` with `kEncoding` attached
2. `Schema.compose` passes this Map through `CBORValueSchema` (no-clone)
3. `FromCDDL.decode` receives the **same Map object** with the Symbol intact

If `CBORValueSchema` were `Schema.MapFromSelf(...)` or `Schema.Struct(...)`, the validation step would create a new Map/object and the Symbol would be lost.

### Appendix C: Comparison with CML

| Aspect | CML | Evolution (this spec) |
|--------|-----|----------------------|
| Metadata storage | Auto-generated `*Encoding` structs | Single `CBOREncoding` tree via Symbol |
| Codegen required | Yes (~200+ fields per era) | No |
| Key order | `orig_deser_order: Vec<Key>`, invalidated when field count changes | `keyOrder: ReadonlyArray<CBOR>`, same invalidation guard |
| Per-field encoding | Dedicated field per encoding choice | Tree structure with `children`/`entries` |
| Force canonical | `force_canonical: bool` flag | `mode: "canonical"` or `mode: "custom"` — metadata ignored unconditionally |
| Preserve toggle | Implicit (always preserves unless `force_canonical`) | Explicit `mode: "preserve"` — only mode that reads metadata |
| Body mutation | Preserves field encoding, drops key order on field count change | Same behavior |
