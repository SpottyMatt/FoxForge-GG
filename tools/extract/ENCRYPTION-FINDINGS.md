# M2 Datamining — Encryption Findings (blocker)

**Date:** 2026-06-11 · **APK:** jp.pokemon.pokemonunite v1.23.1.1

## What we confirmed (first-party, from the APK)
- The `.apkm` unpacks cleanly: `split_ab.apk` → 1,444 `assets/Main/*.bundle`,
  `base.apk` → `assets/bin/Data` + IL2CPP metadata, the IL2CPP runtime hidden
  inside `lib/arm64-v8a/libResources.so` (a 7z masquerading as a .so;
  `01_unpack.py` extracts `libil2cpp.so` 165 MB + `global-metadata.dat` 32 MB).
- **All 1,444 data bundles are encrypted.** Every bundle keeps the `UnityFS`
  magic and `2019.4.15f1` revision, but the size word is scrambled (0/1444 match
  the real file size) and the compressed block-info won't inflate. UnityPy reads
  **0 objects**. Encryption is flagged by bit `0x200` (49 bundles) or `0x400`
  (1,395 bundles) in the bundle `flags` word.
- The scheme is **TiMi's custom XOR** (kwsch/UntieUnite, `AssetCrypto.cs`):
  `plain[i] = ((cipher[i] ^ ~key[i % len]) + 0x49) & 0xFF`, a 16-byte
  `MetaDataKey` over the size fields + a 1013-byte `BlockInfoKey` over the
  compressed block info. Ported verbatim in `bundle_crypto.py`.
- **`global-metadata.dat` is also encrypted** — magic `94 43 72 12` instead of
  the standard `AF 1B B1 FA`, so Il2CppDumper can't read types as-is either.

## The blocker
The public keys **no longer work** on v1.23.1.1. Under the documented transform
(and every common variant, both endiannesses), the UntieUnite `MetaDataKey` does
not decrypt the size field to the file size for any bundle. Decisive proof: in an
independent-byte XOR scheme, the size's high bytes are `0x00`, so `cipher[0]`
would be the **same constant** across all bundles — but it varies (`0x93`, `0xD6`,
…). TiMi rotated the `MetaData`/`BlockInfo` byte-array keys (and/or chained the
cipher) sometime in the 5 years since UntieUnite (2021) was last updated. No
public fork (newest 2022) covers this version.

**Consequence:** both the numeric tables *and* the art/icons live behind this
bundle encryption, so first-party extraction of *either* is blocked until the
current keys are recovered.

## Paths forward
- **A — Deep RE (recover current keys):** find the bundle-decrypt routine in the
  165 MB stripped `libil2cpp.so` and read the live key/scheme. Gated by the
  *also*-rotated metadata encryption (needed for symbol/type recovery). Multi-hour,
  uncertain.
- **B — Community-data fallback (the plan's documented last resort):** numbers
  from Unite-DB / UniteAPI, art from community/official sources, every value
  flagged with its `source`. Unblocks the product immediately; first-party
  pipeline stays in-repo for when keys are recovered.

## What's already built and reusable regardless
`01_unpack.py` (incl. the disguised-7z IL2CPP extraction), `02_scan.py`,
`bundle_crypto.py` (correct scheme, needs current keys), `_keyscan.py`. The M1
engine + tests are complete and data-source-agnostic.
