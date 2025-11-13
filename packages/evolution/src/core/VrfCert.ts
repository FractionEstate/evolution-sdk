import { Either as E, Equal, FastCheck, Hash, Inspectable, ParseResult, Schema } from "effect"

import * as Bytes from "./Bytes.js"
import * as Bytes32 from "./Bytes32.js"
import * as Bytes80 from "./Bytes80.js"
import * as CBOR from "./CBOR.js"

/**
 * Schema for VRF output (32 bytes).
 * vrf_output = bytes .size 32
 *
 * @since 2.0.0
 * @category schemas
 */
export class VRFOutput extends Schema.TaggedClass<VRFOutput>()("VrfOutput", {
  bytes: Bytes32.BytesFromHex
}) {
  toJSON() {
    return { _tag: "VrfOutput", bytes: this.bytes }
  }
  toString(): string {
    return Inspectable.format(this.toJSON())
  }
  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }
  [Equal.symbol](that: unknown): boolean {
    return that instanceof VRFOutput && Equal.equals(this.bytes, that.bytes)
  }
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash(this.bytes))
  }
}

/**
 * Schema for VRF output as a byte array.
 * vrf_output = bytes .size 32
 *
 * @since 2.0.0
 * @category schemas
 */
export const VRFOutputFromBytes = Schema.transform(
  Schema.typeSchema(Bytes32.BytesFromHex),
  Schema.typeSchema(VRFOutput),
  {
    strict: true,
    decode: (bytes) => new VRFOutput({ bytes }, { disableValidation: true }), // Disable validation since we already check length in Bytes32
    encode: (vrfOutput) => vrfOutput.bytes
  }
).annotations({
  identifier: "VrfOutput.Bytes"
})

/**
 * Schema for VRF output as a hex string.
 * vrf_output = bytes .size 32
 *
 * @since 2.0.0
 * @category schemas
 */
export const VRFOutputHexSchema = Schema.compose(
  Bytes32.BytesFromHex, // string -> hex string
  VRFOutputFromBytes // hex string -> VRFOutput
).annotations({
  identifier: "VrfOutput.Hex"
})

/**
 * Schema for VRF proof (80 bytes).
 * vrf_proof = bytes .size 80
 *
 * @since 2.0.0
 * @category schemas
 */
export class VRFProof extends Schema.TaggedClass<VRFProof>()("VrfProof", {
  bytes: Bytes80.BytesSchema
}) {
  toJSON() {
    return { _tag: "VrfProof", bytes: this.bytes }
  }
  toString(): string {
    return Inspectable.format(this.toJSON())
  }
  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }
  [Equal.symbol](that: unknown): boolean {
    return that instanceof VRFProof && Equal.equals(this.bytes, that.bytes)
  }
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.hash(this.bytes))
  }
}

/**
 * Schema for VRF proof as a byte array.
 * vrf_proof = bytes .size 80
 *
 * @since 2.0.0
 * @category schemas
 */
export const VRFProofFromBytes = Schema.transform(Bytes80.BytesSchema, VRFProof, {
  strict: true,
  decode: (bytes) => new VRFProof({ bytes }, { disableValidation: true }), // Disable validation since we already check length in Bytes80
  encode: (vrfProof) => vrfProof.bytes
}).annotations({
  identifier: "VrfProof.Bytes"
})

/**
 * Schema for VRF proof as a hex string.
 * vrf_proof = bytes .size 80
 *
 * @since 2.0.0
 * @category schemas
 */
export const VRFProofHexSchema = Schema.compose(
  Bytes80.FromHex, // string -> hex string
  VRFProofFromBytes // hex string -> VRFProof
).annotations({
  identifier: "VrfProof.Hex"
})

/**
 * Schema for VrfCert representing a VRF certificate.
 * vrf_cert = [vrf_output, vrf_proof]
 *
 * @since 2.0.0
 * @category model
 */
export class VrfCert extends Schema.TaggedClass<VrfCert>()("VrfCert", {
  output: VRFOutput,
  proof: VRFProof
}) {
  toJSON() {
    return { _tag: "VrfCert", output: this.output, proof: this.proof }
  }
  toString(): string {
    return Inspectable.format(this.toJSON())
  }
  [Inspectable.NodeInspectSymbol](): unknown {
    return this.toJSON()
  }
  [Equal.symbol](that: unknown): boolean {
    return that instanceof VrfCert && Equal.equals(this.output, that.output) && Equal.equals(this.proof, that.proof)
  }
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.combine(Hash.hash(this.output))(Hash.hash(this.proof)))
  }
}

export const CDDLSchema = Schema.Tuple(
  CBOR.ByteArray, // vrf_output as bytes
  CBOR.ByteArray // vrf_proof as bytes
)

/**
 * CDDL schema for VrfCert as tuple structure.
 * vrf_cert = [vrf_output, vrf_proof]
 * vrf_output = bytes .size 32
 * vrf_proof = bytes .size 80
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCDDL = Schema.transformOrFail(CDDLSchema, Schema.typeSchema(VrfCert), {
  strict: true,
  encode: (vrfCert) => E.right([vrfCert.output.bytes, vrfCert.proof.bytes] as const),
  decode: ([outputBytes, proofBytes]) =>
    E.gen(function* () {
      const output = yield* ParseResult.decodeEither(VRFOutputFromBytes)(outputBytes)
      const proof = yield* ParseResult.decodeEither(VRFProofFromBytes)(proofBytes)
      return new VrfCert(
        {
          output,
          proof
        },
        { disableValidation: true }
      )
    })
})

/**
 * CBOR bytes transformation schema for VrfCert.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORBytes = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    CBOR.FromBytes(options), // Uint8Array → CBOR
    FromCDDL // CBOR → VrfCert
  ).annotations({
    identifier: "VrfCert.FromCBORBytes"
  })

/**
 * CBOR hex transformation schema for VrfCert.
 *
 * @since 2.0.0
 * @category schemas
 */
export const FromCBORHex = (options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.compose(
    Bytes.FromHex, // string → Uint8Array
    FromCBORBytes(options) // Uint8Array → VrfCert
  ).annotations({
    identifier: "VrfCert.FromCBORHex"
  })

/**
 * @since 2.0.0
 * @category FastCheck
 */
export const arbitrary = FastCheck.record({
  output: FastCheck.uint8Array({ minLength: 32, maxLength: 32 }),
  proof: FastCheck.uint8Array({ minLength: 80, maxLength: 80 })
}).chain(({ output, proof }) =>
  FastCheck.constant(
    new VrfCert({
      output: new VRFOutput({ bytes: output }),
      proof: new VRFProof({ bytes: proof })
    })
  )
)

/**
 * Check if the given value is a valid VrfCert.
 *
 * @since 2.0.0
 * @category predicates
 */
export const isVrfCert = Schema.is(VrfCert)

/**
 * Convert CBOR bytes to VrfCert (unsafe).
 *
 * @since 2.0.0
 * @category encoding
 */
export const fromCBORBytes = (bytes: Uint8Array, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORBytes(options))(bytes)

/**
 * Convert CBOR hex to VrfCert (unsafe).
 *
 * @since 2.0.0
 * @category decoding
 */
export const fromCBORHex = (hex: string, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.decodeSync(FromCBORHex(options))(hex)

/**
 * Convert VrfCert to CBOR bytes (unsafe).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORBytes = (vrfCert: VrfCert, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORBytes(options))(vrfCert)

/**
 * Convert VrfCert to CBOR hex (unsafe).
 *
 * @since 2.0.0
 * @category encoding
 */
export const toCBORHex = (vrfCert: VrfCert, options: CBOR.CodecOptions = CBOR.CML_DEFAULT_OPTIONS) =>
  Schema.encodeSync(FromCBORHex(options))(vrfCert)
