import { makeEvaluator } from "./Evaluator.js"

/**
 * Create a Scalus UPLC evaluator instance.
 *
 * @returns A TransactionBuilder.Evaluator that uses Scalus for script evaluation
 *
 * @example
 * ```typescript
 * import { createScalusEvaluator } from "@evolution-sdk/scalus-uplc"
 *
 * const evaluator = createScalusEvaluator()
 * const redeemers = await Effect.runPromise(evaluator.evaluate(tx, utxos, context))
 * ```
 */
export const createScalusEvaluator = makeEvaluator()
