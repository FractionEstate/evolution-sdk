---
"@evolution-sdk/evolution": patch
---

Fix `calculateMinimumUtxoLovelace` to use the Babbage/Conway formula with 160-byte UTxO entry overhead and an exact fixed-point solve to avoid CBOR under-estimation for outputs with script references.
