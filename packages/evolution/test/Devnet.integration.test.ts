import { afterAll, describe, expect, it } from "@effect/vitest"
import Docker from "dockerode"
import { Effect } from "effect"

import * as AddressEras from "../src/core/AddressEras.js"
import * as EnterpriseAddress from "../src/core/EnterpriseAddress.js"
import * as KeyHash from "../src/core/KeyHash.js"
import * as PrivateKey from "../src/core/PrivateKey.js"
import * as VKey from "../src/core/VKey.js"
import * as Devnet from "../src/sdk/Devnet/Devnet.js"

/**
 * Fast Shelley genesis config for testing.
 * Produces blocks every 20ms instead of default 1s (50x faster).
 */
const FAST_SHELLEY_GENESIS = {
  slotLength: 0.02,       // 20ms per slot (50x faster than default 1s)
  epochLength: 50,        // Very short epochs for faster testing
  activeSlotsCoeff: 1.0   // Block every slot (100% probability)
} as const

/**
 * Integration tests for Devnet module using REAL Docker containers.
 * 
 * Prerequisites:
 * - Docker daemon must be running
 * - Sufficient disk space for cardano-node image
 */
describe("Devnet Integration Tests", () => {
  const createdClusters: Array<Devnet.DevNetCluster> = []

  afterAll(async () => {
    for (const cluster of createdClusters) {
      try {
        await Devnet.Cluster.remove(cluster)
      } catch {
        // Silently ignore cleanup errors
      }
    }
  }, 120_000)

  describe("Cluster Creation", () => {
    it("should create devnet cluster with default configuration", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make()
      createdClusters.push(cluster)

      expect(cluster.cardanoNode).toBeDefined()
      expect(cluster.cardanoNode.id).toMatch(/^[a-f0-9]{64}$/i)
      expect(cluster.cardanoNode.name).toBe("devnet-cardano-node")
      expect(cluster.networkName).toBe("devnet-network")

      const docker = new Docker()
      const container = docker.getContainer(cluster.cardanoNode.id)
      const info = await container.inspect()

      expect(info.State.Status).toBe("created")
      expect(info.Name).toBe("/devnet-cardano-node")
    })

    it("should create devnet cluster with custom cluster name", { timeout: 120_000 }, async () => {
      const customName = "test-cluster-custom"
      const cluster = await Devnet.Cluster.make({ clusterName: customName })
      createdClusters.push(cluster)

      expect(cluster.cardanoNode.name).toBe(`${customName}-cardano-node`)
      expect(cluster.networkName).toBe(`${customName}-network`)
    })

    it("should create cluster with custom initial funds", { timeout: 120_000 }, async () => {
      const privateKeyBytes = PrivateKey.generate()
      const privateKey = PrivateKey.make({ key: privateKeyBytes })
      const publicKey = VKey.fromPrivateKey(privateKey)
      const keyHash = KeyHash.fromVKey(publicKey)
      const addressHex = KeyHash.toHex(keyHash)
      
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-funded",
        shelleyGenesis: {
          initialFunds: { [addressHex]: 1_000_000_000_000 }
        }
      })
      createdClusters.push(cluster)

      expect(cluster.cardanoNode.id).toBeDefined()
    })

    it("should create cluster with custom epoch length", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-fast-epochs",
        shelleyGenesis: { epochLength: 500 }
      })
      createdClusters.push(cluster)

      expect(cluster.cardanoNode.id).toBeDefined()
    })

    it("should create cluster with Kupo enabled", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-kupo",
        kupo: { enabled: true, port: 41442 }
      })
      createdClusters.push(cluster)

      expect(cluster.kupo).toBeDefined()
      expect(cluster.kupo?.name).toBe("test-cluster-kupo-kupo")
      
      const docker = new Docker()
      const container = docker.getContainer(cluster.kupo!.id)
      const info = await container.inspect()
      expect(info.Name).toBe("/test-cluster-kupo-kupo")
    })

    it("should create cluster with Ogmios enabled", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-ogmios",
        ogmios: { enabled: true, port: 41337 }
      })
      createdClusters.push(cluster)

      expect(cluster.ogmios).toBeDefined()
      expect(cluster.ogmios?.name).toBe("test-cluster-ogmios-ogmios")
      
      const docker = new Docker()
      const container = docker.getContainer(cluster.ogmios!.id)
      const info = await container.inspect()
      expect(info.Name).toBe("/test-cluster-ogmios-ogmios")
    })

    it("should remove and recreate cluster with same name", { timeout: 180_000 }, async () => {
      const clusterName = "test-cluster-recreate"
      
      const cluster1 = await Devnet.Cluster.make({ clusterName })
      const firstId = cluster1.cardanoNode.id
      
      const cluster2 = await Devnet.Cluster.make({ clusterName })
      createdClusters.push(cluster2)
      
      expect(cluster2.cardanoNode.id).not.toBe(firstId)
      expect(cluster2.cardanoNode.name).toBe(cluster1.cardanoNode.name)
      
      const docker = new Docker()
      await expect(docker.getContainer(firstId).inspect()).rejects.toThrow()
    })
  })

  describe("Cluster Lifecycle", () => {
    it("should start cluster and produce blocks", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-start",
        ports: { node: 4001, submit: 8090 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)

      const docker = new Docker()
      const container = docker.getContainer(cluster.cardanoNode.id)
      const info = await container.inspect()

      expect(info.State.Status).toBe("running")
      expect(info.State.Running).toBe(true)

      await new Promise((resolve) => setTimeout(resolve, 500))

      const logs = await container.logs({ stdout: true, stderr: true, tail: 100 })
      const logString = logs.toString()
      
      const hasBlockProduction =
        logString.includes("Forge.Loop.AdoptedBlock") ||
        logString.includes("Forge.Loop.NodeIsLeader")

      expect(hasBlockProduction).toBe(true)
      
      await Devnet.Cluster.stop(cluster)
    })

    it("should query tip after cluster starts", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-query-tip",
        ports: { node: 4002, submit: 8091 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await new Promise((resolve) => setTimeout(resolve, 500))

      const output = await Devnet.Container.execCommand(cluster.cardanoNode, [
        "cardano-cli", "query", "tip",
        "--socket-path", "/opt/cardano/ipc/node.socket",
        "--testnet-magic", "42"
      ])

      const tipData = JSON.parse(output)
      
      expect(tipData).toHaveProperty("block")
      expect(tipData).toHaveProperty("epoch")
      expect(tipData).toHaveProperty("slot")
      expect(tipData.block).toBeGreaterThan(0)
      
      await Devnet.Cluster.stop(cluster)
    })

    it("should stop running cluster", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-stop",
        ports: { node: 4003, submit: 8092 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await Devnet.Cluster.stop(cluster)

      const docker = new Docker()
      const container = docker.getContainer(cluster.cardanoNode.id)
      const info = await container.inspect()

      expect(info.State.Running).toBe(false)
      expect(info.State.Status).toMatch(/exited|stopped/)
    })

    it("should stop cluster with child containers", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-stop-all",
        ports: { node: 4004, submit: 8093 },
        shelleyGenesis: FAST_SHELLEY_GENESIS,
        kupo: { enabled: true },
        ogmios: { enabled: true }
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await Devnet.Cluster.stop(cluster)

      const docker = new Docker()

      const nodeInfo = await docker.getContainer(cluster.cardanoNode.id).inspect()
      expect(nodeInfo.State.Running).toBe(false)

      const kupoInfo = await docker.getContainer(cluster.kupo!.id).inspect()
      expect(kupoInfo.State.Running).toBe(false)

      const ogmiosInfo = await docker.getContainer(cluster.ogmios!.id).inspect()
      expect(ogmiosInfo.State.Running).toBe(false)
    })

    it("should restart stopped cluster", { timeout: 240_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-cluster-restart",
        ports: { node: 4005, submit: 8094 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await Devnet.Cluster.stop(cluster)
      await Devnet.Cluster.start(cluster)

      const docker = new Docker()
      const info = await docker.getContainer(cluster.cardanoNode.id).inspect()

      expect(info.State.Running).toBe(true)
      expect(info.State.Status).toBe("running")
      
      await Devnet.Cluster.stop(cluster)
    })
  })

  describe("Container Operations", () => {
    it("should start individual container", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-container-start",
        ports: { node: 4006, submit: 8095 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Container.start(cluster.cardanoNode)

      const docker = new Docker()
      const info = await docker.getContainer(cluster.cardanoNode.id).inspect()

      expect(info.State.Running).toBe(true)
      
      await Devnet.Container.stop(cluster.cardanoNode)
    })

    it("should stop individual container", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-container-stop",
        ports: { node: 4007, submit: 8096 },
        shelleyGenesis: FAST_SHELLEY_GENESIS
      })
      createdClusters.push(cluster)

      await Devnet.Container.start(cluster.cardanoNode)
      await Devnet.Container.stop(cluster.cardanoNode)

      const docker = new Docker()
      const info = await docker.getContainer(cluster.cardanoNode.id).inspect()

      expect(info.State.Running).toBe(false)
    })

    it("should get container status", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-container-status"
      })
      createdClusters.push(cluster)

      const status = await Devnet.Container.getStatus(cluster.cardanoNode)

      expect(status).toBeDefined()
      expect(status?.State).toBeDefined()
      expect(status?.State.Status).toBe("created")
    })
  })

  describe("Error Handling", () => {
    it("should fail gracefully when Docker is not available", { timeout: 30_000 }, async () => {
      const fakeContainer: Devnet.DevNetContainer = {
        id: "nonexistent123456789",
        name: "fake-container"
      }

      await expect(
        Devnet.Container.getStatus(fakeContainer)
      ).rejects.toThrow()
    })

    it("should handle missing Docker image gracefully", { timeout: 30_000 }, async () => {
      const isAvailable = await Devnet.Container.isImageAvailable(
        "cardanosolutions/cardano-node-ogmios:latest-nonexistent"
      )

      expect(isAvailable).toBe(false)
    })

    it("should stop non-running container without error", { timeout: 120_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-stop-not-running"
      })
      createdClusters.push(cluster)

      await expect(
        Devnet.Container.stop(cluster.cardanoNode)
      ).resolves.not.toThrow()
    })
  })

  describe("Effect Integration", () => {
    it("should create cluster using Effect.gen", { timeout: 120_000 }, async () => {
      const program = Effect.gen(function* () {
        const cluster = yield* Devnet.Cluster.makeEffect({
          clusterName: "test-effect-gen"
        })
        
        return cluster
      })

      const cluster = await Effect.runPromise(program)
      createdClusters.push(cluster)

      expect(cluster.cardanoNode.id).toBeDefined()
    })

    it("should handle errors using Effect error channel", { timeout: 30_000 }, async () => {
      const program = Effect.gen(function* () {
        const fakeContainer: Devnet.DevNetContainer = {
          id: "fake-id-for-effect",
          name: "fake"
        }
        
        yield* Devnet.Container.getStatusEffect(fakeContainer)
      })

      await expect(
        Effect.runPromise(program)
      ).rejects.toThrow(/container may be corrupted or inaccessible/i)
    })

    it("should compose cluster operations in Effect pipeline", { timeout: 180_000 }, async () => {
      const program = Effect.gen(function* () {
        const cluster = yield* Devnet.Cluster.makeEffect({
          clusterName: "test-effect-pipeline",
          ports: { node: 4008, submit: 8097 },
          shelleyGenesis: FAST_SHELLEY_GENESIS
        })
        
        yield* Devnet.Cluster.startEffect(cluster)
        yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 500)))
        
        const status = yield* Devnet.Container.getStatusEffect(cluster.cardanoNode)
        
        yield* Devnet.Cluster.stopEffect(cluster)
        
        return { cluster, wasRunning: status?.State.Running }
      })

      const result = await Effect.runPromise(program)
      createdClusters.push(result.cluster)

      expect(result.wasRunning).toBe(true)
      
      await Devnet.Cluster.stop(result.cluster)
    })
  })

  describe("Real-World Scenarios", () => {
    it("should create funded devnet cluster and query UTxOs", { timeout: 240_000 }, async () => {
      const privateKeyBytes = PrivateKey.generate()
      const privateKey = PrivateKey.make({ key: privateKeyBytes })
      const publicKey = VKey.fromPrivateKey(privateKey)
      const keyHash = KeyHash.fromVKey(publicKey)

      const enterpriseAddr = new EnterpriseAddress.EnterpriseAddress({
        networkId: 0,
        paymentCredential: keyHash
      })

      const addressHex = EnterpriseAddress.toHex(enterpriseAddr)
      const addressBech32 = AddressEras.toBech32(enterpriseAddr)

      const cluster = await Devnet.Cluster.make({
        clusterName: "test-funded-utxos",
        ports: { node: 4009, submit: 8098 },
        shelleyGenesis: {
          ...FAST_SHELLEY_GENESIS,
          initialFunds: {
            [addressHex]: 5_000_000_000_000
          }
        }
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await new Promise((resolve) => setTimeout(resolve, 500))

      const output = await Devnet.Container.execCommand(cluster.cardanoNode, [
        "cardano-cli",
        "query",
        "utxo",
        "--address",
        addressBech32,
        "--socket-path",
        "/opt/cardano/ipc/node.socket",
        "--testnet-magic",
        "42",
        "--out-file",
        "/dev/stdout"
      ])

      expect(output).toContain(addressBech32)
      
      await Devnet.Cluster.stop(cluster)
    })

    it("should create devnet with Kupo and Ogmios for full stack testing", { timeout: 180_000 }, async () => {
      const cluster = await Devnet.Cluster.make({
        clusterName: "test-full-stack",
        ports: { node: 4010, submit: 8099 },
        shelleyGenesis: FAST_SHELLEY_GENESIS,
        kupo: {
          enabled: true,
          port: 41444,
          logLevel: "Debug"
        },
        ogmios: {
          enabled: true,
          port: 41339,
          logLevel: "info"
        }
      })
      createdClusters.push(cluster)

      await Devnet.Cluster.start(cluster)
      await new Promise((resolve) => setTimeout(resolve, 2_000))

      const docker = new Docker()
      
      const nodeInfo = await docker.getContainer(cluster.cardanoNode.id).inspect()
      expect(nodeInfo.State.Running).toBe(true)
      
      const kupoInfo = await docker.getContainer(cluster.kupo!.id).inspect()
      expect(kupoInfo.State.Running).toBe(true)
      
      const ogmiosInfo = await docker.getContainer(cluster.ogmios!.id).inspect()
      expect(ogmiosInfo.State.Running).toBe(true)

      await Devnet.Cluster.stop(cluster)
    })
  })
})
