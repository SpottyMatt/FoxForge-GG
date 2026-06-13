"""Sliding-window UnityCN key recovery: test every byte offset of a file as a
candidate 16-byte AES key against the bundle's embedded signature."""
import sys, time
from pathlib import Path
from Crypto.Cipher import AES

KEY_SIG = bytes.fromhex("6b37a61c5d94e2ef4251fddd7eb67c9c")
DATA_SIG = bytes.fromhex("a56b2bf7b2a5153bd5963e9700f55b64")
EXPECTED = bytes(a ^ b for a, b in zip(DATA_SIG, b"#$unity3dchina!@"))


def scan(fp: str):
    data = Path(fp).read_bytes()
    n = len(data) - 16
    t = time.time()
    enc = AES.new  # local
    for i in range(n):
        if enc(data[i : i + 16], AES.MODE_ECB).encrypt(KEY_SIG) == EXPECTED:
            key = data[i : i + 16]
            print(f"\n*** FOUND in {fp} at offset {i} ({hex(i)}) ***")
            print("hex:", key.hex())
            Path("_work/out/unitycn_key.bin").write_bytes(key)
            Path("_work/out/unitycn_key.hex").write_text(key.hex())
            return key
        if i % 5_000_000 == 0 and i:
            print(f"  {fp}: {i//1_000_000}M/{n//1_000_000}M ({time.time()-t:.0f}s)", flush=True)
    print(f"  {fp}: no match ({time.time()-t:.0f}s)")
    return None


if __name__ == "__main__":
    for fp in sys.argv[1:]:
        if scan(fp):
            break
