---
"@evolution-sdk/evolution": patch
---

Add `Data.hashData()` function for computing blake2b-256 hash of PlutusData.

This moves the hashing functionality from `utils/Hash.hashPlutusData()` to the Data module for better organization and discoverability. The function computes the datum hash used for inline datums and datum witnesses.

**Example:**

```typescript
import * as Data from "@evolution-sdk/evolution/Data"

// Hash a simple integer
const intHash = Data.hashData(42n)

// Hash a constructor (e.g., for a custom datum type)
const constr = new Data.Constr({ index: 0n, fields: [1n, 2n] })
const constrHash = Data.hashData(constr)

// Hash a bytearray
const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
const bytesHash = Data.hashData(bytes)

// Hash a map
const map = new Map<Data.Data, Data.Data>([[1n, 2n]])
const mapHash = Data.hashData(map)
```

**Breaking Change:** `hashPlutusData` has been removed from `utils/Hash`. Use `Data.hashData()` instead.
