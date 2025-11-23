---
title: sdk/Devnet/Devnet.ts
nav_order: 160
parent: Modules
---

## Devnet overview

---

<h2 class="text-delta">Table of contents</h2>

- [cluster](#cluster)
  - [Cluster](#cluster-1)
- [container](#container)
  - [Container](#container-1)
- [genesis](#genesis)
  - [Genesis](#genesis-1)
- [utils](#utils)
  - [CardanoDevNetError (class)](#cardanodevneterror-class)
  - [DevNetCluster (interface)](#devnetcluster-interface)
  - [DevNetContainer (interface)](#devnetcontainer-interface)

---

# cluster

## Cluster

Cluster management operations for Cardano DevNet.

**Signature**

```ts
export declare const Cluster: {
  readonly makeEffect: (config?: DevnetDefault.DevNetConfig) => Effect.Effect<DevNetCluster, CardanoDevNetError>
  readonly make: (config?: DevnetDefault.DevNetConfig) => Promise<DevNetCluster>
  readonly startEffect: (cluster: DevNetCluster) => Effect.Effect<void, CardanoDevNetError>
  readonly start: (cluster: DevNetCluster) => Promise<void>
  readonly stopEffect: (cluster: DevNetCluster) => Effect.Effect<void, CardanoDevNetError>
  readonly stop: (cluster: DevNetCluster) => Promise<void>
  readonly removeEffect: (cluster: DevNetCluster) => Effect.Effect<void, CardanoDevNetError>
  readonly remove: (cluster: DevNetCluster) => Promise<void>
}
```

Added in v2.0.0

# container

## Container

Individual container management operations.

**Signature**

```ts
export declare const Container: {
  readonly startEffect: (container: DevNetContainer) => Effect.Effect<void, CardanoDevNetError>
  readonly start: (container: DevNetContainer) => Promise<void>
  readonly stopEffect: (container: DevNetContainer) => Effect.Effect<void, CardanoDevNetError>
  readonly stop: (container: DevNetContainer) => Promise<void>
  readonly removeEffect: (container: DevNetContainer) => Effect.Effect<void, CardanoDevNetError>
  readonly remove: (container: DevNetContainer) => Promise<void>
  readonly getStatusEffect: (
    container: DevNetContainer
  ) => Effect.Effect<Docker.ContainerInspectInfo | undefined, CardanoDevNetError>
  readonly getStatus: (container: DevNetContainer) => Promise<Docker.ContainerInspectInfo | undefined>
  readonly isImageAvailableEffect: (imageName: string) => Effect.Effect<boolean, CardanoDevNetError, never>
  readonly isImageAvailable: (imageName: string) => Promise<boolean>
  readonly downloadImageEffect: (imageName: string) => Effect.Effect<void, CardanoDevNetError, never>
  readonly downloadImage: (imageName: string) => Promise<void>
  readonly ensureImageAvailableEffect: (imageName: string) => Effect.Effect<void, CardanoDevNetError, never>
  readonly ensureImageAvailable: (imageName: string) => Promise<void>
  readonly execCommandEffect: (
    container: DevNetContainer,
    command: Array<string>
  ) => Effect.Effect<string, CardanoDevNetError>
  readonly execCommand: (container: DevNetContainer, command: Array<string>) => Promise<string>
}
```

Added in v2.0.0

# genesis

## Genesis

Genesis UTxO operations for deterministic calculation and querying.

**Signature**

```ts
export declare const Genesis: {
  readonly calculateUtxosFromConfig: (
    genesisConfig: DevnetDefault.ShelleyGenesis
  ) => Effect.Effect<ReadonlyArray<UTxO.UTxO>, CardanoDevNetError>
  readonly calculateUtxosFromConfigOrThrow: (
    genesisConfig: DevnetDefault.ShelleyGenesis
  ) => Promise<readonly UTxO.UTxO[]>
  readonly queryUtxos: (cluster: DevNetCluster) => Effect.Effect<ReadonlyArray<UTxO.UTxO>, CardanoDevNetError>
  readonly queryUtxosOrThrow: (cluster: DevNetCluster) => Promise<readonly UTxO.UTxO[]>
}
```

Added in v2.0.0

# utils

## CardanoDevNetError (class)

**Signature**

```ts
export declare class CardanoDevNetError
```

## DevNetCluster (interface)

**Signature**

```ts
export interface DevNetCluster {
  readonly cardanoNode: DevNetContainer
  readonly kupo?: DevNetContainer | undefined
  readonly ogmios?: DevNetContainer | undefined
  readonly networkName: string
}
```

## DevNetContainer (interface)

**Signature**

```ts
export interface DevNetContainer {
  readonly id: string
  readonly name: string
}
```
