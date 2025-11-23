/**
 * Code generation configuration
 * 
 * @since 2.0.0
 * @category blueprint
 */

/**
 * Configuration for how to generate optional types `(Option<T>)`
 */
export type OptionStyle = 
  | "NullOr"      // TSchema.NullOr(T)
  | "UndefinedOr" // TSchema.UndefinedOr(T)
  | "Union"       // Keep as Union of TaggedStruct("Some", ...) | TaggedStruct("None", ...)

/**
 * Configuration for how to generate union types with named constructors
 */
export type UnionStyle =
  | "Variant"       // TSchema.Variant({ Tag1: { ... }, Tag2: { ... } })
  | "TaggedStruct"  // TSchema.Union(TaggedStruct("Tag1", ...), TaggedStruct("Tag2", ...))

/**
 * Configuration for how to generate empty constructors
 */
export type EmptyConstructorStyle =
  | "Literal"  // TSchema.Literal("Unit" as const)
  | "Struct"   // TSchema.Struct({})

/**
 * Module organization strategy
 */
export type ModuleStrategy =
  | "flat"        // Current: CardanoAddressCredential
  | "namespaced"  // Nested namespaces: Cardano.Address.Credential

/**
 * Configuration for field naming in constructors without explicit field names
 */
export interface FieldNamingConfig {
  /**
   * Name to use for single unnamed field
   * @default "value"
   */
  singleFieldName: string

  /**
   * Pattern to use for multiple unnamed fields
   * @default "field{index}" where {index} is replaced with field number
   */
  multiFieldPattern: string
}

/**
 * Code generation configuration
 */
export interface CodegenConfig {
  /**
   * How to generate Option<T> types
   * @default "NullOr"
   */
  optionStyle: OptionStyle

  /**
   * How to generate union types with named constructors
   * @default "Variant"
   */
  unionStyle: UnionStyle

  /**
   * Force Variant style even when Blueprint fields are unnamed
   * When true, will use custom field names from variantFieldNames map
   * or fall back to singleFieldName/multiFieldPattern
   * @default false
   */
  forceVariant?: boolean

  /**
   * Custom field names for Variant constructors when Blueprint has unnamed fields
   * Map from "TypeTitle.ConstructorTitle" to array of field names
   * Example: 
   * ```
   * { "Credential.VerificationKey": ["hash"], "Credential.Script": ["hash"] }
   * ```
   */
  variantFieldNames?: Record<string, Array<string>>

  /**
   * How to generate empty constructors
   * @default "Literal"
   */
  emptyConstructorStyle: EmptyConstructorStyle

  /**
   * Field naming configuration
   */
  fieldNaming: FieldNamingConfig

  /**
   * Whether to include index in TSchema constructors
   * @default false
   */
  includeIndex: boolean

  /**
   * Whether to use `Schema.suspend()` for forward references
   * Only disable if you're sure there are no circular dependencies
   * @default true
   */
  useSuspend: boolean

  /**
   * Module organization strategy
   * - "flat": Current behavior (CardanoAddressCredential)
   * - "namespaced": Nested namespaces (Cardano.Address.Credential)
   * @default "flat"
   */
  moduleStrategy: ModuleStrategy

  /**
   * Whether to use relative references within same namespace
   * Only applies when moduleStrategy is "namespaced"
   * @default true
   */
  useRelativeRefs: boolean

  /**
   * Explicit import lines for Data, TSchema, and effect modules
   * e.g. data: 'import { Data } from "@evolution-sdk/evolution/core/Data"'
   */
  imports: {
    data: string
    tschema: string
    /** Optional explicit import line for Effect Schema (`Schema`). Omit to skip emitting it. */
    effect?: string
  }

  /**
   * Indentation to use in generated code
   * @default "  " (2 spaces)
   */
  indent: string
}

/**
 * Default code generation configuration
 */
export const DEFAULT_CODEGEN_CONFIG: CodegenConfig = {
  optionStyle: "NullOr",
  unionStyle: "Variant",
  emptyConstructorStyle: "Literal",
  fieldNaming: {
    singleFieldName: "value",
    multiFieldPattern: "field{index}"
  },
  includeIndex: false,
  useSuspend: true,
  moduleStrategy: "flat",
  useRelativeRefs: true,
  imports: {
    data: 'import { Data } from "@evolution-sdk/evolution/core/Data"',
    tschema: 'import { TSchema } from "@evolution-sdk/evolution/core/TSchema"'
  },
  indent: "  "
}

/**
 * Create a custom codegen configuration by merging with defaults
 */
export function createCodegenConfig(
  config: Partial<CodegenConfig> = {}
): CodegenConfig {
  return {
    ...DEFAULT_CODEGEN_CONFIG,
    ...config,
    fieldNaming: {
      ...DEFAULT_CODEGEN_CONFIG.fieldNaming,
      ...config.fieldNaming
    },
    imports: {
      ...DEFAULT_CODEGEN_CONFIG.imports,
      ...config.imports
    },
    indent: config.indent ?? DEFAULT_CODEGEN_CONFIG.indent
  }
}
