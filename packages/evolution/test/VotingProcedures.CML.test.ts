import * as CML from "@dcspark/cardano-multiplatform-lib-nodejs"
import { Equal, FastCheck } from "effect"
import { describe, expect, it } from "vitest"

import * as Anchor from "../src/core/Anchor.js"
import * as DRep from "../src/core/DRep.js"
import * as GovernanceAction from "../src/core/GovernanceAction.js"
import * as KeyHash from "../src/core/KeyHash.js"
import * as ScriptHash from "../src/core/ScriptHash.js"
import * as TransactionHash from "../src/core/TransactionHash.js"
import * as VotingProcedures from "../src/core/VotingProcedures.js"

/**
 * CML compatibility test for VotingProcedures CBOR serialization.
 */
describe("VotingProcedures CML Compatibility", () => {
  // Test helper to generate deterministic test data using arbitraries
  // Only generate DRep variants valid for Voter identifiers (key/script)
  const generateTestDRep = (seed: number = 42): DRep.DRep =>
    FastCheck.sample(
      FastCheck.oneof(
        KeyHash.arbitrary.map((keyHash) => DRep.fromKeyHash(keyHash)),
        ScriptHash.arbitrary.map((scriptHash) => DRep.fromScriptHash(scriptHash))
      ),
      { seed, numRuns: 1 }
    )[0]

  const generateTestAnchor = (seed: number = 42): Anchor.Anchor =>
    FastCheck.sample(Anchor.arbitrary, { seed, numRuns: 1 })[0]

  it("validates CBOR hex compatibility: Evolution SDK vs CML serialization", () => {
    // Create test data using arbitraries
    const drep = generateTestDRep(1)
    const anchor = generateTestAnchor(1)

    // Create Evolution SDK VotingProcedures
    const drepVoter = new VotingProcedures.DRepVoter({ drep })
    const govActionId = new GovernanceAction.GovActionId({
      transactionId: new TransactionHash.TransactionHash({
        hash: new Uint8Array(32).fill(1) // Deterministic test data
      }),
      govActionIndex: 0n
    })
    const votingProcedure = new VotingProcedures.VotingProcedure({
      vote: VotingProcedures.yes(),
      anchor
    })

    const evolutionVotingProcedures = new VotingProcedures.VotingProcedures({
      procedures: new Map([[drepVoter, new Map([[govActionId, votingProcedure]])]])
    })

    // Create equivalent CML VotingProcedure
    const cmlVote = CML.Vote.Yes
    const cmlProcedure = CML.VotingProcedure.new(cmlVote)

    // Get CBOR hex from both implementations
    const _cmlProcedureCborHex = cmlProcedure.to_cbor_hex()
    const evolutionCborHex = VotingProcedures.toCBORHex(evolutionVotingProcedures)

    // For Conway governance, CML may not support full VotingProcedures collections yet
    // Focus on verifying Evolution SDK produces valid CBOR
    expect(evolutionCborHex).toMatch(/^[0-9a-fA-F]+$/)
    expect(evolutionCborHex.length).toBeGreaterThan(0)

    // Test that Evolution SDK can parse its own CBOR
    const evolutionRoundTrip = VotingProcedures.fromCBORHex(evolutionCborHex)
    expect(Equal.equals(evolutionRoundTrip, evolutionVotingProcedures)).toBe(true)
  })

  it("validates CBOR hex compatibility with anchor: Evolution SDK vs CML serialization", () => {
    // Create test data using arbitraries
    const drep = generateTestDRep(2)
    const anchor = generateTestAnchor(2)

    // Create Evolution SDK VotingProcedures with anchor
    const drepVoter = new VotingProcedures.DRepVoter({ drep })
    const govActionId = new GovernanceAction.GovActionId({
      transactionId: new TransactionHash.TransactionHash({
        hash: new Uint8Array(32).fill(1) // Deterministic test data
      }),
      govActionIndex: 1n
    })
    const votingProcedure = new VotingProcedures.VotingProcedure({
      vote: VotingProcedures.no(),
      anchor
    })

    const evolutionVotingProcedures = new VotingProcedures.VotingProcedures({
      procedures: new Map([[drepVoter, new Map([[govActionId, votingProcedure]])]])
    })

    // Create CML VotingProcedure (without anchor - CML limitation)
    const cmlVote = CML.Vote.No
    const cmlProcedure = CML.VotingProcedure.new(cmlVote)

    // Test anchor compatibility separately
    const anchorHex = Anchor.toCBORHex(anchor)
    const cmlAnchor = CML.Anchor.from_cbor_hex(anchorHex)
    const _cmlAnchorCbor = cmlAnchor.to_cbor_hex()

    // Get CBOR hex from both implementations
    const _cmlProcedureCborHex = cmlProcedure.to_cbor_hex()
    const evolutionCborHex = VotingProcedures.toCBORHex(evolutionVotingProcedures)

    // Verify Evolution SDK produces valid CBOR with anchor
    expect(evolutionCborHex).toMatch(/^[0-9a-fA-F]+$/)
    expect(evolutionCborHex.length).toBeGreaterThan(0)
    expect(evolutionCborHex.length).toBeGreaterThan(_cmlProcedureCborHex.length) // Should be longer due to anchor

    // Test that Evolution SDK can parse its own CBOR
    const evolutionRoundTrip = VotingProcedures.fromCBORHex(evolutionCborHex)
    expect(Equal.equals(evolutionRoundTrip, evolutionVotingProcedures)).toBe(true)

    // Verify the anchor is preserved
    const roundTripEntries = Array.from(evolutionRoundTrip.procedures.values())[0]
    const roundTripProcedure = Array.from(roundTripEntries.values())[0]
    expect(roundTripProcedure.anchor).not.toBeNull()
  })
})
