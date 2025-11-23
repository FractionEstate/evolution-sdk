use cardano/address.{Credential, Address}
use cardano/transaction.{OutputReference, Transaction, ValidityRange, Redeemer}
use cardano/assets.{PolicyId, AssetName, from_lovelace, from_asset_list}
use cardano/certificate.{Certificate}
use cardano/governance.{Constitution, GovernanceActionId, ProposalProcedure, GovernanceAction , Mandate, ProtocolVersion, TransactionId, Vote, Voter}

pub type MintRedeemer {
  idx: Int,
}

pub type WithdrawRedeemer {
  msg: ByteArray,
}

pub type PublishRedeemer {
  msg: ByteArray,
}

pub type AssetsMap = Pairs<PolicyId, Pairs<AssetName, Int>>

pub type NestedData {
  owner: Address,
  amount: AssetsMap,
  signers: List<Address>,
  metadata: Option<ByteArray>,
  cert: Certificate,
  out_ref: OutputReference,
  validity_range: ValidityRange,
  redeemer: Redeemer,
  // governance
  constitution: Constitution,
  // governance_action: GovernanceAction, // opaque type is not allowed
  governance_action_id: GovernanceActionId,
  mandate: Mandate,
  // proposal_procedure: ProposalProcedure // opaque type is not allowed
  protocol_version: ProtocolVersion,
  transaction_id: TransactionId,
  vote: Vote,
  voter: Voter,
  // prelude
  true_false: Bool,
  bytes: ByteArray,
  data: Data,
  int: Int,
  never: Never,
  ordering: Ordering,
  // prng: PRNG, // I do not know how to generate a portable Plutus specification for the following type:
  string: String,
  void: Void,

}

pub type SpendDatum {
  data: NestedData,
  counter: Int,
}

validator mint_policy {
  spend(
    datum: Option<SpendDatum>,
    redeemer: ByteArray,
    _utxo: OutputReference,
    _self: Transaction,
  ) {
    when datum is {
      Some(d) -> {
        // Assert nested datum values
        from_lovelace(10) == from_asset_list(d.data.amount) && d.counter >= 0 && redeemer == "1"
      }
      None -> False
    }
  }

  withdraw(redeemer: WithdrawRedeemer, _account: Credential, _self: Transaction) {
    redeemer.msg == "1"
  }

  publish(redeemer: PublishRedeemer, _account: Credential, _self: Transaction) {
    redeemer.msg == "1"
  }

  mint(redeemer: MintRedeemer, _policy_id: ByteArray, _self: Transaction) {
    redeemer.idx == 1
  }

  else(_) {
    fail @"unsupported purpose"
  }
}