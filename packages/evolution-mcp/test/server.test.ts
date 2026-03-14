import { once } from "node:events"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

import { startHttpServer } from "../src/http.js"

const TEST_ADDRESS =
  "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs68faae"

const parseToolJson = <T>(result: unknown): T => {
  const content =
    typeof result === "object" && result !== null && "content" in result
      ? (result as { content?: Array<{ type?: string; text?: string }> }).content
      : undefined

  const text = content?.find((item) => item.type === "text")?.text
  if (!text) {
    throw new Error("Tool result did not include text content")
  }

  return JSON.parse(text) as T
}

describe("evolution-mcp", () => {
  test("serves MCP tools over HTTP and supports offline transaction building", async () => {
    const { server } = await startHttpServer({ port: 0 })
    const addressInfo = server.address()

    if (!addressInfo || typeof addressInfo === "string") {
      throw new Error("Failed to read bound server address")
    }

    const client = new Client({ name: "evolution-mcp-test", version: "1.0.0" })
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${addressInfo.port}/mcp`))

    await client.connect(transport)

    const toolsResult = await client.listTools()
    expect(toolsResult.tools.some((tool) => tool.name === "create_client")).toBe(true)
    expect(toolsResult.tools.some((tool) => tool.name === "sdk_exports")).toBe(true)
    expect(toolsResult.tools.some((tool) => tool.name === "cbor_codec")).toBe(true)
    expect(toolsResult.tools.some((tool) => tool.name === "data_codec")).toBe(true)
    expect(toolsResult.tools.some((tool) => tool.name === "identifier_codec")).toBe(true)

    const exportsResult = await client.callTool({
      name: "sdk_exports",
      arguments: {
        exportName: "Address"
      }
    })

    expect(parseToolJson<{ members: Array<{ name: string }> }>(exportsResult).members.some((member) => member.name === "fromBech32")).toBe(true)

    const addressCodecResult = await client.callTool({
      name: "address_codec",
      arguments: {
        action: "inspect",
        value: TEST_ADDRESS
      }
    })

    expect(parseToolJson<{ details: { address: { bech32: string } } }>(addressCodecResult).details.address.bech32).toBe(TEST_ADDRESS)

    const assetsCodecResult = await client.callTool({
      name: "assets_codec",
      arguments: {
        action: "merge",
        left: {
          lovelace: "1000000"
        },
        right: {
          lovelace: "2500000"
        }
      }
    })

    expect(parseToolJson<{ assets: { record: { lovelace: string } } }>(assetsCodecResult).assets.record.lovelace).toBe("3500000")

    const cborEncodeResult = await client.callTool({
      name: "cbor_codec",
      arguments: {
        action: "encode",
        optionsPreset: "canonical",
        value: {
          type: "map",
          entries: [
            {
              key: { type: "text", value: "hello" },
              value: {
                type: "array",
                items: [
                  { type: "integer", value: "42" },
                  { type: "bytes", hex: "deadbeef" }
                ]
              }
            }
          ]
        }
      }
    })

    const cborHex = parseToolJson<{ cborHex: string }>(cborEncodeResult).cborHex
    expect(cborHex.length).toBeGreaterThan(0)

    const cborDecodeResult = await client.callTool({
      name: "cbor_codec",
      arguments: {
        action: "decodeWithFormat",
        cborHex
      }
    })

    const decodedCbor = parseToolJson<{
      value: {
        type: string
        entries: Array<{ key: { type: string; value: string }; value: { type: string; items: Array<{ type: string; value?: string; hex?: string }> } }>
      }
      format: { type: string }
    }>(cborDecodeResult)

    expect(decodedCbor.value.type).toBe("map")
    expect(decodedCbor.value.entries[0]?.key.value).toBe("hello")
    expect(decodedCbor.value.entries[0]?.value.items[1]?.hex).toBe("deadbeef")
    expect(decodedCbor.format.type).toBe("map")

    const dataEncodeResult = await client.callTool({
      name: "data_codec",
      arguments: {
        action: "encode",
        optionsPreset: "aiken",
        value: {
          type: "constr",
          index: "0",
          fields: [
            { type: "int", value: "42" },
            { type: "bytes", hex: "deadbeef" }
          ]
        }
      }
    })

    const dataCborHex = parseToolJson<{ cborHex: string }>(dataEncodeResult).cborHex
    expect(dataCborHex.length).toBeGreaterThan(0)

    const dataHashResult = await client.callTool({
      name: "data_codec",
      arguments: {
        action: "hashData",
        dataCborHex,
        optionsPreset: "aiken"
      }
    })

    const hashedData = parseToolJson<{
      data: { type: string; index: string; fields: Array<{ type: string; value?: string; hex?: string }> }
      datumHash: string
      structuralHash: number
    }>(dataHashResult)

    expect(hashedData.data.type).toBe("constr")
    expect(hashedData.data.index).toBe("0")
    expect(hashedData.data.fields[0]?.value).toBe("42")
    expect(hashedData.datumHash).toHaveLength(64)
    expect(Number.isInteger(hashedData.structuralHash)).toBe(true)

    const poolKeyHashHex = "11".repeat(28)
    const poolIdentifierResult = await client.callTool({
      name: "identifier_codec",
      arguments: {
        kind: "poolKeyHash",
        action: "decode",
        input: poolKeyHashHex,
        inputFormat: "hex"
      }
    })

    const decodedPool = parseToolJson<{
      identifier: { type: string; hex: string; bech32: string }
    }>(poolIdentifierResult)

    expect(decodedPool.identifier.type).toBe("poolKeyHash")
    expect(decodedPool.identifier.hex).toBe(poolKeyHashHex)
    expect(decodedPool.identifier.bech32.startsWith("pool1")).toBe(true)

    const drepEncodeResult = await client.callTool({
      name: "identifier_codec",
      arguments: {
        kind: "drep",
        action: "encode",
        value: {
          type: "drep",
          drepType: "alwaysAbstain"
        }
      }
    })

    const encodedDrep = parseToolJson<{
      identifier: { type: string; drepType: string; cborHex: string }
    }>(drepEncodeResult)

    expect(encodedDrep.identifier.type).toBe("drep")
    expect(encodedDrep.identifier.drepType).toBe("alwaysAbstain")
    expect(encodedDrep.identifier.cborHex.length).toBeGreaterThan(0)

    const drepEqualityResult = await client.callTool({
      name: "identifier_codec",
      arguments: {
        kind: "drep",
        action: "equals",
        left: encodedDrep.identifier.cborHex,
        leftFormat: "cbor",
        right: encodedDrep.identifier.cborHex,
        rightFormat: "cbor"
      }
    })

    expect(parseToolJson<{ equal: boolean }>(drepEqualityResult).equal).toBe(true)

    const createClientResult = await client.callTool({
      name: "create_client",
      arguments: {
        network: "preview",
        provider: {
          type: "koios",
          baseUrl: "http://127.0.0.1:65535"
        },
        wallet: {
          type: "read-only",
          address: TEST_ADDRESS
        }
      }
    })

    const clientHandle = parseToolJson<{ clientHandle: string }>(createClientResult).clientHandle

    const addressResult = await client.callTool({
      name: "client_invoke",
      arguments: {
        clientHandle,
        method: "address"
      }
    })

    expect(parseToolJson<{ address: string }>(addressResult).address).toBe(TEST_ADDRESS)

    const builderResult = await client.callTool({
      name: "tx_builder_create",
      arguments: { clientHandle }
    })

    const builderHandle = parseToolJson<{ builderHandle: string }>(builderResult).builderHandle

    await client.callTool({
      name: "tx_builder_apply",
      arguments: {
        builderHandle,
        operation: "payToAddress",
        address: TEST_ADDRESS,
        assets: {
          lovelace: "1500000"
        }
      }
    })

    const buildResult = await client.callTool({
      name: "tx_builder_build",
      arguments: {
        builderHandle,
        buildOptions: {
          changeAddress: TEST_ADDRESS,
          availableUtxos: [
            {
              transactionId: "11".repeat(32),
              index: 0,
              address: TEST_ADDRESS,
              assets: {
                lovelace: "10000000"
              }
            }
          ],
          protocolParameters: {
            minFeeCoefficient: 44,
            minFeeConstant: 155381,
            coinsPerUtxoByte: 4310,
            maxTxSize: 16384,
            priceMem: 0.0577,
            priceStep: 0.0000721,
            minFeeRefScriptCostPerByte: 44
          }
        }
      }
    })

    const built = parseToolJson<{
      resultType: string
      transaction: { cborHex: string }
      estimatedFee: string
    }>(buildResult)

    expect(built.resultType).toBe("transaction-result")
    expect(built.transaction.cborHex.length).toBeGreaterThan(0)
    expect(Number.parseInt(built.estimatedFee, 10)).toBeGreaterThan(0)

    const transactionCodecResult = await client.callTool({
      name: "transaction_codec",
      arguments: {
        action: "decode",
        transactionCborHex: built.transaction.cborHex
      }
    })

    expect(parseToolJson<{ transaction: { cborHex: string } }>(transactionCodecResult).transaction.cborHex).toBe(built.transaction.cborHex)

    // typed_export_codec: listModules
    const listModulesResult = await client.callTool({
      name: "typed_export_codec",
      arguments: {
        moduleName: "TransactionInput",
        action: "listModules"
      }
    })

    const listedModules = parseToolJson<{ modules: Array<string> }>(listModulesResult).modules
    expect(listedModules).toContain("TransactionInput")
    expect(listedModules).toContain("Certificate")
    expect(listedModules).toContain("Value")
    expect(listedModules).not.toContain("DRep")

    // typed_export_codec: decode TransactionInput
    const txInputCborHex = "825820000000000000000000000000000000000000000000000000000000000000000000"

    const typedDecodeResult = await client.callTool({
      name: "typed_export_codec",
      arguments: {
        moduleName: "TransactionInput",
        action: "decode",
        cborHex: txInputCborHex
      }
    })

    const decodedInput = parseToolJson<{
      moduleName: string
      json: { _tag: string; index: string }
      cborHex: string
    }>(typedDecodeResult)

    expect(decodedInput.moduleName).toBe("TransactionInput")
    expect(decodedInput.json._tag).toBe("TransactionInput")
    expect(decodedInput.cborHex).toBe(txInputCborHex)

    // typed_export_codec: reencode TransactionInput
    const typedReencodeResult = await client.callTool({
      name: "typed_export_codec",
      arguments: {
        moduleName: "TransactionInput",
        action: "reencode",
        cborHex: txInputCborHex
      }
    })

    expect(parseToolJson<{ cborHex: string }>(typedReencodeResult).cborHex).toBe(txInputCborHex)

    // evaluator_info: list available evaluators
    const evaluatorInfoResult = await client.callTool({
      name: "evaluator_info",
      arguments: {}
    })

    const evaluatorInfo = parseToolJson<{
      evaluators: Array<{ name: string; package: string; available: boolean }>
      usage: string
    }>(evaluatorInfoResult)

    expect(evaluatorInfo.evaluators).toHaveLength(2)
    expect(evaluatorInfo.evaluators[0]?.name).toBe("aiken")
    expect(evaluatorInfo.evaluators[0]?.available).toBe(true)
    expect(evaluatorInfo.evaluators[1]?.name).toBe("scalus")
    expect(evaluatorInfo.evaluators[1]?.available).toBe(true)

    // devnet_config_defaults: get defaults
    const devnetDefaultsResult = await client.callTool({
      name: "devnet_config_defaults",
      arguments: { section: "all" }
    })

    const devnetDefaults = parseToolJson<{
      clusterName: string
      networkMagic: number
      image: string
    }>(devnetDefaultsResult)

    expect(devnetDefaults.clusterName).toBeTruthy()
    expect(devnetDefaults.networkMagic).toBe(42)
    expect(devnetDefaults.image).toContain("cardano-node")

    // time_slot_convert: slotToUnix
    const slotToUnixResult = await client.callTool({
      name: "time_slot_convert",
      arguments: {
        action: "slotToUnix",
        network: "Mainnet",
        slot: "0"
      }
    })

    const slotUnix = parseToolJson<{ slot: string; unixTimeMs: string; isoDate: string }>(slotToUnixResult)
    expect(slotUnix.slot).toBe("0")
    expect(Number(slotUnix.unixTimeMs)).toBeGreaterThan(0)
    expect(slotUnix.isoDate).toContain("2020")

    // time_slot_convert: getConfig
    const slotConfigResult = await client.callTool({
      name: "time_slot_convert",
      arguments: {
        action: "getConfig",
        network: "Preview"
      }
    })

    const slotConfig = parseToolJson<{ network: string; zeroTime: string; slotLength: number }>(slotConfigResult)
    expect(slotConfig.network).toBe("Preview")
    expect(slotConfig.slotLength).toBe(1000)

    // blueprint_parse
    const minimalBlueprint = JSON.stringify({
      preamble: {
        title: "test",
        version: "0.0.0",
        plutusVersion: "v3",
        compiler: { name: "Aiken", version: "v1.0.0" }
      },
      validators: [
        {
          title: "test.spend",
          compiledCode: "4e4d01000033222220051",
          hash: "abababababababababababababababababababababababababababababab"
        }
      ],
      definitions: {}
    })

    const blueprintParseResult = await client.callTool({
      name: "blueprint_parse",
      arguments: { blueprintJson: minimalBlueprint }
    })

    const parsedBp = parseToolJson<{
      preamble: { title: string }
      validatorCount: number
      validators: Array<{ title: string; hash: string }>
    }>(blueprintParseResult)

    expect(parsedBp.preamble.title).toBe("test")
    expect(parsedBp.validatorCount).toBe(1)
    expect(parsedBp.validators[0]?.title).toBe("test.spend")

    // blueprint_codegen
    const blueprintCodegenResult = await client.callTool({
      name: "blueprint_codegen",
      arguments: { blueprintJson: minimalBlueprint }
    })

    const codegen = parseToolJson<{ generatedTypeScript: string }>(blueprintCodegenResult)
    expect(codegen.generatedTypeScript.length).toBeGreaterThan(0)

    // message_sign + message_verify round-trip
    // Generate test key material outside MCP (for constructing hex inputs)
    const { PrivateKey, KeyHash } = await import("@evolution-sdk/evolution")
    const rawBytes = PrivateKey.generate()
    const pk = PrivateKey.fromBytes(rawBytes)
    const pkHex = PrivateKey.toHex(pk)
    const kh = KeyHash.fromPrivateKey(pk)
    const khHex = KeyHash.toHex(kh)
    const payloadHex = "48656c6c6f" // "Hello" in hex

    const signResult = await client.callTool({
      name: "message_sign",
      arguments: {
        addressHex: khHex,
        payload: payloadHex,
        privateKeyHex: pkHex
      }
    })

    const signed = parseToolJson<{ signature: string; key: string }>(signResult)
    expect(signed.signature.length).toBeGreaterThan(0)
    expect(signed.key.length).toBeGreaterThan(0)

    const verifyResult = await client.callTool({
      name: "message_verify",
      arguments: {
        addressHex: khHex,
        keyHash: khHex,
        payload: payloadHex,
        signedMessage: { signature: signed.signature, key: signed.key }
      }
    })

    expect(parseToolJson<{ valid: boolean }>(verifyResult).valid).toBe(true)

    // fee_validate: use the transaction built earlier
    const feeValidateResult = await client.callTool({
      name: "fee_validate",
      arguments: {
        transactionCborHex: built.transaction.cborHex,
        minFeeCoefficient: "44",
        minFeeConstant: "155381"
      }
    })

    const feeResult = parseToolJson<{
      isValid: boolean
      actualFee: string
      minRequiredFee: string
      txSizeBytes: number
      difference: string
    }>(feeValidateResult)

    expect(typeof feeResult.isValid).toBe("boolean")
    expect(Number(feeResult.actualFee)).toBeGreaterThan(0)
    expect(Number(feeResult.minRequiredFee)).toBeGreaterThan(0)
    expect(feeResult.txSizeBytes).toBeGreaterThan(0)

    // cip68_codec: tokenLabels
    const cip68LabelsResult = await client.callTool({
      name: "cip68_codec",
      arguments: { action: "tokenLabels" }
    })

    const labels = parseToolJson<{
      REFERENCE_TOKEN_LABEL: number
      NFT_TOKEN_LABEL: number
      FT_TOKEN_LABEL: number
      RFT_TOKEN_LABEL: number
    }>(cip68LabelsResult)

    expect(labels.REFERENCE_TOKEN_LABEL).toBe(100)
    expect(labels.NFT_TOKEN_LABEL).toBe(222)
    expect(labels.FT_TOKEN_LABEL).toBe(333)
    expect(labels.RFT_TOKEN_LABEL).toBe(444)

    // cip68_codec: encode then decode round-trip
    const cip68EncodeResult = await client.callTool({
      name: "cip68_codec",
      arguments: {
        action: "encode",
        datum: {
          metadata: { type: "map", entries: [] },
          version: 1,
          extra: []
        }
      }
    })

    const cip68Encoded = parseToolJson<{ cborHex: string }>(cip68EncodeResult)
    expect(cip68Encoded.cborHex.length).toBeGreaterThan(0)

    const cip68DecodeResult = await client.callTool({
      name: "cip68_codec",
      arguments: {
        action: "decode",
        cborHex: "d8799fbf446e616d654474657374ff0180ff"
      }
    })

    const cip68Decoded = parseToolJson<{ version: number }>(cip68DecodeResult)
    expect(cip68Decoded.version).toBe(1)

    // key_generate: generateMnemonic
    const mnemonicResult = await client.callTool({
      name: "key_generate",
      arguments: { action: "generateMnemonic" }
    })

    const mnemonicData = parseToolJson<{
      mnemonic: string
      wordCount: number
      strength: number
    }>(mnemonicResult)

    expect(mnemonicData.wordCount).toBe(24)
    expect(mnemonicData.strength).toBe(256)

    // key_generate: validateMnemonic
    const validateResult = await client.callTool({
      name: "key_generate",
      arguments: {
        action: "validateMnemonic",
        mnemonic: mnemonicData.mnemonic
      }
    })

    expect(parseToolJson<{ valid: boolean }>(validateResult).valid).toBe(true)

    // key_generate: fromMnemonicCardano
    const deriveResult = await client.callTool({
      name: "key_generate",
      arguments: {
        action: "fromMnemonicCardano",
        mnemonic: mnemonicData.mnemonic,
        account: 0,
        role: "0",
        index: 0
      }
    })

    const derived = parseToolJson<{
      privateKeyHex: string
      privateKeyBech32: string
      publicKeyHex: string
      keyHashHex: string
      derivationPath: string
    }>(deriveResult)

    expect(derived.privateKeyHex.length).toBe(128)
    expect(derived.privateKeyBech32.startsWith("ed25519e_sk")).toBe(true)
    expect(derived.publicKeyHex.length).toBe(64)
    expect(derived.keyHashHex.length).toBe(56)
    expect(derived.derivationPath).toBe("m/1852'/1815'/0'/0/0")

    // key_generate: keyHash
    const keyHashResult = await client.callTool({
      name: "key_generate",
      arguments: {
        action: "keyHash",
        privateKeyHex: derived.privateKeyHex
      }
    })

    const keyHashData = parseToolJson<{ keyHashHex: string; publicKeyHex: string }>(keyHashResult)
    expect(keyHashData.keyHashHex).toBe(derived.keyHashHex)
    expect(keyHashData.publicKeyHex).toBe(derived.publicKeyHex)

    // native_script_tools: build a pubKey script
    const nsBuildResult = await client.callTool({
      name: "native_script_tools",
      arguments: {
        action: "build",
        spec: { tag: "pubKey", keyHashHex: derived.keyHashHex }
      }
    })

    const nsBuilt = parseToolJson<{
      cborHex: string
      json: { type: string; keyHash: string }
      script: { tag: string; keyHashHex: string }
    }>(nsBuildResult)

    expect(nsBuilt.json.type).toBe("sig")
    expect(nsBuilt.json.keyHash).toBe(derived.keyHashHex)
    expect(nsBuilt.cborHex.length).toBeGreaterThan(0)

    // native_script_tools: parseCbor round-trip
    const nsParsedResult = await client.callTool({
      name: "native_script_tools",
      arguments: {
        action: "parseCbor",
        cborHex: nsBuilt.cborHex
      }
    })

    const nsParsed = parseToolJson<{
      script: { tag: string; keyHashHex: string }
      json: { type: string }
    }>(nsParsedResult)

    expect(nsParsed.script.tag).toBe("pubKey")
    expect(nsParsed.script.keyHashHex).toBe(derived.keyHashHex)

    // native_script_tools: build a complex script (all + time lock)
    const nsComplexResult = await client.callTool({
      name: "native_script_tools",
      arguments: {
        action: "build",
        spec: {
          tag: "all",
          scripts: [
            { tag: "pubKey", keyHashHex: derived.keyHashHex },
            { tag: "invalidBefore", slot: "1000" }
          ]
        }
      }
    })

    const nsComplex = parseToolJson<{
      cborHex: string
      json: { type: string }
    }>(nsComplexResult)

    expect(nsComplex.json.type).toBe("all")
    expect(nsComplex.cborHex.length).toBeGreaterThan(0)

    // native_script_tools: extractKeyHashes
    const nsHashesResult = await client.callTool({
      name: "native_script_tools",
      arguments: {
        action: "extractKeyHashes",
        cborHex: nsComplex.cborHex
      }
    })

    const nsHashes = parseToolJson<{ keyHashes: string[]; count: number }>(nsHashesResult)
    expect(nsHashes.count).toBe(1)
    expect(nsHashes.keyHashes[0]).toBe(derived.keyHashHex)

    // native_script_tools: countRequiredSigners
    const nsCountResult = await client.callTool({
      name: "native_script_tools",
      arguments: {
        action: "countRequiredSigners",
        cborHex: nsComplex.cborHex
      }
    })

    expect(parseToolJson<{ requiredSigners: number }>(nsCountResult).requiredSigners).toBe(1)

    // utxo_tools: create + size
    const utxoCreateResult = await client.callTool({
      name: "utxo_tools",
      arguments: {
        action: "create",
        utxos: [
          {
            transactionId: "11".repeat(32),
            index: 0,
            address: TEST_ADDRESS,
            assets: { lovelace: "5000000" }
          },
          {
            transactionId: "22".repeat(32),
            index: 1,
            address: TEST_ADDRESS,
            assets: { lovelace: "3000000" }
          }
        ]
      }
    })

    const utxoCreated = parseToolJson<{
      size: number
      utxos: Array<{ transactionId: string; outRef: string }>
    }>(utxoCreateResult)

    expect(utxoCreated.size).toBe(2)

    // utxo_tools: difference
    const utxoDiffResult = await client.callTool({
      name: "utxo_tools",
      arguments: {
        action: "difference",
        left: [
          { transactionId: "11".repeat(32), index: 0, address: TEST_ADDRESS, assets: { lovelace: "5000000" } },
          { transactionId: "22".repeat(32), index: 1, address: TEST_ADDRESS, assets: { lovelace: "3000000" } }
        ],
        right: [
          { transactionId: "11".repeat(32), index: 0, address: TEST_ADDRESS, assets: { lovelace: "5000000" } }
        ]
      }
    })

    const utxoDiff = parseToolJson<{
      operation: string
      resultSize: number
    }>(utxoDiffResult)

    expect(utxoDiff.operation).toBe("difference")
    expect(utxoDiff.resultSize).toBe(1)

    // bech32_codec: encode
    const bech32EncodeResult = await client.callTool({
      name: "bech32_codec",
      arguments: {
        action: "encode",
        hex: "11".repeat(28),
        prefix: "pool"
      }
    })

    const bech32Enc = parseToolJson<{ bech32: string; hex: string; prefix: string }>(bech32EncodeResult)
    expect(bech32Enc.bech32.startsWith("pool1")).toBe(true)
    expect(bech32Enc.prefix).toBe("pool")

    // bech32_codec: decode
    const bech32DecodeResult = await client.callTool({
      name: "bech32_codec",
      arguments: {
        action: "decode",
        bech32: bech32Enc.bech32
      }
    })

    const bech32Dec = parseToolJson<{ prefix: string; hex: string; byteLength: number }>(bech32DecodeResult)
    expect(bech32Dec.prefix).toBe("pool")
    expect(bech32Dec.hex).toBe("11".repeat(28))
    expect(bech32Dec.byteLength).toBe(28)

    // bytes_codec: fromHex
    const bytesResult = await client.callTool({
      name: "bytes_codec",
      arguments: {
        action: "fromHex",
        hex: "deadbeef"
      }
    })

    const bytesData = parseToolJson<{ hex: string; byteLength: number }>(bytesResult)
    expect(bytesData.hex).toBe("deadbeef")
    expect(bytesData.byteLength).toBe(4)

    // bytes_codec: validate
    const bytesValidateResult = await client.callTool({
      name: "bytes_codec",
      arguments: {
        action: "validate",
        hex: "00".repeat(32),
        expectedLength: 32
      }
    })

    const bytesValid = parseToolJson<{
      byteLength: number
      matchesExpected: boolean
      matchesKnownSize: boolean
    }>(bytesValidateResult)

    expect(bytesValid.byteLength).toBe(32)
    expect(bytesValid.matchesExpected).toBe(true)
    expect(bytesValid.matchesKnownSize).toBe(true)

    // bytes_codec: equals
    const bytesEqResult = await client.callTool({
      name: "bytes_codec",
      arguments: {
        action: "equals",
        leftHex: "deadbeef",
        rightHex: "deadbeef"
      }
    })

    expect(parseToolJson<{ equal: boolean }>(bytesEqResult).equal).toBe(true)

    // Verify all tools are listed
    const allTools = await client.listTools()
    const toolNames = allTools.tools.map((t) => t.name)
    expect(toolNames).toContain("evaluator_info")
    expect(toolNames).toContain("time_slot_convert")
    expect(toolNames).toContain("blueprint_parse")
    expect(toolNames).toContain("blueprint_codegen")
    expect(toolNames).toContain("message_sign")
    expect(toolNames).toContain("message_verify")
    expect(toolNames).toContain("fee_validate")
    expect(toolNames).toContain("cip68_codec")
    expect(toolNames).toContain("key_generate")
    expect(toolNames).toContain("native_script_tools")
    expect(toolNames).toContain("utxo_tools")
    expect(toolNames).toContain("bech32_codec")
    expect(toolNames).toContain("bytes_codec")
    expect(toolNames).toContain("devnet_create")
    expect(toolNames).toContain("devnet_start")
    expect(toolNames).toContain("devnet_stop")
    expect(toolNames).toContain("devnet_remove")
    expect(toolNames).toContain("devnet_status")
    expect(toolNames).toContain("devnet_exec")
    expect(toolNames).toContain("devnet_genesis_utxos")
    expect(toolNames).toContain("devnet_query_epoch")
    expect(toolNames).toContain("devnet_config_defaults")

    await client.close()
    await transport.close()

    server.close()
    await once(server, "close")
  })
})