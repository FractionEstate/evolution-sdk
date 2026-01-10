---
"@evolution-sdk/evolution": patch
---

**BREAKING CHANGE:** Remove `Core` namespace, flatten package structure

### What changed
- Moved all modules from `src/core/` to `src/`
- Removed the `Core` namespace export
- Added `Cardano` namespace for API discovery/exploration
- Individual module exports remain available for tree-shaking

### Migration

**Before:**
```typescript
import { Core } from "@evolution-sdk/evolution"
const address = Core.Address.fromBech32("addr...")
```

**After (namespace style):**
```typescript
import { Cardano } from "@evolution-sdk/evolution"
const address = Cardano.Address.fromBech32("addr...")
```

**After (individual imports - recommended for production):**
```typescript
import { Address } from "@evolution-sdk/evolution"
const address = Address.fromBech32("addr...")
