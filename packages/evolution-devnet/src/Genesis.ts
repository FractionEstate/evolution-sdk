import * as Address from "@evolution-sdk/evolution/core/AddressEras"
import * as TransactionHash from "@evolution-sdk/evolution/core/TransactionHash"
import * as Assets from "@evolution-sdk/evolution/sdk/Assets"
import type * as UTxO from "@evolution-sdk/evolution/sdk/UTxO"
import { blake2b } from "@noble/hashes/blake2"
import { Data, Effect } from "effect"

import type * as Config from "./Config.js"
import type * as Container from "./Container.js"

export class GenesisError extends Data.TaggedError("GenesisError")<{
  reason: string
  message: string
  cause?: unknown
}> {}

export interface Cluster {
  readonly cardanoNode: Container.Container
  readonly kupo?: Container.Container | undefined
  readonly ogmios?: Container.Container | undefined
  readonly networkName: string
}

/**
 * Calculate genesis UTxOs deterministically from shelley genesis configuration.
 * No node interaction required - purely computational.
 *
 * Implementation follows Cardano's `initialFundsPseudoTxIn` algorithm:
 * Each address gets a unique pseudo-TxId by hashing the address itself (not the genesis JSON).
 * This matches the Haskell implementation in cardano-ledger.
 *
 * Algorithm:
 * 1. For each address in initialFunds:
 *    a. Serialize address to CBOR bytes
 *    b. Hash with blake2b-256 → this becomes the TxId
 *    c. Output index is always 0 (minBound)
 *
 * Reference: cardano-ledger/eras/shelley/impl/src/Cardano/Ledger/Shelley/Genesis.hs
 * `initialFundsPseudoTxIn addr = TxIn (pseudoTxId addr) minBound`
 * `pseudoTxId = TxId . unsafeMakeSafeHash . Hash.castHash . Hash.hashWith serialiseAddr`
 *
 * @example
 * ```typescript
 * import * as Devnet from "@evolution-sdk/evolution-devnet"
 *
 * const genesisConfig = {
 *   initialFunds: {
 *     "00813c32c92aad21...": 900_000_000_000
 *   },
 *   // ... other genesis config
 * }
 *
 * const utxos = await Devnet.Genesis.calculateUtxosFromConfigOrThrow(
 *   genesisConfig
 * )
 * ```
 *
 * @since 2.0.0
 * @category genesis
 */
export const calculateUtxosFromConfig = (
  genesisConfig: Config.ShelleyGenesis
): Effect.Effect<ReadonlyArray<UTxO.UTxO>, GenesisError> =>
  Effect.gen(function* () {
    const utxos: Array<UTxO.UTxO> = []
    const fundEntries = Object.entries(genesisConfig.initialFunds)

    for (const [addressHex, lovelace] of fundEntries) {
      // Convert hex address to Address object and bech32
      const addressBech32 = yield* Effect.try({
        try: () => {
          const addr = Address.fromHex(addressHex)
          return Address.toBech32(addr)
        },
        catch: (e) =>
          new GenesisError({
            reason: "address_conversion_failed",
            message: `Failed to convert genesis address hex to bech32: ${addressHex}`,
            cause: e
          })
      })

      // Calculate pseudo-TxId by hashing the address bytes
      // This matches Cardano's: Hash.hashWith serialiseAddr addr
      const addr = Address.fromHex(addressHex)
      const addressBytes = Address.toBytes(addr)
      const txHashBytes = blake2b(addressBytes, { dkLen: 32 })
      const txHash = TransactionHash.toHex(new TransactionHash.TransactionHash({ hash: txHashBytes }))

      utxos.push({
        txHash,
        outputIndex: 0, // Genesis UTxOs always use index 0 (minBound in Haskell)
        address: addressBech32,
        assets: Assets.fromLovelace(BigInt(lovelace))
      })
    }

    return utxos
  })

/**
 * Calculate genesis UTxOs from config, throws on error.
 *
 * @since 2.0.0
 * @category genesis
 */
export const calculateUtxosFromConfigOrThrow = (genesisConfig: Config.ShelleyGenesis) =>
  Effect.runPromise(calculateUtxosFromConfig(genesisConfig))

/**
 * Query genesis UTxOs from the running node using cardano-cli.
 * This is the "source of truth" method that queries actual chain state.
 *
 * @since 2.0.0
 * @category genesis
 */
export const queryUtxos = (cluster: Cluster): Effect.Effect<ReadonlyArray<UTxO.UTxO>, GenesisError> =>
  Effect.gen(function* () {
    // Need to import Container functions dynamically to avoid circular dependency
    const ContainerModule = yield* Effect.promise(() => import("./Container.js"))

    const output = yield* ContainerModule.execCommandEffect(cluster.cardanoNode, [
      "cardano-cli",
      "conway",
      "query",
      "utxo",
      "--whole-utxo",
      "--socket-path",
      "/opt/cardano/ipc/node.socket",
      "--testnet-magic",
      "42",
      "--out-file",
      "/dev/stdout"
    ]).pipe(
      Effect.mapError(
        (e) =>
          new GenesisError({
            reason: "utxo_query_failed",
            message: "Failed to query UTxOs from node",
            cause: e
          })
      )
    )

    const parsed = yield* Effect.try({
      try: () => JSON.parse(output) as Record<string, { address: string; value: { lovelace: number } }>,
      catch: (e) =>
        new GenesisError({
          reason: "utxo_parse_failed",
          message: "Failed to parse UTxO query output from cardano-cli",
          cause: e
        })
    })

    return Object.entries(parsed).map(([key, data]) => {
      const [txHash, outputIndex] = key.split("#")
      return {
        txHash,
        outputIndex: parseInt(outputIndex),
        address: data.address,
        assets: Assets.fromLovelace(BigInt(data.value.lovelace))
      }
    })
  })

/**
 * Query genesis UTxOs from node, throws on error.
 *
 * @since 2.0.0
 * @category genesis
 */
export const queryUtxosOrThrow = (cluster: Cluster) => Effect.runPromise(queryUtxos(cluster))
