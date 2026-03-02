---
"@evolution-sdk/evolution": patch
---

Fix BlockfrostEffect.evaluateTx dropping reference scripts from additionalUtxoSet, which caused missingRequiredScripts errors when evaluating transactions that reference unconfirmed UTxOs carrying minting policies.
