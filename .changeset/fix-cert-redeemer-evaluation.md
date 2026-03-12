---
"@evolution-sdk/evolution": patch
---

Script transactions with certificate or withdrawal redeemers evaluated via Blockfrost no longer spam warning logs or loop indefinitely. Blockfrost's Ogmios v5 JSONWSP format returns `"certificate:N"` and `"withdrawal:N"` as redeemer pointer keys; these are now normalized to the canonical `"cert"` and `"reward"` tags before evaluation matching. Unmatched redeemer tags from any evaluator now fail immediately instead of silently leaving ExUnits at zero.
