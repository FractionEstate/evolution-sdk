import { Core } from '../../src'

// Union with flat Structs (single-level encoding)
Core.TSchema.Union(
  Core.TSchema.Struct({ amount: Core.TSchema.Integer }, { index: 121, flat: true }),
  Core.TSchema.Struct({ amount: Core.TSchema.Integer }, { index: 122, flat: true })
)
// Encodes to: Constr(121, [amount]) or Constr(122, [amount]) - single level!
