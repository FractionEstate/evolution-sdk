---
"@evolution-sdk/evolution": patch
---

Fix scriptDataHash integrity mismatch when spending UTxOs carrying inline scriptRef (e.g. PlutusV3) via `collectFrom()` without `attachScript()` or `readFrom()`. Also correct tiered reference-script fee calculation to match the Conway ledger formula (stride 25,600 bytes, 1.2× multiplier per tier, `minFeeRefScriptCostPerByte` protocol parameter).
