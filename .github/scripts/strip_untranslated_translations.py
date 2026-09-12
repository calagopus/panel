#!/usr/bin/env python3
# Removes strings from Crowdin-downloaded translation files that Crowdin
# filled in with the source-language text because no translation exists yet.
#
# Usage: strip_untranslated_translations.py <translation-file.json> [...]
# Each file is compared against "en.json" in the same directory.

from __future__ import annotations

import json
import sys
from pathlib import Path

SOURCE_FILENAME = "en.json"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def strip_untranslated(source: dict, target: dict) -> tuple[dict, int]:
    removed = 0
    result: dict = {}

    for key, target_value in target.items():
        source_value = source.get(key)

        if isinstance(target_value, dict) and isinstance(source_value, dict):
            pruned, count = strip_untranslated(source_value, target_value)
            removed += count
            if pruned:
                result[key] = pruned
        elif isinstance(target_value, dict):
            result[key] = target_value
        elif target_value == source_value:
            removed += 1
        else:
            result[key] = target_value

    return result, removed


def process_file(target_path: Path) -> None:
    source_path = target_path.with_name(SOURCE_FILENAME)

    if target_path.resolve() == source_path.resolve():
        return

    if not source_path.exists():
        print(f"skip {target_path}: no {SOURCE_FILENAME} found alongside it", file=sys.stderr)
        return

    if not target_path.exists():
        print(f"skip {target_path}: file not found", file=sys.stderr)
        return

    source_data = load_json(source_path)
    target_data = load_json(target_path)

    pruned, removed = strip_untranslated(source_data, target_data)
    if not removed:
        return

    if pruned:
        dump_json(target_path, pruned)
        print(f"{target_path}: stripped {removed} untranslated string(s)")
    else:
        target_path.unlink()
        print(f"{target_path}: stripped {removed} untranslated string(s), no translations left, deleted")


def main(argv: list[str]) -> int:
    if not argv:
        print("no translation files given, nothing to do")
        return 0

    for raw_path in argv:
        process_file(Path(raw_path))

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
