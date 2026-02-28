---
"@evolution-sdk/evolution": patch
---

Fix CBOR encoding of large byte strings to comply with the Conway CDDL `bounded_bytes = bytes .size (0..64)` constraint. Byte strings longer than 64 bytes are now encoded as indefinite-length chunked byte strings (`0x5f [chunk]* 0xff`). Adds `chunkBytesAt` option to `CodecOptions`; set to 64 in `CML_DATA_DEFAULT_OPTIONS` and `AIKEN_DEFAULT_OPTIONS`.
