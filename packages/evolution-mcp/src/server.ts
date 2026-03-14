import type { Implementation } from "@modelcontextprotocol/sdk/types.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as Evolution from "@evolution-sdk/evolution"
import * as AssetUnit from "@evolution-sdk/evolution/Assets/Unit"
import * as AssetLabel from "@evolution-sdk/evolution/Assets/Label"
import * as EvolutionHash from "@evolution-sdk/evolution/utils/Hash"
import * as Devnet from "@evolution-sdk/devnet"
import { createAikenEvaluator } from "@evolution-sdk/aiken-uplc"
import { createScalusEvaluator } from "@evolution-sdk/scalus-uplc"
import { z } from "zod"

import {
  parseAddress,
  parseAssets,
  parseBigInt,
  parseProtocolParameters,
  parseTransaction,
  parseUtxos,
  parseWitnessSet,
  serializeAddress,
  serializeDelegation,
  serializeProtocolParameters,
  serializeTransaction,
  serializeTransactionHash,
  serializeUtxos,
  serializeWitnessSet,
  toStructured,
  type AssetRecordInput,
  type ProtocolParametersInput,
  type UtxoInput
} from "./codec.js"
import { sessionStore } from "./sessions.js"

const packageVersion = "0.1.0"

const implementation: Implementation = {
  name: "@evolution-sdk/mcp",
  version: packageVersion
}

const evolutionExports = Object.keys(Evolution).sort()

const NetworkSchema = z.union([z.enum(["mainnet", "preprod", "preview"]), z.number().int()])

const SlotConfigSchema = z
  .object({
    zeroTime: z.union([z.string(), z.number().int()]),
    zeroSlot: z.union([z.string(), z.number().int()]),
    slotLength: z.number().int().positive()
  })
  .optional()

const ProviderConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blockfrost"),
    baseUrl: z.string().url(),
    projectId: z.string().optional()
  }),
  z.object({
    type: z.literal("kupmios"),
    kupoUrl: z.string().url(),
    ogmiosUrl: z.string().url(),
    headers: z
      .object({
        ogmiosHeader: z.record(z.string(), z.string()).optional(),
        kupoHeader: z.record(z.string(), z.string()).optional()
      })
      .optional()
  }),
  z.object({
    type: z.literal("maestro"),
    baseUrl: z.string().url(),
    apiKey: z.string(),
    turboSubmit: z.boolean().optional()
  }),
  z.object({
    type: z.literal("koios"),
    baseUrl: z.string().url(),
    token: z.string().optional()
  })
])

const WalletConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("seed"),
    mnemonic: z.string(),
    accountIndex: z.number().int().nonnegative().optional(),
    paymentIndex: z.number().int().nonnegative().optional(),
    stakeIndex: z.number().int().nonnegative().optional(),
    addressType: z.enum(["Base", "Enterprise"]).optional(),
    password: z.string().optional()
  }),
  z.object({
    type: z.literal("private-key"),
    paymentKey: z.string(),
    stakeKey: z.string().optional(),
    addressType: z.enum(["Base", "Enterprise"]).optional()
  }),
  z.object({
    type: z.literal("read-only"),
    address: z.string(),
    rewardAddress: z.string().optional()
  })
])

const AssetRecordSchema = z.record(z.string(), z.union([z.string(), z.number().int()]))

const UtxoInputSchema = z.object({
  transactionId: z.string(),
  index: z.union([z.string(), z.number().int().nonnegative()]),
  address: z.string(),
  assets: AssetRecordSchema,
  datumOptionCborHex: z.string().optional(),
  scriptRefCborHex: z.string().optional()
})

const ProtocolParametersSchema = z.object({
  minFeeCoefficient: z.union([z.string(), z.number().int()]),
  minFeeConstant: z.union([z.string(), z.number().int()]),
  coinsPerUtxoByte: z.union([z.string(), z.number().int()]),
  maxTxSize: z.number().int().positive(),
  priceMem: z.number().optional(),
  priceStep: z.number().optional(),
  minFeeRefScriptCostPerByte: z.number().optional()
})

const ExportNameSchema = z.string().refine((value) => evolutionExports.includes(value), {
  message: "Unknown public Evolution export"
})

const CborOptionsPresetSchema = z
  .enum(["canonical", "cml", "cml-data", "aiken", "struct-friendly", "cardano-node-data"])
  .optional()

const AssetDeltaSchema = z.object({
  policyIdHex: z.string(),
  assetNameHex: z.string(),
  quantity: z.union([z.string(), z.number().int()])
})

const IdentifierKindSchema = z.enum([
  "keyHash",
  "scriptHash",
  "policyId",
  "poolKeyHash",
  "datumHash",
  "transactionHash",
  "credential",
  "drep"
])

// Build a map of all Evolution modules that expose fromCBORHex / toCBORHex as data-first functions.
// DRep is excluded because its toCBORHex is curried rather than data-first.
const typedExportModules = new Map<
  string,
  {
    fromCBORHex: (hex: string, options?: Evolution.CBOR.CodecOptions) => unknown
    toCBORHex: (value: unknown, options?: Evolution.CBOR.CodecOptions) => string
  }
>()

for (const name of evolutionExports) {
  if (name === "DRep") continue
  const mod = (Evolution as Record<string, unknown>)[name]
  if (
    mod !== null &&
    typeof mod === "object" &&
    typeof (mod as Record<string, unknown>).fromCBORHex === "function" &&
    typeof (mod as Record<string, unknown>).toCBORHex === "function"
  ) {
    typedExportModules.set(name, {
      fromCBORHex: (mod as Record<string, Function>).fromCBORHex as any,
      toCBORHex: (mod as Record<string, Function>).toCBORHex as any
    })
  }
}

const typedExportModuleNames = Array.from(typedExportModules.keys()).sort()

const EvaluatorSchema = z.enum(["aiken", "scalus"]).optional()

const resolveEvaluator = (evaluator: z.infer<typeof EvaluatorSchema>) => {
  switch (evaluator) {
    case "aiken":
      return createAikenEvaluator
    case "scalus":
      return createScalusEvaluator
    default:
      return undefined
  }
}

const asToolText = (value: unknown): string => JSON.stringify(toStructured(value), null, 2)

type ToolResultObject = Record<string, unknown>

type StructuredCborValue =
  | { readonly type: "integer"; readonly value: string }
  | { readonly type: "bytes"; readonly hex: string }
  | { readonly type: "text"; readonly value: string }
  | { readonly type: "array"; readonly items: ReadonlyArray<StructuredCborValue> }
  | { readonly type: "map"; readonly entries: ReadonlyArray<{ readonly key: StructuredCborValue; readonly value: StructuredCborValue }> }
  | { readonly type: "record"; readonly entries: Record<string, StructuredCborValue> }
  | { readonly type: "tag"; readonly tag: number; readonly value: StructuredCborValue }
  | { readonly type: "boolean"; readonly value: boolean }
  | { readonly type: "null" }
  | { readonly type: "undefined" }
  | { readonly type: "float"; readonly value: number }
  | { readonly type: "boundedBytes"; readonly hex: string }

type StructuredDataValue =
  | { readonly type: "constr"; readonly index: string; readonly fields: ReadonlyArray<StructuredDataValue> }
  | { readonly type: "map"; readonly entries: ReadonlyArray<{ readonly key: StructuredDataValue; readonly value: StructuredDataValue }> }
  | { readonly type: "list"; readonly items: ReadonlyArray<StructuredDataValue> }
  | { readonly type: "int"; readonly value: string }
  | { readonly type: "bytes"; readonly hex: string }

type StructuredIdentifier =
  | { readonly type: "keyHash"; readonly hex: string }
  | { readonly type: "scriptHash"; readonly hex: string }
  | { readonly type: "policyId"; readonly hex: string }
  | { readonly type: "poolKeyHash"; readonly hex: string; readonly bech32: string }
  | { readonly type: "datumHash"; readonly hex: string }
  | { readonly type: "transactionHash"; readonly hex: string }
  | { readonly type: "credential"; readonly credentialType: "keyHash" | "scriptHash"; readonly hex: string; readonly cborHex: string }
  | {
      readonly type: "drep"
      readonly drepType: "keyHash" | "scriptHash" | "alwaysAbstain" | "alwaysNoConfidence"
      readonly hex?: string
      readonly bech32?: string
      readonly cborHex: string
    }

interface SubmitBuilderLike {
  readonly witnessSet: Evolution.TransactionWitnessSet.TransactionWitnessSet
  readonly submit: () => Promise<Evolution.TransactionHash.TransactionHash>
}

const toolTextResult = (result: ToolResultObject) => ({
  content: [{ type: "text" as const, text: asToolText(result) }],
  structuredContent: result
})

const hasMethod = <T extends string>(value: unknown, method: T): value is Record<T, (...args: Array<any>) => any> =>
  typeof value === "object" && value !== null && method in value && typeof (value as Record<string, unknown>)[method] === "function"

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/iu.test(hex)) {
    throw new Error(`Invalid hex string: ${hex}`)
  }

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16)
  }

  return bytes
}

const resolveCborOptions = (
  preset: z.infer<typeof CborOptionsPresetSchema>,
  fallback: Evolution.CBOR.CodecOptions = Evolution.CBOR.CML_DEFAULT_OPTIONS
): Evolution.CBOR.CodecOptions => {
  switch (preset) {
    case "canonical":
      return Evolution.CBOR.CANONICAL_OPTIONS
    case "cml":
      return Evolution.CBOR.CML_DEFAULT_OPTIONS
    case "cml-data":
      return Evolution.CBOR.CML_DATA_DEFAULT_OPTIONS
    case "aiken":
      return Evolution.CBOR.AIKEN_DEFAULT_OPTIONS
    case "struct-friendly":
      return Evolution.CBOR.STRUCT_FRIENDLY_OPTIONS
    case "cardano-node-data":
      return Evolution.CBOR.CARDANO_NODE_DATA_OPTIONS
    default:
      return fallback
  }
}

const serializeCborValue = (value: Evolution.CBOR.CBOR): StructuredCborValue => {
  if (typeof value === "bigint") {
    return { type: "integer", value: value.toString() }
  }

  if (value instanceof Uint8Array) {
    return { type: "bytes", hex: bytesToHex(value) }
  }

  if (typeof value === "string") {
    return { type: "text", value }
  }

  if (Array.isArray(value)) {
    return { type: "array", items: value.map(serializeCborValue) }
  }

  if (value instanceof Map) {
    return {
      type: "map",
      entries: Array.from(value.entries()).map(([key, entryValue]) => ({
        key: serializeCborValue(key),
        value: serializeCborValue(entryValue)
      }))
    }
  }

  if (Evolution.CBOR.BoundedBytes.is(value)) {
    return { type: "boundedBytes", hex: bytesToHex(value.bytes) }
  }

  if (Evolution.CBOR.isTag(value)) {
    return {
      type: "tag",
      tag: value.tag,
      value: serializeCborValue(value.value)
    }
  }

  if (typeof value === "boolean") {
    return { type: "boolean", value }
  }

  if (value === null) {
    return { type: "null" }
  }

  if (value === undefined) {
    return { type: "undefined" }
  }

  if (typeof value === "number") {
    return { type: "float", value }
  }

  return {
    type: "record",
    entries: Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, serializeCborValue(entryValue)]))
  }
}

const serializeCborLengthEncoding = (value: Evolution.CBOR.LengthEncoding | undefined) =>
  value
    ? value.tag === "indefinite"
      ? { tag: "indefinite" as const }
      : { tag: "definite" as const, byteSize: value.byteSize }
    : undefined

const serializeCborStringEncoding = (value: Evolution.CBOR.StringEncoding | undefined) =>
  value
    ? value.tag === "definite"
      ? { tag: "definite" as const, byteSize: value.byteSize }
      : {
          tag: "indefinite" as const,
          chunks: value.chunks.map((chunk) => ({ length: chunk.length, byteSize: chunk.byteSize }))
        }
    : undefined

const serializeCborFormat = (format: Evolution.CBOR.CBORFormat): unknown => {
  switch (format._tag) {
    case "uint":
    case "nint":
      return {
        type: format._tag,
        ...(format.byteSize !== undefined ? { byteSize: format.byteSize } : undefined)
      }
    case "bytes":
    case "text":
      return {
        type: format._tag,
        ...(format.encoding ? { encoding: serializeCborStringEncoding(format.encoding) } : undefined)
      }
    case "array":
      return {
        type: "array",
        ...(format.length ? { length: serializeCborLengthEncoding(format.length) } : undefined),
        children: format.children.map(serializeCborFormat)
      }
    case "map":
      return {
        type: "map",
        ...(format.length ? { length: serializeCborLengthEncoding(format.length) } : undefined),
        ...(format.keyOrder ? { keyOrderHex: format.keyOrder.map(bytesToHex) } : undefined),
        entries: format.entries.map(([key, value]) => [serializeCborFormat(key), serializeCborFormat(value)])
      }
    case "tag":
      return {
        type: "tag",
        ...(format.width !== undefined ? { width: format.width } : undefined),
        child: serializeCborFormat(format.child)
      }
    case "simple":
      return { type: "simple" }
  }
}

const parseStructuredCbor = (value: unknown): Evolution.CBOR.CBOR => {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error("CBOR value must be a tagged object with a string type field")
  }

  switch (value.type) {
    case "integer":
      if (typeof value.value !== "string") {
        throw new Error("CBOR integer value must be a string")
      }
      return BigInt(value.value)
    case "bytes":
      if (typeof value.hex !== "string") {
        throw new Error("CBOR bytes hex must be a string")
      }
      return hexToBytes(value.hex)
    case "text":
      if (typeof value.value !== "string") {
        throw new Error("CBOR text value must be a string")
      }
      return value.value
    case "array":
      if (!Array.isArray(value.items)) {
        throw new Error("CBOR array items must be an array")
      }
      return value.items.map(parseStructuredCbor)
    case "map":
      if (!Array.isArray(value.entries)) {
        throw new Error("CBOR map entries must be an array")
      }
      return new Map(
        value.entries.map((entry, index) => {
          if (!isObject(entry) || !("key" in entry) || !("value" in entry)) {
            throw new Error(`CBOR map entry ${index} must include key and value`)
          }

          return [parseStructuredCbor(entry.key), parseStructuredCbor(entry.value)] as const
        })
      )
    case "record":
      if (!isObject(value.entries)) {
        throw new Error("CBOR record entries must be an object")
      }
      return Object.fromEntries(Object.entries(value.entries).map(([key, entryValue]) => [key, parseStructuredCbor(entryValue)]))
    case "tag":
      if (typeof value.tag !== "number" || !Number.isInteger(value.tag)) {
        throw new Error("CBOR tag value must be an integer number")
      }
      if (!("value" in value)) {
        throw new Error("CBOR tag must include a nested value")
      }
      return Evolution.CBOR.Tag.make({ tag: value.tag, value: parseStructuredCbor(value.value) })
    case "boolean":
      if (typeof value.value !== "boolean") {
        throw new Error("CBOR boolean value must be a boolean")
      }
      return value.value
    case "null":
      return null
    case "undefined":
      return undefined
    case "float":
      if (typeof value.value !== "number") {
        throw new Error("CBOR float value must be a number")
      }
      return value.value
    case "boundedBytes":
      if (typeof value.hex !== "string") {
        throw new Error("CBOR boundedBytes hex must be a string")
      }
      return Evolution.CBOR.BoundedBytes.make(hexToBytes(value.hex))
    default:
      throw new Error(`Unsupported CBOR type: ${value.type}`)
  }
}

const serializeDataValue = (value: Evolution.Data.Data): StructuredDataValue => {
  if (value instanceof Evolution.Data.Constr) {
    return {
      type: "constr",
      index: value.index.toString(),
      fields: value.fields.map((field) => serializeDataValue(field as Evolution.Data.Data))
    }
  }

  if (value instanceof Map) {
    return {
      type: "map",
      entries: Array.from(value.entries()).map(([key, entryValue]) => ({
        key: serializeDataValue(key as Evolution.Data.Data),
        value: serializeDataValue(entryValue as Evolution.Data.Data)
      }))
    }
  }

  if (Array.isArray(value)) {
    return {
      type: "list",
      items: value.map((item) => serializeDataValue(item as Evolution.Data.Data))
    }
  }

  if (typeof value === "bigint") {
    return { type: "int", value: value.toString() }
  }

  if (value instanceof Uint8Array) {
    return { type: "bytes", hex: bytesToHex(value) }
  }

  throw new Error("Unsupported Data value")
}

const parseStructuredData = (value: unknown): Evolution.Data.Data => {
  if (!isObject(value) || typeof value.type !== "string") {
    throw new Error("Data value must be a tagged object with a string type field")
  }

  switch (value.type) {
    case "constr":
      if (typeof value.index !== "string") {
        throw new Error("Data constr index must be a string")
      }
      if (!Array.isArray(value.fields)) {
        throw new Error("Data constr fields must be an array")
      }
      return Evolution.Data.constr(
        BigInt(value.index),
        value.fields.map((field) => parseStructuredData(field))
      )
    case "map":
      if (!Array.isArray(value.entries)) {
        throw new Error("Data map entries must be an array")
      }
      return Evolution.Data.map(
        value.entries.map((entry, index) => {
          if (!isObject(entry) || !("key" in entry) || !("value" in entry)) {
            throw new Error(`Data map entry ${index} must include key and value`)
          }

          return [parseStructuredData(entry.key), parseStructuredData(entry.value)]
        })
      )
    case "list":
      if (!Array.isArray(value.items)) {
        throw new Error("Data list items must be an array")
      }
      return Evolution.Data.list(value.items.map((item) => parseStructuredData(item)))
    case "int":
      if (typeof value.value !== "string") {
        throw new Error("Data int value must be a string")
      }
      return Evolution.Data.int(BigInt(value.value))
    case "bytes":
      if (typeof value.hex !== "string") {
        throw new Error("Data bytes hex must be a string")
      }
      return Evolution.Data.bytearray(value.hex)
    default:
      throw new Error(`Unsupported Data type: ${value.type}`)
  }
}

const parseAddressInput = (value: string): Evolution.Address.Address => {
  try {
    return Evolution.Address.fromBech32(value)
  } catch {
    return Evolution.Address.fromHex(value)
  }
}

const serializeCredential = (credential: Evolution.Credential.Credential): StructuredIdentifier =>
  credential._tag === "KeyHash"
    ? {
        type: "credential",
        credentialType: "keyHash",
        hex: Evolution.KeyHash.toHex(credential),
        cborHex: Evolution.Credential.toCBORHex(credential)
      }
    : {
        type: "credential",
        credentialType: "scriptHash",
        hex: Evolution.ScriptHash.toHex(credential),
        cborHex: Evolution.Credential.toCBORHex(credential)
      }

const parseStructuredCredential = (value: unknown): Evolution.Credential.Credential => {
  if (!isObject(value) || value.type !== "credential") {
    throw new Error("Credential value must be a tagged credential object")
  }

  if (value.credentialType === "keyHash") {
    if (typeof value.hex !== "string") {
      throw new Error("Credential keyHash hex must be a string")
    }
    return Evolution.KeyHash.fromHex(value.hex)
  }

  if (value.credentialType === "scriptHash") {
    if (typeof value.hex !== "string") {
      throw new Error("Credential scriptHash hex must be a string")
    }
    return Evolution.ScriptHash.fromHex(value.hex)
  }

  throw new Error("Credential credentialType must be keyHash or scriptHash")
}

const serializeDRep = (drep: Evolution.DRep.DRep): StructuredIdentifier => {
  switch (drep._tag) {
    case "KeyHashDRep":
      return {
        type: "drep",
        drepType: "keyHash",
        hex: Evolution.DRep.toHex(drep),
        bech32: Evolution.DRep.toBech32(drep),
        cborHex: Evolution.DRep.toCBORHex()(drep)
      }
    case "ScriptHashDRep":
      return {
        type: "drep",
        drepType: "scriptHash",
        hex: Evolution.DRep.toHex(drep),
        bech32: Evolution.DRep.toBech32(drep),
        cborHex: Evolution.DRep.toCBORHex()(drep)
      }
    case "AlwaysAbstainDRep":
      return {
        type: "drep",
        drepType: "alwaysAbstain",
        cborHex: Evolution.DRep.toCBORHex()(drep)
      }
    case "AlwaysNoConfidenceDRep":
      return {
        type: "drep",
        drepType: "alwaysNoConfidence",
        cborHex: Evolution.DRep.toCBORHex()(drep)
      }
  }
}

const parseStructuredDRep = (value: unknown): Evolution.DRep.DRep => {
  if (!isObject(value) || value.type !== "drep") {
    throw new Error("DRep value must be a tagged drep object")
  }

  switch (value.drepType) {
    case "keyHash":
    case "scriptHash":
      if (typeof value.hex !== "string") {
        throw new Error("DRep keyHash/scriptHash hex must be a string")
      }
      return Evolution.Schema.decodeSync(Evolution.DRep.FromHex)(value.hex)
    case "alwaysAbstain":
      return Evolution.DRep.alwaysAbstain()
    case "alwaysNoConfidence":
      return Evolution.DRep.alwaysNoConfidence()
    default:
      throw new Error("DRep drepType must be keyHash, scriptHash, alwaysAbstain, or alwaysNoConfidence")
  }
}

const serializeIdentifier = (
  kind: z.infer<typeof IdentifierKindSchema>,
  value:
    | Evolution.KeyHash.KeyHash
    | Evolution.ScriptHash.ScriptHash
    | Evolution.PolicyId.PolicyId
    | Evolution.PoolKeyHash.PoolKeyHash
    | Evolution.DatumHash.DatumHash
    | Evolution.TransactionHash.TransactionHash
    | Evolution.Credential.Credential
    | Evolution.DRep.DRep
): StructuredIdentifier => {
  switch (kind) {
    case "keyHash":
      return { type: "keyHash", hex: Evolution.KeyHash.toHex(value as Evolution.KeyHash.KeyHash) }
    case "scriptHash":
      return { type: "scriptHash", hex: Evolution.ScriptHash.toHex(value as Evolution.ScriptHash.ScriptHash) }
    case "policyId":
      return { type: "policyId", hex: Evolution.PolicyId.toHex(value as Evolution.PolicyId.PolicyId) }
    case "poolKeyHash": {
      const poolKeyHash = value as Evolution.PoolKeyHash.PoolKeyHash
      return {
        type: "poolKeyHash",
        hex: Evolution.PoolKeyHash.toHex(poolKeyHash),
        bech32: Evolution.PoolKeyHash.toBech32(poolKeyHash)
      }
    }
    case "datumHash":
      return { type: "datumHash", hex: Evolution.DatumHash.toHex(value as Evolution.DatumHash.DatumHash) }
    case "transactionHash":
      return { type: "transactionHash", hex: Evolution.TransactionHash.toHex(value as Evolution.TransactionHash.TransactionHash) }
    case "credential":
      return serializeCredential(value as Evolution.Credential.Credential)
    case "drep":
      return serializeDRep(value as Evolution.DRep.DRep)
  }
}

const parseIdentifier = (
  kind: z.infer<typeof IdentifierKindSchema>,
  value: string,
  format: "hex" | "bech32" | "cbor"
):
  | Evolution.KeyHash.KeyHash
  | Evolution.ScriptHash.ScriptHash
  | Evolution.PolicyId.PolicyId
  | Evolution.PoolKeyHash.PoolKeyHash
  | Evolution.DatumHash.DatumHash
  | Evolution.TransactionHash.TransactionHash
  | Evolution.Credential.Credential
  | Evolution.DRep.DRep => {
  switch (kind) {
    case "keyHash":
      if (format !== "hex") throw new Error("keyHash only supports hex input")
      return Evolution.KeyHash.fromHex(value)
    case "scriptHash":
      if (format !== "hex") throw new Error("scriptHash only supports hex input")
      return Evolution.ScriptHash.fromHex(value)
    case "policyId":
      if (format !== "hex") throw new Error("policyId only supports hex input")
      return Evolution.PolicyId.fromHex(value)
    case "poolKeyHash":
      if (format === "hex") return Evolution.PoolKeyHash.fromHex(value)
      if (format === "bech32") return Evolution.PoolKeyHash.fromBech32(value)
      throw new Error("poolKeyHash supports hex or bech32 input")
    case "datumHash":
      if (format !== "hex") throw new Error("datumHash only supports hex input")
      return Evolution.DatumHash.fromHex(value)
    case "transactionHash":
      if (format !== "hex") throw new Error("transactionHash only supports hex input")
      return Evolution.TransactionHash.fromHex(value)
    case "credential":
      if (format !== "cbor") throw new Error("credential only supports cbor input")
      return Evolution.Credential.fromCBORHex(value)
    case "drep":
      if (format === "hex") return Evolution.Schema.decodeSync(Evolution.DRep.FromHex)(value)
      if (format === "bech32") return Evolution.Schema.decodeSync(Evolution.DRep.FromBech32)(value)
      if (format === "cbor") return Evolution.DRep.fromCBORHex(value)
      throw new Error("drep supports hex, bech32, or cbor input")
  }
}

const serializeAssets = (assets: Evolution.Assets.Assets) => {
  const record: Record<string, string> = {
    lovelace: assets.lovelace.toString()
  }

  if (assets.multiAsset) {
    for (const [policyId, assetMap] of assets.multiAsset.map.entries()) {
      const policyIdHex = Evolution.PolicyId.toHex(policyId)
      for (const [assetName, quantity] of assetMap.entries()) {
        const assetNameHex = Evolution.AssetName.toHex(assetName)
        record[`${policyIdHex}${assetNameHex}`] = quantity.toString()
      }
    }
  }

  return {
    record,
    json: toStructured(assets.toJSON()),
    isZero: Evolution.Assets.isZero(assets),
    allPositive: Evolution.Assets.allPositive(assets)
  }
}

const listExportMembers = (exportName: string) => {
  const exportValue = (Evolution as Record<string, unknown>)[exportName]

  if (exportValue === undefined) {
    throw new Error(`Unknown public export: ${exportName}`)
  }

  if ((typeof exportValue !== "object" || exportValue === null) && typeof exportValue !== "function") {
    return [{ name: exportName, type: typeof exportValue, callable: false }]
  }

  return Object.entries(exportValue as Record<string, unknown>)
    .map(([name, member]) => ({
      name,
      type: typeof member,
      callable: typeof member === "function"
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

const getClientCapabilities = (client: unknown) => ({
  canAttachProvider: hasMethod(client, "attachProvider"),
  canAttachWallet: hasMethod(client, "attachWallet"),
  canBuildTransactions: hasMethod(client, "newTx"),
  hasProviderQueries: hasMethod(client, "getProtocolParameters"),
  hasAddress: hasMethod(client, "address"),
  hasRewardAddress: hasMethod(client, "rewardAddress"),
  hasWalletUtxos: hasMethod(client, "getWalletUtxos"),
  hasWalletDelegation: hasMethod(client, "getWalletDelegation"),
  canSubmitTransaction: hasMethod(client, "submitTx")
})

const createServerResourceContents = () => ({
  uri: "evolution://catalog",
  mimeType: "application/json",
  text: JSON.stringify(
    {
      package: implementation,
      toolGroups: [
        "sdk_info",
        "sdk_exports",
        "destroy_handle",
        "address_codec",
        "assets_codec",
        "cbor_codec",
        "data_codec",
        "identifier_codec",
        "typed_export_codec",
        "transaction_codec",
        "witness_set_codec",
        "script_codec",
        "evaluator_info",
        "create_client",
        "client_attach_provider",
        "client_attach_wallet",
        "client_invoke",
        "tx_builder_create",
        "tx_builder_apply",
        "tx_builder_build",
        "sign_result_call",
        "submit_builder_call",
        "time_slot_convert",
        "blueprint_parse",
        "blueprint_codegen",
        "message_sign",
        "message_verify",
        "fee_validate",
        "cip68_codec",
        "key_generate",
        "native_script_tools",
        "utxo_tools",
        "bech32_codec",
        "bytes_codec",
        "address_build",
        "metadata_tools",
        "credential_tools",
        "drep_tools",
        "value_tools",
        "assets_tools",
        "unit_tools",
        "coin_tools",
        "network_tools",
        "data_construct",
        "hash_tools",
        "devnet_create",
        "devnet_start",
        "devnet_stop",
        "devnet_remove",
        "devnet_status",
        "devnet_exec",
        "devnet_genesis_utxos",
        "devnet_query_epoch",
        "devnet_config_defaults"
      ],
      notes: [
        "Handles are opaque server-side session identifiers.",
        "Client and builder APIs are intentionally grouped into workflow tools.",
        "The current package covers stateless codecs, evaluators, time/slot conversion, CIP-57 blueprint parsing/codegen, CIP-8/CIP-30 message signing, fee validation, CIP-68 metadata codec, key generation/derivation, native script building, UTxO set operations, bech32/bytes codecs, address building from credentials, transaction metadata/AuxiliaryData construction, credential building, DRep governance tools, Value/Assets arithmetic and construction, CIP-67 unit/label tools, Coin arithmetic, network ID conversion, Plutus Data construction/matching, transaction hashing, client sessions, provider access, transaction building/signing flows, and local devnet management.",
        "Use sdk_exports to inspect the current public @evolution-sdk/evolution export surface at runtime."
      ],
      publicExports: evolutionExports
    },
    null,
    2
  )
})

export const createEvolutionMcpServer = (): McpServer => {
  const server = new McpServer(implementation, {
    capabilities: {
      tools: {},
      resources: {}
    }
  })

  server.registerResource(
    "evolution-catalog",
    "evolution://catalog",
    {
      description: "Current Evolution MCP tool catalog",
      mimeType: "application/json"
    },
    async () => ({
      contents: [createServerResourceContents()]
    })
  )

  server.registerTool(
    "sdk_info",
    {
      description: "Return Evolution MCP server metadata, session counts, and high-level tool groups"
    },
    async () => {
      const result = {
        implementation,
        sessionStats: sessionStore.stats(),
        exportCount: evolutionExports.length,
        currentScope: [
          "public export introspection",
          "stateless codecs",
          "cbor and plutus data codecs",
          "client sessions",
          "provider queries",
          "transaction builder sessions",
          "sign/submit flows"
        ]
      }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "sdk_exports",
    {
      description: "List the public @evolution-sdk/evolution root exports or inspect the members of one export",
      inputSchema: z.object({
        exportName: ExportNameSchema.optional()
      })
    },
    async ({ exportName }) => {
      const result = exportName
        ? {
            exportName,
            members: listExportMembers(exportName)
          }
        : {
            exports: evolutionExports,
            total: evolutionExports.length
          }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "destroy_handle",
    {
      description: "Delete a previously created MCP session handle",
      inputSchema: z.object({ handle: z.string() })
    },
    async ({ handle }) => {
      const deleted = sessionStore.delete(handle)
      const result = { handle, deleted, sessionStats: sessionStore.stats() }
      return toolTextResult(result)
    }
  )

  server.registerTool(
    "address_codec",
    {
      description: "Inspect or convert public Address values using the Evolution Address module",
      inputSchema: z.object({
        action: z.enum(["inspect", "toBech32", "toHex"]),
        value: z.string()
      })
    },
    async ({ action, value }) => {
      const parsed = parseAddressInput(value)
      const result =
        action === "inspect"
          ? {
              details: toStructured(
                Evolution.Address.getAddressDetails(value) ?? {
                  address: {
                    bech32: Evolution.Address.toBech32(parsed),
                    hex: Evolution.Address.toHex(parsed)
                  },
                  networkId: Evolution.Address.getNetworkId(parsed),
                  type: Evolution.Address.isEnterprise(parsed) ? "Enterprise" : "Base",
                  paymentCredential: parsed.paymentCredential.toJSON(),
                  stakingCredential: parsed.stakingCredential?.toJSON()
                }
              )
            }
          : action === "toBech32"
            ? { bech32: Evolution.Address.toBech32(parsed) }
            : { hex: Evolution.Address.toHex(parsed) }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "assets_codec",
    {
      description: "Inspect and combine public Assets values using record-shaped inputs",
      inputSchema: z.object({
        action: z.enum(["inspect", "merge", "subtract", "negate", "addByHex"]),
        record: AssetRecordSchema.optional(),
        left: AssetRecordSchema.optional(),
        right: AssetRecordSchema.optional(),
        delta: AssetDeltaSchema.optional()
      })
    },
    async ({ action, record, left, right, delta }) => {
      let result: ToolResultObject

      switch (action) {
        case "inspect": {
          if (!record) {
            throw new Error("record is required for inspect")
          }
          result = { assets: serializeAssets(parseAssets(record as AssetRecordInput)) }
          break
        }
        case "merge": {
          if (!left || !right) {
            throw new Error("left and right are required for merge")
          }
          result = {
            assets: serializeAssets(
              Evolution.Assets.merge(parseAssets(left as AssetRecordInput), parseAssets(right as AssetRecordInput))
            )
          }
          break
        }
        case "subtract": {
          if (!left || !right) {
            throw new Error("left and right are required for subtract")
          }
          result = {
            assets: serializeAssets(
              Evolution.Assets.subtract(parseAssets(left as AssetRecordInput), parseAssets(right as AssetRecordInput))
            )
          }
          break
        }
        case "negate": {
          if (!record) {
            throw new Error("record is required for negate")
          }
          result = { assets: serializeAssets(Evolution.Assets.negate(parseAssets(record as AssetRecordInput))) }
          break
        }
        case "addByHex": {
          if (!record || !delta) {
            throw new Error("record and delta are required for addByHex")
          }
          result = {
            assets: serializeAssets(
              Evolution.Assets.addByHex(
                parseAssets(record as AssetRecordInput),
                delta.policyIdHex,
                delta.assetNameHex,
                parseBigInt(delta.quantity)
              )
            )
          }
          break
        }
      }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "cbor_codec",
    {
      description: "Decode, inspect, compare, and encode public CBOR values using an MCP-friendly tagged JSON shape",
      inputSchema: z.object({
        action: z.enum(["decode", "decodeWithFormat", "encode", "reencode", "equals"]),
        cborHex: z.string().optional(),
        leftCborHex: z.string().optional(),
        rightCborHex: z.string().optional(),
        value: z.unknown().optional(),
        optionsPreset: CborOptionsPresetSchema
      })
    },
    async ({ action, cborHex, leftCborHex, rightCborHex, value, optionsPreset }) => {
      const options = resolveCborOptions(optionsPreset)

      const result =
        action === "decode"
          ? (() => {
              if (!cborHex) {
                throw new Error("cborHex is required for decode")
              }
              return { value: serializeCborValue(Evolution.CBOR.fromCBORHex(cborHex, options)) }
            })()
          : action === "decodeWithFormat"
            ? (() => {
                if (!cborHex) {
                  throw new Error("cborHex is required for decodeWithFormat")
                }
                const decoded = Evolution.CBOR.fromCBORHexWithFormat(cborHex)
                return {
                  value: serializeCborValue(decoded.value),
                  format: serializeCborFormat(decoded.format)
                }
              })()
            : action === "encode"
              ? (() => {
                  if (value === undefined) {
                    throw new Error("value is required for encode")
                  }
                  const parsed = parseStructuredCbor(value)
                  return {
                    cborHex: Evolution.CBOR.toCBORHex(parsed, options),
                    value: serializeCborValue(parsed)
                  }
                })()
              : action === "reencode"
                ? (() => {
                    if (!cborHex) {
                      throw new Error("cborHex is required for reencode")
                    }
                    const parsed = Evolution.CBOR.fromCBORHex(cborHex, options)
                    return {
                      cborHex: Evolution.CBOR.toCBORHex(parsed, options),
                      value: serializeCborValue(parsed)
                    }
                  })()
                : (() => {
                    if (!leftCborHex || !rightCborHex) {
                      throw new Error("leftCborHex and rightCborHex are required for equals")
                    }
                    return {
                      equal: Evolution.CBOR.equals(
                        Evolution.CBOR.fromCBORHex(leftCborHex, options),
                        Evolution.CBOR.fromCBORHex(rightCborHex, options)
                      )
                    }
                  })()

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "data_codec",
    {
      description: "Decode, encode, hash, and compare public Plutus Data values using an MCP-friendly tagged JSON shape",
      inputSchema: z.object({
        action: z.enum(["decode", "encode", "reencode", "hashData", "equals"]),
        dataCborHex: z.string().optional(),
        leftDataCborHex: z.string().optional(),
        rightDataCborHex: z.string().optional(),
        value: z.unknown().optional(),
        optionsPreset: CborOptionsPresetSchema
      })
    },
    async ({ action, dataCborHex, leftDataCborHex, rightDataCborHex, value, optionsPreset }) => {
      const options = resolveCborOptions(optionsPreset, Evolution.CBOR.CML_DATA_DEFAULT_OPTIONS)

      const result =
        action === "decode"
          ? (() => {
              if (!dataCborHex) {
                throw new Error("dataCborHex is required for decode")
              }
              return { data: serializeDataValue(Evolution.Data.fromCBORHex(dataCborHex, options)) }
            })()
          : action === "encode"
            ? (() => {
                if (value === undefined) {
                  throw new Error("value is required for encode")
                }
                const parsed = parseStructuredData(value)
                return {
                  cborHex: Evolution.Data.toCBORHex(parsed, options),
                  data: serializeDataValue(parsed)
                }
              })()
            : action === "reencode"
              ? (() => {
                  if (!dataCborHex) {
                    throw new Error("dataCborHex is required for reencode")
                  }
                  const parsed = Evolution.Data.fromCBORHex(dataCborHex, options)
                  return {
                    cborHex: Evolution.Data.toCBORHex(parsed, options),
                    data: serializeDataValue(parsed)
                  }
                })()
              : action === "hashData"
                ? (() => {
                    const parsed = dataCborHex
                      ? Evolution.Data.fromCBORHex(dataCborHex, options)
                      : value === undefined
                        ? (() => {
                            throw new Error("dataCborHex or value is required for hashData")
                          })()
                        : parseStructuredData(value)

                    const datumHash = Evolution.Data.hashData(parsed, options)
                    return {
                      data: serializeDataValue(parsed),
                      datumHash: datumHash.toJSON().hash,
                      structuralHash: Evolution.Data.hash(parsed)
                    }
                  })()
                : (() => {
                    if (!leftDataCborHex || !rightDataCborHex) {
                      throw new Error("leftDataCborHex and rightDataCborHex are required for equals")
                    }
                    return {
                      equal: Evolution.Data.equals(
                        Evolution.Data.fromCBORHex(leftDataCborHex, options),
                        Evolution.Data.fromCBORHex(rightDataCborHex, options)
                      )
                    }
                  })()

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "identifier_codec",
    {
      description: "Inspect and convert public identifier exports including hashes, credentials, and DReps",
      inputSchema: z.object({
        kind: IdentifierKindSchema,
        action: z.enum(["decode", "encode", "equals"]),
        input: z.string().optional(),
        inputFormat: z.enum(["hex", "bech32", "cbor"]).optional(),
        left: z.string().optional(),
        leftFormat: z.enum(["hex", "bech32", "cbor"]).optional(),
        right: z.string().optional(),
        rightFormat: z.enum(["hex", "bech32", "cbor"]).optional(),
        value: z.unknown().optional()
      })
    },
    async ({ kind, action, input, inputFormat, left, leftFormat, right, rightFormat, value }) => {
      const result =
        action === "decode"
          ? (() => {
              if (!input || !inputFormat) {
                throw new Error("input and inputFormat are required for decode")
              }
              return {
                identifier: serializeIdentifier(kind, parseIdentifier(kind, input, inputFormat))
              }
            })()
          : action === "encode"
            ? (() => {
                if (value === undefined) {
                  throw new Error("value is required for encode")
                }

                const encoded =
                  kind === "credential"
                    ? serializeCredential(parseStructuredCredential(value))
                    : kind === "drep"
                      ? serializeDRep(parseStructuredDRep(value))
                      : (() => {
                          throw new Error("encode is only supported for credential and drep structured values")
                        })()

                return { identifier: encoded }
              })()
            : (() => {
                if (!left || !leftFormat || !right || !rightFormat) {
                  throw new Error("left, leftFormat, right, and rightFormat are required for equals")
                }

                const leftIdentifier = serializeIdentifier(kind, parseIdentifier(kind, left, leftFormat))
                const rightIdentifier = serializeIdentifier(kind, parseIdentifier(kind, right, rightFormat))

                return {
                  equal: JSON.stringify(leftIdentifier) === JSON.stringify(rightIdentifier),
                  left: leftIdentifier,
                  right: rightIdentifier
                }
              })()

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "typed_export_codec",
    {
      description:
        "Decode or re-encode any Evolution SDK typed export that has fromCBORHex / toCBORHex. " +
        "Use sdk_exports to verify a module exists, then pass its name here. " +
        "Covers Certificate, Redeemer, TransactionBody, TransactionOutput, Value, Mint, " +
        "ProposalProcedure, VotingProcedures, AuxiliaryData, and many more.",
      inputSchema: z.object({
        moduleName: z.string().refine((value) => typedExportModules.has(value), {
          message: `Module must be one of: ${typedExportModuleNames.join(", ")}`
        }),
        action: z.enum(["decode", "reencode", "listModules"]),
        cborHex: z.string().optional(),
        cborOptionsPreset: CborOptionsPresetSchema
      })
    },
    async ({ moduleName, action, cborHex, cborOptionsPreset }) => {
      if (action === "listModules") {
        return toolTextResult({ modules: typedExportModuleNames })
      }

      if (!cborHex) {
        throw new Error("cborHex is required for decode and reencode actions")
      }

      const mod = typedExportModules.get(moduleName)
      if (!mod) {
        throw new Error(`Module ${moduleName} does not support typed CBOR codec`)
      }

      const options = resolveCborOptions(cborOptionsPreset)
      const decoded = mod.fromCBORHex(cborHex, options)

      if (action === "reencode") {
        const reencoded = mod.toCBORHex(decoded, options)
        return toolTextResult({ moduleName, cborHex: reencoded })
      }

      const json = hasMethod(decoded, "toJSON") ? toStructured(decoded.toJSON()) : toStructured(decoded)

      return toolTextResult({ moduleName, json, cborHex: mod.toCBORHex(decoded, options) })
    }
  )

  server.registerTool(
    "transaction_codec",
    {
      description: "Decode, re-encode, or add witnesses to public Transaction CBOR hex values",
      inputSchema: z.object({
        action: z.enum(["decode", "reencode", "addVKeyWitnessesHex"]),
        transactionCborHex: z.string(),
        witnessSetCborHex: z.string().optional()
      })
    },
    async ({ action, transactionCborHex, witnessSetCborHex }) => {
      const result =
        action === "decode"
          ? {
              transaction: serializeTransaction(Evolution.Transaction.fromCBORHex(transactionCborHex))
            }
          : action === "reencode"
            ? {
                cborHex: Evolution.Transaction.toCBORHex(Evolution.Transaction.fromCBORHex(transactionCborHex))
              }
            : (() => {
                if (!witnessSetCborHex) {
                  throw new Error("witnessSetCborHex is required for addVKeyWitnessesHex")
                }

                const merged = Evolution.Transaction.addVKeyWitnessesHex(transactionCborHex, witnessSetCborHex)
                return {
                  cborHex: merged,
                  transaction: serializeTransaction(Evolution.Transaction.fromCBORHex(merged))
                }
              })()

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "witness_set_codec",
    {
      description: "Decode or re-encode public TransactionWitnessSet CBOR hex values",
      inputSchema: z.object({
        action: z.enum(["decode", "reencode"]),
        witnessSetCborHex: z.string()
      })
    },
    async ({ action, witnessSetCborHex }) => {
      const witnessSet = Evolution.TransactionWitnessSet.fromCBORHex(witnessSetCborHex)
      const result =
        action === "decode"
          ? {
              witnessSet: serializeWitnessSet(witnessSet)
            }
          : {
              cborHex: Evolution.TransactionWitnessSet.toCBORHex(witnessSet)
            }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "script_codec",
    {
      description: "Decode or re-encode public Script CBOR hex values",
      inputSchema: z.object({
        action: z.enum(["decode", "reencode"]),
        scriptCborHex: z.string()
      })
    },
    async ({ action, scriptCborHex }) => {
      const script = Evolution.Script.fromCBORHex(scriptCborHex)
      const result =
        action === "decode"
          ? {
              script: toStructured(script)
            }
          : {
              cborHex: Evolution.Script.toCBORHex(script)
            }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "create_client",
    {
      description: "Create an Evolution client session from provider and wallet configuration",
      inputSchema: z.object({
        network: NetworkSchema.optional(),
        provider: ProviderConfigSchema.optional(),
        wallet: WalletConfigSchema.optional(),
        slotConfig: SlotConfigSchema
      })
    },
    async ({ network, provider, wallet, slotConfig }) => {
      const config = {
        ...(network !== undefined ? { network } : undefined),
        ...(provider ? { provider } : undefined),
        ...(wallet ? { wallet } : undefined),
        ...(slotConfig
          ? {
              slotConfig: {
                zeroTime: parseBigInt(slotConfig.zeroTime),
                zeroSlot: parseBigInt(slotConfig.zeroSlot),
                slotLength: slotConfig.slotLength
              }
            }
          : undefined)
      }

      const client = Evolution.createClient(config)
      const capabilities = getClientCapabilities(client)
      const clientHandle = sessionStore.createClient(client, capabilities)
      const result = { clientHandle, capabilities }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "client_attach_provider",
    {
      description: "Attach a provider to an existing client session that supports attachProvider",
      inputSchema: z.object({
        clientHandle: z.string(),
        provider: ProviderConfigSchema
      })
    },
    async ({ clientHandle, provider }) => {
      const session = sessionStore.getClient(clientHandle)
      if (!hasMethod(session.client, "attachProvider")) {
        throw new Error(`Client handle ${clientHandle} does not support attachProvider()`)
      }

      const attached = session.client.attachProvider(provider)
      const capabilities = getClientCapabilities(attached)
      const attachedClientHandle = sessionStore.createClient(attached, capabilities)
      const result = { attachedClientHandle, capabilities }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "client_attach_wallet",
    {
      description: "Attach a wallet to an existing client session that supports attachWallet",
      inputSchema: z.object({
        clientHandle: z.string(),
        wallet: WalletConfigSchema
      })
    },
    async ({ clientHandle, wallet }) => {
      const session = sessionStore.getClient(clientHandle)
      if (!hasMethod(session.client, "attachWallet")) {
        throw new Error(`Client handle ${clientHandle} does not support attachWallet()`)
      }

      const attached = session.client.attachWallet(wallet)
      const capabilities = getClientCapabilities(attached)
      const attachedClientHandle = sessionStore.createClient(attached, capabilities)
      const result = { attachedClientHandle, capabilities }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "client_invoke",
    {
      description: "Invoke a supported client-level wallet or provider method using a client handle",
      inputSchema: z.object({
        clientHandle: z.string(),
        method: z.enum([
          "address",
          "rewardAddress",
          "getProtocolParameters",
          "getWalletUtxos",
          "getWalletDelegation",
          "getUtxos",
          "getUtxosWithUnit",
          "getUtxoByUnit",
          "submitTx",
          "awaitTx",
          "evaluateTx"
        ]),
        address: z.string().optional(),
        unit: z.string().optional(),
        transactionCborHex: z.string().optional(),
        txHash: z.string().optional(),
        checkInterval: z.number().int().positive().optional(),
        timeout: z.number().int().positive().optional()
      })
    },
    async ({ clientHandle, method, address, unit, transactionCborHex, txHash, checkInterval, timeout }) => {
      const { client } = sessionStore.getClient(clientHandle)

      let result: ToolResultObject
      switch (method) {
        case "address":
          if (!hasMethod(client, "address")) {
            throw new Error(`Client handle ${clientHandle} does not expose address()`)
          }
          result = { address: serializeAddress(await client.address()) }
          break
        case "rewardAddress":
          if (!hasMethod(client, "rewardAddress")) {
            throw new Error(`Client handle ${clientHandle} does not expose rewardAddress()`)
          }
          result = { rewardAddress: (await client.rewardAddress()) ?? null }
          break
        case "getProtocolParameters":
          if (!hasMethod(client, "getProtocolParameters")) {
            throw new Error(`Client handle ${clientHandle} does not expose getProtocolParameters()`)
          }
          result = serializeProtocolParameters(await client.getProtocolParameters()) as ToolResultObject
          break
        case "getWalletUtxos":
          if (!hasMethod(client, "getWalletUtxos")) {
            throw new Error(`Client handle ${clientHandle} does not expose getWalletUtxos()`)
          }
          result = { utxos: serializeUtxos(await client.getWalletUtxos()) }
          break
        case "getWalletDelegation":
          if (!hasMethod(client, "getWalletDelegation")) {
            throw new Error(`Client handle ${clientHandle} does not expose getWalletDelegation()`)
          }
          result = serializeDelegation(await client.getWalletDelegation())
          break
        case "getUtxos":
          if (!hasMethod(client, "getUtxos")) {
            throw new Error(`Client handle ${clientHandle} does not expose getUtxos()`)
          }
          if (!address) {
            throw new Error("address is required for getUtxos")
          }
          result = { utxos: serializeUtxos(await client.getUtxos(parseAddress(address))) }
          break
        case "getUtxosWithUnit":
          if (!hasMethod(client, "getUtxosWithUnit")) {
            throw new Error(`Client handle ${clientHandle} does not expose getUtxosWithUnit()`)
          }
          if (!address || !unit) {
            throw new Error("address and unit are required for getUtxosWithUnit")
          }
          result = { utxos: serializeUtxos(await client.getUtxosWithUnit(parseAddress(address), unit)) }
          break
        case "getUtxoByUnit":
          if (!hasMethod(client, "getUtxoByUnit")) {
            throw new Error(`Client handle ${clientHandle} does not expose getUtxoByUnit()`)
          }
          if (!unit) {
            throw new Error("unit is required for getUtxoByUnit")
          }
          result = { utxo: serializeUtxos([await client.getUtxoByUnit(unit)])[0] }
          break
        case "submitTx":
          if (!hasMethod(client, "submitTx")) {
            throw new Error(`Client handle ${clientHandle} does not expose submitTx()`)
          }
          if (!transactionCborHex) {
            throw new Error("transactionCborHex is required for submitTx")
          }
          result = { txHash: serializeTransactionHash(await client.submitTx(parseTransaction(transactionCborHex))) }
          break
        case "awaitTx":
          if (!hasMethod(client, "awaitTx")) {
            throw new Error(`Client handle ${clientHandle} does not expose awaitTx()`)
          }
          if (!txHash) {
            throw new Error("txHash is required for awaitTx")
          }
          result = {
            confirmed: await client.awaitTx(Evolution.TransactionHash.fromHex(txHash), checkInterval, timeout)
          }
          break
        case "evaluateTx":
          if (!hasMethod(client, "evaluateTx")) {
            throw new Error(`Client handle ${clientHandle} does not expose evaluateTx()`)
          }
          if (!transactionCborHex) {
            throw new Error("transactionCborHex is required for evaluateTx")
          }
          result = { evaluation: toStructured(await client.evaluateTx(parseTransaction(transactionCborHex))) }
          break
      }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "tx_builder_create",
    {
      description: "Create a transaction builder session from a client handle",
      inputSchema: z.object({
        clientHandle: z.string(),
        availableUtxos: z.array(UtxoInputSchema).optional()
      })
    },
    async ({ clientHandle, availableUtxos }) => {
      const { client } = sessionStore.getClient(clientHandle)
      if (!hasMethod(client, "newTx")) {
        throw new Error(`Client handle ${clientHandle} does not expose newTx()`)
      }

      const builder = availableUtxos ? client.newTx(parseUtxos(availableUtxos)) : client.newTx()
      const builderHandle = sessionStore.createBuilder(builder, clientHandle)
      const result = { builderHandle, operations: [] }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "tx_builder_apply",
    {
      description: "Apply a supported transaction builder operation to a builder handle",
      inputSchema: z.object({
        builderHandle: z.string(),
        operation: z.enum(["payToAddress", "collectFrom", "readFrom", "mintAssets", "setValidity", "sendAll"]),
        address: z.string().optional(),
        assets: AssetRecordSchema.optional(),
        utxos: z.array(UtxoInputSchema).optional(),
        fromUnixMs: z.union([z.string(), z.number().int()]).optional(),
        toUnixMs: z.union([z.string(), z.number().int()]).optional(),
        datumOptionCborHex: z.string().optional(),
        scriptCborHex: z.string().optional()
      })
    },
    async ({ builderHandle, operation, address, assets, utxos, fromUnixMs, toUnixMs, datumOptionCborHex, scriptCborHex }) => {
      const session = sessionStore.getBuilder(builderHandle)
      const builder = session.builder as Record<string, (...args: Array<any>) => unknown>

      switch (operation) {
        case "payToAddress":
          if (!address || !assets) {
            throw new Error("address and assets are required for payToAddress")
          }
          builder.payToAddress({
            address: parseAddress(address),
            assets: parseAssets(assets as AssetRecordInput),
            datum: datumOptionCborHex ? Evolution.DatumOption.fromCBORHex(datumOptionCborHex) : undefined,
            script: scriptCborHex ? Evolution.Script.fromCBORHex(scriptCborHex) : undefined
          })
          break
        case "collectFrom":
          if (!utxos) {
            throw new Error("utxos are required for collectFrom")
          }
          builder.collectFrom({ inputs: parseUtxos(utxos as Array<UtxoInput>) })
          break
        case "readFrom":
          if (!utxos) {
            throw new Error("utxos are required for readFrom")
          }
          builder.readFrom({ referenceInputs: parseUtxos(utxos as Array<UtxoInput>) })
          break
        case "mintAssets":
          if (!assets) {
            throw new Error("assets are required for mintAssets")
          }
          builder.mintAssets({ assets: parseAssets(assets as AssetRecordInput) })
          break
        case "setValidity":
          builder.setValidity({
            from: fromUnixMs === undefined ? undefined : parseBigInt(fromUnixMs),
            to: toUnixMs === undefined ? undefined : parseBigInt(toUnixMs)
          })
          break
        case "sendAll":
          if (!address) {
            throw new Error("address is required for sendAll")
          }
          builder.sendAll({ to: parseAddress(address) })
          break
      }

      sessionStore.updateBuilderOperations(builderHandle, operation)
      const result = { builderHandle, operations: [...session.operations, operation] }
      return toolTextResult(result)
    }
  )

  server.registerTool(
    "tx_builder_build",
    {
      description: "Build a transaction from a builder handle and return a result handle",
      inputSchema: z.object({
        builderHandle: z.string(),
        evaluator: EvaluatorSchema.describe("UPLC evaluator for Plutus scripts: 'aiken' or 'scalus'"),
        buildOptions: z
          .object({
            changeAddress: z.string().optional(),
            availableUtxos: z.array(UtxoInputSchema).optional(),
            protocolParameters: ProtocolParametersSchema.optional(),
            coinSelection: z.enum(["largest-first", "random-improve", "optimal"]).optional()
          })
          .optional()
      })
    },
    async ({ builderHandle, evaluator, buildOptions }) => {
      const session = sessionStore.getBuilder(builderHandle)
      const builder = session.builder as { build: (options?: Record<string, unknown>) => Promise<unknown> }

      const resolvedEvaluator = resolveEvaluator(evaluator)

      const parsedOptions = buildOptions
        ? {
            ...(buildOptions.changeAddress ? { changeAddress: parseAddress(buildOptions.changeAddress) } : undefined),
            ...(buildOptions.availableUtxos ? { availableUtxos: parseUtxos(buildOptions.availableUtxos) } : undefined),
            ...(buildOptions.protocolParameters
              ? { protocolParameters: parseProtocolParameters(buildOptions.protocolParameters as ProtocolParametersInput) }
              : undefined),
            ...(buildOptions.coinSelection ? { coinSelection: buildOptions.coinSelection } : undefined),
            ...(resolvedEvaluator ? { evaluator: resolvedEvaluator } : undefined)
          }
        : resolvedEvaluator
          ? { evaluator: resolvedEvaluator }
          : undefined

      const built = await builder.build(parsedOptions)
      const transaction = await (built as { toTransaction: () => Promise<Evolution.Transaction.Transaction> }).toTransaction()
      const estimatedFee = await (built as { estimateFee: () => Promise<bigint> }).estimateFee()

      const isSignBuilder = hasMethod(built, "sign")
      const resultHandle = sessionStore.createResult(
        built,
        isSignBuilder ? "sign-builder" : "transaction-result",
        builderHandle
      )

      const result = {
        resultHandle,
        resultType: isSignBuilder ? "sign-builder" : "transaction-result",
        estimatedFee: estimatedFee.toString(),
        transaction: serializeTransaction(transaction),
        chainResult:
          isSignBuilder && hasMethod(built, "chainResult")
            ? (() => {
                const chainResult = built.chainResult()
                return {
                  consumed: serializeUtxos(chainResult.consumed),
                  available: serializeUtxos(chainResult.available),
                  txHash: chainResult.txHash
                }
              })()
            : null
      }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "sign_result_call",
    {
      description: "Invoke a supported SignBuilder or TransactionResult method on a result handle",
      inputSchema: z.object({
        resultHandle: z.string(),
        action: z.enum([
          "toTransaction",
          "toTransactionWithFakeWitnesses",
          "estimateFee",
          "chainResult",
          "sign",
          "signAndSubmit",
          "partialSign",
          "getWitnessSet",
          "signWithWitness",
          "assemble"
        ]),
        witnessSetCborHex: z.string().optional(),
        witnessSetsCborHex: z.array(z.string()).optional()
      })
    },
    async ({ resultHandle, action, witnessSetCborHex, witnessSetsCborHex }) => {
      const session = sessionStore.getResult(resultHandle)
      const resultBuilder = session.result as Record<string, (...args: Array<any>) => Promise<any>>

      if (session.resultType !== "sign-builder" && !["toTransaction", "toTransactionWithFakeWitnesses", "estimateFee"].includes(action)) {
        throw new Error(`Result handle ${resultHandle} is not a SignBuilder`)
      }

      let result: ToolResultObject
      switch (action) {
        case "toTransaction":
          result = { transaction: serializeTransaction(await resultBuilder.toTransaction()) }
          break
        case "toTransactionWithFakeWitnesses":
          result = { transaction: serializeTransaction(await resultBuilder.toTransactionWithFakeWitnesses()) }
          break
        case "estimateFee":
          result = { estimatedFee: (await resultBuilder.estimateFee()).toString() }
          break
        case "chainResult": {
          const chainResult = (session.result as {
            chainResult: () => {
              readonly consumed: ReadonlyArray<Evolution.UTxO.UTxO>
              readonly available: ReadonlyArray<Evolution.UTxO.UTxO>
              readonly txHash: string
            }
          }).chainResult()
          result = {
            consumed: serializeUtxos(chainResult.consumed),
            available: serializeUtxos(chainResult.available),
            txHash: chainResult.txHash
          }
          break
        }
        case "sign": {
          const submitBuilder = await resultBuilder.sign()
          const submitHandle = sessionStore.createSubmit(submitBuilder, resultHandle)
          result = {
            submitHandle,
            witnessSet: serializeWitnessSet((submitBuilder as SubmitBuilderLike).witnessSet)
          }
          break
        }
        case "signAndSubmit":
          result = { txHash: serializeTransactionHash(await resultBuilder.signAndSubmit()) }
          break
        case "partialSign":
          result = { witnessSet: serializeWitnessSet(await resultBuilder.partialSign()) }
          break
        case "getWitnessSet":
          result = { witnessSet: serializeWitnessSet(await resultBuilder.getWitnessSet()) }
          break
        case "signWithWitness": {
          if (!witnessSetCborHex) {
            throw new Error("witnessSetCborHex is required for signWithWitness")
          }
          const submitBuilder = await resultBuilder.signWithWitness(parseWitnessSet(witnessSetCborHex))
          const submitHandle = sessionStore.createSubmit(submitBuilder, resultHandle)
          result = {
            submitHandle,
            witnessSet: serializeWitnessSet((submitBuilder as SubmitBuilderLike).witnessSet)
          }
          break
        }
        case "assemble": {
          if (!witnessSetsCborHex || witnessSetsCborHex.length === 0) {
            throw new Error("witnessSetsCborHex is required for assemble")
          }
          const submitBuilder = await resultBuilder.assemble(witnessSetsCborHex.map(parseWitnessSet))
          const submitHandle = sessionStore.createSubmit(submitBuilder, resultHandle)
          result = {
            submitHandle,
            witnessSet: serializeWitnessSet((submitBuilder as SubmitBuilderLike).witnessSet)
          }
          break
        }
      }

      return toolTextResult(result)
    }
  )

  server.registerTool(
    "submit_builder_call",
    {
      description: "Inspect or submit a SubmitBuilder handle",
      inputSchema: z.object({
        submitHandle: z.string(),
        action: z.enum(["getWitnessSet", "submit"])
      })
    },
    async ({ submitHandle, action }) => {
      const session = sessionStore.getSubmit(submitHandle)
      const submitBuilder = session.submitBuilder as SubmitBuilderLike

      const result =
        action === "getWitnessSet"
          ? { witnessSet: serializeWitnessSet(submitBuilder.witnessSet) }
          : { txHash: serializeTransactionHash(await submitBuilder.submit()) }

      return toolTextResult(result)
    }
  )

  // ── Evaluator info ──────────────────────────────────────────────────────

  server.registerTool(
    "evaluator_info",
    {
      description:
        "List available UPLC evaluators from @evolution-sdk/aiken-uplc and @evolution-sdk/scalus-uplc. " +
        "These can be passed to tx_builder_build via the 'evaluator' parameter.",
      inputSchema: z.object({})
    },
    async () => {
      const evaluators = [
        {
          name: "aiken",
          package: "@evolution-sdk/aiken-uplc",
          description: "Aiken UPLC evaluator (Rust/WASM)",
          available: typeof createAikenEvaluator?.evaluate === "function"
        },
        {
          name: "scalus",
          package: "@evolution-sdk/scalus-uplc",
          description: "Scalus UPLC evaluator (Scala/WASM)",
          available: typeof createScalusEvaluator?.evaluate === "function"
        }
      ]

      return toolTextResult({
        evaluators,
        usage: "Pass evaluator name ('aiken' or 'scalus') to tx_builder_build to enable Plutus script evaluation"
      })
    }
  )

  // ── Time / slot conversion ──────────────────────────────────────────────

  const SlotConfigNetworkSchema = z.enum(["Mainnet", "Preview", "Preprod"])

  server.registerTool(
    "time_slot_convert",
    {
      description:
        "Convert between Cardano slot numbers and Unix timestamps, or get the current slot. " +
        "Actions: 'slotToUnix' converts a slot to a Unix timestamp (ms), " +
        "'unixToSlot' converts a Unix timestamp (ms) to a slot, " +
        "'currentSlot' returns the current slot for a network, " +
        "'getConfig' returns the slot configuration for a network.",
      inputSchema: z.object({
        action: z.enum(["slotToUnix", "unixToSlot", "currentSlot", "getConfig"]),
        network: SlotConfigNetworkSchema.optional().describe("Network name (default: Mainnet)"),
        slot: z.string().optional().describe("Slot number as string (for slotToUnix)"),
        unixTime: z.string().optional().describe("Unix time in milliseconds as string (for unixToSlot)"),
        customConfig: z
          .object({
            zeroTime: z.string().describe("Zero time in ms as string (bigint)"),
            zeroSlot: z.string().describe("Zero slot as string (bigint)"),
            slotLength: z.number().positive().describe("Slot length in ms")
          })
          .optional()
          .describe("Custom slot config (overrides network)")
      })
    },
    async ({ action, network, slot, unixTime, customConfig }) => {
      const slotConfig = customConfig
        ? {
            zeroTime: BigInt(customConfig.zeroTime),
            zeroSlot: BigInt(customConfig.zeroSlot),
            slotLength: customConfig.slotLength
          }
        : Evolution.Time.SLOT_CONFIG_NETWORK[network ?? "Mainnet"]

      switch (action) {
        case "slotToUnix": {
          if (!slot) throw new Error("'slot' is required for slotToUnix")
          const unix = Evolution.Time.slotToUnixTime(BigInt(slot), slotConfig)
          return toolTextResult({
            slot,
            unixTimeMs: unix.toString(),
            isoDate: new Date(Number(unix)).toISOString()
          })
        }
        case "unixToSlot": {
          if (!unixTime) throw new Error("'unixTime' is required for unixToSlot")
          const s = Evolution.Time.unixTimeToSlot(BigInt(unixTime), slotConfig)
          return toolTextResult({ unixTimeMs: unixTime, slot: s.toString() })
        }
        case "currentSlot": {
          const s = Evolution.Time.getCurrentSlot(network ?? "Mainnet")
          return toolTextResult({
            network: network ?? "Mainnet",
            currentSlot: s.toString(),
            currentUnixTimeMs: Date.now().toString()
          })
        }
        case "getConfig": {
          const cfg = customConfig ? slotConfig : Evolution.Time.SLOT_CONFIG_NETWORK[network ?? "Mainnet"]
          return toolTextResult({
            network: customConfig ? "Custom" : (network ?? "Mainnet"),
            zeroTime: cfg.zeroTime.toString(),
            zeroSlot: cfg.zeroSlot.toString(),
            slotLength: cfg.slotLength
          })
        }
      }
    }
  )

  // ── Blueprint tools ─────────────────────────────────────────────────────

  server.registerTool(
    "blueprint_parse",
    {
      description:
        "Parse a CIP-57 Plutus blueprint JSON. Returns the preamble, validator list " +
        "(with compiled code hashes, datum/redeemer types), and definition count.",
      inputSchema: z.object({
        blueprintJson: z.string().describe("The blueprint JSON string")
      })
    },
    async ({ blueprintJson }) => {
      const raw = JSON.parse(blueprintJson) as unknown
      const blueprint = Evolution.Schema.decodeUnknownSync(Evolution.Blueprint.PlutusBlueprint)(raw)

      const validators = blueprint.validators.map((v: any) => ({
        title: v.title,
        hash: v.hash,
        datum: v.datum ?? null,
        redeemer: v.redeemer ?? null,
        compiledCodeSize: v.compiledCode ? v.compiledCode.length : 0
      }))

      return toolTextResult({
        preamble: blueprint.preamble,
        validatorCount: validators.length,
        validators,
        definitionCount: Object.keys(blueprint.definitions ?? {}).length
      })
    }
  )

  server.registerTool(
    "blueprint_codegen",
    {
      description:
        "Generate TypeScript code from a CIP-57 Plutus blueprint JSON. Uses @evolution-sdk/evolution Blueprint codegen.",
      inputSchema: z.object({
        blueprintJson: z.string().describe("The blueprint JSON string"),
        config: z
          .object({
            optionStyle: z.enum(["NullOr", "Option"]).optional(),
            unionStyle: z.enum(["Variant", "TaggedUnion"]).optional(),
            emptyConstructorStyle: z.enum(["Literal", "Unit"]).optional(),
            includeIndex: z.boolean().optional(),
            moduleStrategy: z.enum(["flat", "nested"]).optional(),
            indent: z.string().optional()
          })
          .optional()
          .describe("Optional codegen configuration overrides")
      })
    },
    async ({ blueprintJson, config }) => {
      const raw = JSON.parse(blueprintJson) as unknown
      const blueprint = Evolution.Schema.decodeUnknownSync(Evolution.Blueprint.PlutusBlueprint)(raw)
      const codegenConfig = config
        ? Evolution.Blueprint.createCodegenConfig(config as any)
        : undefined
      const typescript = Evolution.Blueprint.generateTypeScript(blueprint, codegenConfig)

      return toolTextResult({ generatedTypeScript: typescript })
    }
  )

  // ── Message signing tools ───────────────────────────────────────────────

  server.registerTool(
    "message_sign",
    {
      description:
        "Sign arbitrary data with a private key following CIP-8 / CIP-30 message signing. " +
        "Returns a COSE_Sign1 signed message. Suitable for devnet/testing use.",
      inputSchema: z.object({
        addressHex: z.string().describe("Address as hex string"),
        payload: z.string().describe("Payload as hex string"),
        privateKeyHex: z.string().describe("Ed25519 private key as hex string")
      })
    },
    async ({ addressHex, payload, privateKeyHex }) => {
      const privateKey = Evolution.PrivateKey.fromHex(privateKeyHex)
      const signed = Evolution.MessageSigning.SignData.signData(addressHex, hexToBytes(payload), privateKey)
      return toolTextResult({
        signature: bytesToHex(signed.signature),
        key: bytesToHex(signed.key)
      })
    }
  )

  server.registerTool(
    "message_verify",
    {
      description:
        "Verify a CIP-8 / CIP-30 signed message. Returns whether the signature is valid.",
      inputSchema: z.object({
        addressHex: z.string().describe("Address as hex string"),
        keyHash: z.string().describe("Key hash (hex) used when signing"),
        payload: z.string().describe("Original payload as hex string"),
        signedMessage: z.object({
          signature: z.string().describe("COSE_Sign1 signature hex"),
          key: z.string().describe("COSE_Key hex")
        })
      })
    },
    async ({ addressHex, keyHash, payload, signedMessage }) => {
      const valid = Evolution.MessageSigning.SignData.verifyData(
        addressHex,
        keyHash,
        hexToBytes(payload),
        { signature: hexToBytes(signedMessage.signature), key: hexToBytes(signedMessage.key) }
      )
      return toolTextResult({ valid })
    }
  )

  // ── Fee validation ──────────────────────────────────────────────────────

  server.registerTool(
    "fee_validate",
    {
      description:
        "Validate whether a transaction's fee meets the minimum required fee. " +
        "Returns isValid, actualFee, minRequiredFee, txSizeBytes, and difference.",
      inputSchema: z.object({
        transactionCborHex: z.string().describe("Full transaction CBOR hex"),
        minFeeCoefficient: z.string().describe("Protocol param minFeeCoefficient (bigint as string)"),
        minFeeConstant: z.string().describe("Protocol param minFeeConstant (bigint as string)"),
        fakeWitnessSetCborHex: z.string().optional().describe("Optional fake witness set CBOR hex for size estimation")
      })
    },
    async ({ transactionCborHex, minFeeCoefficient, minFeeConstant, fakeWitnessSetCborHex }) => {
      const transaction = Evolution.Transaction.fromCBORHex(transactionCborHex)
      const protocolParams = {
        minFeeCoefficient: BigInt(minFeeCoefficient),
        minFeeConstant: BigInt(minFeeConstant)
      }
      const fakeWitnessSet = fakeWitnessSetCborHex
        ? Evolution.TransactionWitnessSet.fromCBORHex(fakeWitnessSetCborHex)
        : undefined
      const result = Evolution.FeeValidation.validateTransactionFee(
        transaction,
        protocolParams,
        fakeWitnessSet
      )
      return toolTextResult({
        isValid: result.isValid,
        actualFee: result.actualFee.toString(),
        minRequiredFee: result.minRequiredFee.toString(),
        txSizeBytes: result.txSizeBytes,
        difference: result.difference.toString()
      })
    }
  )

  // ── CIP-68 metadata codec ──────────────────────────────────────────────

  server.registerTool(
    "cip68_codec",
    {
      description:
        "Encode or decode CIP-68 metadata datums. CIP-68 datums contain metadata (PlutusData), " +
        "a version integer, and an extra array. Also provides token label constants " +
        "(REFERENCE=100, NFT=222, FT=333, RFT=444).",
      inputSchema: z.object({
        action: z.enum(["decode", "encode", "tokenLabels"]),
        cborHex: z.string().optional().describe("CBOR hex of CIP-68 datum (for decode)"),
        datum: z
          .object({
            metadata: z.any().describe("Metadata as PlutusData JSON"),
            version: z.number().int().describe("Version integer"),
            extra: z.array(z.any()).optional().describe("Extra PlutusData array (default: [])")
          })
          .optional()
          .describe("CIP-68 datum fields (for encode)")
      })
    },
    async ({ action, cborHex, datum }) => {
      switch (action) {
        case "decode": {
          if (!cborHex) throw new Error("'cborHex' is required for decode")
          const decoded = Evolution.Plutus.CIP68Metadata.Codec.fromCBORHex(cborHex)
          return toolTextResult({
            metadata: toStructured(decoded.metadata),
            version: Number(decoded.version),
            extra: decoded.extra.map((e: unknown) => toStructured(e))
          })
        }
        case "encode": {
          if (!datum) throw new Error("'datum' is required for encode")
          const value = {
            metadata: parseStructuredData(datum.metadata),
            version: BigInt(datum.version),
            extra: (datum.extra ?? []).map((e: unknown) => parseStructuredData(e))
          }
          const hex = Evolution.Plutus.CIP68Metadata.Codec.toCBORHex(value as any)
          return toolTextResult({ cborHex: hex })
        }
        case "tokenLabels": {
          return toolTextResult({
            REFERENCE_TOKEN_LABEL: Evolution.Plutus.CIP68Metadata.REFERENCE_TOKEN_LABEL,
            NFT_TOKEN_LABEL: Evolution.Plutus.CIP68Metadata.NFT_TOKEN_LABEL,
            FT_TOKEN_LABEL: Evolution.Plutus.CIP68Metadata.FT_TOKEN_LABEL,
            RFT_TOKEN_LABEL: Evolution.Plutus.CIP68Metadata.RFT_TOKEN_LABEL,
            description: "CIP-68 token label prefixes: REFERENCE (100) for reference tokens, NFT (222), FT (333), RFT (444)"
          })
        }
      }
    }
  )

  // ── Key management tools ────────────────────────────────────────────────

  server.registerTool(
    "key_generate",
    {
      description:
        "Generate cryptographic keys, mnemonics, and derive keys from mnemonics. " +
        "WARNING: Generated keys are returned in plaintext — use ONLY for devnet / testing. " +
        "Actions: 'generateMnemonic' creates a BIP-39 mnemonic, " +
        "'validateMnemonic' checks if a mnemonic is valid, " +
        "'fromMnemonicCardano' derives a PrivateKey from a mnemonic via BIP32-Ed25519 (Icarus V2), " +
        "'toPublicKey' derives the public key (VKey) from a private key, " +
        "'keyHash' computes the Ed25519 key hash (blake2b-224) from a private key.",
      inputSchema: z.object({
        action: z.enum(["generateMnemonic", "validateMnemonic", "fromMnemonicCardano", "toPublicKey", "keyHash"]),
        mnemonic: z.string().optional().describe("BIP-39 mnemonic phrase (for validate/derive)"),
        mnemonicStrength: z.enum(["128", "160", "192", "224", "256"]).optional().describe("Mnemonic strength in bits (default: 256)"),
        account: z.number().int().nonnegative().optional().describe("Account index (default: 0)"),
        role: z.enum(["0", "2"]).optional().describe("Role: 0 = payment, 2 = staking (default: 0)"),
        index: z.number().int().nonnegative().optional().describe("Address index (default: 0)"),
        password: z.string().optional().describe("Optional BIP-39 passphrase"),
        privateKeyHex: z.string().optional().describe("Private key hex (for toPublicKey/keyHash)")
      })
    },
    async ({ action, mnemonic, mnemonicStrength, account, role, index, password, privateKeyHex }) => {
      switch (action) {
        case "generateMnemonic": {
          const strength = mnemonicStrength ? (Number(mnemonicStrength) as 128 | 160 | 192 | 224 | 256) : undefined
          const words = Evolution.PrivateKey.generateMnemonic(strength)
          return toolTextResult({
            mnemonic: words,
            wordCount: words.split(" ").length,
            strength: strength ?? 256
          })
        }
        case "validateMnemonic": {
          if (!mnemonic) throw new Error("'mnemonic' is required for validateMnemonic")
          return toolTextResult({
            valid: Evolution.PrivateKey.validateMnemonic(mnemonic),
            wordCount: mnemonic.split(" ").length
          })
        }
        case "fromMnemonicCardano": {
          if (!mnemonic) throw new Error("'mnemonic' is required for fromMnemonicCardano")
          const pk = Evolution.PrivateKey.fromMnemonicCardano(mnemonic, {
            account: account ?? 0,
            role: role ? (Number(role) as 0 | 2) : 0,
            index: index ?? 0,
            password
          })
          const pub = Evolution.PrivateKey.toPublicKey(pk)
          const kh = Evolution.KeyHash.fromPrivateKey(pk)
          return toolTextResult({
            privateKeyHex: Evolution.PrivateKey.toHex(pk),
            privateKeyBech32: Evolution.PrivateKey.toBech32(pk),
            publicKeyHex: bytesToHex(Evolution.VKey.toBytes(pub)),
            keyHashHex: Evolution.KeyHash.toHex(kh),
            derivationPath: `m/1852'/1815'/${account ?? 0}'/${role ?? 0}/${index ?? 0}`
          })
        }
        case "toPublicKey": {
          if (!privateKeyHex) throw new Error("'privateKeyHex' is required for toPublicKey")
          const pk = Evolution.PrivateKey.fromHex(privateKeyHex)
          const pub = Evolution.PrivateKey.toPublicKey(pk)
          return toolTextResult({
            publicKeyHex: bytesToHex(Evolution.VKey.toBytes(pub))
          })
        }
        case "keyHash": {
          if (!privateKeyHex) throw new Error("'privateKeyHex' is required for keyHash")
          const pk = Evolution.PrivateKey.fromHex(privateKeyHex)
          const kh = Evolution.KeyHash.fromPrivateKey(pk)
          return toolTextResult({
            keyHashHex: Evolution.KeyHash.toHex(kh),
            publicKeyHex: bytesToHex(Evolution.VKey.toBytes(Evolution.PrivateKey.toPublicKey(pk)))
          })
        }
      }
    }
  )

  // ── Native script tools ─────────────────────────────────────────────────

  const NativeScriptVariantSchema: z.ZodType<any> = z.lazy(() =>
    z.discriminatedUnion("tag", [
      z.object({ tag: z.literal("pubKey"), keyHashHex: z.string().describe("Ed25519 key hash as hex (56 chars)") }),
      z.object({ tag: z.literal("invalidBefore"), slot: z.string().describe("Slot number as string (bigint)") }),
      z.object({ tag: z.literal("invalidHereafter"), slot: z.string().describe("Slot number as string (bigint)") }),
      z.object({ tag: z.literal("all"), scripts: z.array(NativeScriptVariantSchema) }),
      z.object({ tag: z.literal("any"), scripts: z.array(NativeScriptVariantSchema) }),
      z.object({
        tag: z.literal("nOfK"),
        required: z.string().describe("Required count as string (bigint)"),
        scripts: z.array(NativeScriptVariantSchema)
      })
    ])
  )

  const buildNativeScript = (spec: any): Evolution.NativeScripts.NativeScript => {
    switch (spec.tag) {
      case "pubKey":
        return Evolution.NativeScripts.makeScriptPubKey(hexToBytes(spec.keyHashHex))
      case "invalidBefore":
        return Evolution.NativeScripts.makeInvalidBefore(BigInt(spec.slot))
      case "invalidHereafter":
        return Evolution.NativeScripts.makeInvalidHereafter(BigInt(spec.slot))
      case "all":
        return Evolution.NativeScripts.makeScriptAll(spec.scripts.map((s: any) => buildNativeScript(s).script))
      case "any":
        return Evolution.NativeScripts.makeScriptAny(spec.scripts.map((s: any) => buildNativeScript(s).script))
      case "nOfK":
        return Evolution.NativeScripts.makeScriptNOfK(
          BigInt(spec.required),
          spec.scripts.map((s: any) => buildNativeScript(s).script)
        )
      default:
        throw new Error(`Unknown native script tag: ${(spec as any).tag}`)
    }
  }

  const serializeNativeVariant = (v: any): any => {
    switch (v._tag) {
      case "ScriptPubKey":
        return { tag: "pubKey", keyHashHex: bytesToHex(v.keyHash) }
      case "InvalidBefore":
        return { tag: "invalidBefore", slot: v.slot.toString() }
      case "InvalidHereafter":
        return { tag: "invalidHereafter", slot: v.slot.toString() }
      case "ScriptAll":
        return { tag: "all", scripts: v.scripts.map(serializeNativeVariant) }
      case "ScriptAny":
        return { tag: "any", scripts: v.scripts.map(serializeNativeVariant) }
      case "ScriptNOfK":
        return { tag: "nOfK", required: v.required.toString(), scripts: v.scripts.map(serializeNativeVariant) }
      default:
        return v
    }
  }

  server.registerTool(
    "native_script_tools",
    {
      description:
        "Build, parse, and analyze Cardano native scripts. " +
        "Actions: 'build' creates a native script from a structured spec, " +
        "'parseCbor' decodes a native script from CBOR hex, " +
        "'toJson' converts a CBOR-encoded script to cardano-cli JSON format, " +
        "'extractKeyHashes' lists all required key hashes, " +
        "'countRequiredSigners' returns the minimum number of signers needed.",
      inputSchema: z.object({
        action: z.enum(["build", "parseCbor", "toJson", "extractKeyHashes", "countRequiredSigners"]),
        spec: NativeScriptVariantSchema.optional().describe("Script specification (for build)"),
        cborHex: z.string().optional().describe("CBOR hex of a native script (for parse/toJson/extract/count)")
      })
    },
    async ({ action, spec, cborHex }) => {
      switch (action) {
        case "build": {
          if (!spec) throw new Error("'spec' is required for build")
          const ns = buildNativeScript(spec)
          const hex = Evolution.NativeScripts.toCBORHex(ns)
          const json = Evolution.NativeScripts.toJSON(ns.script)
          return toolTextResult({
            cborHex: hex,
            json,
            script: serializeNativeVariant(ns.script)
          })
        }
        case "parseCbor": {
          if (!cborHex) throw new Error("'cborHex' is required for parseCbor")
          const ns = Evolution.NativeScripts.fromCBORHex(cborHex)
          return toolTextResult({
            script: serializeNativeVariant(ns.script),
            json: Evolution.NativeScripts.toJSON(ns.script),
            cborHex
          })
        }
        case "toJson": {
          if (!cborHex) throw new Error("'cborHex' is required for toJson")
          const ns = Evolution.NativeScripts.fromCBORHex(cborHex)
          return toolTextResult({ json: Evolution.NativeScripts.toJSON(ns.script) })
        }
        case "extractKeyHashes": {
          if (!cborHex) throw new Error("'cborHex' is required for extractKeyHashes")
          const ns = Evolution.NativeScripts.fromCBORHex(cborHex)
          const hashes = Evolution.NativeScripts.extractKeyHashes(ns.script)
          return toolTextResult({
            keyHashes: hashes.map((h: Uint8Array) => bytesToHex(h)),
            count: hashes.length
          })
        }
        case "countRequiredSigners": {
          if (!cborHex) throw new Error("'cborHex' is required for countRequiredSigners")
          const ns = Evolution.NativeScripts.fromCBORHex(cborHex)
          return toolTextResult({
            requiredSigners: Evolution.NativeScripts.countRequiredSigners(ns.script)
          })
        }
      }
    }
  )

  // ── UTxO set tools ──────────────────────────────────────────────────────

  const UtxoItemSchema = z.object({
    transactionId: z.string().describe("Transaction hash hex (64 chars)"),
    index: z.number().int().nonnegative().describe("Output index"),
    address: z.string().describe("Address (bech32)"),
    assets: z.record(z.string(), z.string()).describe("Asset map: { lovelace: '...', policyId.assetName: '...' }")
  })

  const parseUtxoItem = (item: any): Evolution.UTxO.UTxO => {
    const address = Evolution.Address.fromBech32(item.address)
    const assets = Evolution.Assets.fromRecord(
      Object.fromEntries(
        Object.entries(item.assets as Record<string, string>).map(([k, v]) => [k, globalThis.BigInt(v)])
      )
    )
    const transactionId = Evolution.TransactionHash.fromHex(item.transactionId)
    return new Evolution.UTxO.UTxO({
      transactionId,
      index: globalThis.BigInt(item.index),
      address,
      assets
    })
  }

  const serializeUtxoItem = (utxo: Evolution.UTxO.UTxO): any => {
    const json = utxo.assets.toJSON() as { lovelace?: string; multiAsset?: Record<string, Record<string, string>> }
    const assetsRecord: Record<string, string> = {}
    if (json.lovelace) assetsRecord.lovelace = json.lovelace
    if (json.multiAsset) {
      for (const [policy, names] of Object.entries(json.multiAsset)) {
        for (const [name, qty] of Object.entries(names)) {
          assetsRecord[`${policy}.${name}`] = qty
        }
      }
    }
    return {
      transactionId: Evolution.TransactionHash.toHex(utxo.transactionId),
      index: Number(utxo.index),
      address: Evolution.Address.toBech32(utxo.address),
      assets: assetsRecord,
      outRef: Evolution.UTxO.toOutRefString(utxo)
    }
  }

  server.registerTool(
    "utxo_tools",
    {
      description:
        "Perform UTxO set operations: create sets, compute union/intersection/difference, filter, " +
        "check membership, and get size. Useful for preparing coin selection and transaction building.",
      inputSchema: z.object({
        action: z.enum(["create", "union", "intersection", "difference", "size"]),
        utxos: z.array(UtxoItemSchema).optional().describe("UTxO items (for create)"),
        left: z.array(UtxoItemSchema).optional().describe("Left UTxO set (for set operations)"),
        right: z.array(UtxoItemSchema).optional().describe("Right UTxO set (for set operations)")
      })
    },
    async ({ action, utxos, left, right }) => {
      switch (action) {
        case "create": {
          if (!utxos) throw new Error("'utxos' is required for create")
          const set = Evolution.UTxO.fromIterable(utxos.map(parseUtxoItem))
          return toolTextResult({
            size: Evolution.UTxO.size(set),
            utxos: Evolution.UTxO.toArray(set).map(serializeUtxoItem)
          })
        }
        case "union":
        case "intersection":
        case "difference": {
          if (!left || !right) throw new Error("'left' and 'right' are required for set operations")
          const setA = Evolution.UTxO.fromIterable(left.map(parseUtxoItem))
          const setB = Evolution.UTxO.fromIterable(right.map(parseUtxoItem))
          const result =
            action === "union"
              ? Evolution.UTxO.union(setA, setB)
              : action === "intersection"
                ? Evolution.UTxO.intersection(setA, setB)
                : Evolution.UTxO.difference(setA, setB)
          return toolTextResult({
            operation: action,
            leftSize: Evolution.UTxO.size(setA),
            rightSize: Evolution.UTxO.size(setB),
            resultSize: Evolution.UTxO.size(result),
            utxos: Evolution.UTxO.toArray(result).map(serializeUtxoItem)
          })
        }
        case "size": {
          if (!utxos) throw new Error("'utxos' is required for size")
          const set = Evolution.UTxO.fromIterable(utxos.map(parseUtxoItem))
          return toolTextResult({
            size: Evolution.UTxO.size(set),
            isEmpty: Evolution.UTxO.isEmpty(set)
          })
        }
      }
    }
  )

  // ── Bech32 codec ────────────────────────────────────────────────────────

  server.registerTool(
    "bech32_codec",
    {
      description:
        "Encode or decode Bech32/Bech32m strings. " +
        "Actions: 'encode' creates a bech32 string from hex data and a prefix (hrp), " +
        "'decode' extracts the prefix and hex data from a bech32 string.",
      inputSchema: z.object({
        action: z.enum(["encode", "decode"]),
        bech32: z.string().optional().describe("Bech32 string to decode"),
        hex: z.string().optional().describe("Hex data to encode"),
        prefix: z.string().optional().describe("Human-readable prefix (for encode)")
      })
    },
    async ({ action, bech32, hex, prefix }) => {
      switch (action) {
        case "encode": {
          if (!hex) throw new Error("'hex' is required for encode")
          if (!prefix) throw new Error("'prefix' is required for encode")
          const encoded = Evolution.Schema.decodeSync(Evolution.Bech32.FromHex(prefix))(hex)
          return toolTextResult({ bech32: encoded, hex, prefix })
        }
        case "decode": {
          if (!bech32) throw new Error("'bech32' is required for decode")
          // Extract prefix from the bech32 string (everything before the last '1')
          const sepIdx = bech32.lastIndexOf("1")
          if (sepIdx < 1) throw new Error("Invalid bech32 string: no separator found")
          const hrp = bech32.substring(0, sepIdx)
          const decodedHex = Evolution.Schema.encodeSync(Evolution.Bech32.FromHex(hrp))(bech32)
          return toolTextResult({
            prefix: hrp,
            hex: decodedHex,
            byteLength: decodedHex.length / 2,
            bech32
          })
        }
      }
    }
  )

  // ── Bytes codec ─────────────────────────────────────────────────────────

  server.registerTool(
    "bytes_codec",
    {
      description:
        "Convert between hex strings and byte arrays, validate byte lengths, " +
        "and compare byte values. Supports all standard Cardano byte sizes " +
        "(4, 16, 28, 29, 32, 57, 64, 80, 96, 128, 448 bytes).",
      inputSchema: z.object({
        action: z.enum(["fromHex", "validate", "equals"]),
        hex: z.string().optional().describe("Hex string"),
        expectedLength: z.number().int().positive().optional().describe("Expected byte length to validate against"),
        leftHex: z.string().optional().describe("Left hex string (for equals)"),
        rightHex: z.string().optional().describe("Right hex string (for equals)")
      })
    },
    async ({ action, hex, expectedLength, leftHex, rightHex }) => {
      switch (action) {
        case "fromHex": {
          if (!hex) throw new Error("'hex' is required for fromHex")
          const bytes = Evolution.Bytes.fromHex(hex)
          return toolTextResult({
            hex: Evolution.Bytes.toHex(bytes),
            byteLength: bytes.length,
            hexLength: hex.length
          })
        }
        case "validate": {
          if (!hex) throw new Error("'hex' is required for validate")
          const bytes = Evolution.Bytes.fromHex(hex)
          const byteLength = bytes.length
          const validSizes = [4, 16, 28, 29, 32, 57, 64, 80, 96, 128, 448]
          const matchesExpected = expectedLength ? byteLength === expectedLength : true
          const matchesKnownSize = validSizes.includes(byteLength)
          return toolTextResult({
            hex: Evolution.Bytes.toHex(bytes),
            byteLength,
            matchesExpected,
            matchesKnownSize,
            expectedLength: expectedLength ?? null,
            knownSizes: validSizes
          })
        }
        case "equals": {
          if (!leftHex || !rightHex) throw new Error("'leftHex' and 'rightHex' are required for equals")
          const left = Evolution.Bytes.fromHex(leftHex)
          const right = Evolution.Bytes.fromHex(rightHex)
          return toolTextResult({
            equal: Evolution.Bytes.equals(left, right),
            leftLength: left.length,
            rightLength: right.length
          })
        }
      }
    }
  )

  // ── Address builder ──────────────────────────────────────────────────

  server.registerTool(
    "address_build",
    {
      description:
        "Build Cardano addresses from credential hashes. Supports BaseAddress (payment + stake), " +
        "EnterpriseAddress (payment only), and RewardAddress (stake only). " +
        "Credentials can be key hashes (28-byte hex, 56 chars) or script hashes. " +
        "Returns the address as bech32 and hex.",
      inputSchema: z.object({
        type: z.enum(["base", "enterprise", "reward"]),
        networkId: z.number().int().min(0).max(1).describe("0 = testnet, 1 = mainnet"),
        paymentHash: z.string().optional().describe("Payment credential hash hex (56 chars)"),
        paymentType: z.enum(["key", "script"]).optional().describe("Payment credential type (default: key)"),
        stakeHash: z.string().optional().describe("Stake credential hash hex (56 chars)"),
        stakeType: z.enum(["key", "script"]).optional().describe("Stake credential type (default: key)")
      })
    },
    async ({ type, networkId, paymentHash, paymentType, stakeHash, stakeType }) => {
      const makeCredential = (hash: string, credType: "key" | "script" = "key") =>
        credType === "key"
          ? Evolution.Credential.makeKeyHash(hexToBytes(hash))
          : Evolution.Credential.makeScriptHash(hexToBytes(hash))

      switch (type) {
        case "base": {
          if (!paymentHash) throw new Error("'paymentHash' is required for base address")
          if (!stakeHash) throw new Error("'stakeHash' is required for base address")
          const paymentCredential = makeCredential(paymentHash, paymentType ?? "key")
          const stakeCredential = makeCredential(stakeHash, stakeType ?? "key")
          const addr = new Evolution.BaseAddress.BaseAddress({ networkId, paymentCredential, stakeCredential })
          const bytes = Evolution.BaseAddress.toBytes(addr)
          const eraAddr = Evolution.AddressEras.fromBytes(bytes)
          const bech32 = Evolution.AddressEras.toBech32(eraAddr)
          return toolTextResult({
            bech32,
            hex: Evolution.AddressEras.toHex(eraAddr),
            type: "base",
            networkId,
            paymentCredential: { hash: paymentHash, type: paymentType ?? "key" },
            stakeCredential: { hash: stakeHash, type: stakeType ?? "key" }
          })
        }
        case "enterprise": {
          if (!paymentHash) throw new Error("'paymentHash' is required for enterprise address")
          const paymentCredential = makeCredential(paymentHash, paymentType ?? "key")
          const addr = new Evolution.EnterpriseAddress.EnterpriseAddress({ networkId, paymentCredential })
          const bytes = Evolution.EnterpriseAddress.toBytes(addr)
          const eraAddr = Evolution.AddressEras.fromBytes(bytes)
          const bech32 = Evolution.AddressEras.toBech32(eraAddr)
          return toolTextResult({
            bech32,
            hex: Evolution.AddressEras.toHex(eraAddr),
            type: "enterprise",
            networkId,
            paymentCredential: { hash: paymentHash, type: paymentType ?? "key" }
          })
        }
        case "reward": {
          if (!stakeHash) throw new Error("'stakeHash' is required for reward address")
          // Build reward address bytes manually: header byte + 28-byte hash
          // Header: 0xe0 = testnet+key, 0xe1 = mainnet+key, 0xf0 = testnet+script, 0xf1 = mainnet+script
          const isScript = (stakeType ?? "key") === "script"
          const header = (isScript ? 0xf0 : 0xe0) | (networkId & 0x0f)
          const hashBytes = hexToBytes(stakeHash)
          const addrBytes = new Uint8Array(29)
          addrBytes[0] = header
          addrBytes.set(hashBytes, 1)
          const eraAddr = Evolution.AddressEras.fromBytes(addrBytes)
          const bech32 = Evolution.AddressEras.toBech32(eraAddr)
          return toolTextResult({
            bech32,
            hex: Evolution.AddressEras.toHex(eraAddr),
            type: "reward",
            networkId,
            stakeCredential: { hash: stakeHash, type: stakeType ?? "key" }
          })
        }
      }
    }
  )

  // ── Metadata tools ──────────────────────────────────────────────────────

  server.registerTool(
    "metadata_tools",
    {
      description:
        "Build and parse Cardano transaction metadata (TransactionMetadatum). " +
        "Actions: 'build' creates metadata from a JSON spec with typed entries, " +
        "'parseCbor' decodes metadata from CBOR hex, " +
        "'buildAuxiliaryData' creates AuxiliaryData with metadata entries, " +
        "'parseAuxiliaryData' decodes AuxiliaryData from CBOR hex.",
      inputSchema: z.object({
        action: z.enum(["build", "parseCbor", "buildAuxiliaryData", "parseAuxiliaryData"]),
        entries: z
          .array(
            z.object({
              label: z.string().describe("Metadata label as string (bigint)"),
              value: z.any().describe("Metadata value: string for text, number for int, or {type, value} for explicit types")
            })
          )
          .optional()
          .describe("Metadata entries: label→value pairs (for build/buildAuxiliaryData)"),
        cborHex: z.string().optional().describe("CBOR hex to decode (for parseCbor/parseAuxiliaryData)")
      })
    },
    async ({ action, entries, cborHex }) => {
      const buildMetadatumValue = (v: unknown): any => {
        if (typeof v === "string") return Evolution.TransactionMetadatum.text(v)
        if (typeof v === "number") return Evolution.TransactionMetadatum.int(BigInt(v))
        if (Array.isArray(v)) return Evolution.TransactionMetadatum.array(v.map(buildMetadatumValue))
        if (v && typeof v === "object") {
          const obj = v as Record<string, unknown>
          if (obj.type === "bytes" && typeof obj.value === "string") {
            return Evolution.TransactionMetadatum.bytes(hexToBytes(obj.value as string))
          }
          if (obj.type === "int" && (typeof obj.value === "string" || typeof obj.value === "number")) {
            return Evolution.TransactionMetadatum.int(BigInt(obj.value))
          }
          if (obj.type === "text" && typeof obj.value === "string") {
            return Evolution.TransactionMetadatum.text(obj.value as string)
          }
          if (obj.type === "list" && Array.isArray(obj.value)) {
            return Evolution.TransactionMetadatum.array(
              (obj.value as unknown[]).map(buildMetadatumValue)
            )
          }
          if (obj.type === "map" && Array.isArray(obj.value)) {
            const m = new Map(
              (obj.value as Array<[unknown, unknown]>).map(
                ([k, val]: [unknown, unknown]) => [buildMetadatumValue(k), buildMetadatumValue(val)] as [any, any]
              )
            )
            return Evolution.TransactionMetadatum.map(m)
          }
          // Object treated as key-value map of text keys
          const mapEntries = new Map(
            Object.entries(obj).map(
              ([k, val]) =>
                [Evolution.TransactionMetadatum.text(k), buildMetadatumValue(val)] as [any, any]
            )
          )
          return Evolution.TransactionMetadatum.map(mapEntries)
        }
        throw new Error(`Unsupported metadata value type: ${typeof v}`)
      }

      switch (action) {
        case "build": {
          if (!entries || entries.length === 0) throw new Error("'entries' is required for build")
          const metadatum = Evolution.TransactionMetadatum.fromEntries(
            entries.map((e) => [BigInt(e.label), buildMetadatumValue(e.value)] as [bigint, any])
          )
          const hex = Evolution.TransactionMetadatum.toCBORHex(metadatum)
          return toolTextResult({ cborHex: hex })
        }
        case "parseCbor": {
          if (!cborHex) throw new Error("'cborHex' is required for parseCbor")
          const metadatum = Evolution.TransactionMetadatum.fromCBORHex(cborHex)
          return toolTextResult({ metadatum: toStructured(metadatum), cborHex })
        }
        case "buildAuxiliaryData": {
          if (!entries || entries.length === 0) throw new Error("'entries' is required for buildAuxiliaryData")
          const metadatum = Evolution.TransactionMetadatum.fromEntries(
            entries.map((e) => [BigInt(e.label), buildMetadatumValue(e.value)] as [bigint, any])
          )
          const aux = Evolution.AuxiliaryData.conway({
            metadata: metadatum as any,
            nativeScripts: [],
            plutusV1Scripts: [],
            plutusV2Scripts: [],
            plutusV3Scripts: []
          })
          const hex = Evolution.AuxiliaryData.toCBORHex(aux)
          return toolTextResult({ cborHex: hex, tag: "ConwayAuxiliaryData" })
        }
        case "parseAuxiliaryData": {
          if (!cborHex) throw new Error("'cborHex' is required for parseAuxiliaryData")
          const aux = Evolution.AuxiliaryData.fromCBORHex(cborHex)
          return toolTextResult({ auxiliaryData: toStructured(aux), cborHex })
        }
      }
    }
  )

  // ── Credential tools ────────────────────────────────────────────────────

  server.registerTool(
    "credential_tools",
    {
      description:
        "Build and inspect Cardano credentials. " +
        "Actions: 'makeKeyHash' creates a key hash credential from a 28-byte hash hex, " +
        "'makeScriptHash' creates a script hash credential, " +
        "'fromCbor' decodes a credential from CBOR hex, " +
        "'toCbor' encodes a credential to CBOR hex.",
      inputSchema: z.object({
        action: z.enum(["makeKeyHash", "makeScriptHash", "fromCbor", "toCbor"]),
        hashHex: z.string().optional().describe("28-byte hash as hex (56 chars)"),
        cborHex: z.string().optional().describe("CBOR hex of a credential"),
        credentialType: z.enum(["key", "script"]).optional().describe("Credential type (for toCbor)")
      })
    },
    async ({ action, hashHex, cborHex, credentialType }) => {
      switch (action) {
        case "makeKeyHash": {
          if (!hashHex) throw new Error("'hashHex' is required for makeKeyHash")
          const cred = Evolution.Credential.makeKeyHash(hexToBytes(hashHex))
          const hex = Evolution.Credential.toCBORHex(cred)
          return toolTextResult({
            credential: { tag: "KeyHash", hash: hashHex },
            cborHex: hex
          })
        }
        case "makeScriptHash": {
          if (!hashHex) throw new Error("'hashHex' is required for makeScriptHash")
          const cred = Evolution.Credential.makeScriptHash(hexToBytes(hashHex))
          const hex = Evolution.Credential.toCBORHex(cred)
          return toolTextResult({
            credential: { tag: "ScriptHash", hash: hashHex },
            cborHex: hex
          })
        }
        case "fromCbor": {
          if (!cborHex) throw new Error("'cborHex' is required for fromCbor")
          const cred = Evolution.Credential.fromCBORHex(cborHex)
          return toolTextResult({
            credential: {
              tag: cred._tag,
              hash: cred.hash
            },
            cborHex
          })
        }
        case "toCbor": {
          if (!hashHex) throw new Error("'hashHex' is required for toCbor")
          const type = credentialType ?? "key"
          const cred =
            type === "key"
              ? Evolution.Credential.makeKeyHash(hexToBytes(hashHex))
              : Evolution.Credential.makeScriptHash(hexToBytes(hashHex))
          return toolTextResult({
            cborHex: Evolution.Credential.toCBORHex(cred),
            credential: { tag: cred._tag, hash: hashHex }
          })
        }
      }
    }
  )

  // ── DRep tools ──────────────────────────────────────────────────────────

  server.registerTool(
    "drep_tools",
    {
      description:
        "Build and inspect DRep (Delegated Representative) values for Cardano governance. " +
        "Actions: 'fromKeyHash' creates a DRep from a 28-byte key hash, " +
        "'fromScriptHash' creates a DRep from a script hash, " +
        "'alwaysAbstain' / 'alwaysNoConfidence' create special DRep constants, " +
        "'fromBech32' parses a drep1... bech32 string, " +
        "'toBech32' converts a DRep hex to bech32, " +
        "'fromCbor' decodes a DRep from CBOR hex, " +
        "'inspect' returns the hex and bech32 representations of a DRep from its hex encoding.",
      inputSchema: z.object({
        action: z.enum([
          "fromKeyHash",
          "fromScriptHash",
          "alwaysAbstain",
          "alwaysNoConfidence",
          "fromBech32",
          "toBech32",
          "fromCbor",
          "inspect"
        ]),
        hashHex: z.string().optional().describe("Key hash or script hash hex (56 chars)"),
        bech32: z.string().optional().describe("DRep bech32 string (drep1...)"),
        cborHex: z.string().optional().describe("DRep CBOR hex"),
        hex: z.string().optional().describe("DRep raw hex (from toHex)")
      })
    },
    async ({ action, hashHex, bech32, cborHex, hex }) => {
      const serializeDRep = (d: any) => {
        switch (d._tag) {
          case "KeyHashDRep":
            return { tag: "KeyHashDRep", keyHash: Evolution.KeyHash.toHex(d.keyHash) }
          case "ScriptHashDRep":
            return { tag: "ScriptHashDRep", scriptHash: d.scriptHash.hash }
          case "AlwaysAbstainDRep":
            return { tag: "AlwaysAbstainDRep" }
          case "AlwaysNoConfidenceDRep":
            return { tag: "AlwaysNoConfidenceDRep" }
          default:
            return d
        }
      }

      const drepHexAndBech32 = (d: any) => {
        // AlwaysAbstain/AlwaysNoConfidence cannot be encoded to hex or bech32
        if (d._tag === "AlwaysAbstainDRep" || d._tag === "AlwaysNoConfidenceDRep") {
          return { hex: null, bech32: null }
        }
        const h = Evolution.DRep.toHex(d)
        const b32 = Evolution.DRep.toBech32(d)
        return { hex: h, bech32: b32 }
      }

      switch (action) {
        case "fromKeyHash": {
          if (!hashHex) throw new Error("'hashHex' is required for fromKeyHash")
          const kh = Evolution.KeyHash.fromHex(hashHex)
          const drep = Evolution.DRep.fromKeyHash(kh)
          const enc = drepHexAndBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), ...enc })
        }
        case "fromScriptHash": {
          if (!hashHex) throw new Error("'hashHex' is required for fromScriptHash")
          const sh = Evolution.ScriptHash.fromHex(hashHex)
          const drep = Evolution.DRep.fromScriptHash(sh)
          const enc = drepHexAndBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), ...enc })
        }
        case "alwaysAbstain": {
          const drep = Evolution.DRep.alwaysAbstain()
          return toolTextResult({ drep: serializeDRep(drep) })
        }
        case "alwaysNoConfidence": {
          const drep = Evolution.DRep.alwaysNoConfidence()
          return toolTextResult({ drep: serializeDRep(drep) })
        }
        case "fromBech32": {
          if (!bech32) throw new Error("'bech32' is required for fromBech32")
          const drep = Evolution.Schema.decodeSync(Evolution.DRep.FromBech32)(bech32)
          const enc = drepHexAndBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), ...enc })
        }
        case "toBech32": {
          if (!hex) throw new Error("'hex' is required for toBech32")
          const drep = Evolution.Schema.decodeSync(Evolution.DRep.FromHex)(hex)
          const b32 = Evolution.DRep.toBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), bech32: b32, hex })
        }
        case "fromCbor": {
          if (!cborHex) throw new Error("'cborHex' is required for fromCbor")
          const drep = Evolution.DRep.fromCBORHex(cborHex)
          const enc = drepHexAndBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), cborHex, ...enc })
        }
        case "inspect": {
          if (!hex) throw new Error("'hex' is required for inspect")
          const drep = Evolution.Schema.decodeSync(Evolution.DRep.FromHex)(hex)
          const enc = drepHexAndBech32(drep)
          return toolTextResult({ drep: serializeDRep(drep), ...enc })
        }
      }
    }
  )

  // ── Value tools ─────────────────────────────────────────────────────────

  server.registerTool(
    "value_tools",
    {
      description:
        "Cardano Value arithmetic and inspection. " +
        "Actions: 'onlyCoin' creates an ADA-only Value, " +
        "'withAssets' creates a Value with ADA + multi-asset from CBOR hex, " +
        "'add' / 'subtract' perform Value arithmetic (CBOR hex inputs), " +
        "'geq' checks if first Value >= second, " +
        "'getAda' extracts the ADA (lovelace) amount, " +
        "'isAdaOnly' checks if Value has only ADA, " +
        "'getAssets' extracts the multi-asset map.",
      inputSchema: z.object({
        action: z.enum(["onlyCoin", "withAssets", "add", "subtract", "geq", "getAda", "isAdaOnly", "getAssets"]),
        lovelace: z.string().optional().describe("Lovelace amount as decimal string"),
        multiAssetCborHex: z.string().optional().describe("MultiAsset CBOR hex (for withAssets)"),
        valueCborHex: z.string().optional().describe("Value CBOR hex"),
        valueCborHexB: z.string().optional().describe("Second Value CBOR hex (for add/subtract/geq)")
      })
    },
    async ({ action, lovelace, multiAssetCborHex, valueCborHex, valueCborHexB }) => {
      switch (action) {
        case "onlyCoin": {
          if (!lovelace) throw new Error("'lovelace' is required")
          const v = Evolution.Value.onlyCoin(BigInt(lovelace))
          const hex = Evolution.Value.toCBORHex(v)
          return toolTextResult({ value: { tag: v._tag, coin: lovelace }, cborHex: hex })
        }
        case "withAssets": {
          if (!lovelace) throw new Error("'lovelace' is required")
          if (!multiAssetCborHex) throw new Error("'multiAssetCborHex' is required")
          const ma = Evolution.MultiAsset.fromCBORHex(multiAssetCborHex)
          const v = Evolution.Value.withAssets(BigInt(lovelace), ma)
          const hex = Evolution.Value.toCBORHex(v)
          return toolTextResult({ value: { tag: v._tag, coin: lovelace }, cborHex: hex })
        }
        case "add": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          if (!valueCborHexB) throw new Error("'valueCborHexB' is required")
          const a = Evolution.Value.fromCBORHex(valueCborHex)
          const b = Evolution.Value.fromCBORHex(valueCborHexB)
          const result = Evolution.Value.add(a, b)
          const hex = Evolution.Value.toCBORHex(result)
          return toolTextResult({ value: { tag: result._tag, coin: String(Evolution.Value.getAda(result)) }, cborHex: hex })
        }
        case "subtract": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          if (!valueCborHexB) throw new Error("'valueCborHexB' is required")
          const a = Evolution.Value.fromCBORHex(valueCborHex)
          const b = Evolution.Value.fromCBORHex(valueCborHexB)
          const result = Evolution.Value.subtract(a, b)
          const hex = Evolution.Value.toCBORHex(result)
          return toolTextResult({ value: { tag: result._tag, coin: String(Evolution.Value.getAda(result)) }, cborHex: hex })
        }
        case "geq": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          if (!valueCborHexB) throw new Error("'valueCborHexB' is required")
          const a = Evolution.Value.fromCBORHex(valueCborHex)
          const b = Evolution.Value.fromCBORHex(valueCborHexB)
          return toolTextResult({ geq: Evolution.Value.geq(a, b) })
        }
        case "getAda": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          const v = Evolution.Value.fromCBORHex(valueCborHex)
          return toolTextResult({ lovelace: String(Evolution.Value.getAda(v)) })
        }
        case "isAdaOnly": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          const v = Evolution.Value.fromCBORHex(valueCborHex)
          return toolTextResult({ isAdaOnly: Evolution.Value.isAdaOnly(v) })
        }
        case "getAssets": {
          if (!valueCborHex) throw new Error("'valueCborHex' is required")
          const v = Evolution.Value.fromCBORHex(valueCborHex)
          const hasMA = Evolution.Value.hasAssets(v)
          if (!hasMA) return toolTextResult({ hasAssets: false, multiAssetCborHex: null })
          const ma = (v as any).assets
          const maHex = Evolution.MultiAsset.toCBORHex(ma)
          return toolTextResult({ hasAssets: true, multiAssetCborHex: maHex })
        }
      }
    }
  )

  // ── Assets tools ────────────────────────────────────────────────────────

  server.registerTool(
    "assets_tools",
    {
      description:
        "Cardano Assets construction, arithmetic, and inspection. " +
        "Actions: 'fromLovelace' creates ADA-only assets, " +
        "'fromAsset' creates assets with a single token, " +
        "'fromHexStrings' creates from hex policy+name, " +
        "'fromRecord' creates from a JSON record, " +
        "'merge' combines two Assets (sums all quantities), " +
        "'subtract' subtracts one from another, " +
        "'lovelaceOf' extracts ADA, " +
        "'getUnits' lists all unit strings, " +
        "'covers' checks if first Assets covers second, " +
        "'flatten' lists all (policyHex, nameHex, qty) triples.",
      inputSchema: z.object({
        action: z.enum([
          "fromLovelace", "fromAsset", "fromHexStrings", "fromRecord",
          "merge", "subtract", "lovelaceOf", "getUnits", "covers",
          "flatten", "hasMultiAsset", "policies", "addLovelace",
          "quantityOf", "toCbor", "fromCbor"
        ]),
        lovelace: z.string().optional().describe("Lovelace amount as decimal string"),
        policyIdHex: z.string().optional().describe("Policy ID hex (56 chars)"),
        assetNameHex: z.string().optional().describe("Asset name hex"),
        quantity: z.string().optional().describe("Token quantity as decimal string"),
        record: z.record(z.string(), z.string()).optional().describe("Record of unit→quantity pairs (unit = 'lovelace' or policyHex+nameHex)"),
        cborHex: z.string().optional().describe("Assets CBOR hex"),
        cborHexB: z.string().optional().describe("Second Assets CBOR hex (for merge/subtract/covers)")
      })
    },
    async ({ action, lovelace, policyIdHex, assetNameHex, quantity, record, cborHex, cborHexB }) => {
      const serializeAssets = (a: Evolution.Assets.Assets) => {
        const units = Evolution.Assets.getUnits(a)
        const obj: Record<string, string> = {}
        for (const u of units) {
          obj[u] = String(Evolution.Assets.getByUnit(a, u))
        }
        return obj
      }

      switch (action) {
        case "fromLovelace": {
          if (!lovelace) throw new Error("'lovelace' is required")
          const a = Evolution.Assets.fromLovelace(BigInt(lovelace))
          return toolTextResult({ assets: serializeAssets(a), cborHex: Evolution.Assets.toCBORHex(a) })
        }
        case "fromAsset": {
          if (!policyIdHex || !assetNameHex) throw new Error("'policyIdHex' and 'assetNameHex' are required")
          const qty = quantity ? BigInt(quantity) : 1n
          const lv = lovelace ? BigInt(lovelace) : 0n
          const a = Evolution.Assets.fromHexStrings(policyIdHex, assetNameHex, qty, lv)
          return toolTextResult({ assets: serializeAssets(a), cborHex: Evolution.Assets.toCBORHex(a) })
        }
        case "fromHexStrings": {
          if (!policyIdHex || !assetNameHex) throw new Error("'policyIdHex' and 'assetNameHex' are required")
          const qty = quantity ? BigInt(quantity) : 1n
          const lv = lovelace ? BigInt(lovelace) : 0n
          const a = Evolution.Assets.fromHexStrings(policyIdHex, assetNameHex, qty, lv)
          return toolTextResult({ assets: serializeAssets(a), cborHex: Evolution.Assets.toCBORHex(a) })
        }
        case "fromRecord": {
          if (!record) throw new Error("'record' is required")
          const rec: Record<string, bigint> = {}
          for (const [k, v] of Object.entries(record)) rec[k] = BigInt(v)
          const a = Evolution.Assets.fromRecord(rec)
          return toolTextResult({ assets: serializeAssets(a), cborHex: Evolution.Assets.toCBORHex(a) })
        }
        case "merge": {
          if (!cborHex || !cborHexB) throw new Error("'cborHex' and 'cborHexB' are required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const b = Evolution.Assets.fromCBORHex(cborHexB)
          const merged = Evolution.Assets.merge(a, b)
          return toolTextResult({ assets: serializeAssets(merged), cborHex: Evolution.Assets.toCBORHex(merged) })
        }
        case "subtract": {
          if (!cborHex || !cborHexB) throw new Error("'cborHex' and 'cborHexB' are required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const b = Evolution.Assets.fromCBORHex(cborHexB)
          const result = Evolution.Assets.subtract(a, b)
          return toolTextResult({ assets: serializeAssets(result), cborHex: Evolution.Assets.toCBORHex(result) })
        }
        case "lovelaceOf": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          return toolTextResult({ lovelace: String(Evolution.Assets.lovelaceOf(a)) })
        }
        case "getUnits": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          return toolTextResult({ units: Evolution.Assets.getUnits(a) })
        }
        case "covers": {
          if (!cborHex || !cborHexB) throw new Error("'cborHex' and 'cborHexB' are required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const b = Evolution.Assets.fromCBORHex(cborHexB)
          return toolTextResult({ covers: Evolution.Assets.covers(a, b) })
        }
        case "flatten": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const flat = Evolution.Assets.flatten(a)
          const entries = flat.map(([p, n, q]: [any, any, any]) => ({
            policyIdHex: bytesToHex(p.hash ?? p),
            assetNameHex: bytesToHex(n.bytes ?? n),
            quantity: String(q)
          }))
          return toolTextResult({ entries })
        }
        case "hasMultiAsset": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          return toolTextResult({ hasMultiAsset: Evolution.Assets.hasMultiAsset(a) })
        }
        case "policies": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const pols = Evolution.Assets.policies(a)
          return toolTextResult({ policies: pols.map((p: any) => bytesToHex(p.hash ?? p)) })
        }
        case "addLovelace": {
          if (!cborHex || !lovelace) throw new Error("'cborHex' and 'lovelace' are required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const result = Evolution.Assets.addLovelace(a, BigInt(lovelace))
          return toolTextResult({ assets: serializeAssets(result), cborHex: Evolution.Assets.toCBORHex(result) })
        }
        case "quantityOf": {
          if (!cborHex || !policyIdHex || !assetNameHex) throw new Error("'cborHex', 'policyIdHex', and 'assetNameHex' are required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          const qty = Evolution.Assets.getByUnit(a, policyIdHex + assetNameHex)
          return toolTextResult({ quantity: String(qty) })
        }
        case "toCbor": {
          if (!record && !cborHex) throw new Error("'record' or 'cborHex' is required")
          if (record) {
            const rec: Record<string, bigint> = {}
            for (const [k, v] of Object.entries(record)) rec[k] = BigInt(v)
            const a = Evolution.Assets.fromRecord(rec)
            return toolTextResult({ cborHex: Evolution.Assets.toCBORHex(a) })
          }
          return toolTextResult({ cborHex })
        }
        case "fromCbor": {
          if (!cborHex) throw new Error("'cborHex' is required")
          const a = Evolution.Assets.fromCBORHex(cborHex)
          return toolTextResult({ assets: serializeAssets(a) })
        }
      }
    }
  )

  // ── Unit & Label tools ──────────────────────────────────────────────────

  server.registerTool(
    "unit_tools",
    {
      description:
        "CIP-67 asset unit string parsing and construction. " +
        "Actions: 'fromUnit' parses a unit string (policyHex+assetNameHex) into policyId, assetName, and optional CIP-67 label; " +
        "'toUnit' constructs a unit string from policyId hex, optional name, and optional label; " +
        "'toLabel' encodes a CIP-67 label number (0-65535) to its 8-char hex prefix; " +
        "'fromLabel' decodes a CIP-67 label hex prefix back to its number.",
      inputSchema: z.object({
        action: z.enum(["fromUnit", "toUnit", "toLabel", "fromLabel"]),
        unit: z.string().optional().describe("Unit string (policyIdHex + assetNameHex)"),
        policyIdHex: z.string().optional().describe("Policy ID hex (56 chars)"),
        assetNameHex: z.string().optional().describe("Asset name hex (without CIP-67 label prefix)"),
        label: z.number().int().optional().describe("CIP-67 label number (0-65535)"),
        labelHex: z.string().optional().describe("CIP-67 label hex prefix (8 chars)")
      })
    },
    async ({ action, unit, policyIdHex, assetNameHex, label, labelHex }) => {
      switch (action) {
        case "fromUnit": {
          if (!unit) throw new Error("'unit' is required")
          const details = AssetUnit.fromUnit(unit)
          return toolTextResult({
            policyIdHex: bytesToHex(details.policyId.hash as any),
            assetNameHex: details.assetName ? bytesToHex(details.assetName.bytes as any) : null,
            nameHex: details.name ? bytesToHex(details.name.bytes as any) : null,
            label: details.label
          })
        }
        case "toUnit": {
          if (!policyIdHex) throw new Error("'policyIdHex' is required")
          const result = AssetUnit.toUnit(
            hexToBytes(policyIdHex) as any,
            assetNameHex ? hexToBytes(assetNameHex) as any : null,
            label ?? null
          )
          return toolTextResult({ unit: result })
        }
        case "toLabel": {
          if (label === undefined || label === null) throw new Error("'label' is required")
          const hex = AssetLabel.toLabel(label)
          return toolTextResult({ labelHex: hex, label })
        }
        case "fromLabel": {
          if (!labelHex) throw new Error("'labelHex' is required")
          const num = AssetLabel.fromLabel(labelHex)
          return toolTextResult({ label: num ?? null, labelHex })
        }
      }
    }
  )

  // ── Coin tools ──────────────────────────────────────────────────────────

  server.registerTool(
    "coin_tools",
    {
      description:
        "Safe Cardano ADA (Coin) arithmetic with overflow/underflow checking. " +
        "Actions: 'add' adds two coin amounts, 'subtract' subtracts (throws on underflow), " +
        "'compare' returns -1/0/1, 'validate' checks if a value is a valid Coin (0 to 2^64-1), " +
        "'maxCoinValue' returns the maximum valid coin value.",
      inputSchema: z.object({
        action: z.enum(["add", "subtract", "compare", "validate", "maxCoinValue"]),
        a: z.string().optional().describe("First coin amount as decimal string"),
        b: z.string().optional().describe("Second coin amount as decimal string")
      })
    },
    async ({ action, a, b }) => {
      switch (action) {
        case "add": {
          if (!a || !b) throw new Error("'a' and 'b' are required")
          const result = Evolution.Coin.add(BigInt(a) as any, BigInt(b) as any)
          return toolTextResult({ result: String(result) })
        }
        case "subtract": {
          if (!a || !b) throw new Error("'a' and 'b' are required")
          const result = Evolution.Coin.subtract(BigInt(a) as any, BigInt(b) as any)
          return toolTextResult({ result: String(result) })
        }
        case "compare": {
          if (!a || !b) throw new Error("'a' and 'b' are required")
          return toolTextResult({ result: Evolution.Coin.compare(BigInt(a) as any, BigInt(b) as any) })
        }
        case "validate": {
          if (!a) throw new Error("'a' is required")
          return toolTextResult({ valid: Evolution.Coin.is(BigInt(a)) })
        }
        case "maxCoinValue": {
          return toolTextResult({ maxCoinValue: String(Evolution.Coin.MAX_COIN_VALUE) })
        }
      }
    }
  )

  // ── Network tools ───────────────────────────────────────────────────────

  server.registerTool(
    "network_tools",
    {
      description:
        "Cardano network name ↔ ID conversion. " +
        "'toId' converts a network name (Mainnet/Preview/Preprod) to its numeric ID, " +
        "'fromId' converts a numeric network ID back to a name (0→Preview, 1→Mainnet), " +
        "'validate' checks if a string is a valid network name.",
      inputSchema: z.object({
        action: z.enum(["toId", "fromId", "validate"]),
        network: z.string().optional().describe("Network name: Mainnet, Preview, or Preprod"),
        networkId: z.number().int().optional().describe("Network ID: 0 or 1")
      })
    },
    async ({ action, network, networkId }) => {
      switch (action) {
        case "toId": {
          if (!network) throw new Error("'network' is required")
          const id = Evolution.Network.toId(network as any)
          return toolTextResult({ network, networkId: id })
        }
        case "fromId": {
          if (networkId === undefined || networkId === null) throw new Error("'networkId' is required")
          const name = Evolution.Network.fromId(networkId as any)
          return toolTextResult({ network: name, networkId })
        }
        case "validate": {
          if (!network) throw new Error("'network' is required")
          return toolTextResult({ valid: Evolution.Network.is(network) })
        }
      }
    }
  )

  // ── Data construction tools ─────────────────────────────────────────────

  server.registerTool(
    "data_construct",
    {
      description:
        "Construct and inspect Plutus Data values programmatically. " +
        "Actions: 'constr' builds a constructor with index + fields, " +
        "'int' wraps a bigint, 'bytes' wraps a hex string as byte array, " +
        "'list' wraps an array of Data (as CBOR hex items), " +
        "'map' wraps key-value pairs (each as CBOR hex), " +
        "'match' pattern-matches a Data CBOR hex and returns its structure, " +
        "'isConstr'/'isMap'/'isList'/'isInt'/'isBytes' type-check a Data CBOR hex.",
      inputSchema: z.object({
        action: z.enum(["constr", "int", "bytes", "list", "map", "match", "isConstr", "isMap", "isList", "isInt", "isBytes"]),
        index: z.string().optional().describe("Constructor index as decimal string (for 'constr')"),
        fieldsCborHex: z.array(z.string()).optional().describe("Array of Plutus Data CBOR hex strings (for 'constr'/'list')"),
        value: z.string().optional().describe("Integer decimal string (for 'int') or hex string (for 'bytes')"),
        entriesCborHex: z.array(z.object({ key: z.string(), value: z.string() })).optional()
          .describe("Array of {key,value} CBOR hex pairs (for 'map')"),
        dataCborHex: z.string().optional().describe("Plutus Data CBOR hex to inspect")
      })
    },
    async ({ action, index, fieldsCborHex, value, entriesCborHex, dataCborHex }) => {
      const dataToHex = (d: any) => Evolution.Data.toCBORHex(d)

      switch (action) {
        case "constr": {
          if (index === undefined) throw new Error("'index' is required")
          const fields = (fieldsCborHex ?? []).map((h: string) => Evolution.Data.fromCBORHex(h))
          const c = Evolution.Data.constr(BigInt(index), fields)
          return toolTextResult({ cborHex: dataToHex(c), index, fieldCount: fields.length })
        }
        case "int": {
          if (!value) throw new Error("'value' is required")
          const d = Evolution.Data.int(BigInt(value))
          return toolTextResult({ cborHex: dataToHex(d), value })
        }
        case "bytes": {
          if (!value) throw new Error("'value' (hex string) is required")
          const d = Evolution.Data.bytearray(value)
          return toolTextResult({ cborHex: dataToHex(d), hex: value })
        }
        case "list": {
          const items = (fieldsCborHex ?? []).map((h: string) => Evolution.Data.fromCBORHex(h))
          const d = Evolution.Data.list(items)
          return toolTextResult({ cborHex: dataToHex(d), length: items.length })
        }
        case "map": {
          const entries = (entriesCborHex ?? []).map((e: { key: string; value: string }) => [
            Evolution.Data.fromCBORHex(e.key),
            Evolution.Data.fromCBORHex(e.value)
          ] as [any, any])
          const d = Evolution.Data.map(entries)
          return toolTextResult({ cborHex: dataToHex(d), entryCount: entries.length })
        }
        case "match": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          const result = (Evolution.Data.matchData as any)(d, {
            Constr: (c: any) => ({
              type: "constr" as const,
              index: String(c.index),
              fieldsCborHex: (c.fields as any[]).map(dataToHex)
            }),
            Map: (entries: any) => ({
              type: "map" as const,
              entries: [...entries].map(([k, v]: [any, any]) => ({ key: dataToHex(k), value: dataToHex(v) }))
            }),
            List: (items: any) => ({
              type: "list" as const,
              itemsCborHex: (items as any[]).map(dataToHex)
            }),
            Int: (i: any) => ({ type: "int" as const, value: String(i) }),
            Bytes: (b: any) => ({ type: "bytes" as const, hex: bytesToHex(b) })
          })
          return toolTextResult(result as any)
        }
        case "isConstr": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          return toolTextResult({ isConstr: Evolution.Data.isConstr(d) })
        }
        case "isMap": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          return toolTextResult({ isMap: Evolution.Data.isMap(d) })
        }
        case "isList": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          return toolTextResult({ isList: Evolution.Data.isList(d) })
        }
        case "isInt": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          return toolTextResult({ isInt: Evolution.Data.isInt(d) })
        }
        case "isBytes": {
          if (!dataCborHex) throw new Error("'dataCborHex' is required")
          const d = Evolution.Data.fromCBORHex(dataCborHex)
          return toolTextResult({ isBytes: Evolution.Data.isBytes(d) })
        }
      }
    }
  )

  // ── Hash tools ──────────────────────────────────────────────────────────

  server.registerTool(
    "hash_tools",
    {
      description:
        "Cardano hashing utilities (blake2b-256). " +
        "Actions: 'hashTransaction' computes transaction hash from TransactionBody CBOR hex, " +
        "'hashTransactionRaw' hashes raw CBOR bytes directly, " +
        "'hashAuxiliaryData' hashes AuxiliaryData CBOR hex.",
      inputSchema: z.object({
        action: z.enum(["hashTransaction", "hashTransactionRaw", "hashAuxiliaryData"]),
        cborHex: z.string().describe("CBOR hex of TransactionBody or AuxiliaryData or raw bytes")
      })
    },
    async ({ action, cborHex }) => {
      switch (action) {
        case "hashTransaction": {
          const body = Evolution.TransactionBody.fromCBORHex(cborHex)
          const hash = EvolutionHash.hashTransaction(body)
          return toolTextResult({ transactionHash: Evolution.TransactionHash.toHex(hash) })
        }
        case "hashTransactionRaw": {
          const bytes = hexToBytes(cborHex)
          const hash = EvolutionHash.hashTransactionRaw(bytes)
          return toolTextResult({ transactionHash: Evolution.TransactionHash.toHex(hash) })
        }
        case "hashAuxiliaryData": {
          const aux = Evolution.AuxiliaryData.fromCBORHex(cborHex)
          const hash = EvolutionHash.hashAuxiliaryData(aux)
          return toolTextResult({ auxiliaryDataHash: Evolution.AuxiliaryDataHash.toHex(hash) })
        }
      }
    }
  )

  // ── Devnet cluster tools ────────────────────────────────────────────────

  const DevnetConfigSchema = z
    .object({
      clusterName: z.string().optional(),
      networkMagic: z.number().int().positive().optional(),
      shelleyGenesis: z
        .object({
          slotLength: z.number().positive().optional(),
          epochLength: z.number().int().positive().optional(),
          activeSlotsCoeff: z.number().min(0).max(1).optional()
        })
        .optional(),
      kupo: z
        .object({
          enabled: z.boolean().optional(),
          port: z.number().int().positive().optional()
        })
        .optional(),
      ogmios: z
        .object({
          enabled: z.boolean().optional(),
          port: z.number().int().positive().optional()
        })
        .optional(),
      ports: z
        .object({
          node: z.number().int().positive().optional(),
          submit: z.number().int().positive().optional()
        })
        .optional()
    })
    .optional()

  const serializeCluster = (cluster: Devnet.Cluster.Cluster) => ({
    networkName: cluster.networkName,
    cardanoNode: { id: cluster.cardanoNode.id, name: cluster.cardanoNode.name },
    kupo: cluster.kupo ? { id: cluster.kupo.id, name: cluster.kupo.name } : null,
    ogmios: cluster.ogmios ? { id: cluster.ogmios.id, name: cluster.ogmios.name } : null,
    slotConfig: Devnet.Cluster.getSlotConfig(cluster)
  })

  server.registerTool(
    "devnet_create",
    {
      description:
        "Create a local Cardano devnet cluster using Docker. " +
        "Returns a cluster handle for use with other devnet_ tools. " +
        "Requires Docker to be running. Package: @evolution-sdk/devnet.",
      inputSchema: z.object({
        config: DevnetConfigSchema
      })
    },
    async ({ config }) => {
      const mergedConfig: Partial<Devnet.Config.DevNetConfig> | undefined = config
        ? {
            ...(config.clusterName ? { clusterName: config.clusterName } : undefined),
            ...(config.networkMagic ? { networkMagic: config.networkMagic } : undefined),
            ...(config.ports ? { ports: { ...Devnet.Config.DEFAULT_DEVNET_CONFIG.ports, ...config.ports } } : undefined),
            ...(config.shelleyGenesis
              ? {
                  shelleyGenesis: {
                    ...Devnet.Config.DEFAULT_SHELLEY_GENESIS,
                    ...config.shelleyGenesis
                  }
                }
              : undefined),
            ...(config.kupo
              ? { kupo: { ...Devnet.Config.DEFAULT_KUPO_CONFIG, ...config.kupo } }
              : undefined),
            ...(config.ogmios
              ? { ogmios: { ...Devnet.Config.DEFAULT_OGMIOS_CONFIG, ...config.ogmios } }
              : undefined)
          }
        : undefined

      const cluster = await Devnet.Cluster.make(mergedConfig)
      const clusterHandle = sessionStore.createCluster(cluster, cluster.networkName)

      return toolTextResult({
        clusterHandle,
        cluster: serializeCluster(cluster)
      })
    }
  )

  server.registerTool(
    "devnet_start",
    {
      description: "Start all containers in a devnet cluster. Waits for block production before returning.",
      inputSchema: z.object({
        clusterHandle: z.string()
      })
    },
    async ({ clusterHandle }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster
      await Devnet.Cluster.start(cluster)

      return toolTextResult({
        clusterHandle,
        status: "started",
        cluster: serializeCluster(cluster)
      })
    }
  )

  server.registerTool(
    "devnet_stop",
    {
      description: "Stop all containers in a devnet cluster without removing them.",
      inputSchema: z.object({
        clusterHandle: z.string()
      })
    },
    async ({ clusterHandle }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster
      await Devnet.Cluster.stop(cluster)

      return toolTextResult({ clusterHandle, status: "stopped" })
    }
  )

  server.registerTool(
    "devnet_remove",
    {
      description: "Stop and remove all containers in a devnet cluster.",
      inputSchema: z.object({
        clusterHandle: z.string()
      })
    },
    async ({ clusterHandle }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster
      await Devnet.Cluster.remove(cluster)
      sessionStore.delete(clusterHandle)

      return toolTextResult({ clusterHandle, status: "removed" })
    }
  )

  server.registerTool(
    "devnet_status",
    {
      description: "Get the status of containers in a devnet cluster.",
      inputSchema: z.object({
        clusterHandle: z.string(),
        containerName: z.enum(["cardanoNode", "kupo", "ogmios"]).optional()
      })
    },
    async ({ clusterHandle, containerName }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster

      const containers: Array<{ name: string; container: Devnet.Container.Container }> = containerName
        ? (() => {
            const c = cluster[containerName]
            if (!c) throw new Error(`Container ${containerName} is not part of this cluster`)
            return [{ name: containerName, container: c }]
          })()
        : [
            { name: "cardanoNode", container: cluster.cardanoNode },
            ...(cluster.kupo ? [{ name: "kupo", container: cluster.kupo }] : []),
            ...(cluster.ogmios ? [{ name: "ogmios", container: cluster.ogmios }] : [])
          ]

      const statuses = await Promise.all(
        containers.map(async ({ name, container }) => {
          const info = await Devnet.Container.getStatus(container)
          return {
            name,
            containerId: container.id,
            containerName: container.name,
            running: info?.State?.Running ?? false,
            status: info?.State?.Status ?? "unknown"
          }
        })
      )

      return toolTextResult({ clusterHandle, containers: statuses })
    }
  )

  server.registerTool(
    "devnet_exec",
    {
      description: "Execute a command inside a devnet container. Returns stdout.",
      inputSchema: z.object({
        clusterHandle: z.string(),
        containerName: z.enum(["cardanoNode", "kupo", "ogmios"]),
        command: z.array(z.string()).min(1)
      })
    },
    async ({ clusterHandle, containerName, command }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster
      const container = cluster[containerName]

      if (!container) {
        throw new Error(`Container ${containerName} is not part of this cluster`)
      }

      const output = await Devnet.Container.execCommand(container, command)
      return toolTextResult({ containerName, command, output })
    }
  )

  server.registerTool(
    "devnet_genesis_utxos",
    {
      description:
        "Calculate genesis UTxOs from cluster config (offline) or query them from a running cluster. " +
        "The 'calculate' action works without a running node.",
      inputSchema: z.object({
        clusterHandle: z.string(),
        action: z.enum(["calculate", "query"])
      })
    },
    async ({ clusterHandle, action }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster

      const utxos =
        action === "calculate"
          ? await Devnet.Genesis.calculateUtxosFromConfig(cluster.shelleyGenesis)
          : await Devnet.Genesis.queryUtxos(cluster)

      return toolTextResult({
        action,
        count: utxos.length,
        utxos: serializeUtxos(utxos as unknown as ReadonlyArray<Evolution.UTxO.UTxO>)
      })
    }
  )

  server.registerTool(
    "devnet_query_epoch",
    {
      description: "Query the current epoch from a running devnet cluster.",
      inputSchema: z.object({
        clusterHandle: z.string()
      })
    },
    async ({ clusterHandle }) => {
      const session = sessionStore.getCluster(clusterHandle)
      const cluster = session.cluster as Devnet.Cluster.Cluster
      const epoch = await Devnet.Genesis.queryCurrentEpoch(cluster)

      return toolTextResult({ epoch: epoch.toString() })
    }
  )

  server.registerTool(
    "devnet_config_defaults",
    {
      description: "Return the default devnet configuration values from @evolution-sdk/devnet.",
      inputSchema: z.object({
        section: z.enum(["all", "shelleyGenesis", "alonzoGenesis", "conwayGenesis", "byronGenesis", "kupo", "ogmios", "nodeConfig"]).optional()
      })
    },
    async ({ section }) => {
      const sectionName = section ?? "all"

      if (sectionName === "all") {
        return toolTextResult({
          clusterName: Devnet.Config.DEFAULT_DEVNET_CONFIG.clusterName,
          networkMagic: Devnet.Config.DEFAULT_DEVNET_CONFIG.networkMagic,
          image: Devnet.Config.DEFAULT_DEVNET_CONFIG.image,
          ports: Devnet.Config.DEFAULT_DEVNET_CONFIG.ports,
          kupo: Devnet.Config.DEFAULT_KUPO_CONFIG,
          ogmios: Devnet.Config.DEFAULT_OGMIOS_CONFIG
        })
      }

      const sections: Record<string, unknown> = {
        shelleyGenesis: Devnet.Config.DEFAULT_SHELLEY_GENESIS,
        alonzoGenesis: Devnet.Config.DEFAULT_ALONZO_GENESIS,
        conwayGenesis: Devnet.Config.DEFAULT_CONWAY_GENESIS,
        byronGenesis: Devnet.Config.DEFAULT_BYRON_GENESIS,
        kupo: Devnet.Config.DEFAULT_KUPO_CONFIG,
        ogmios: Devnet.Config.DEFAULT_OGMIOS_CONFIG,
        nodeConfig: Devnet.Config.DEFAULT_NODE_CONFIG
      }

      return toolTextResult({ [sectionName]: toStructured(sections[sectionName]) })
    }
  )

  return server
}
