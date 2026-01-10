---
title: blueprint/codegen-config.ts
nav_order: 18
parent: Modules
---

## codegen-config overview

Code generation configuration

Added in v2.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [CodegenConfig (interface)](#codegenconfig-interface)
  - [DEFAULT_CODEGEN_CONFIG](#default_codegen_config)
  - [EmptyConstructorStyle (type alias)](#emptyconstructorstyle-type-alias)
  - [FieldNamingConfig (interface)](#fieldnamingconfig-interface)
  - [ModuleStrategy (type alias)](#modulestrategy-type-alias)
  - [OptionStyle (type alias)](#optionstyle-type-alias)
  - [UnionStyle (type alias)](#unionstyle-type-alias)
  - [createCodegenConfig](#createcodegenconfig)

---

# utils

## CodegenConfig (interface)

Code generation configuration

**Signature**

````ts
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
   * e.g. data: 'import { Data } from "@evolution-sdk/evolution/Data"'
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
````

## DEFAULT_CODEGEN_CONFIG

Default code generation configuration

**Signature**

```ts
export declare const DEFAULT_CODEGEN_CONFIG: CodegenConfig
```

## EmptyConstructorStyle (type alias)

Configuration for how to generate empty constructors

**Signature**

```ts
export type EmptyConstructorStyle =
  | "Literal" // TSchema.Literal("Unit" as const)
  | "Struct"
```

## FieldNamingConfig (interface)

Configuration for field naming in constructors without explicit field names

**Signature**

```ts
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
```

## ModuleStrategy (type alias)

Module organization strategy

**Signature**

```ts
export type ModuleStrategy =
  | "flat" // Current: CardanoAddressCredential
  | "namespaced"
```

## OptionStyle (type alias)

Configuration for how to generate optional types `(Option<T>)`

**Signature**

```ts
export type OptionStyle =
  | "NullOr" // TSchema.NullOr(T)
  | "UndefinedOr" // TSchema.UndefinedOr(T)
  | "Union"
```

## UnionStyle (type alias)

Configuration for how to generate union types with named constructors

**Signature**

```ts
export type UnionStyle =
  | "Variant" // TSchema.Variant({ Tag1: { ... }, Tag2: { ... } })
  | "TaggedStruct"
```

## createCodegenConfig

Create a custom codegen configuration by merging with defaults

**Signature**

```ts
export declare function createCodegenConfig(config: Partial<CodegenConfig> = {}): CodegenConfig
```
