"""
Rerank Bench & Profiling Runner (HTTP)

Goals:
- Measure end-to-end latency and throughput against the running rerank server
- Optionally request per-stage timings (`debug=true`) to find bottlenecks
- Optionally trigger a one-off cProfile capture (`profile=true`) for deep Python profiling

Usage:
  uv run python python/bench.py --url http://localhost:8200 --requests 50 --concurrency 4 --docs 20 --debug

Notes:
- This script assumes the server is already running.
- Use --profile-once to request a single cProfile dump (see RERANK_PROFILE_DIR on the server).
- If you pass a local file path to --image, the server must be started with RERANK_ALLOW_FILE_URLS=1.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    idx = int(p * (len(sorted_vals) - 1))
    idx = max(0, min(len(sorted_vals) - 1, idx))
    return float(sorted_vals[idx])


def mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(sum(values) / len(values))


@dataclass(frozen=True)
class StageAgg:
    build_query_ms: list[float]
    split_docs_ms: list[float]
    text_only_ms: list[float]
    multimodal_ms: list[float]
    sort_ms: list[float]
    total_ms: list[float]


def _empty_stage_agg() -> StageAgg:
    return StageAgg(
        build_query_ms=[],
        split_docs_ms=[],
        text_only_ms=[],
        multimodal_ms=[],
        sort_ms=[],
        total_ms=[],
    )


def build_documents(n: int, image: Optional[str], multimodal_ratio: float) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    mm_every = int(1 / multimodal_ratio) if multimodal_ratio > 0 else 0
    for i in range(n):
        is_mm = bool(image) and mm_every > 0 and (i % mm_every == 0)
        if is_mm:
            docs.append(
                {
                    "id": f"doc-{i}",
                    "text": f"UI design document #{i} (contains an image).",
                    "image": image,
                }
            )
        else:
            topic = "machine learning" if i % 3 == 0 else "weather"
            docs.append(
                {
                    "id": f"doc-{i}",
                    "text": f"Document #{i} about {topic}.",
                }
            )
    return docs


async def one_request(
    client: httpx.AsyncClient,
    url: str,
    docs: list[dict[str, Any]],
    *,
    debug: bool,
    profile: bool,
    top_n: int,
) -> tuple[float, Optional[dict[str, Any]]]:
    payload: dict[str, Any] = {
        "query": {"text": "machine learning algorithms"},
        "documents": docs,
        "top_n": top_n,
        "debug": debug,
        "profile": profile,
    }
    t0 = time.perf_counter()
    r = await client.post(f"{url}/rerank", json=payload)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    r.raise_for_status()
    body = r.json()
    return elapsed_ms, body.get("debug")


async def run_load(
    url: str,
    *,
    concurrency: int,
    requests: int,
    docs: int,
    top_n: int,
    debug: bool,
    profile_once: bool,
    multimodal_ratio: float,
    image: Optional[str],
) -> dict[str, Any]:
    latencies_ms: list[float] = []
    stages = _empty_stage_agg()
    errors: list[str] = []

    docs_payload = build_documents(docs, image=image, multimodal_ratio=multimodal_ratio)

    idx = 0
    idx_lock = asyncio.Lock()

    async def worker(wid: int) -> None:
        nonlocal idx
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
            while True:
                async with idx_lock:
                    if idx >= requests:
                        return
                    cur = idx
                    idx += 1

                # Profile only the very first request (to avoid dumping many .pstats files)
                do_profile = profile_once and cur == 0
                try:
                    latency_ms, dbg = await one_request(
                        client,
                        url,
                        docs_payload,
                        debug=debug,
                        profile=do_profile,
                        top_n=top_n,
                    )
                    latencies_ms.append(latency_ms)
                    if debug and isinstance(dbg, dict):
                        stages.build_query_ms.append(float(dbg.get("build_query_ms", 0.0)))
                        stages.split_docs_ms.append(float(dbg.get("split_docs_ms", 0.0)))
                        stages.text_only_ms.append(float(dbg.get("text_only_ms", 0.0)))
                        stages.multimodal_ms.append(float(dbg.get("multimodal_ms", 0.0)))
                        stages.sort_ms.append(float(dbg.get("sort_ms", 0.0)))
                        stages.total_ms.append(float(dbg.get("total_ms", 0.0)))
                except Exception as e:
                    msg = f"worker={wid} req={cur} error={e}"
                    errors.append(msg)

    started = time.perf_counter()
    await asyncio.gather(*[worker(i) for i in range(max(1, concurrency))])
    duration_ms = (time.perf_counter() - started) * 1000

    total = len(latencies_ms) + len(errors)
    seconds = duration_ms / 1000 if duration_ms > 0 else 0.0
    rps = total / seconds if seconds > 0 else 0.0

    report: dict[str, Any] = {
        "url": url,
        "concurrency": concurrency,
        "requests": requests,
        "docs": docs,
        "top_n": top_n,
        "debug": debug,
        "profile_once": profile_once,
        "multimodal_ratio": multimodal_ratio,
        "duration_ms": duration_ms,
        "ok": len(latencies_ms),
        "failed": len(errors),
        "rps": rps,
        "latency_ms": {
            "avg": mean(latencies_ms),
            "p50": percentile(latencies_ms, 0.50),
            "p95": percentile(latencies_ms, 0.95),
            "p99": percentile(latencies_ms, 0.99),
            "max": percentile(latencies_ms, 1.00),
        },
        "errors": errors[:25],
    }

    if debug:
        report["stages_ms"] = {
            "build_query_ms": {
                "avg": mean(stages.build_query_ms),
                "p95": percentile(stages.build_query_ms, 0.95),
            },
            "split_docs_ms": {
                "avg": mean(stages.split_docs_ms),
                "p95": percentile(stages.split_docs_ms, 0.95),
            },
            "text_only_ms": {
                "avg": mean(stages.text_only_ms),
                "p95": percentile(stages.text_only_ms, 0.95),
            },
            "multimodal_ms": {
                "avg": mean(stages.multimodal_ms),
                "p95": percentile(stages.multimodal_ms, 0.95),
            },
            "sort_ms": {
                "avg": mean(stages.sort_ms),
                "p95": percentile(stages.sort_ms, 0.95),
            },
            "total_ms_server": {
                "avg": mean(stages.total_ms),
                "p95": percentile(stages.total_ms, 0.95),
            },
        }

    return report


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=os.getenv("QWEN3VL_RERANK_URL", "http://localhost:8200"))
    p.add_argument("--concurrency", type=int, default=4)
    p.add_argument("--requests", type=int, default=50)
    p.add_argument("--docs", type=int, default=20)
    p.add_argument("--top-n", type=int, default=10)
    p.add_argument("--debug", action="store_true")
    p.add_argument("--profile-once", action="store_true")
    p.add_argument("--multimodal-ratio", type=float, default=0.0)
    p.add_argument("--image", default=os.getenv("RERANK_BENCH_IMAGE", ""))
    p.add_argument("--out", default="")
    return p.parse_args()


async def main() -> None:
    args = parse_args()

    image = args.image.strip() or None
    # If a local path is provided, convert to file:// URL (server supports it)
    if image and not image.startswith(("http://", "https://", "file://")):
        image = f"file://{os.path.abspath(image)}"

    report = await run_load(
        args.url.rstrip("/"),
        concurrency=max(1, args.concurrency),
        requests=max(1, args.requests),
        docs=max(1, args.docs),
        top_n=max(1, args.top_n),
        debug=bool(args.debug),
        profile_once=bool(args.profile_once),
        multimodal_ratio=max(0.0, min(1.0, float(args.multimodal_ratio))),
        image=image,
    )

    print("")
    print("rerank benchmark results")
    print(json.dumps(report, indent=2))

    if args.out:
        out_path = os.path.abspath(args.out)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
            f.write("\n")
        print(f"\nWrote report to: {out_path}")


if __name__ == "__main__":
    asyncio.run(main())

