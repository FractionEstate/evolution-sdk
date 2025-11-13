import { Effect } from "effect"
import { runEffectPromise } from '../../src/utils/effect-runtime'

const myEffect = Effect.succeed(42)

async function example() {
  try {
    const result = await runEffectPromise(myEffect)
    console.log(result)
  } catch (error) {
    // Error with clean stack trace, no Effect.ts internals
    console.error(error)
  }
}
