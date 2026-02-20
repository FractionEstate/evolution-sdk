import { UplcDecoder } from "./uplc-decoder"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "UPLC Decoder | Evolution SDK",
  description: "Decode UPLC (Untyped Plutus Core) programs from CBOR hex format"
}

export default function UplcDecoderPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">UPLC Decoder</h1>
        <p className="text-muted-foreground text-lg">
          Decode UPLC (Untyped Plutus Core) programs from CBOR hex format. Automatically handles single or double CBOR
          encoding.
        </p>
      </div>
      <UplcDecoder />
    </div>
  )
}
