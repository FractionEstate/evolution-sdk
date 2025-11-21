---
"@evolution-sdk/evolution": patch
---

Fixed field ordering bug in TSchema.Struct encode function that caused fields to be swapped during CBOR encoding when using NullOr/UndefinedOr.

**Before:**
```typescript
const CredentialSchema = TSchema.Union(
  TSchema.Struct({ pubKeyHash: TSchema.ByteArray }, { flatFields: true }),
  TSchema.Struct({ scriptHash: TSchema.ByteArray }, { flatFields: true })
)

const AddressSchema = TSchema.Struct({
  paymentCredential: CredentialSchema,
  stakeCredential: TSchema.NullOr(TSchema.Integer)
})

const Foo = TSchema.Union(
  TSchema.Struct({ foo: AddressSchema }, { flatFields: true })
)

const input = {
  foo: {
    paymentCredential: { pubKeyHash: fromHex("deadbeef") },
    stakeCredential: null
  }
}

const encoded = Data.withSchema(Foo).toData(input)
// BUG: Fields were swapped in innerStruct!
// innerStruct.fields[0] = Constr(1, [])      // stakeCredential (null) - WRONG!
// innerStruct.fields[1] = Constr(0, [...])   // paymentCredential - WRONG!
```

**After:**
```typescript
const CredentialSchema = TSchema.Union(
  TSchema.Struct({ pubKeyHash: TSchema.ByteArray }, { flatFields: true }),
  TSchema.Struct({ scriptHash: TSchema.ByteArray }, { flatFields: true })
)

const AddressSchema = TSchema.Struct({
  paymentCredential: CredentialSchema,
  stakeCredential: TSchema.NullOr(TSchema.Integer)
})

const Foo = TSchema.Union(
  TSchema.Struct({ foo: AddressSchema }, { flatFields: true })
)

const input = {
  foo: {
    paymentCredential: { pubKeyHash: fromHex("deadbeef") },
    stakeCredential: null
  }
}

const encoded = Data.withSchema(Foo).toData(input)
// FIXED: Fields now in correct order matching schema!
// innerStruct.fields[0] = Constr(0, [...])   // paymentCredential - CORRECT!
// innerStruct.fields[1] = Constr(1, [])      // stakeCredential (null) - CORRECT!
```

