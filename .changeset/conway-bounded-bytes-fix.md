---
"@evolution-sdk/evolution": patch
---

Introduces `BoundedBytes` as a first-class CBOR node type that enforces the Conway CDDL `bounded_bytes = bytes .size (0..64)` constraint unconditionally and independently of `CodecOptions`. PlutusData byte strings are now emitted via `CBOR.BoundedBytes.make()`, which applies definite-length encoding for ≤ 64 bytes and indefinite-length 64-byte chunked encoding (`0x5f [chunk]* 0xff`) for larger values. Adds `BoundedBytes` branch to `CBOR.match`. Removes the unused `PreEncoded` node type.
