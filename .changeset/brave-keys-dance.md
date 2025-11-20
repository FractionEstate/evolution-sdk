---
"@evolution-sdk/evolution": patch
---

Improve `Variant` type inference with `PropertyKey` constraint

The `Variant` helper now accepts `PropertyKey` (string | number | symbol) as variant keys instead of just strings, enabling more flexible discriminated union patterns.

**Before:**
```typescript
// Only string keys were properly typed
const MyVariant = TSchema.Variant({
  "Success": { value: TSchema.Integer },
  "Error": { message: TSchema.ByteArray }
})
```

**After:**
```typescript
// Now supports symbols and numbers as variant keys
const MyVariant = TSchema.Variant({
  Success: { value: TSchema.Integer },
  Error: { message: TSchema.ByteArray }
})
// Type inference is improved, especially with const assertions
```

Replace `@ts-expect-error` with `as any` following Effect patterns

Improved code quality by replacing forbidden `@ts-expect-error` directives with explicit `as any` type assertions, consistent with Effect Schema's approach for dynamic object construction.

Add comprehensive Cardano Address type support

Added full CBOR encoding support for Cardano address structures with Aiken compatibility:

```typescript
const Credential = TSchema.Variant({
  VerificationKey: { hash: TSchema.ByteArray },
  Script: { hash: TSchema.ByteArray }
})

const Address = TSchema.Struct({
  payment_credential: Credential,
  stake_credential: TSchema.UndefinedOr(
    TSchema.Variant({
      Inline: { credential: Credential },
      Pointer: {
        slot_number: TSchema.Integer,
        transaction_index: TSchema.Integer,
        certificate_index: TSchema.Integer
      }
    })
  )
})

// Creates proper CBOR encoding matching Aiken's output
const address = Data.withSchema(Address).toData({
  payment_credential: { VerificationKey: { hash } },
  stake_credential: { Inline: { credential: { VerificationKey: { stakeHash } } } }
})
```
