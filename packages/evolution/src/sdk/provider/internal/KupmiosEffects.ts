import { FetchHttpClient } from "@effect/platform"
import { Array as _Array, Effect, pipe, Schedule, Schema } from "effect"

import * as CoreAddress from "../../../core/Address.js"
import * as CoreAssets from "../../../core/Assets/index.js"
import * as PlutusData from "../../../core/Data.js"
import * as DatumOption from "../../../core/DatumOption.js"
import * as ScriptRef from "../../../core/ScriptRef.js"
import * as TransactionHash from "../../../core/TransactionHash.js"
import * as CoreUTxO from "../../../core/UTxO.js"
import type * as Credential from "../../Credential.js"
import type { EvalRedeemer } from "../../EvalRedeemer.js"
import type * as OutRef from "../../OutRef.js"
import type * as ProtocolParameters from "../../ProtocolParameters.js"
import type * as RewardAddress from "../../RewardAddress.js"
import * as Script from "../../Script.js"
import * as Unit from "../../Unit.js"
import { ProviderError } from "../Provider.js"
import * as HttpUtils from "./HttpUtils.js"
import * as Kupo from "./Kupo.js"
import * as Ogmios from "./Ogmios.js"

const TIMEOUT = 10_000

// Internal utility functions (not exported)
const toProtocolParameters = (result: Ogmios.ProtocolParameters): ProtocolParameters.ProtocolParameters => {
  return {
    minFeeA: result.minFeeCoefficient,
    minFeeB: result.minFeeConstant.ada.lovelace,
    maxTxSize: result.maxTransactionSize.bytes,
    maxValSize: result.maxValueSize.bytes,
    keyDeposit: BigInt(result.stakeCredentialDeposit.ada.lovelace),
    poolDeposit: BigInt(result.stakePoolDeposit.ada.lovelace),
    drepDeposit: BigInt(result.delegateRepresentativeDeposit.ada.lovelace),
    govActionDeposit: BigInt(result.governanceActionDeposit.ada.lovelace),
    priceMem: result.scriptExecutionPrices.memory[0] / result.scriptExecutionPrices.memory[1],
    priceStep: result.scriptExecutionPrices.cpu[0] / result.scriptExecutionPrices.cpu[1],
    maxTxExMem: BigInt(result.maxExecutionUnitsPerTransaction.memory),
    maxTxExSteps: BigInt(result.maxExecutionUnitsPerTransaction.cpu),
    coinsPerUtxoByte: BigInt(result.minUtxoDepositCoefficient),
    collateralPercentage: result.collateralPercentage,
    maxCollateralInputs: result.maxCollateralInputs,
    minFeeRefScriptCostPerByte: result.minFeeReferenceScripts.base,
    costModels: {
      PlutusV1: Object.fromEntries(
        result.plutusCostModels["plutus:v1"].map((value, index) => [index.toString(), value])
      ),
      PlutusV2: Object.fromEntries(
        result.plutusCostModels["plutus:v2"].map((value, index) => [index.toString(), value])
      ),
      PlutusV3: Object.fromEntries(
        result.plutusCostModels["plutus:v3"].map((value, index) => [index.toString(), value])
      )
    }
  }
}

const toAssets = (value: Kupo.UTxO["value"]): CoreAssets.Assets => {
  let assets = CoreAssets.fromLovelace(BigInt(value.coins))
  for (const unit of Object.keys(value.assets)) {
    const cleanUnit = unit.replace(".", "")
    // Parse policyId (first 56 chars) and assetName (rest)
    const policyIdHex = cleanUnit.slice(0, 56)
    const assetNameHex = cleanUnit.slice(56)
    assets = CoreAssets.addByHex(assets, policyIdHex, assetNameHex, BigInt(value.assets[unit]))
  }
  return assets
}

const retrieveDatumEffect =
  (kupoUrl: string, kupoHeader?: Record<string, string>) =>
  (datum_type: Kupo.UTxO["datum_type"], datum_hash: Kupo.UTxO["datum_hash"]): Effect.Effect<DatumOption.DatumOption | undefined, ProviderError> =>
    Effect.gen(function* () {
      if (datum_type === "inline" && datum_hash) {
        const pattern = `${kupoUrl}/datums/${datum_hash}`
        const schema = Kupo.DatumSchema
        return yield* pipe(
          HttpUtils.get(pattern, schema, kupoHeader),
          Effect.flatMap(Effect.fromNullable),
          Effect.map(
            (result) => {
              // Parse the datum hex string to PlutusData
              const data = PlutusData.fromCBORHex(result.datum)
              return new DatumOption.InlineDatum({ data })
            }
          ),
          Effect.retry(Schedule.compose(Schedule.exponential(50), Schedule.recurs(5))),
          Effect.timeout(5_000),
          Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to retrieve datum" }))
        )
      } else if (datum_type === "hash" && datum_hash) {
        const hashBytes = new Uint8Array(Buffer.from(datum_hash, "hex"))
        return new DatumOption.DatumHash({ hash: hashBytes })
      }

      return undefined
    })

const getScriptEffect =
  (kupoUrl: string, kupoHeader?: Record<string, string>) => (script_hash: Kupo.UTxO["script_hash"]): Effect.Effect<ScriptRef.ScriptRef | undefined, ProviderError> =>
    Effect.gen(function* () {
      if (script_hash) {
        const pattern = `${kupoUrl}/scripts/${script_hash}`
        const schema = Kupo.ScriptSchema
        return yield* pipe(
          HttpUtils.get(pattern, schema, kupoHeader),
          Effect.flatMap(Effect.fromNullable),
          Effect.retry(Schedule.compose(Schedule.exponential(50), Schedule.recurs(5))),
          Effect.timeout(5_000),
          Effect.map(({ language, script }) => {
            // Apply appropriate CBOR encoding based on script type
            let encodedScript: string
            switch (language) {
              case "native":
                encodedScript = script // Native scripts don't need double encoding
                break
              case "plutus:v1":
              case "plutus:v2":
              case "plutus:v3":
                encodedScript = Script.applyDoubleCborEncoding(script)
                break
            }
            // Convert hex script to bytes and wrap in ScriptRef
            const scriptBytes = new Uint8Array(Buffer.from(encodedScript, "hex"))
            return new ScriptRef.ScriptRef({ bytes: scriptBytes })
          }),
          Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get script" }))
        )
      } else return undefined
    })

const kupmiosUtxosToUtxos =
  (kupoURL: string, kupoHeader?: Record<string, string>) => (utxos: ReadonlyArray<Kupo.UTxO>): Effect.Effect<Array<CoreUTxO.UTxO>, ProviderError> => {
    const getDatum = retrieveDatumEffect(kupoURL, kupoHeader)
    const getScript = getScriptEffect(kupoURL, kupoHeader)
    return Effect.forEach(
      utxos,
      (utxo) => {
        return pipe(
          Effect.all([getDatum(utxo.datum_type, utxo.datum_hash), getScript(utxo.script_hash)]),
          Effect.map(
            ([datumOption, scriptRef]): CoreUTxO.UTxO => {
              const transactionId = TransactionHash.fromHex(utxo.transaction_id)
              const address = CoreAddress.fromBech32(utxo.address)
              return new CoreUTxO.UTxO({
                transactionId,
                index: BigInt(utxo.output_index),
                address,
                assets: toAssets(utxo.value),
                datumOption,
                scriptRef
              })
            }
          )
        )
      },
      { concurrency: "unbounded" }
    )
  }

// Exported effect functions used by KupmiosProvider
export const getProtocolParametersEffect = Effect.fn("getProtocolParameters")(function* (
  ogmiosUrl: string,
  headers?: { ogmiosHeader?: Record<string, string> }
) {
  const data = {
    jsonrpc: "2.0",
    method: "queryLedgerState/protocolParameters",
    params: {},
    id: null
  } as const

  const schema = Ogmios.JSONRPCSchema(Ogmios.ProtocolParametersSchema)
  const { result } = yield* pipe(
    HttpUtils.postJson(ogmiosUrl, data, schema, headers?.ogmiosHeader),
    Effect.timeout(TIMEOUT),
    Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get protocol parameters" })),
    Effect.provide(FetchHttpClient.layer)
  )
  return toProtocolParameters(result)
})

export const getUtxosEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("getUtxos")(function* (addressOrCredential: CoreAddress.Address | Credential.Credential) {
    let pattern: string
    if (addressOrCredential instanceof CoreAddress.Address) {
      const addressStr = CoreAddress.toBech32(addressOrCredential)
      pattern = `${kupoUrl}/matches/${addressStr}?unspent`
    } else {
      pattern = `${kupoUrl}/matches/${addressOrCredential.hash}/*?unspent`
    }
    const toUtxos = kupmiosUtxosToUtxos(kupoUrl, headers?.kupoHeader)

    const schema = Schema.Array(Kupo.UTxOSchema)
    const utxos = yield* pipe(
      HttpUtils.get(pattern, schema, headers?.kupoHeader),
      Effect.flatMap((u) => toUtxos(u)),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get UTxOs" })),
      Effect.provide(FetchHttpClient.layer)
    )
    return utxos
  })

export const getUtxoByUnitEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("getUtxoByUnit")(function* (unit: Unit.Unit) {
    const { assetName, policyId } = Unit.fromUnit(unit)
    const pattern = `${kupoUrl}/matches/${policyId}.${assetName ? `${assetName}` : "*"}?unspent`

    const toUtxos = kupmiosUtxosToUtxos(kupoUrl, headers?.kupoHeader)

    const schema = Schema.Array(Kupo.UTxOSchema)
    const utxos = yield* pipe(
      HttpUtils.get(pattern, schema, headers?.kupoHeader),
      Effect.flatMap((u) => toUtxos(u)),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get UTxO by unit" })),
      Effect.provide(FetchHttpClient.layer)
    )

    if (utxos.length > 1) {
      return yield* Effect.fail(
        new ProviderError({
          cause: new Error("Unit needs to be an NFT or only held by one address."),
          message: "Multiple UTxOs found for unit"
        })
      )
    }

    if (utxos.length === 0) {
      return yield* Effect.fail(
        new ProviderError({
          cause: new Error("No UTxO found for unit"),
          message: "UTxO not found"
        })
      )
    }

    return utxos[0]
  })

export const getUtxosByOutRefEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("getUtxosByOutRef")(function* (outRefs: ReadonlyArray<OutRef.OutRef>) {
    const queryHashes: Array<string> = [...new Set(outRefs.map((outRef) => outRef.txHash))]
    const mkPattern = (txHash: string) => `${kupoUrl}/matches/*@${txHash}?unspent`
    const schema = Schema.Array(Kupo.UTxOSchema)
    const toUtxos = kupmiosUtxosToUtxos(kupoUrl, headers?.kupoHeader)
    const program = Effect.forEach(queryHashes, (txHash) =>
      pipe(
        HttpUtils.get(mkPattern(txHash), schema, headers?.kupoHeader),
        Effect.flatMap((u) => toUtxos(u)),
        Effect.timeout(TIMEOUT),
        Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get UTxOs by OutRef" }))
      )
    )
    const utxos: Array<Array<CoreUTxO.UTxO>> = yield* pipe(program, Effect.provide(FetchHttpClient.layer))

    return _Array
      .flatten(utxos)
      .filter((utxo) =>
        outRefs.some((outRef) => TransactionHash.toHex(utxo.transactionId) === outRef.txHash && Number(utxo.index) === outRef.outputIndex)
      )
  })

export const submitTxEffect = (ogmiosUrl: string, headers?: { ogmiosHeader?: Record<string, string> }) =>
  Effect.fn("submitTx")(function* (tx: string) {
    const data = {
      jsonrpc: "2.0",
      method: "submitTransaction",
      params: {
        transaction: { cbor: tx }
      },
      id: null
    } as const

    const schema = Ogmios.JSONRPCSchema(
      Schema.Struct({
        transaction: Schema.Struct({
          id: Schema.String
        })
      })
    )

    const { result } = yield* pipe(
      HttpUtils.postJson(ogmiosUrl, data, schema, headers?.ogmiosHeader),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to submit transaction" })),
      Effect.provide(FetchHttpClient.layer)
    )

    // Return the transaction ID as a string
    return result.transaction.id
  })

export const getUtxosWithUnitEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("getUtxosWithUnit")(function* (addressOrCredential: CoreAddress.Address | Credential.Credential, unit: Unit.Unit) {
    const isAddress = addressOrCredential instanceof CoreAddress.Address
    const queryPredicate = isAddress ? CoreAddress.toBech32(addressOrCredential) : addressOrCredential.hash
    const { assetName, policyId } = Unit.fromUnit(unit)
    const pattern = `${kupoUrl}/matches/${queryPredicate}${isAddress ? "" : "/*"}?unspent&policy_id=${policyId}${assetName ? `&asset_name=${assetName}` : ""}`

    const schema = Schema.Array(Kupo.UTxOSchema)
    const toUtxos = kupmiosUtxosToUtxos(kupoUrl, headers?.kupoHeader)
    const utxos = yield* pipe(
      HttpUtils.get(pattern, schema, headers?.kupoHeader),
      Effect.flatMap((u) => toUtxos(u)),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get UTxOs with unit" })),
      Effect.provide(FetchHttpClient.layer)
    )
    return utxos
  })

export const evaluateTxEffect = (ogmiosUrl: string, headers?: { ogmiosHeader?: Record<string, string> }) =>
  Effect.fn("evaluateTx")(function* (tx: string, additionalUTxOs?: Array<CoreUTxO.UTxO>) {
    // Prepare request data
    const data = {
      jsonrpc: "2.0",
      method: "evaluateTransaction",
      params: {
        transaction: { cbor: tx },
        additionalUtxo: Ogmios.toOgmiosUTxOs(additionalUTxOs)
      },
      id: null
    }

    // Define the schema
    const schema = Ogmios.JSONRPCSchema(Schema.Array(Ogmios.RedeemerSchema))

    // Perform the request and handle the response
    const { result } = yield* pipe(
      HttpUtils.postJson(ogmiosUrl, data, schema, headers?.ogmiosHeader),
      Effect.provide(FetchHttpClient.layer),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to evaluate transaction" }))
    )

    const evalRedeemers: Array<EvalRedeemer> = (result as Array<any>).map((item: any) => ({
      ex_units: {
        mem: item.budget.memory,
        steps: item.budget.cpu
      },
      redeemer_index: item.validator.index,
      redeemer_tag: item.validator.purpose
    }))

    return evalRedeemers
  })

export const awaitTxEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("awaitTx")(function* (txHash: string, checkInterval = 20000) {
    const pattern = `${kupoUrl}/matches/*@${txHash}?unspent`
    const schema = Schema.Array(Kupo.UTxOSchema).annotations({
      identifier: "Array<KupmiosSchema.KupoUTxO>"
    })

    const result = yield* pipe(
      HttpUtils.get(pattern, schema, headers?.kupoHeader),
      Effect.provide(FetchHttpClient.layer),
      Effect.repeat({
        schedule: Schedule.exponential(checkInterval),
        until: (result) => result.length > 0
      }),
      Effect.timeout(160_000),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to await transaction" })),
      Effect.as(true)
    )
    return result
  })

export const getDelegationEffect = (ogmiosUrl: string, headers?: { ogmiosHeader?: Record<string, string> }) =>
  Effect.fn("getDelegation")(function* (rewardAddress: RewardAddress.RewardAddress) {
    const data = {
      jsonrpc: "2.0",
      method: "queryLedgerState/rewardAccountSummaries",
      params: { keys: [rewardAddress] },
      id: null
    }
    const schema = Ogmios.JSONRPCSchema(Ogmios.Delegation)
    const { result } = yield* pipe(
      HttpUtils.postJson(ogmiosUrl, data, schema, headers?.ogmiosHeader),
      Effect.provide(FetchHttpClient.layer),
      Effect.timeout(TIMEOUT),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get delegation" }))
    )
    const delegation = result ? (Object.values(result)[0] as any) : null

    return {
      poolId: delegation?.delegate?.id || null,
      rewards: BigInt(delegation?.rewards?.ada?.lovelace || 0)
    }
  })

export const getDatumEffect = (kupoUrl: string, headers?: { kupoHeader?: Record<string, string> }) =>
  Effect.fn("getDatum")(function* (datumHash: string) {
    const pattern = `${kupoUrl}/datums/${datumHash}`
    const schema = Kupo.DatumSchema
    const result = yield* pipe(
      HttpUtils.get(pattern, schema, headers?.kupoHeader),
      Effect.provide(FetchHttpClient.layer),
      Effect.timeout(TIMEOUT),
      Effect.flatMap(Effect.fromNullable),
      Effect.catchAll((cause) => new ProviderError({ cause, message: "Failed to get datum" }))
    )
    return result.datum
  })