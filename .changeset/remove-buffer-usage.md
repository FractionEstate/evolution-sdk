---
"@evolution-sdk/evolution": patch
---

### Remove Buffer Usage from Source Code

Replaced all `Buffer.from()` usage with `Bytes.fromHex()` and `Bytes.toHex()` from the core module for better cross-platform compatibility.

**Files Updated:**
- `TxBuilderImpl.ts` - Use `Bytes.toHex()` for key hash hex conversion in `buildFakeWitnessSet`
- `Assets/index.ts` - Use `Bytes.fromHex()` for policy ID and asset name decoding
- `MaestroEffect.ts` - Use `Bytes.fromHex()` for transaction CBOR conversion
- `Ogmios.ts` - Use `Bytes.toHex()` for datum hash hex conversion
- `KupmiosEffects.ts` - Use `Bytes.fromHex()` for datum hash and script bytes decoding
