---
"@evolution-sdk/evolution": minor
---

Add `sendAll()` API to TxBuilder for draining wallet assets to a single address.

This new method simplifies the common use case of transferring all wallet assets:
- Automatically selects all wallet UTxOs as inputs
- Creates a single output with all assets minus the transaction fee
- Properly calculates minUTxO for the destination output
- Validates incompatibility with other operations (payToAddress, collectFrom, mint, staking, governance)

Usage:
```typescript
const tx = await client
  .newTx()
  .sendAll({ to: recipientAddress })
  .build()
```
