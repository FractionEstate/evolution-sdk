/**
 * Browser entry point - not implemented in rough draft
 *
 * @packageDocumentation
 */

import type * as TransactionBuilder from "@evolution-sdk/evolution/sdk/builders/TransactionBuilder"

/**
 * Create a Scalus UPLC evaluator instance for browser environments.
 *
 * @throws Error - Browser support not yet implemented
 */
export function createScalusEvaluator(): TransactionBuilder.Evaluator {
  throw new Error("Browser support not yet implemented for Scalus UPLC evaluator")
}
