import { Core } from '../../src'

// Flat union variants with custom indices
Core.TSchema.Struct({ amount: Core.TSchema.Integer }, { index: 121, flat: true })
Core.TSchema.Struct({ amount: Core.TSchema.Integer }, { index: 122, flat: true })
