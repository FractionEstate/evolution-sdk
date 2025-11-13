import { Core } from '../../src'

// Standard union with auto indices (nested)
Core.TSchema.Union(
  Core.TSchema.Struct({ a: Core.TSchema.Integer }),
  Core.TSchema.Struct({ b: Core.TSchema.Integer })
)
// Encodes to: Constr(0, [Constr(0, [a])]) or Constr(1, [Constr(0, [b])])
