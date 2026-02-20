---
"@evolution-sdk/evolution": patch
---

Add `TSchema.PlutusData` schema for opaque PlutusData fields inside TSchema combinators.

Previously, using `Data.DataSchema` inside `TSchema.Struct` caused a `ParseError` because its encoding layer transforms `Data` into `DataEncoded`, which is incompatible with how TSchema assembles `Constr.fields`. `TSchema.PlutusData` uses `Schema.typeSchema` to strip the encoding layer, matching the same pattern used by `TSchema.ByteArray` and `TSchema.Integer`.

```ts
import * as TSchema from "@evolution-sdk/evolution/TSchema"
import * as Data from "@evolution-sdk/evolution/Data"

// Define a struct with an opaque PlutusData field
const FooSchema = TSchema.Struct({
  foo: TSchema.PlutusData, // accepts any PlutusData value
})

// Extract the TypeScript type from the schema
type Foo = typeof FooSchema.Type

// Create a serialiser using the schema
const serialise = (d: Foo) => Data.withSchema(FooSchema).toCBORHex(d)

// Encode a struct containing arbitrary PlutusData (e.g. Constr(0, []))
serialise({ foo: Data.fromCBORHex("d87980") })
// => "d8799fd87980ff"
```

Fixes #146
