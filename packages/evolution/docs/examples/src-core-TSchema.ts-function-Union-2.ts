import { Core } from '../../src'

// Mixed union: some nested, some flat
Core.TSchema.Union(
  Core.TSchema.Struct({ a: Core.TSchema.Integer }),  // nested, auto index 0
  Core.TSchema.Struct({ b: Core.TSchema.Integer }, { flat: true }),  // flat, auto index 1
  Core.TSchema.Struct({ c: Core.TSchema.Integer }, { index: 100, flat: true })  // flat, custom index 100
)
