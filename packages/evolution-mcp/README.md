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
- Address construction: build Base, Enterprise, and Reward addresses from credential hashes with network selection
- Credential tools: create key-hash and script-hash credentials, CBOR encode/decode
- DRep tools: create DReps from key/script hashes or special values (alwaysAbstain, alwaysNoConfidence), Bech32 round-trip, CBOR codec, inspection
- Transaction metadata: build typed metadata values (text, int, bytes, list, map), Conway auxiliary data construction and parsing
- Value arithmetic: create ADA-only or multi-asset Values, add, subtract, compare, extract ADA and assets
- Assets construction and arithmetic: build from lovelace/tokens/records, merge, subtract, coverage checks, unit listing, CBOR round-trip
- CIP-67 unit and label tools: parse/build asset unit strings, encode/decode CIP-67 label prefixes
- Coin arithmetic: safe ADA addition/subtraction with overflow checking, comparison, validation
- Network ID conversion: map between network names (Mainnet/Preview/Preprod) and numeric IDs
- Plutus Data construction: build constr/int/bytes/list/map values, pattern match, type checking
- Transaction hashing: blake2b-256 hash of TransactionBody, raw CBOR bytes, or AuxiliaryData
- Mint construction: build Mint values for minting/burning tokens, singleton/insert/remove/query operations, CBOR round-trip
- Withdrawals: build reward withdrawal maps, singleton/add/remove/query/entries operations, CBOR round-trip
- Governance Anchors: create Anchor values (URL + data hash) for proposals and certificates, CBOR round-trip
- Certificate building: all pre-Conway and Conway-era certificates (stakeRegistration, stakeDeregistration, stakeDelegation, poolRetirement, regCert, unregCert, voteDelegCert, stakeVoteDelegCert, stakeRegDelegCert, voteRegDelegCert), CBOR round-trip
- Redeemer/ExUnits: build spend/mint/cert/reward Redeemers with execution unit budgets, inspection, CBOR round-trip
- VotingProcedures: build governance votes with DRep/StakePool/CC voters, yes/no/abstain voting, optional Anchor, CBOR round-trip
- ScriptRef: build and parse CBOR tag-24 script references for transaction outputs
- Governance Actions: create all CIP-1694 governance actions (InfoAction, NoConfidenceAction, ParameterChangeAction, TreasuryWithdrawalsAction, HardForkInitiationAction, NewConstitutionAction, UpdateCommitteeAction), GovActionId references, pattern matching, CBOR round-trip
- Proposal Procedures: build governance ProposalProcedures combining deposit, reward account, governance action, and anchor; CBOR round-trip
- Transaction Outputs: build Babbage-era transaction outputs with address, value, optional datum hash or inline datum, optional script reference; inspect and parse existing outputs
- Plutus Data Codecs: structured encode/decode of typed Plutus data using SDK codecs — OutputReference, Credential, Address, Lovelace, and CIP-68 metadata; convert between typed representations and CBOR hex
- Pool Parameters: build full PoolParams for stake pool registration (operator, VRF key, pledge, cost, margin, relays, metadata), create SingleHostAddr/SingleHostName/MultiHostName relays, PoolRegistration/PoolRetirement certificates, validation helpers (hasMinimumCost, hasValidMargin), CBOR round-trip
- DRep Certificates: build governance DRep certificates — RegDrepCert (register with deposit + optional anchor), UnregDrepCert (unregister), UpdateDrepCert (update anchor)
- Committee Certificates: build constitutional committee certificates — AuthCommitteeHotCert (authorize hot key) and ResignCommitteeColdCert (resign with optional anchor)
- Constitution: build and encode/decode Constitution objects (anchor URL + optional guardrail script hash) for NewConstitutionAction governance proposals
- Protocol Parameter Updates: build ProtocolParamUpdate with all optional fields — fee params, size limits, deposits, execution units, ExUnitPrices, DRepVotingThresholds (10 thresholds), PoolVotingThresholds (5 thresholds), governance params; CBOR round-trip
- Client session creation and attachment
- Provider and wallet calls via client handles
- Transaction builder sessions and build operations (with optional Plutus evaluator)
- Sign and submit flows via result handles
- Local Cardano devnet management via Docker (`@evolution-sdk/devnet`): create, start, stop, remove clusters; query genesis UTxOs and epochs; execute container commands; inspect default configs

This package covers all four workspace packages: `@evolution-sdk/evolution`, `@evolution-sdk/aiken-uplc`, `@evolution-sdk/scalus-uplc`, and `@evolution-sdk/devnet`.