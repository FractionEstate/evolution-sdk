"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { VM } from "@stackblitz/sdk"
import { StackBlitzPlayground } from "../../components/playground/StackBlitzPlayground"

// Encode/decode code for URL sharing - handles Unicode properly with base64url
const encodeCode = (code: string): string => {
  const bytes = new TextEncoder().encode(code)
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("")
  return btoa(binString).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const decodeCode = (encoded: string): string | null => {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
    const binString = atob(padded)
    const bytes = Uint8Array.from(binString, (char) => char.codePointAt(0)!)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

const defaultCode = `import { Address } from "@evolution-sdk/evolution"

const bech32 = "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp"

// Parse from Bech32
const address = Address.fromBech32(bech32)

console.log("Address:", address)
console.log("Network ID:", address.networkId)
console.log("Payment credential:", address.paymentCredential)
console.log("Has staking:", address.stakingCredential !== undefined)

// Check if it's an enterprise address
console.log("Is enterprise:", Address.isEnterprise(address))`

export default function PlaygroundPage() {
  const [code, setCode] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)
  const [vmReady, setVmReady] = useState(false)
  const vmRef = useRef<VM | null>(null)

  // Load code from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const encodedCode = params.get("code")
    if (encodedCode) {
      const decoded = decodeCode(encodedCode)
      if (decoded) {
        setCode(decoded)
      }
    }
  }, [])

  const shareCode = async () => {
    if (typeof window === "undefined") return

    try {
      let currentCode = code || defaultCode

      if (vmRef.current) {
        try {
          const files = await vmRef.current.getFsSnapshot()
          if (files?.["index.ts"]) {
            currentCode = files["index.ts"]
          }
        } catch (vmError) {
          console.warn("Could not read from VM:", vmError)
        }
      }

      const encoded = encodeCode(currentCode)
      const url = new URL(window.location.href)
      url.searchParams.set("code", encoded)

      window.history.pushState({}, "", url.toString())
      await navigator.clipboard.writeText(url.toString())

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to share code:", error)
    }
  }

  const handleVmReady = useCallback((vm: VM) => {
    vmRef.current = vm
    setVmReady(true)
  }, [])

  return (
    <div className="h-screen flex flex-col">
      <header className="flex-shrink-0 p-4 border-b border-fd-border bg-fd-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Evolution SDK Playground</h1>
            <p className="text-sm text-muted-foreground">
              Full Node.js environment in your browser powered by StackBlitz WebContainers
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              💡 Save changes: <code className="bg-fd-muted px-1 rounded font-mono">Cmd+S</code> /{" "}
              <code className="bg-fd-muted px-1 rounded font-mono">Ctrl+S</code>, then run:{" "}
              <code className="bg-fd-muted px-1 rounded font-mono">npm start</code>
            </p>
          </div>
          <button
            onClick={shareCode}
            className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-6 py-2 bg-zinc-700 text-white hover:bg-zinc-600 active:bg-zinc-500 transition-all cursor-pointer shadow-sm hover:shadow"
            title={vmReady ? "Share your current code" : "Loading playground..."}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share Code
              </>
            )}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <StackBlitzPlayground key={code || "default"} initialCode={code} onVmReady={handleVmReady} />
      </div>
    </div>
  )
}
