/**
 * @since 1.0.0
 */

import { bech32 } from "@scure/base"
import { Effect as Eff, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as Bytes from "./Bytes.js"
import * as Bytes29 from "./Bytes29.js"
import * as Bytes57 from "./Bytes57.js"
import * as Credential from "./Credential.js"
import * as KeyHash from "./KeyHash.js"
import * as NetworkId from "./NetworkId.js"
import * as ScriptHash from "./ScriptHash.js"

/**
 * @since 1.0.0
 * @category Schema
 */
export class Address extends Schema.Class<Address>("AddressStructure")({
  networkId: NetworkId.NetworkId,
  paymentCredential: Credential.CredentialSchema,
  stakingCredential: Schema.optional(Credential.CredentialSchema)
}) {
  toJSON() {
    return {
      networkId: this.networkId,
      paymentCredential: this.paymentCredential,
      stakingCredential: this.stakingCredential
    }
  }

  toString(): string {
    return Inspectable.format(this.toJSON())
  }

  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }

  [Equal.symbol](that: unknown): boolean {
    return (
      that instanceof Address &&
      this.networkId === that.networkId &&
      Equal.equals(this.paymentCredential, that.paymentCredential) &&
      ((this.stakingCredential === undefined && that.stakingCredential === undefined) ||
        (this.stakingCredential !== undefined &&
          that.stakingCredential !== undefined &&
          Equal.equals(this.stakingCredential, that.stakingCredential)))
    )
  }

  [Hash.symbol](): number {
    return Hash.hash(this.toJSON())
  }
}

/**
 * Transform from bytes to AddressStructure
 * Handles both BaseAddress (57 bytes) and EnterpriseAddress (29 bytes)
 *
 * @since 1.0.0
 * @category Transformations
 */
export const FromBytes = Schema.transformOrFail(
  Schema.Union(Bytes57.BytesSchema, Bytes29.BytesSchema),
  Schema.typeSchema(Address),
  {
    strict: true,
    encode: (_, __, ___, toA) =>
      Eff.gen(function* () {
        if (toA.stakingCredential) {
          // BaseAddress encoding (57 bytes)
          const paymentBit = toA.paymentCredential._tag === "KeyHash" ? 0 : 1
          const stakeBit = toA.stakingCredential._tag === "KeyHash" ? 0 : 1
          const header = (0b00 << 6) | (stakeBit << 5) | (paymentBit << 4) | (toA.networkId & 0b00001111)
          const result = new Uint8Array(57)
          result[0] = header
          const paymentCredentialBytes = toA.paymentCredential.hash
          result.set(paymentCredentialBytes, 1)
          const stakeCredentialBytes = toA.stakingCredential.hash
          result.set(stakeCredentialBytes, 29)
          return yield* ParseResult.succeed(result)
        } else {
          // EnterpriseAddress encoding (29 bytes)
          const paymentBit = toA.paymentCredential._tag === "KeyHash" ? 0 : 1
          const header = (0b01 << 6) | (0b1 << 5) | (paymentBit << 4) | (toA.networkId & 0b00001111)
          const result = new Uint8Array(29)
          result[0] = header
          const paymentCredentialBytes = toA.paymentCredential.hash
          result.set(paymentCredentialBytes, 1)
          return yield* ParseResult.succeed(result)
        }
      }),
    decode: (fromI, options, ast, fromA) =>
      Eff.gen(function* () {
        const header = fromA[0]
        const networkId = header & 0b00001111
        const addressTypeBits = (header >> 4) & 0b1111

        if (fromA.length === 57) {
          // BaseAddress (with staking credential)
          const isPaymentKey = (addressTypeBits & 0b0001) === 0
          const paymentCredential: Credential.CredentialSchema = isPaymentKey
            ? new KeyHash.KeyHash({ hash: fromA.slice(1, 29) })
            : new ScriptHash.ScriptHash({ hash: fromA.slice(1, 29) })

          const isStakeKey = (addressTypeBits & 0b0010) === 0
          const stakingCredential: Credential.CredentialSchema = isStakeKey
            ? new KeyHash.KeyHash({ hash: fromA.slice(29, 57) })
            : new ScriptHash.ScriptHash({ hash: fromA.slice(29, 57) })

          return Address.make({
            networkId,
            paymentCredential,
            stakingCredential
          })
        } else if (fromA.length === 29) {
          // EnterpriseAddress (no staking credential)
          const isPaymentKey = (addressTypeBits & 0b0001) === 0
          const paymentCredential: Credential.CredentialSchema = isPaymentKey
            ? new KeyHash.KeyHash({ hash: fromA.slice(1, 29) })
            : new ScriptHash.ScriptHash({ hash: fromA.slice(1, 29) })

          return Address.make({
            networkId,
            paymentCredential,
            stakingCredential: undefined
          })
        } else {
          return yield* ParseResult.fail(new ParseResult.Type(ast, fromA, "Invalid address length"))
        }
      })
  }
).annotations({
  identifier: "AddressStructure.FromBytes"
})

/**
 * Transform from hex string to AddressStructure
 *
 * @since 1.0.0
 * @category Transformations
 */
export const FromHex = Schema.compose(Bytes.FromHex, FromBytes).annotations({
  identifier: "AddressStructure.FromHex"
})

/**
 * Transform from Bech32 string to AddressStructure
 *
 * @since 1.0.0
 * @category Transformations
 */
export const FromBech32 = Schema.transformOrFail(Schema.String, Schema.typeSchema(Address), {
  strict: true,
  encode: (_, __, ___, toA) =>
    Eff.gen(function* () {
      const prefix = toA.networkId === 0 ? "addr_test" : "addr"
      const bytes = yield* ParseResult.encode(FromBytes)(toA)
      const words = bech32.toWords(bytes)
      return bech32.encode(prefix, words, false)
    }),
  decode: (fromA, _, ast) =>
    Eff.gen(function* () {
      const result = yield* Eff.try({
        try: () => {
          const decoded = bech32.decode(fromA as any, false)
          const bytes = bech32.fromWords(decoded.words)
          return new Uint8Array(bytes)
        },
        catch: () => new ParseResult.Type(ast, fromA, `Failed to decode Bech32: ${fromA}`)
      })
      return yield* ParseResult.decode(FromBytes)(result)
    })
}).annotations({
  identifier: "AddressStructure.FromBech32",
  description: "Transforms Bech32 string to AddressStructure"
})

/**
 * Check if AddressStructure has staking credential (BaseAddress-like)
 *
 * @since 1.0.0
 * @category Utils
 */
export const hasStakingCredential = (address: Address): boolean => address.stakingCredential !== undefined

/**
 * Check if AddressStructure is enterprise-like (no staking credential)
 *
 * @since 1.0.0
 * @category Utils
 */
export const isEnterprise = (address: Address): boolean => address.stakingCredential === undefined

/**
 * Get network ID from AddressStructure
 *
 * @since 1.0.0
 * @category Utils
 */
export const getNetworkId = (address: Address): NetworkId.NetworkId => address.networkId

/**
 * Sync functions using Schema utilities
 *
 * @since 1.0.0
 * @category Functions
 */
export const fromBech32 = Schema.decodeSync(FromBech32)
export const toBech32 = Schema.encodeSync(FromBech32)
export const fromHex = Schema.decodeSync(FromHex)
export const toHex = Schema.encodeSync(FromHex)
export const fromBytes = Schema.decodeSync(FromBytes)
export const toBytes = Schema.encodeSync(FromBytes)

/**
 * FastCheck arbitrary generator for testing
 *
 * @since 1.0.0
 * @category Arbitrary
 */
export const arbitrary = FastCheck.record({
  networkId: NetworkId.arbitrary,
  paymentCredential: Credential.arbitrary,
  stakingCredential: FastCheck.option(Credential.arbitrary)
}).map(
  (props) =>
    new Address({
      ...props,
      stakingCredential: props.stakingCredential ?? undefined
    })
)
