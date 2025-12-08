---
title: sdk/Network.ts
nav_order: 168
parent: Modules
---

## Network overview

Network type for Cardano networks.

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constants](#constants)
  - [SLOT_CONFIG_NETWORK](#slot_config_network)
- [model](#model)
  - [Network (type alias)](#network-type-alias)
  - [SlotConfig (interface)](#slotconfig-interface)
- [transformation](#transformation)
  - [slotToUnixTime](#slottounixtime)
  - [unixTimeToSlot](#unixtimetoslot)

---

# constants

## SLOT_CONFIG_NETWORK

Network-specific slot configurations for all Cardano networks.

- **Mainnet**: Production network starting at Shelley era
- **Preview**: Preview testnet for protocol updates
- **Preprod**: Pre-production testnet
- **Custom**: Customizable for emulator/devnet (initialized with zeros)

**Signature**

```ts
export declare const SLOT_CONFIG_NETWORK: Record<Network, SlotConfig>
```

Added in v2.0.0

# model

## Network (type alias)

Network type for Cardano networks.

**Signature**

```ts
export type Network = "Mainnet" | "Preview" | "Preprod" | "Custom"
```

Added in v2.0.0

## SlotConfig (interface)

Slot configuration for a Cardano network.
Defines the relationship between slots and Unix time.

**Signature**

```ts
export interface SlotConfig {
  /**
   * Unix timestamp (in milliseconds) of the network start (Shelley era).
   */
  readonly zeroTime: bigint

  /**
   * First slot number of the Shelley era.
   */
  readonly zeroSlot: bigint

  /**
   * Duration of each slot in milliseconds (typically 1000ms = 1 second).
   */
  readonly slotLength: number
}
```

Added in v2.0.0

# transformation

## slotToUnixTime

Convert a slot number to Unix time (in milliseconds).

**Signature**

```ts
export declare const slotToUnixTime: (slot: bigint, slotConfig: SlotConfig) => bigint
```

Added in v2.0.0

## unixTimeToSlot

Convert a Unix time (in milliseconds) to the enclosing slot number.

**Signature**

```ts
export declare const unixTimeToSlot: (unixTime: bigint, slotConfig: SlotConfig) => bigint
```

Added in v2.0.0
