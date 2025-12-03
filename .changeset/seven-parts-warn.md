---
"@evolution-sdk/evolution": patch
---

## hashPlutusData encoding options

Add optional CBOR encoding options parameter to `hashPlutusData` function. This allows controlling how Plutus data is encoded before hashing, which affects the resulting datum hash.

**Before:**

```typescript
import { hashPlutusData } from "@evolution-sdk/evolution/utils/Hash"

// Always uses indefinite-length encoding (CML_DATA_DEFAULT_OPTIONS)
const hash = hashPlutusData(data)
```

**After:**

```typescript
import { Core } from "@evolution-sdk/evolution"
import { hashPlutusData } from "@evolution-sdk/evolution/utils/Hash"

const cborHex = "d87983486c6f76656c6163655820c3e43c6b8fb46068d4ef9746a934eba534873db0aacebdaf369c78ab23cb57751a004c4b40"
const decoded = Core.Data.fromCBORHex(cborHex)

// Indefinite-length (SDK default for Data)
const indefiniteHash = hashPlutusData(decoded, Core.CBOR.CML_DATA_DEFAULT_OPTIONS)
console.log("Hash:", Core.Bytes.toHex(indefiniteHash.hash))
// b67b6e7d2497d4e87a240a080a109a905f73527a244775cc1e2a43f48202700f

// Definite-length encoding
const definiteHash = hashPlutusData(decoded, Core.CBOR.CML_DEFAULT_OPTIONS)
console.log("Hash:", Core.Bytes.toHex(definiteHash.hash))
// bc7eea92ba15710926e99904e746e5da739d77085b6192ddd87a0e7b4298e0c0

// Aiken-compatible encoding
const aikenHash = hashPlutusData(decoded, Core.CBOR.AIKEN_DEFAULT_OPTIONS)
console.log("Hash:", Core.Bytes.toHex(aikenHash.hash))
// b67b6e7d2497d4e87a240a080a109a905f73527a244775cc1e2a43f48202700f
```
