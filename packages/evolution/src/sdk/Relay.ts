import type * as CoreRelay from "../core/Relay.js"

export type Relay = typeof CoreRelay.Relay.Encoded

export type SingleHostAddr = (typeof CoreRelay.Relay.members)[0]["Encoded"]
export type SingleHostName = (typeof CoreRelay.Relay.members)[1]["Encoded"]
export type MultiHostName = (typeof CoreRelay.Relay.members)[2]["Encoded"]
