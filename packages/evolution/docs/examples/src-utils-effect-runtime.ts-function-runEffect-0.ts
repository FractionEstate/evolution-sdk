import { Effect } from "effect"
import { runEffect } from '../../src/utils/effect-runtime'

const myEffect = Effect.succeed(42)

try {
  const result = runEffect(myEffect)
  console.log(result)
} catch (error) {
  // Error with clean stack trace, no Effect.ts internals
  console.error(error)
}
