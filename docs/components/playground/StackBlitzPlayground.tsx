"use client"

import { useEffect, useRef, useState } from "react"
import sdk, { type VM } from "@stackblitz/sdk"

export interface StackBlitzPlaygroundProps {
	initialCode?: string
	onVmReady?: (vm: VM) => void
}

const defaultCode = `import { Core } from "@evolution-sdk/evolution"

const bech32 = "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp"

// Parse from Bech32
const address = Core.Address.fromBech32(bech32)

console.log("Address:", address)
console.log("Network ID:", address.networkId)
console.log("Payment credential:", address.paymentCredential)
console.log("Has staking:", address.stakingCredential !== undefined)

// Check if it's an enterprise address
console.log("Is enterprise:", Core.Address.isEnterprise(address))
`

export function StackBlitzPlayground({ initialCode = defaultCode, onVmReady }: StackBlitzPlaygroundProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const vmRef = useRef<VM | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const hasEmbeddedRef = useRef(false)

	useEffect(() => {
		if (!containerRef.current || hasEmbeddedRef.current) return

		hasEmbeddedRef.current = true
		setIsLoading(true)

			sdk
				.embedProject(
					containerRef.current,
					{
						title: "Evolution SDK Playground",
						description: "Interactive TypeScript playground for Evolution SDK",
						template: "node",
						files: {
							"index.ts": initialCode,
							"package.json": JSON.stringify(
								{
									name: "evolution-sdk-playground",
									version: "1.0.0",
									description: "Evolution SDK Playground",
									type: "module",
									main: "index.ts",
									scripts: {
										start: "tsx index.ts"
									},
									dependencies: {
										"@evolution-sdk/evolution": "latest",
										effect: "latest"
									},
									devDependencies: {
										"@types/node": "latest",
										tsx: "latest",
										typescript: "latest"
									}
								},
								null,
								2
							),
							"tsconfig.json": JSON.stringify(
								{
									compilerOptions: {
										target: "ES2022",
										module: "ESNext",
										moduleResolution: "bundler",
										lib: ["ES2022"],
										strict: true,
										esModuleInterop: true,
										skipLibCheck: true,
										forceConsistentCasingInFileNames: true,
										resolveJsonModule: true,
										isolatedModules: true
									}
								},
								null,
								2
							)
						}
					},
					{
						openFile: "index.ts",
						view: "editor",
						theme: "dark",
						hideExplorer: true
					}
				)
				.then((vm) => {
					vmRef.current = vm
					onVmReady?.(vm)
					setIsLoading(false)
				})
				.catch((error) => {
					console.error("Failed to load StackBlitz:", error)
					setIsLoading(false)
				})
	}, [])

	return (
		<div className="relative w-full h-full">
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-fd-background">
					<div className="text-fd-muted-foreground">Loading playground...</div>
				</div>
			)}
			<div ref={containerRef} className="w-full h-full" />
		</div>
	)
}
