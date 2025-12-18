---
"@evolution-sdk/devnet": patch
"@evolution-sdk/evolution": patch
---

Add deferred redeemer construction for dynamic index resolution

**RedeemerBuilder module** (`RedeemerBuilder.ts`):
- `IndexedInput` type: `{ index: number, utxo: UTxO }` - provides the final sorted index and original UTxO after coin selection
- Three modes for redeemer construction:
  - `Static`: Direct Data value when index not needed
  - `Self`: Per-input function `(input: IndexedInput) => Data` for single UTxO index
  - `Batch`: Multi-input function `(inputs: IndexedInput[]) => Data` for stake validator coordinator pattern
- Type guards: `isSelfFn`, `isBatchBuilder`, `isStaticData`
- Internal types: `DeferredRedeemer`, `toDeferredRedeemer`

**Evaluation phase updates**:
- Add `resolveDeferredRedeemers` to convert deferred redeemers after coin selection
- Build `refToIndex` and `refToUtxo` mappings from sorted inputs
- Invoke Self/Batch callbacks with resolved `IndexedInput` objects

**Operations updates**:
- `collectFrom` and `mintTokens` now accept `RedeemerArg` (Data | SelfRedeemerFn | BatchRedeemerBuilder)
- Store deferred redeemers in `state.deferredRedeemers` for later resolution

**Test coverage** (`TxBuilder.RedeemerBuilder.test.ts`):
- Tests for all three modes with mint_multi_validator.ak spec

**Architecture docs** (`redeemer-indexing.mdx`):
- Document the circular dependency problem and deferred construction solution
- Explain stake validator coordinator pattern with O(1) index lookup
