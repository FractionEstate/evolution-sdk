import { Core } from '../../src'

// Custom index but stay nested (advanced use case)
Core.TSchema.Struct({ data: Core.TSchema.Integer }, { index: 10, flat: false })
