---
"@evolution-sdk/evolution": patch
---

## TSchema Code Simplifications and Test Coverage

### Summary
Added Literal options (index, flatInUnion) for better Union control. Simplified TSchema implementation by removing redundant code, extracting helpers, and optimizing algorithms. Added 7 missing round-trip tests for comprehensive coverage.

### New Features

**Literal options for custom indices and flat unions:**
```typescript
// Custom index for positioning in unions
const Action = TSchema.Literal("withdraw", { index: 100 })

// Flat in union - unwraps the Literal at the Union level
const FlatUnion = TSchema.Union(
  TSchema.Literal("OptionA", { flatInUnion: true }),
  TSchema.Literal("OptionB", { flatInUnion: true })
)

// Before: Union wraps each literal
// Constr(0, [Constr(0, [])]) for OptionA
// Constr(1, [Constr(1, [])]) for OptionB

// After: Literals are unwrapped at Union level
// Constr(0, []) for OptionA
// Constr(1, []) for OptionB

// Note: TSchema.Literal("OptionA", "OptionB") creates a single schema
// with multiple literal values, which is different from a Union of
// separate Literal schemas. Use Union + flatInUnion for explicit control.
```

**LiteralOptions interface:**
```typescript
interface LiteralOptions {
  index?: number        // Custom Constr index (default: auto-increment)
  flatInUnion?: boolean // Unwrap when used in Union (default: false)
}

// Overloaded signatures
function Literal(...values: Literals): Literal<Literals>
function Literal(...args: [...Literals, LiteralOptions]): Literal<Literals>
```

### Code Simplifications

**Removed redundant OneLiteral function:**
```typescript
// Before: Separate function for single literals
const Action = TSchema.OneLiteral("withdraw")

// After: Use Literal directly
const Action = TSchema.Literal("withdraw")
```

**Simplified Boolean validation:**
```typescript
// Before: Two separate checks
decode: ({ fields, index }) => {
  if (index !== 0n && index !== 1n) {
    throw new Error(`Expected constructor index to be 0 or 1, got ${index}`)
  }
  if (fields.length !== 0) {
    throw new Error("Expected a constructor with no fields")
  }
  return index === 1n
}

// After: Combined check with better error message
decode: ({ fields, index }) => {
  if ((index !== 0n && index !== 1n) || fields.length !== 0) {
    throw new Error(`Expected constructor with index 0 or 1 and no fields, got index ${index} with ${fields.length} fields`)
  }
  return index === 1n
}
```

**Optimized collision detection (O(n²) → O(n)):**
```typescript
// Before: Nested loops
for (let i = 0; i < flatMembers.length; i++) {
  for (let j = i + 1; j < flatMembers.length; j++) {
    if (flatMembers[i].index === flatMembers[j].index) {
      // collision detected
    }
  }
}

// After: Map-based tracking
const indexMap = new globalThis.Map<number, number>()
for (const member of flatMembers) {
  if (indexMap.has(member.index)) {
    // collision detected
  }
  indexMap.set(member.index, member.position)
}
```

**Extracted helper functions:**
- `getTypeName(value)` - Centralized type name logic for error messages
- Simplified `getLiteralFieldValue` with ternary operators
- Simplified tag field detection logic

### New Round-Trip Tests

Added comprehensive test coverage for previously untested features:

1. **UndefinedOr** - Both defined and undefined value encoding/decoding
2. **Struct with custom index** - Validates custom Constr index is preserved
3. **Struct with flatFields** - Verifies field merging into parent struct
4. **Variant** - Multi-option tagged unions (Mint, Burn, Transfer)
5. **TaggedStruct** - Default "_tag" field and custom tagField names
6. **flatInUnion Literals in Union** - Validates flat Literals with Structs
7. **flatInUnion mixed types** - Literals and Structs with flatFields

