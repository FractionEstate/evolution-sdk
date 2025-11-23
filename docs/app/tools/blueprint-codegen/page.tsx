import { BlueprintCodegen } from "./blueprint-codegen"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blueprint Codegen | Evolution SDK',
  description: 'Generate TypeScript types from Plutus Blueprint (plutus.json)',
}

export default function BlueprintCodegenPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Blueprint Type Generator</h1>
        <p className="text-muted-foreground text-lg">
          Generate TypeScript TSchema definitions from your Plutus Blueprint (plutus.json). Paste your blueprint JSON below to generate type-safe TypeScript code.
        </p>
      </div>
      <BlueprintCodegen />
    </div>
  )
}
