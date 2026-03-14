# Evolution MCP

`@evolution-sdk/mcp` exposes Evolution SDK functionality as an HTTP MCP server.

Default runtime configuration:

- Host: `127.0.0.1`
- Port: `10000`
- MCP endpoint: `/mcp`
- Health endpoint: `/health`

The package ships a Linux-first `postinstall` bootstrap that attempts to register and start a local background process so the server is reachable at `http://localhost:10000/mcp` after installation. If automatic startup cannot be completed, installation stays successful and the package prints a manual fallback.

## Commands

```bash
pnpm --filter @evolution-sdk/mcp build
pnpm --filter @evolution-sdk/mcp test
node packages/evolution-mcp/dist/bin.js serve
```

## Environment Variables

- `EVOLUTION_MCP_HOST`: bind host, default `127.0.0.1`
- `EVOLUTION_MCP_PORT`: bind port, default `10000`
- `EVOLUTION_MCP_PATH`: MCP route, default `/mcp`
- `EVOLUTION_MCP_HEALTH_PATH`: health route, default `/health`
- `EVOLUTION_MCP_SKIP_POSTINSTALL`: skip install-time bootstrap when set to `1`
- `EVOLUTION_MCP_POSTINSTALL_STRICT`: fail install if bootstrap fails when set to `1`

## Current Tool Surface

- SDK metadata, root export introspection, and server stats
- Stateless codecs for Address, Assets, CBOR, Plutus Data, identifiers and hashes, Transaction, TransactionWitnessSet, and Script
- Generic typed-export codec for any SDK module with `fromCBORHex`/`toCBORHex` (40+ modules including Certificate, Redeemer, Value, TransactionBody, and more)
- UPLC evaluator info and selection (`@evolution-sdk/aiken-uplc`, `@evolution-sdk/scalus-uplc`)
- Time/slot conversion: slot-to-Unix, Unix-to-slot, current slot, and per-network slot configuration
- CIP-57 Plutus blueprint parsing and TypeScript codegen
- CIP-8/CIP-30 message signing and verification
- Fee validation against protocol parameters
- CIP-68 metadata datum codec (encode, decode, token label constants)
- Key generation and management: BIP-39 mnemonics, BIP32-Ed25519 derivation, public key and key hash computation (devnet/testing only)
- Native script building and analysis: construct, parse, extract key hashes, count required signers, convert to cardano-cli JSON
- UTxO set operations: create, union, intersection, difference, size
- Low-level Bech32 encode/decode and byte array codec with length validation
- Client session creation and attachment
- Provider and wallet calls via client handles
- Transaction builder sessions and build operations (with optional Plutus evaluator)
- Sign and submit flows via result handles
- Local Cardano devnet management via Docker (`@evolution-sdk/devnet`): create, start, stop, remove clusters; query genesis UTxOs and epochs; execute container commands; inspect default configs

This package covers all four workspace packages: `@evolution-sdk/evolution`, `@evolution-sdk/aiken-uplc`, `@evolution-sdk/scalus-uplc`, and `@evolution-sdk/devnet`.