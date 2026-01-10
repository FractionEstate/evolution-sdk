---
"@evolution-sdk/scalus-uplc": patch
---

# Initial release: Scalus UPLC evaluator

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
