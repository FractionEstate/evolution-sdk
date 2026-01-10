# @evolution-sdk/scalus-uplc

## 0.0.2

### Patch Changes

- [#119](https://github.com/IntersectMBO/evolution-sdk/pull/119) [`150fde4`](https://github.com/IntersectMBO/evolution-sdk/commit/150fde4cc73a52b999f89578b07e1e5f4cab0418) Thanks [@sae3023](https://github.com/sae3023)! - # Initial release: Scalus UPLC evaluator

  Add JavaScript-based Plutus script evaluator using Scalus as an alternative to the WASM-based Aiken evaluator.

  ## Features
  - **Pure JavaScript evaluation**: Evaluate Plutus scripts without WASM dependencies
  - **Production-ready**: Scalus v0.14.2 with full Plutus V1/V2/V3 support
  - **Compatible API**: Drop-in replacement for Aiken evaluator with identical interface
  - **Tag mapping**: Automatic translation between Scalus string tags and Evolution RedeemerTag enum

  ## Use Cases
  - Environments where WASM is unavailable or restricted
  - Node.js applications requiring native JavaScript execution
  - Cross-platform compatibility without binary dependencies
  - Alternative evaluation for validation and testing

  ## Package Configuration

  Includes standard workspace integration with proper exports, TypeScript definitions, and ESLint configuration

- Updated dependencies [[`15be602`](https://github.com/IntersectMBO/evolution-sdk/commit/15be602a53dfcf59b8f0ccec55081904eaf7ff89), [`8b8ade7`](https://github.com/IntersectMBO/evolution-sdk/commit/8b8ade75f51dd1103dcf4b3714f0012d8e430725)]:
  - @evolution-sdk/evolution@0.3.12
