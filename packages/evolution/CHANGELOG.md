# @evolution-sdk/evolution

## 0.2.2

### Patch Changes

- [#63](https://github.com/IntersectMBO/evolution-sdk/pull/63) [`7bb1da3`](https://github.com/IntersectMBO/evolution-sdk/commit/7bb1da32488c5a1a92a9c8b90e5aa4514e004232) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Improve `Variant` type inference with `PropertyKey` constraint

  The `Variant` helper now accepts `PropertyKey` (string | number | symbol) as variant keys instead of just strings, enabling more flexible discriminated union patterns.

  **Before:**

  ```typescript
  // Only string keys were properly typed
  const MyVariant = TSchema.Variant({
    Success: { value: TSchema.Integer },
    Error: { message: TSchema.ByteArray }
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

- [#63](https://github.com/IntersectMBO/evolution-sdk/pull/63) [`844dfec`](https://github.com/IntersectMBO/evolution-sdk/commit/844dfeccb48c0af0ce0cebfc67e6cdcc67e28cc8) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Add Aiken-compatible CBOR encoding with encodeMapAsPairs option and comprehensive test suite. PlutusData maps can now encode as arrays of pairs (Aiken style) or CBOR maps (CML style). Includes 72 Aiken reference tests and 40 TypeScript compatibility tests verifying identical encoding. Also fixes branded schema pattern in Data.ts for cleaner type inference and updates TSchema error handling test.

## 0.2.1

### Patch Changes

- [#61](https://github.com/IntersectMBO/evolution-sdk/pull/61) [`0dcf415`](https://github.com/IntersectMBO/evolution-sdk/commit/0dcf4155e7950ff46061100300355fb0a69e902d) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - upgrade modules

## 0.2.0

### Minor Changes

- [#24](https://github.com/no-witness-labs/evolution-sdk/pull/24) [`1503549`](https://github.com/no-witness-labs/evolution-sdk/commit/15035498c85286a661f1073fdd34423f01128b54) Thanks [@solidsnakedev](https://github.com/solidsnakedev)! - Experimental release 1:
  - Introduce experimental modules and docs flow
  - Add runnable Data examples with MDX generation
  - ESM Next/Nextra configuration for docs
