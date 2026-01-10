import { Effect as Eff, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as AuxiliaryData from "./AuxiliaryData.js"
import * as CBOR from "./CBOR.js"
import * as TransactionBody from "./TransactionBody.js"
import * as TransactionWitnessSet from "./TransactionWitnessSet.js"

/**
 * Transaction based on Conway CDDL specification
 *
 * CDDL: transaction =
 *   [transaction_body, transaction_witness_set, bool, auxiliary_data / nil]
 *
 * @since 2.0.0
 * @category model
 */
export class Transaction extends Schema.TaggedClass<Transaction>()("Transaction", {
  body: TransactionBody.TransactionBody,
  witnessSet: TransactionWitnessSet.TransactionWitnessSet,
  isValid: Schema.Boolean,
  auxiliaryData: Schema.NullOr(AuxiliaryData.AuxiliaryData)
}) {
  toJSON() {
    return {
      _tag: this._tag,
      body: this.body.toJSON(),
      witnessSet: this.witnessSet.toJSON(),
      isValid: this.isValid,
      auxiliaryData: this.auxiliaryData?.toJSON() ?? null
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
      that instanceof Transaction &&
      Equal.equals(this.body, that.body) &&
      Equal.equals(this.witnessSet, that.witnessSet) &&
      this.isValid === that.isValid &&
      Equal.equals(this.auxiliaryData, that.auxiliaryData)
    )
  }

  [Hash.symbol](): number {
    return Hash.cached(
      this,
      Hash.combine(
        Hash.combine(Hash.combine(Hash.hash(this.body))(Hash.hash(this.witnessSet)))(Hash.hash(this.isValid))
      )(Hash.hash(this.auxiliaryData))
    )
  }
}

/**
 * Conway CDDL schema for Transaction tuple structure.
 *
 * CDDL: transaction = [transaction_body, transaction_witness_set, bool, auxiliary_data / nil]
 */
export const CDDLSchema = Schema.Tuple(
  TransactionBody.CDDLSchema.annotations({ identifier: "TransactionBodyCDDL", description: "Transaction body" }),
  TransactionWitnessSet.CDDLSchema.annotations({
    identifier: "TransactionWitnessSetCDDL",
    description: "Transaction witness set"
  }),
  Schema.Boolean,
  // Auxiliary data is a CBOR value; CBOR schema already includes null in its domain
  CBOR.CBORSchema.annotations({ identifier: "AuxiliaryDataCDDL", description: "Auxiliary data as raw CBOR" })
).annotations({ identifier: "TransactionCDDL", description: "Transaction tuple structure" })

/**
 * Transform between CDDL tuple and Transaction class.
 */
export const FromCDDL = Schema.transformOrFail(CDDLSchema, Schema.typeSchema(Transaction), {
  strict: true,
  encode: (tx) =>
    Eff.gen(function* () {
      const bodyReadonly = yield* ParseResult.encode(TransactionBody.FromCDDL)(tx.body)
      const witnessReadonly = yield* ParseResult.encode(TransactionWitnessSet.FromCDDL)(tx.witnessSet)
      // Ensure mutable Map instances for tuple A-type compatibility
      const body = new Map<bigint, CBOR.CBOR>(bodyReadonly.entries())
      const witnessSet = new Map<bigint, CBOR.CBOR>(witnessReadonly.entries())
      const isValid = tx.isValid
      const auxiliaryData =
        tx.auxiliaryData === null ? null : yield* ParseResult.encode(AuxiliaryData.FromCDDL)(tx.auxiliaryData)
      return [body, witnessSet, isValid, auxiliaryData] as const
    }),
  decode: (tuple) =>
    Eff.gen(function* () {
      const [bodyCDDL, witnessSetCDDL, isValid, aux] = tuple
      const body = yield* ParseResult.decode(TransactionBody.FromCDDL)(bodyCDDL)
      const witnessSet = yield* ParseResult.decode(TransactionWitnessSet.FromCDDL)(witnessSetCDDL)
      const auxiliaryData = aux === null ? null : yield* ParseResult.decodeUnknownEither(AuxiliaryData.FromCDDL)(aux)
      return new Transaction({ body, witnessSet, isValid, auxiliaryData }, { disableValidation: true })
    })
})

/**
 * CBOR bytes transformation schema for Transaction.
 */
export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromBytes(options), FromCDDL).annotations({
    identifier: "Transaction.FromCBORBytes",
    description: "Decode Transaction from CBOR bytes per Conway CDDL"
  })

/**
 * CBOR hex transformation schema for Transaction.
 */
export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(CBOR.FromHex(options), FromCDDL).annotations({
    identifier: "Transaction.FromCBORHex",
    description: "Decode Transaction from CBOR hex per Conway CDDL"
  })

// ============================================================================
// Parsing / Encoding Functions
// ============================================================================

export const fromCBORBytes = (bytes: Uint8Array, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORBytes(options))(bytes)

export const fromCBORHex = (hex: string, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORHex(options))(hex)

export const toCBORBytes = (data: Transaction, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORBytes(options))(data)

export const toCBORHex = (data: Transaction, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORHex(options))(data)

// ============================================================================
// Arbitrary (FastCheck)
// ============================================================================

export const arbitrary: FastCheck.Arbitrary<Transaction> = FastCheck.record({
  body: TransactionBody.arbitrary,
  witnessSet: TransactionWitnessSet.arbitrary,
  isValid: FastCheck.boolean(),
  auxiliaryData: FastCheck.option(AuxiliaryData.arbitrary, { nil: null }).map((a) => (a === undefined ? null : a))
}).map((r) => new Transaction(r))
