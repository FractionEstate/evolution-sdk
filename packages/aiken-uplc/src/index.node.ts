/**
 * Node.js entry point - uses Node.js WASM target
 * 
 * @packageDocumentation
 */

import { makeEvaluator } from "./Evaluator.js"
import * as wasmModule from "./node/aiken_uplc.js"

/**
 * Create an Aiken UPLC evaluator for Evolution SDK (Node.js).
 * 
 * This evaluator provides local UPLC script evaluation using Aiken's evaluator
 * compiled to WASM, enabling offline transaction building and testing without
 * requiring a provider connection.
 * 
 * **Benefits:**
 * - No network dependency (works offline)
 * - Privacy (transaction never leaves local environment)
 * - Performance (no network latency)
 * - Deterministic evaluation for testing
 * 
 * @example
 * ```typescript
 * import { makeTxBuilder } from "@evolution-sdk/evolution"
 * import { createAikenEvaluator } from "@evolution-sdk/aiken-uplc"
 * 
 * const builder = makeTxBuilder({ wallet, provider })
 * 
 * const tx = await builder
 *   .collectFrom([scriptUtxo], redeemer)
 *   .attachScript({ script: validatorScript })
 *   .payToAddress({ address: recipientAddr, assets })
 *   .build({
 *     evaluator: createAikenEvaluator
 *   })
 * ```
 */
export const createAikenEvaluator = makeEvaluator(wasmModule)
