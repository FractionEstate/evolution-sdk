---
"@evolution-sdk/evolution": patch
---

Separate DatumOption into dedicated DatumHash and InlineDatum modules.

- Add `DatumHash` module with `fromHex`, `toHex`, `fromBytes`, `toBytes` functions
- Add `InlineDatum` module for inline plutus data
- Refactor `DatumOption` to import from new modules (union type preserved)
- Fix `BlockfrostUTxO` schema to include `address` field
- Update all provider implementations to use new module imports
