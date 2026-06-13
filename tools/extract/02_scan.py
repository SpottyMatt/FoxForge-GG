"""Stage 02: scan every asset bundle and report what's inside.

This output decides the numeric-extraction branch:
  (a) TextAsset tables present  -> dump + decode them
  (b) MonoBehaviours WITH type trees -> UnityPy reads fields directly
  (c) type trees stripped -> need IL2CPP type defs (metadata is encrypted...)

Outputs (in _work/out/):
  scan_report.json          object-type counts, per-type-tree stats, errors
  containers.txt            every container path -> bundle file (the asset map)
  names_textassets.txt      every TextAsset m_Name + bundle
  names_monobehaviours.txt  MonoBehaviour m_Names (deduped sample)
"""

import json
import multiprocessing as mp
from collections import Counter
from pathlib import Path

import UnityPy

from _common import AB_DIR, OUT_DIR

MAIN = AB_DIR / "assets" / "Main"
INDEPENDENT = AB_DIR / "assets" / "IndependentFiles"


def scan_one(path_str: str) -> dict:
    """Scan a single bundle; return plain-dict facts (picklable)."""
    out = {
        "file": Path(path_str).name,
        "types": {},
        "tt_mono_with": 0,
        "tt_mono_without": 0,
        "containers": [],
        "textassets": [],
        "monobehaviours": [],
        "error": None,
    }
    try:
        env = UnityPy.load(path_str)
        types = Counter()
        for obj in env.objects:
            tname = obj.type.name
            types[tname] += 1
            if tname == "MonoBehaviour":
                nodes = None
                st = obj.serialized_type
                if st is not None:
                    nodes = getattr(st, "node", None) or getattr(st, "nodes", None)
                if nodes:
                    out["tt_mono_with"] += 1
                else:
                    out["tt_mono_without"] += 1
                try:
                    name = obj.peek_name()
                except Exception:
                    name = None
                if name:
                    out["monobehaviours"].append(name)
            elif tname == "TextAsset":
                try:
                    data = obj.read()
                    out["textassets"].append(
                        f"{data.m_Name}\t{len(bytes(data.m_Script))}"
                    )
                except Exception as e:  # noqa: BLE001
                    out["textassets"].append(f"<read-error: {e}>")
            elif tname == "AssetBundle":
                try:
                    data = obj.read()
                    for cpath, _ in data.m_Container:
                        out["containers"].append(cpath)
                except Exception:
                    pass
        out["types"] = dict(types)
    except Exception as e:  # noqa: BLE001
        out["error"] = f"{type(e).__name__}: {e}"
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(str(p) for p in MAIN.iterdir() if p.is_file())
    if INDEPENDENT.exists():
        files.append(str(INDEPENDENT))
    print(f"Scanning {len(files)} files with {mp.cpu_count()} workers ...")

    with mp.Pool() as pool:
        results = pool.map(scan_one, files, chunksize=16)

    total_types = Counter()
    tt_with = tt_without = 0
    errors = []
    containers = []
    textassets = []
    mono_names = Counter()
    for r in results:
        total_types.update(r["types"])
        tt_with += r["tt_mono_with"]
        tt_without += r["tt_mono_without"]
        if r["error"]:
            errors.append({"file": r["file"], "error": r["error"]})
        containers.extend(f"{c}\t{r['file']}" for c in r["containers"])
        textassets.extend(f"{t}\t{r['file']}" for t in r["textassets"])
        mono_names.update(r["monobehaviours"])

    report = {
        "files_scanned": len(files),
        "errors": errors,
        "object_type_counts": dict(total_types.most_common()),
        "monobehaviour_with_typetree": tt_with,
        "monobehaviour_without_typetree": tt_without,
        "textasset_count": total_types.get("TextAsset", 0),
        "container_count": len(containers),
    }
    (OUT_DIR / "scan_report.json").write_text(json.dumps(report, indent=2))
    (OUT_DIR / "containers.txt").write_text("\n".join(sorted(containers)))
    (OUT_DIR / "names_textassets.txt").write_text("\n".join(sorted(textassets)))
    (OUT_DIR / "names_monobehaviours.txt").write_text(
        "\n".join(f"{n}\t{c}" for n, c in mono_names.most_common())
    )

    print(json.dumps(report["object_type_counts"], indent=2))
    print(f"MonoBehaviour WITH type tree:    {tt_with}")
    print(f"MonoBehaviour WITHOUT type tree: {tt_without}")
    print(f"TextAssets: {report['textasset_count']}")
    print(f"Container paths: {len(containers)}")
    print(f"Errors: {len(errors)}")
    print(f"\nReports in {OUT_DIR}")


if __name__ == "__main__":
    main()
