---
title: sdk/client/Client.ts
nav_order: 161
parent: Modules
---

## Client overview

---

<h2 class="text-delta">Table of contents</h2>

- [constants](#constants)
  - [RetryPresets](#retrypresets)
- [errors](#errors)
  - [ProviderError (class)](#providererror-class)
- [model](#model)
  - [ApiWalletClient (type alias)](#apiwalletclient-type-alias)
  - [ApiWalletConfig (interface)](#apiwalletconfig-interface)
  - [BlockfrostConfig (interface)](#blockfrostconfig-interface)
  - [KoiosConfig (interface)](#koiosconfig-interface)
  - [KupmiosConfig (interface)](#kupmiosconfig-interface)
  - [MaestroConfig (interface)](#maestroconfig-interface)
  - [MinimalClient (interface)](#minimalclient-interface)
  - [MinimalClientEffect (interface)](#minimalclienteffect-interface)
  - [NetworkId (type alias)](#networkid-type-alias)
  - [PrivateKeyWalletConfig (interface)](#privatekeywalletconfig-interface)
  - [ProviderConfig (type alias)](#providerconfig-type-alias)
  - [ProviderOnlyClient (type alias)](#provideronlyclient-type-alias)
  - [ReadOnlyClient (type alias)](#readonlyclient-type-alias)
  - [ReadOnlyClientEffect (interface)](#readonlyclienteffect-interface)
  - [ReadOnlyWalletClient (type alias)](#readonlywalletclient-type-alias)
  - [ReadOnlyWalletConfig (interface)](#readonlywalletconfig-interface)
  - [RetryConfig (interface)](#retryconfig-interface)
  - [RetryPolicy (type alias)](#retrypolicy-type-alias)
  - [SeedWalletConfig (interface)](#seedwalletconfig-interface)
  - [SigningClient (type alias)](#signingclient-type-alias)
  - [SigningClientEffect (interface)](#signingclienteffect-interface)
  - [SigningWalletClient (type alias)](#signingwalletclient-type-alias)
  - [WalletConfig (type alias)](#walletconfig-type-alias)

---

# constants

## RetryPresets

Preset retry configurations for common scenarios.

**Signature**

```ts
export declare const RetryPresets: {
  readonly none: {
    readonly maxRetries: 0
    readonly retryDelayMs: 0
    readonly backoffMultiplier: 1
    readonly maxRetryDelayMs: 0
  }
  readonly fast: {
    readonly maxRetries: 3
    readonly retryDelayMs: 500
    readonly backoffMultiplier: 1.5
    readonly maxRetryDelayMs: 5000
  }
  readonly standard: {
    readonly maxRetries: 3
    readonly retryDelayMs: 1000
    readonly backoffMultiplier: 2
    readonly maxRetryDelayMs: 10000
  }
  readonly aggressive: {
    readonly maxRetries: 5
    readonly retryDelayMs: 1000
    readonly backoffMultiplier: 2
    readonly maxRetryDelayMs: 30000
  }
}
```

Added in v2.0.0

# errors

## ProviderError (class)

Error class for provider-related operations.

**Signature**

```ts
export declare class ProviderError
```

Added in v2.0.0

# model

## ApiWalletClient (type alias)

ApiWalletClient - CIP-30 wallet signing and submission without blockchain queries.
Requires attachProvider() to access blockchain data.

**Signature**

```ts
export type ApiWalletClient = EffectToPromiseAPI<ApiWalletEffect> & {
  readonly attachProvider: (config: ProviderConfig) => SigningClient
  readonly Effect: ApiWalletEffect
}
```

Added in v2.0.0

## ApiWalletConfig (interface)

CIP-30 API wallet configuration.

**Signature**

```ts
export interface ApiWalletConfig {
  readonly type: "api"
  readonly api: WalletApi
}
```

Added in v2.0.0

## BlockfrostConfig (interface)

Blockfrost provider configuration.

**Signature**

```ts
export interface BlockfrostConfig {
  readonly type: "blockfrost"
  readonly baseUrl: string
  readonly projectId?: string
  readonly retryPolicy?: RetryPolicy
}
```

Added in v2.0.0

## KoiosConfig (interface)

Koios provider configuration.

**Signature**

```ts
export interface KoiosConfig {
  readonly type: "koios"
  readonly baseUrl: string
  readonly token?: string
  readonly retryPolicy?: RetryPolicy
}
```

Added in v2.0.0

## KupmiosConfig (interface)

Kupmios provider configuration (Kupo + Ogmios).

**Signature**

```ts
export interface KupmiosConfig {
  readonly type: "kupmios"
  readonly kupoUrl: string
  readonly ogmiosUrl: string
  readonly headers?: {
    readonly ogmiosHeader?: Record<string, string>
    readonly kupoHeader?: Record<string, string>
  }
  readonly retryPolicy?: RetryPolicy
}
```

Added in v2.0.0

## MaestroConfig (interface)

Maestro provider configuration.

**Signature**

```ts
export interface MaestroConfig {
  readonly type: "maestro"
  readonly baseUrl: string
  readonly apiKey: string
  readonly turboSubmit?: boolean
  readonly retryPolicy?: RetryPolicy
}
```

Added in v2.0.0

## MinimalClient (interface)

MinimalClient - network context with combinator methods to attach provider and/or wallet.

**Signature**

```ts
export interface MinimalClient {
  readonly networkId: number | string
  readonly attachProvider: (config: ProviderConfig) => ProviderOnlyClient
  readonly attachWallet: <T extends WalletConfig>(
    config: T
  ) => T extends SeedWalletConfig
    ? SigningWalletClient
    : T extends PrivateKeyWalletConfig
      ? SigningWalletClient
      : T extends ApiWalletConfig
        ? ApiWalletClient
        : ReadOnlyWalletClient
  readonly attach: <TW extends WalletConfig>(
    providerConfig: ProviderConfig,
    walletConfig: TW
  ) => TW extends SeedWalletConfig
    ? SigningClient
    : TW extends PrivateKeyWalletConfig
      ? SigningClient
      : TW extends ApiWalletConfig
        ? SigningClient
        : ReadOnlyClient
  readonly Effect: MinimalClientEffect
}
```

Added in v2.0.0

## MinimalClientEffect (interface)

MinimalClient Effect - holds network context.

**Signature**

```ts
export interface MinimalClientEffect {
  readonly networkId: Effect.Effect<number | string, never>
}
```

Added in v2.0.0

## NetworkId (type alias)

Network identifier for client configuration.

**Signature**

```ts
export type NetworkId = "mainnet" | "preprod" | "preview" | number
```

Added in v2.0.0

## PrivateKeyWalletConfig (interface)

Private key wallet configuration.

**Signature**

```ts
export interface PrivateKeyWalletConfig {
  readonly type: "private-key"
  readonly paymentKey: string
  readonly stakeKey?: string
  readonly addressType?: "Base" | "Enterprise"
}
```

Added in v2.0.0

## ProviderConfig (type alias)

Provider configuration union type.

**Signature**

```ts
export type ProviderConfig = BlockfrostConfig | KupmiosConfig | MaestroConfig | KoiosConfig
```

Added in v2.0.0

## ProviderOnlyClient (type alias)

ProviderOnlyClient - blockchain queries and transaction submission.

**Signature**

```ts
export type ProviderOnlyClient = EffectToPromiseAPI<Provider.ProviderEffect> & {
  readonly attachWallet: <T extends WalletConfig>(
    config: T
  ) => T extends SeedWalletConfig
    ? SigningClient
    : T extends PrivateKeyWalletConfig
      ? SigningClient
      : T extends ApiWalletConfig
        ? SigningClient
        : ReadOnlyClient
  readonly Effect: Provider.ProviderEffect
}
```

Added in v2.0.0

## ReadOnlyClient (type alias)

ReadOnlyClient - blockchain queries and wallet address operations without signing.
Use newTx() to build unsigned transactions.

**Signature**

```ts
export type ReadOnlyClient = EffectToPromiseAPI<ReadOnlyClientEffect> & {
  readonly newTx: (utxos?: ReadonlyArray<UTxO.UTxO>) => ReadOnlyTransactionBuilder
  readonly Effect: ReadOnlyClientEffect
}
```

Added in v2.0.0

## ReadOnlyClientEffect (interface)

ReadOnlyClient Effect - provider, read-only wallet, and utility methods.

**Signature**

```ts
export interface ReadOnlyClientEffect extends Provider.ProviderEffect, ReadOnlyWalletEffect {
  readonly getWalletUtxos: () => Effect.Effect<ReadonlyArray<UTxO.UTxO>, Provider.ProviderError>
  readonly getWalletDelegation: () => Effect.Effect<Delegation.Delegation, Provider.ProviderError>
}
```

Added in v2.0.0

## ReadOnlyWalletClient (type alias)

ReadOnlyWalletClient - wallet address access without signing or blockchain queries.
Requires attachProvider() to access blockchain data.

**Signature**

```ts
export type ReadOnlyWalletClient = EffectToPromiseAPI<ReadOnlyWalletEffect> & {
  readonly networkId: number | string
  readonly attachProvider: (config: ProviderConfig) => ReadOnlyClient
  readonly Effect: ReadOnlyWalletEffect
}
```

Added in v2.0.0

## ReadOnlyWalletConfig (interface)

Read-only wallet configuration.

**Signature**

```ts
export interface ReadOnlyWalletConfig {
  readonly type: "read-only"
  readonly address: string
  readonly rewardAddress?: string
}
```

Added in v2.0.0

## RetryConfig (interface)

Retry policy configuration with exponential backoff.

**Signature**

```ts
export interface RetryConfig {
  readonly maxRetries: number
  readonly retryDelayMs: number
  readonly backoffMultiplier: number
  readonly maxRetryDelayMs: number
}
```

Added in v2.0.0

## RetryPolicy (type alias)

Retry policy - preset config, custom schedule, or preset reference.

**Signature**

```ts
export type RetryPolicy = RetryConfig | Schedule.Schedule<any, any> | { preset: keyof typeof RetryPresets }
```

Added in v2.0.0

## SeedWalletConfig (interface)

Seed phrase wallet configuration.

**Signature**

```ts
export interface SeedWalletConfig {
  readonly type: "seed"
  readonly mnemonic: string
  readonly accountIndex?: number
  readonly paymentIndex?: number
  readonly stakeIndex?: number
  readonly addressType?: "Base" | "Enterprise"
  readonly password?: string
}
```

Added in v2.0.0

## SigningClient (type alias)

SigningClient - full functionality: blockchain queries, transaction signing, and submission.
Use newTx() to build, sign, and submit transactions.

**Signature**

```ts
export type SigningClient = EffectToPromiseAPI<SigningClientEffect> & {
  readonly newTx: () => SigningTransactionBuilder
  readonly Effect: SigningClientEffect
}
```

Added in v2.0.0

## SigningClientEffect (interface)

SigningClient Effect - provider, signing wallet, and utility methods.

**Signature**

```ts
export interface SigningClientEffect extends Provider.ProviderEffect, SigningWalletEffect {
  readonly getWalletUtxos: () => Effect.Effect<ReadonlyArray<UTxO.UTxO>, WalletError | Provider.ProviderError>
  readonly getWalletDelegation: () => Effect.Effect<Delegation.Delegation, WalletError | Provider.ProviderError>
}
```

Added in v2.0.0

## SigningWalletClient (type alias)

SigningWalletClient - transaction signing without blockchain queries.
Requires attachProvider() to access blockchain data.

**Signature**

```ts
export type SigningWalletClient = EffectToPromiseAPI<SigningWalletEffect> & {
  readonly networkId: number | string
  readonly attachProvider: (config: ProviderConfig) => SigningClient
  readonly Effect: SigningWalletEffect
}
```

Added in v2.0.0

## WalletConfig (type alias)

Wallet configuration union type.

**Signature**

```ts
export type WalletConfig = SeedWalletConfig | PrivateKeyWalletConfig | ReadOnlyWalletConfig | ApiWalletConfig
```

Added in v2.0.0
