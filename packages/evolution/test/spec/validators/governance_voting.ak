use aiken/collection/list
use aiken/crypto.{Blake2b_224, Hash, VerificationKey}
use aiken/interval.{Finite}
use cardano/governance.{Voter}
use cardano/transaction.{InlineDatum, Transaction}

/// Configuration for the governance voting validator
/// Stored as inline datum at the reference UTxO
pub type GovernanceConfig {
  /// Required signers for quorum (list of verification key hashes)
  required_signers: List<Hash<Blake2b_224, VerificationKey>>,
  /// Minimum number of signatures needed (quorum)
  quorum_threshold: Int,
  /// Optional: Earliest slot for voting (None = no restriction)
  vote_start_slot: Option<Int>,
  /// Optional: Latest slot for voting (None = no restriction)
  vote_end_slot: Option<Int>,
}

/// Redeemer for vote purpose - just contains participating signers
/// Config is read from the single reference input
pub type VoteRedeemer {
  /// List of signers participating in this vote (for quorum validation)
  participating_signers: List<Hash<Blake2b_224, VerificationKey>>,
}

/// Simple vote redeemer for always-yes validator
pub type SimpleVoteRedeemer {
  /// Any data can be passed
  data: Data,
}

validator governance_voting {
  /// Vote validator with quorum validation and optional timelock
  /// 
  /// Validates that:
  /// 1. Exactly one reference input exists (the config UTxO)
  /// 2. Required quorum of signers is met
  /// 3. All participating signers are in the required list
  /// 4. All participating signers are present in tx.extra_signatories
  /// 5. If timelock configured, tx validity fits within allowed window
  vote(redeemer: VoteRedeemer, _voter: Voter, self: Transaction) {
    trace @"vote handler entered"
    // Expect exactly one reference input containing the config
    trace @"checking reference inputs"
    let ref_count = list.length(self.reference_inputs)
    trace @"ref_count": ref_count
    expect [config_input] = self.reference_inputs
    trace @"got single ref input"

    // Extract configuration from inline datum
    trace @"extracting datum"
    expect InlineDatum(config_data) = config_input.output.datum
    trace @"got inline datum"
    expect config: GovernanceConfig = config_data
    trace @"parsed config"

    // Validate quorum: number of participating signers meets threshold
    let participating_count = list.length(redeemer.participating_signers)
    trace @"participating_count": participating_count
    trace @"quorum_threshold": config.quorum_threshold
    let quorum_met = participating_count >= config.quorum_threshold
    trace @"quorum_met": quorum_met

    // Validate all participating signers are in required list
    let all_authorized =
      list.all(
        redeemer.participating_signers,
        fn(signer) { list.has(config.required_signers, signer) },
      )
    trace @"all_authorized": all_authorized

    // Validate all participating signers actually signed the transaction
    let all_signed =
      list.all(
        redeemer.participating_signers,
        fn(signer) { list.has(self.extra_signatories, signer) },
      )
    trace @"all_signed": all_signed

    // Validate no duplicate signers in participating list
    let unique_signers = list.unique(redeemer.participating_signers)
    let no_duplicates =
      list.length(unique_signers) == list.length(redeemer.participating_signers)
    trace @"no_duplicates": no_duplicates

    // Validate timelock if configured
    let timelock_valid = validate_timelock(self, config)
    trace @"timelock_valid": timelock_valid

    // All conditions must be satisfied
    and {
      quorum_met?,
      all_authorized?,
      all_signed?,
      no_duplicates?,
      timelock_valid?,
    }
  }

  /// Publish handler for DRep registration/update/retirement
  /// Always succeeds - registration doesn't require quorum, only voting does
  publish(_redeemer: VoteRedeemer, _credential: Data, _self: Transaction) {
    True
  }

  /// Else clause for spending/minting - always fails
  /// This validator should only be used for voting and DRep management
  else(_) {
    False
  }
}

/// Helper: Validate timelock constraints if configured
/// Returns True if no timelock, or if tx validity fits within configured window
fn validate_timelock(tx: Transaction, config: GovernanceConfig) -> Bool {
  trace @"validate_timelock entered"
  trace @"config.vote_start_slot": config.vote_start_slot
  trace @"config.vote_end_slot": config.vote_end_slot
  trace @"tx.validity_range.lower_bound.bound_type": tx.validity_range.lower_bound.bound_type
  trace @"tx.validity_range.upper_bound.bound_type": tx.validity_range.upper_bound.bound_type
  let start_valid =
    when config.vote_start_slot is {
      None -> {
        trace @"start: no restriction"
        True
      }
      Some(start_slot) -> {
        trace @"start_slot config": start_slot
        when tx.validity_range.lower_bound.bound_type is {
          Finite(tx_start) -> {
            trace @"tx_start": tx_start
            let result = tx_start >= start_slot
            trace @"start_valid (tx_start >= start_slot)": result
            result
          }
          _ -> {
            trace @"start: no finite lower bound"
            False
          }
        }
      }
    }
  trace @"start_valid final": start_valid

  let end_valid =
    when config.vote_end_slot is {
      None -> {
        trace @"end: no restriction"
        True
      }
      Some(end_slot) -> {
        trace @"end_slot config": end_slot
        when tx.validity_range.upper_bound.bound_type is {
          Finite(tx_end) -> {
            trace @"tx_end": tx_end
            let result = tx_end <= end_slot
            trace @"end_valid (tx_end <= end_slot)": result
            result
          }
          _ -> {
            trace @"end: no finite upper bound"
            False
          }
        }
      }
    }
  trace @"end_valid final": end_valid

  start_valid && end_valid
}

/// Simple always-yes voting validator for testing
/// Use this for basic integration tests
validator always_yes_vote {
  vote(_redeemer: SimpleVoteRedeemer, _voter: Voter, _self: Transaction) {
    True
  }

  else(_) {
    False
  }
}

/// Always-yes multi-purpose validator for testing DRep registration and voting
/// Accepts both Publishing (DRep registration) and Voting purposes
validator always_yes_drep {
  vote(_redeemer: SimpleVoteRedeemer, _voter: Voter, _self: Transaction) {
    True
  }

  publish(_redeemer: SimpleVoteRedeemer, _credential: Data, _self: Transaction) {
    True
  }

  else(_) {
    False
  }
}
