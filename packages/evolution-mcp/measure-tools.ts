import { createEvolutionMcpServer } from "./src/server.ts"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"

async function main() {
  const srv = createEvolutionMcpServer()
  const client = new Client({ name: "measure", version: "1.0" })
  const [ct, st] = InMemoryTransport.createLinkedPair()
  await srv.connect(st)
  await client.connect(ct)

  const result = await client.listTools()
  const json = JSON.stringify(result)
  console.log("Tool count:", result.tools.length)
  console.log("Total JSON size (bytes):", json.length)
  console.log("Approx tokens:", Math.round(json.length / 4))

  const sizes = result.tools.map(t => ({
    name: t.name,
    bytes: JSON.stringify(t).length
  })).sort((a, b) => b.bytes - a.bytes)

  console.log("\nTop 20 largest:")
  for (const s of sizes.slice(0, 20)) {
    console.log("  " + s.name.padEnd(45) + s.bytes + " bytes (~" + Math.round(s.bytes / 4) + " tok)")
  }
  console.log("\nSmallest 10:")
  for (const s of sizes.slice(-10)) {
    console.log("  " + s.name.padEnd(45) + s.bytes + " bytes (~" + Math.round(s.bytes / 4) + " tok)")
  }

  await client.close()
  await srv.close()
}

main().catch(console.error)
