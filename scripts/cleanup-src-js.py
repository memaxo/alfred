#!/usr/bin/env python3

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def git_ls_files() -> set[str]:
    proc = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout = proc.stdout.decode("utf-8", errors="ignore")
    return {p for p in stdout.split("\0") if p}


def find_src_js_artifacts() -> list[Path]:
    skip_dirs = {
        ".git",
        ".turbo",
        "build",
        "coverage",
        "dist",
        "logs",
        "node_modules",
        "test-results",
        "tmp",
        "vendor",
    }

    out: list[Path] = []
    for base in (ROOT / "packages", ROOT / "apps"):
        if not base.exists():
            continue

        for p in base.rglob("*.js"):
            if not p.is_file():
                continue

            rel = p.relative_to(ROOT)
            if any(part in skip_dirs for part in rel.parts):
                continue
            if "src" not in rel.parts:
                continue

            ts = p.with_suffix(".ts")
            tsx = p.with_suffix(".tsx")
            if ts.exists() or tsx.exists():
                out.append(p)

    out.sort()
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Delete emitted src/**/*.js artifacts that shadow TypeScript sources."
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    tracked = git_ls_files()
    paths = find_src_js_artifacts()

    if not paths:
        print("No src/**/*.js artifacts found.")
        return 0

    tracked_hits: list[str] = []
    deleted = 0

    for p in paths:
        rel = p.relative_to(ROOT).as_posix()
        if rel in tracked:
            tracked_hits.append(rel)
            continue

        if not args.dry_run:
            p.unlink()
            deleted += 1

    if tracked_hits:
        sys.stderr.write("Refusing to delete tracked files:\n")
        for rel in tracked_hits:
            sys.stderr.write(f"- {rel}\n")
        sys.stderr.write("\nUntrack them first if they are truly generated.\n")
        return 2

    if args.dry_run:
        print(f"Would delete {len(paths)} src/**/*.js artifacts.")
        return 0

    print(f"Deleted {deleted} src/**/*.js artifacts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
