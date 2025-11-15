'use client'

import { useState } from 'react'
import { Core } from "@evolution-sdk/evolution"

export function TransactionDecoder() {
  const [txHex, setTxHex] = useState("")
  const [decodedJson, setDecodedJson] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const decodeTx = async () => {
    setError(null)
    setDecodedJson("")

    try {
      const cleanHex = txHex.trim().replace(/\s+/g, '')
      
      if (!cleanHex) {
        setError("Please enter a transaction CBOR hex string")
        return
      }
      
      const tx = Core.Transaction.fromCBORHex(cleanHex)
      const json = JSON.stringify(tx.toJSON(), (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      , 2)
      setDecodedJson(json)
    } catch (err) {
      console.error('Decode error:', err)
      setError(err instanceof Error ? err.message : "Failed to decode transaction")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <button
          onClick={decodeTx}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Decode Transaction
        </button>

        <div className="space-y-2">
          <label htmlFor="tx-hex" className="block text-sm font-medium">
            Transaction CBOR Hex
          </label>
          <textarea
            id="tx-hex"
            value={txHex}
            onChange={(e) => setTxHex(e.target.value)}
            placeholder="Paste transaction CBOR hex here..."
            className="w-full h-32 px-3 py-2 bg-background border border-border rounded-md font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive font-medium">Error decoding transaction:</p>
          <p className="text-destructive/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {decodedJson && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Decoded Transaction (JSON)</label>
          <pre className="w-full p-4 bg-muted border border-border rounded-md overflow-auto max-h-[600px] text-sm">
            <code>{decodedJson}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
