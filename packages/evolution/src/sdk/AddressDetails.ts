import { Effect as Eff, Equal, ParseResult, Schema } from "effect"

import * as AddressEras from "../core/AddressEras.js"
import * as Bytes from "../core/Bytes.js"
import * as NetworkId from "../core/NetworkId.js"

/**
 * Schema for AddressDetails representing extended address information.
 * Contains the address structure and its serialized representations
 *
 * @since 2.0.0
 * @category schemas
 */
export class AddressDetails extends Schema.Class<AddressDetails>("AddressDetails")({
  networkId: NetworkId.NetworkId,
  type: Schema.Union(
    Schema.Literal("BaseAddress"),
    Schema.Literal("EnterpriseAddress"),
    Schema.Literal("PointerAddress"),
    Schema.Literal("RewardAccount"),
    Schema.Literal("ByronAddress")
  ),
  address: AddressEras.AddressEras,
  bech32: Schema.String,
  hex: Bytes.HexSchema
}) {}

export const FromBech32 = Schema.transformOrFail(Schema.String, Schema.typeSchema(AddressDetails), {
  strict: true,
  encode: (_, __, ___, toA) => ParseResult.succeed(toA.bech32),
  decode: (_, __, ___, fromA) =>
    Eff.gen(function* () {
      const address = yield* ParseResult.decode(AddressEras.FromBech32)(fromA)
      const hex = yield* ParseResult.encode(AddressEras.FromHex)(address)
      return new AddressDetails({
        networkId: address.networkId,
        type: address._tag,
        address,
        bech32: fromA,
        hex
      })
    })
})

export const FromHex = Schema.transformOrFail(Bytes.HexSchema, Schema.typeSchema(AddressDetails), {
  strict: true,
  encode: (_, __, ___, toA) => ParseResult.succeed(toA.hex),
  decode: (_, __, ___, fromA) =>
    Eff.gen(function* () {
      const address = yield* ParseResult.decode(AddressEras.FromHex)(fromA)
      const bech32 = yield* ParseResult.encode(AddressEras.FromBech32)(address)
      return new AddressDetails({
        networkId: address.networkId,
        type: address._tag,
        address,
        bech32,
        hex: fromA
      })
    })
})

/**
 * Check if two AddressDetails instances are equal.
 *
 * @since 2.0.0
 * @category equality
 */
export const equals = (self: AddressDetails, that: AddressDetails): boolean => {
  return (
    self.networkId === that.networkId &&
    self.type === that.type &&
    Equal.equals(self.address, that.address) &&
    self.bech32 === that.bech32 &&
    self.hex === that.hex
  )
}

/**
 * Parse AddressDetails from Bech32 string.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromBech32 = Schema.decodeSync(FromBech32)

/**
 * Parse AddressDetails from hex string.
 *
 * @since 2.0.0
 * @category parsing
 */
export const fromHex = Schema.decodeSync(FromHex)

// ============================================================================
// Encoding Functions
// ============================================================================

/**
 * Convert AddressDetails to Bech32 string.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toBech32 = Schema.encodeSync(FromBech32)

/**
 * Convert AddressDetails to hex string.
 *
 * @since 2.0.0
 * @category encoding
 */
export const toHex = Schema.encodeSync(FromHex)
