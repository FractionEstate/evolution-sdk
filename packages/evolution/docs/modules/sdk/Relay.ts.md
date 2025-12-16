---
title: sdk/Relay.ts
nav_order: 190
parent: Modules
---

## Relay overview

---

<h2 class="text-delta">Table of contents</h2>

- [utils](#utils)
  - [MultiHostName (type alias)](#multihostname-type-alias)
  - [Relay (type alias)](#relay-type-alias)
  - [SingleHostAddr (type alias)](#singlehostaddr-type-alias)
  - [SingleHostName (type alias)](#singlehostname-type-alias)

---

# utils

## MultiHostName (type alias)

**Signature**

```ts
export type MultiHostName = (typeof CoreRelay.Relay.members)[2]["Encoded"]
```

## Relay (type alias)

**Signature**

```ts
export type Relay = typeof CoreRelay.Relay.Encoded
```

## SingleHostAddr (type alias)

**Signature**

```ts
export type SingleHostAddr = (typeof CoreRelay.Relay.members)[0]["Encoded"]
```

## SingleHostName (type alias)

**Signature**

```ts
export type SingleHostName = (typeof CoreRelay.Relay.members)[1]["Encoded"]
```
