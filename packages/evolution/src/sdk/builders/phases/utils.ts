/**
 * Shared utilities for transaction builder phases
 *
 * @module phases/utils
 * @since 2.0.0
 */

import type * as Certificate from "../../../core/Certificate.js"
import * as PoolKeyHash from "../../../core/PoolKeyHash.js"

/**
 * Calculate certificate deposits and refunds from a list of certificates.
 *
 * Certificates with deposits (money OUT):
 * - RegCert: Stake registration deposit
 * - RegDrepCert: DRep registration deposit
 * - RegPoolCert: Pool registration deposit (PoolRegistration)
 * - StakeRegDelegCert: Combined stake registration + delegation deposit
 * - VoteRegDelegCert: Combined vote registration + delegation deposit
 * - StakeVoteRegDelegCert: Combined stake + vote registration + delegation deposit
 *
 * Certificates with refunds (money IN):
 * - UnregCert: Stake deregistration refund
 * - UnregDrepCert: DRep deregistration refund
 * - PoolRetirement: Pool retirement (no refund in Conway era; pool deposits are burned)
 *
 * @param certificates - Array of certificates to analyze
 * @param poolDeposits - Map of pool key hashes to their deposit amounts
 * @returns Object containing total deposits and refunds in lovelace
 *
 * @since 2.0.0
 * @category utilities
 */
export function calculateCertificateBalance(
  certificates: ReadonlyArray<Certificate.Certificate>,
  poolDeposits: ReadonlyMap<string, bigint>
): { deposits: bigint; refunds: bigint } {
  return certificates.reduce(
    (acc, cert) => {
      switch (cert._tag) {
        // Registration certificates with deposits (money goes OUT)
        case "RegCert":
        case "RegDrepCert":
        case "StakeRegDelegCert":
        case "VoteRegDelegCert":
        case "StakeVoteRegDelegCert":
          acc.deposits += cert.coin
          break

        // Deregistration certificates with refunds (money comes IN)
        case "UnregCert":
        case "UnregDrepCert":
          acc.refunds += cert.coin
          break

        // Pool registration - deposit tracked in state
        case "PoolRegistration": {
          const operatorHex = PoolKeyHash.toHex(cert.poolParams.operator)
          const deposit = poolDeposits.get(operatorHex)
          if (deposit !== undefined) {
            acc.deposits += deposit
          }
          break
        }

        // Pool retirement - no refund in Conway era (deposit is not refunded)
        // Pool deposits are burned upon retirement
        case "PoolRetirement":
          // No refund for pool retirement in Conway
          break

        // Delegation certificates with no deposit/refund
        case "StakeRegistration":
        case "StakeDeregistration":
        case "StakeDelegation":
        case "VoteDelegCert":
        case "StakeVoteDelegCert":
        case "AuthCommitteeHotCert":
        case "ResignCommitteeColdCert":
        case "UpdateDrepCert":
          // No deposit or refund
          break
      }
      return acc
    },
    { deposits: 0n, refunds: 0n }
  )
}

/**
 * Calculate total withdrawal amount from a map of reward accounts to withdrawal amounts.
 *
 * @param withdrawals - Map of reward accounts to withdrawal amounts
 * @returns Total withdrawal amount in lovelace
 *
 * @since 2.0.0
 * @category utilities
 */
export function calculateWithdrawals(withdrawals: ReadonlyMap<unknown, bigint>): bigint {
  let total = 0n
  for (const amount of withdrawals.values()) {
    total += amount
  }
  return total
}
