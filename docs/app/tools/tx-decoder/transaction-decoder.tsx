"use client"

import { useState } from "react"
import { Transaction, TransactionWitnessSet, Data, Schema } from "@evolution-sdk/evolution"

type DecodeType = "transaction" | "witnessSet" | "data"

export function TransactionDecoder() {
  const [txHex, setTxHex] = useState("")
  const [decodedJson, setDecodedJson] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [decodeType, setDecodeType] = useState<DecodeType>("transaction")

  const decodeTx = async () => {
    setError(null)
    setDecodedJson("")

    try {
      const cleanHex = txHex.trim().replace(/\s+/g, "")

      if (!cleanHex) {
        setError(
          `Please enter a ${decodeType === "transaction" ? "transaction" : decodeType === "witnessSet" ? "transaction witness set" : "plutus data"} CBOR hex string`
        )
        return
      }

      if (decodeType === "transaction") {
        const tx = Transaction.fromCBORHex(cleanHex)
        const json = Schema.encodeSync(Schema.parseJson(Transaction.Transaction, { space: 2 }))(tx)
        setDecodedJson(json)
      } else if (decodeType === "witnessSet") {
        const witnessSet = TransactionWitnessSet.fromCBORHex(cleanHex)
        const json = Schema.encodeSync(Schema.parseJson(TransactionWitnessSet.TransactionWitnessSet, { space: 2 }))(
          witnessSet
        )
        setDecodedJson(json)
      } else {
        const data = Data.fromCBORHex(cleanHex)
        const json = Schema.encodeSync(Schema.parseJson(Data.DataSchema, { space: 2 }))(data)
        setDecodedJson(json)
      }
    } catch (err) {
      console.error("Decode error:", err)
      setError(
        err instanceof Error
          ? err.message
          : `Failed to decode ${decodeType === "transaction" ? "transaction" : decodeType === "witnessSet" ? "witness set" : "data"}`
      )
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight">CBOR Decoder</h3>
              <p className="text-sm text-muted-foreground">Decode Cardano CBOR hex strings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="decode-type" className="text-sm font-medium leading-none">
                  Type
                </label>
                <select
                  id="decode-type"
                  value={decodeType}
                  onChange={(e) => setDecodeType(e.target.value as DecodeType)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="transaction">Transaction</option>
                  <option value="witnessSet">Transaction Witness Set</option>
                  <option value="data">Plutus Data</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="tx-hex" className="text-sm font-medium leading-none">
                CBOR Hex Input
              </label>
              <textarea
                id="tx-hex"
                value={txHex}
                onChange={(e) => setTxHex(e.target.value)}
                placeholder={`Paste ${decodeType === "transaction" ? "transaction" : decodeType === "witnessSet" ? "transaction witness set" : "plutus data"} CBOR hex here...`}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <button
              onClick={decodeTx}
              className="sm:w-auto w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-6 py-2 bg-zinc-700 text-white hover:bg-zinc-600 active:bg-zinc-500 transition-all cursor-pointer shadow-sm hover:shadow"
            >
              Decode{" "}
              {decodeType === "transaction" ? "Transaction" : decodeType === "witnessSet" ? "Witness Set" : "Data"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-destructive shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Error decoding{" "}
                  {decodeType === "transaction" ? "transaction" : decodeType === "witnessSet" ? "witness set" : "data"}
                </p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere font-mono">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {decodedJson && (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6 space-y-3">
            <h4 className="text-sm font-semibold">Decoded Result</h4>
            <pre className="rounded-md bg-muted p-4 overflow-x-auto max-h-[500px]">
              <code className="text-xs">{decodedJson}</code>
            </pre>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-border/50">
        <p className="text-xs text-center text-muted-foreground">
          Questions or feedback?{" "}
          <a
            href="https://github.com/IntersectMBO/evolution-sdk/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Start a discussion on GitHub
          </a>
        </p>
      </div>
    </div>
  )
}
