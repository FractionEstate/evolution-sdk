---
"@evolution-sdk/evolution": patch
---

Add transaction chaining support via `SignBuilder.chainResult()`

- Add `chainResult()` method to `SignBuilder` for building dependent transactions
- Returns `ChainResult` with `consumed`, `available` UTxOs and pre-computed `txHash`
- Lazy evaluation with memoization - computed on first call, cached for subsequent calls
- Add `signAndSubmit()` convenience method combining sign and submit in one call
- Remove redundant `chain()`, `chainEffect()`, `chainEither()` methods from TransactionBuilder
