import { TransactionDecoder } from "./transaction-decoder"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transaction Decoder | Evolution SDK",
  description: "Decode Cardano transactions from CBOR hex format"
}

export default function TransactionDecoderPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Transaction Decoder</h1>
        <p className="text-muted-foreground text-lg">
          Decode Cardano transactions from CBOR hex format. Paste your transaction hex below to inspect its contents.
        </p>
      </div>
      <TransactionDecoder />
    </div>
  )
}
