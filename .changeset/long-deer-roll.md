---
"@evolution-sdk/devnet": patch
"@evolution-sdk/evolution": patch
---

### TxBuilder setValidity API

Add `setValidity()` method to TxBuilder for setting transaction validity intervals:

```ts
client.newTx()
  .setValidity({ 
    from: Date.now(),           // Valid after this Unix time (optional)
    to: Date.now() + 300_000    // Expires after this Unix time (optional)
  })
  .payToAddress({ ... })
  .build()
```

- Times are provided as Unix milliseconds and converted to slots during transaction assembly
- At least one of `from` or `to` must be specified
- Validates that `from < to` when both are provided

### slotConfig support for devnets

Add `slotConfig` parameter to `createClient()` for custom slot configurations:

```ts
const slotConfig = Cluster.getSlotConfig(devnetCluster)
const client = createClient({ 
  network: 0, 
  slotConfig,  // Custom slot config for devnet
  provider: { ... }, 
  wallet: { ... } 
})
```

Priority chain for slot config resolution:
1. `BuildOptions.slotConfig` (per-transaction override)
2. `TxBuilderConfig.slotConfig` (client default)
3. `SLOT_CONFIG_NETWORK[network]` (hardcoded fallback)

### Cluster.getSlotConfig helper

Add `getSlotConfig()` helper to derive slot configuration from devnet cluster genesis:

```ts
const slotConfig = Cluster.getSlotConfig(cluster)
// Returns: { zeroTime, zeroSlot, slotLength }
```
