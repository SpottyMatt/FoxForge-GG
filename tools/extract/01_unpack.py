"""Stage 01: unpack the .apkm into _work/.

  split_ab.apk            -> _work/ab/     (assets/Main/*.bundle — the game data)
  base.apk                -> _work/base/   (assets/bin/Data incl. il2cpp global-metadata)
  split_config.arm64.apk  -> _work/arm64/  (lib/arm64-v8a/libil2cpp.so)

Idempotent: skips anything already extracted.
"""

import zipfile
from pathlib import Path

from _common import AB_DIR, ARM64_DIR, BASE_DIR, WORK, find_apkm

INNER = {
    "split_ab.apk": AB_DIR,
    "base.apk": BASE_DIR,
    "split_config.arm64_v8a.apk": ARM64_DIR,
}


def extract_inner(outer: zipfile.ZipFile, name: str, dest: Path) -> None:
    marker = dest / ".extracted"
    if marker.exists():
        print(f"  {name}: already extracted -> {dest}")
        return
    dest.mkdir(parents=True, exist_ok=True)
    tmp = WORK / name
    if not tmp.exists():
        print(f"  {name}: copying out of .apkm ...")
        outer.extract(name, WORK)
    print(f"  {name}: unzipping -> {dest} ...")
    with zipfile.ZipFile(tmp) as inner:
        inner.extractall(dest)
    tmp.unlink()  # reclaim the intermediate apk
    marker.touch()
    print(f"  {name}: done")


def extract_il2cpp_from_disguised_7z() -> None:
    """UNITE hides the real IL2CPP runtime inside lib/arm64-v8a/libResources.so,
    which is a 7z archive masquerading as a shared library. Pull out
    libil2cpp.so + global-metadata.dat (NOTE: metadata is Tencent-encrypted —
    magic 94 43 72 12, not the standard AF 1B B1 FA)."""
    dest = WORK / "il2cpp"
    if (dest / "Managed" / "Metadata" / "global-metadata.dat").exists():
        print("  libResources.so: il2cpp payload already extracted")
        return
    import py7zr

    src = ARM64_DIR / "lib" / "arm64-v8a" / "libResources.so"
    targets = [
        "arm64-v8a/libil2cpp.so",
        "arm64-v8a/libunity.so",
        "Managed/Metadata/global-metadata.dat",
    ]
    print("  libResources.so: extracting disguised 7z -> _work/il2cpp ...")
    with py7zr.SevenZipFile(src, "r") as a:
        a.extract(path=dest, targets=targets)
    print("  libResources.so: done")


def main() -> None:
    apkm = find_apkm()
    print(f"Unpacking {apkm.name}")
    WORK.mkdir(exist_ok=True)
    with zipfile.ZipFile(apkm) as outer:
        for name, dest in INNER.items():
            extract_inner(outer, name, dest)
    extract_il2cpp_from_disguised_7z()

    bundles = list((AB_DIR / "assets" / "Main").glob("*.bundle"))
    print(f"\nAsset bundles: {len(bundles)}")
    meta = list(WORK.rglob("global-metadata.dat"))
    print(f"global-metadata.dat: {meta[0] if meta else 'NOT FOUND'}")
    il2cpp = list(WORK.rglob("libil2cpp.so"))
    print(f"libil2cpp.so: {il2cpp[0] if il2cpp else 'NOT FOUND'}")


if __name__ == "__main__":
    main()
