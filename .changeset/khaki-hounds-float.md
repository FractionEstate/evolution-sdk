---
"@evolution-sdk/evolution": patch
---

Add Message Signing and UPLC modules with comprehensive cryptographic and smart contract support.

## Message Signing Module

Added complete COSE (RFC 8152) message signing implementation for Cardano:

- **CIP-30 Wallet API Support**: Full implementation of `signData()` and verification APIs compatible with all major Cardano wallets
- **CIP-8 Compliance**: COSE_Sign1 structures for single-signature messages
- **COSE_Sign Support**: Multi-signature message support with separate signature headers
- **COSE_Key Integration**: EdDSA-25519 key representation and management
- **Protected/Unprotected Headers**: Flexible header management with algorithm ID, address, and custom parameters
- **Cryptographic Operations**: Blake2b hashing and Ed25519 signature verification
- **User-Facing Encoding**: Support for `cms_<base64url>` format

Key APIs:
- `signData()`: Sign messages with private keys using COSE_Sign1
- `verifyData()`: Verify signed messages with cryptographic validation
- Complete header management with `HeaderMap` and `Headers` classes
- Label support for both integer and text-based COSE parameters

## UPLC Module

Added comprehensive UPLC (Untyped Plutus Lambda Calculus) implementation:

- **Flat Serialization**: Complete encoder/decoder for Flat format used by Plutus Core
- **CBOR Integration**: Support for single and double CBOR-encoded scripts with automatic detection
- **Term System**: Full support for all UPLC term types including Var, Lambda, Apply, Constant, Builtin, Delay, Force, Constr, Case, and Error
- **Data Types**: Complete type system for Integer, ByteString, String, Unit, Bool, Data, List, and Pair
- **Builtin Functions**: Support for all 87 Plutus V3 builtin functions including BLS12-381 operations
- **Semantic Versioning**: Full version support for UPLC programs (major.minor.patch)
- **Effect Schema Integration**: Type-safe schemas with validation and transformation

Key APIs:
- `fromFlatBytes()` / `fromFlatHex()`: Decode UPLC programs from Flat encoding
- `toFlatBytes()` / `toFlatHex()`: Encode UPLC programs to Flat encoding
- `fromCborHexToProgram()`: Auto-detect and decode CBOR-encoded scripts
- `fromDoubleCborEncodedHex()`: Decode compiled Plutus scripts
- `applyParamsToScript()`: Apply PlutusData parameters to scripts with Aiken-compatible encoding
- `applyParamsToScriptWithSchema()`: Type-safe parameter application with schemas
- `dataConstant()`: Create UPLC constants from PlutusData
- `getCborEncodingLevel()`: Detect CBOR encoding level (none/single/double)

Both modules include comprehensive error handling, validation, and full Effect Schema integration for type safety.
