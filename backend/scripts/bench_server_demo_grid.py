from __future__ import annotations

import asyncio
import json
import math
import os
import statistics
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from random import Random
from time import perf_counter
from typing import Any

from httpx import ASGITransport, AsyncClient

from app.features.server_demo.seed import insert_demo_rows
from app.main import app

BENCHMARK_NAME = "affino-grid-backend-server-demo"
DEFAULT_OUTPUT_PATH = Path("artifacts/performance/backend-server-demo-grid-benchmark.json")
DEFAULT_SEEDS = [1337, 7331, 2026]
DEFAULT_WARMUP_RUNS = 1
DEFAULT_ITERATIONS = 5


@dataclass(frozen=True)
class ScenarioMetrics:
    samples_ms: list[float]
    extra: dict[str, Any]


def parse_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default


def parse_seeds(raw: str | None) -> list[int]:
    if not raw:
        return DEFAULT_SEEDS
    seeds: list[int] = []
    for part in raw.split(","):
        candidate = part.strip()
        if not candidate:
            continue
        try:
            seeds.append(int(candidate))
        except ValueError:
            continue
    return seeds or DEFAULT_SEEDS


def compute_stats(samples_ms: list[float]) -> dict[str, float]:
    if not samples_ms:
        return {
            "count": 0,
            "mean": 0.0,
            "stdev": 0.0,
            "p50": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "min": 0.0,
            "max": 0.0,
            "cvPct": 0.0,
        }
    ordered = sorted(samples_ms)
    mean = statistics.fmean(ordered)
    stdev = statistics.pstdev(ordered) if len(ordered) > 1 else 0.0
    cv_pct = (stdev / mean) * 100.0 if mean > 0 else 0.0

    def percentile(pct: float) -> float:
        if len(ordered) == 1:
            return ordered[0]
        index = max(0, min(len(ordered) - 1, math.ceil((pct / 100.0) * len(ordered)) - 1))
        return ordered[index]

    return {
        "count": len(ordered),
        "mean": mean,
        "stdev": stdev,
        "p50": percentile(50.0),
        "p95": percentile(95.0),
        "p99": percentile(99.0),
        "min": ordered[0],
        "max": ordered[-1],
        "cvPct": cv_pct,
    }


def latency_metrics(samples_ms: list[float], *, unit_name: str | None = None, unit_count: float | None = None) -> dict[str, Any]:
    metrics = compute_stats(samples_ms)
    if metrics["mean"] > 0:
        metrics["operationsPerSecond"] = 1000.0 / metrics["mean"]
    if unit_name and unit_count is not None and metrics["mean"] > 0:
        metrics[f"{unit_name}PerSecond"] = (unit_count * 1000.0) / metrics["mean"]
    return metrics


def build_scope(workspace_id: str, seed: int, scenario: str) -> dict[str, str]:
    token = f"{workspace_id}-{scenario}-{seed}"
    return {
        "workspace_id": workspace_id,
        "table_id": "server_demo",
        "session_id": f"{token}-session",
        "user_id": f"{token}-user",
    }


def workspace_headers(workspace_id: str) -> dict[str, str]:
    return {"X-Workspace-Id": workspace_id}


def create_fill_projection() -> dict[str, object]:
    return {
        "sortModel": [],
        "filterModel": None,
        "groupBy": None,
        "groupExpansion": {"expandedByDefault": False, "toggledGroupKeys": []},
        "treeData": None,
        "pivot": None,
        "pagination": {
            "snapshot": {
                "enabled": False,
                "pageSize": 50,
                "currentPage": 0,
                "pageCount": 0,
                "totalRowCount": 0,
                "startIndex": 0,
                "endIndex": 49,
            },
            "cursor": None,
        },
    }


async def measure(
    iterations: int,
    warmup_runs: int,
    operation: Callable[[int], Awaitable[dict[str, Any] | None]],
) -> tuple[list[float], list[dict[str, Any]]]:
    samples_ms: list[float] = []
    payloads: list[dict[str, Any]] = []
    total_runs = warmup_runs + iterations
    for index in range(total_runs):
        start = perf_counter()
        payload = await operation(index)
        elapsed_ms = (perf_counter() - start) * 1000.0
        if index >= warmup_runs:
            samples_ms.append(elapsed_ms)
            if payload is not None:
                payloads.append(payload)
    return samples_ms, payloads


async def seed_workspace_rows(workspace_id: str, *, row_count: int, id_prefix: str) -> None:
    await insert_demo_rows(workspace_id=workspace_id, row_count=row_count, id_prefix=id_prefix)


async def benchmark_pull_viewport(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=512, id_prefix=f"{workspace_id}-pull")
    scope_headers = workspace_headers(workspace_id)
    rng = Random(seed)

    async def run(index: int) -> dict[str, Any]:
        start_row = rng.randint(0, 462)
        response = await client.post(
            "/api/server-demo/pull",
            headers=scope_headers,
            json={"range": {"startRow": start_row, "endRow": start_row + 50}},
        )
        response.raise_for_status()
        body = response.json()
        assert len(body["rows"]) == 50
        return {"rows": len(body["rows"]), "revision": body.get("revision")}

    samples_ms, payloads = await measure(iterations, warmup_runs, run)
    return ScenarioMetrics(samples_ms=samples_ms, extra={
        "rowsPerResponse": 50,
        "sampleCount": len(payloads),
        "rowsPerSecond": (50 * 1000.0 / statistics.fmean(samples_ms)) if samples_ms else 0.0,
    })


async def benchmark_edit_commit(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=32, id_prefix=f"{workspace_id}-edit")
    scope = build_scope(workspace_id, seed, "edit")
    headers = workspace_headers(workspace_id)
    rng = Random(seed + 11)

    async def run(index: int) -> dict[str, Any]:
        row_index = rng.randint(0, 31)
        operation_id = f"{workspace_id}-edit-{index}"
        response = await client.post(
            "/api/server-demo/edits",
            headers=headers,
            json={
                "operationId": operation_id,
                **scope,
                "edits": [
                    {
                        "rowId": f"{workspace_id}-edit-{row_index:06d}",
                        "columnId": "name",
                        "value": f"Bench edit {seed}-{index}",
                    }
                ],
            },
        )
        response.raise_for_status()
        body = response.json()
        assert body["operationId"] == operation_id
        assert body["canUndo"] is True
        assert body["canRedo"] is False
        assert body["latestUndoOperationId"] == operation_id
        assert body["latestRedoOperationId"] is None
        return body

    samples_ms, payloads = await measure(iterations, warmup_runs, run)
    return ScenarioMetrics(samples_ms=samples_ms, extra={
        "rowsPerOperation": 1,
        "sampleCount": len(payloads),
    })


async def benchmark_fill_commit(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=256, id_prefix=f"{workspace_id}-fill")
    headers = workspace_headers(workspace_id)
    scope = build_scope(workspace_id, seed, "fill")
    projection = create_fill_projection()
    variants = {
        "small": 4,
        "medium": 16,
        "large": 64,
    }
    result: dict[str, Any] = {}

    for label, target_count in variants.items():
        samples_ms: list[float] = []
        row_counts: list[int] = []
        cell_counts: list[int] = []
        total_runs = warmup_runs + iterations
        for index in range(total_runs):
            start_row = (index * (target_count + 2)) % (256 - target_count - 1)
            source_row_id = f"{workspace_id}-fill-{start_row:06d}"
            target_row_ids = [f"{workspace_id}-fill-{row_index:06d}" for row_index in range(start_row + 1, start_row + target_count + 1)]
            operation_id = f"{workspace_id}-fill-{label}-{index}"
            started = perf_counter()
            response = await client.post(
                "/api/server-demo/fill/commit",
                headers=headers,
                json={
                    "operationId": operation_id,
                    **scope,
                    "sourceRange": {"startRow": start_row, "endRow": start_row, "startColumn": 0, "endColumn": 0},
                    "targetRange": {"startRow": start_row + 1, "endRow": start_row + target_count, "startColumn": 0, "endColumn": 0},
                    "sourceRowIds": [source_row_id],
                    "targetRowIds": target_row_ids,
                    "fillColumns": ["name"],
                    "referenceColumns": ["name"],
                    "mode": "copy",
                    "projection": projection,
                },
            )
            elapsed_ms = (perf_counter() - started) * 1000.0
            response.raise_for_status()
            body = response.json()
            assert body["operationId"] == operation_id
            assert body["canUndo"] is True
            assert body["canRedo"] is False
            assert body["latestUndoOperationId"] == operation_id
            assert body["latestRedoOperationId"] is None
            if index < warmup_runs:
                continue
            samples_ms.append(elapsed_ms)
            row_counts.append(int(body["affectedRows"]))
            cell_counts.append(int(body["affectedCells"]))
        result[label] = {
            **latency_metrics(samples_ms, unit_name="fillOperation"),
            "affectedRowsMean": statistics.fmean(row_counts) if row_counts else 0.0,
            "affectedCellsMean": statistics.fmean(cell_counts) if cell_counts else 0.0,
            "samples": samples_ms,
        }

    combined_samples = [sample for payload in result.values() for sample in payload.get("samples", [])]
    return ScenarioMetrics(samples_ms=combined_samples, extra={"variants": result})


async def benchmark_history_status(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=16, id_prefix=f"{workspace_id}-status")
    scope = build_scope(workspace_id, seed, "status")
    headers = workspace_headers(workspace_id)

    async def run(_index: int) -> dict[str, Any]:
        response = await client.post("/api/history/status", headers=headers, json=scope)
        response.raise_for_status()
        body = response.json()
        assert body["workspace_id"] == workspace_id
        return body

    samples_ms, payloads = await measure(iterations, warmup_runs, run)
    return ScenarioMetrics(samples_ms=samples_ms, extra={
        "sampleCount": len(payloads),
    })


async def benchmark_undo_redo_cycle(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=16, id_prefix=f"{workspace_id}-cycle")
    headers = workspace_headers(workspace_id)
    scope = build_scope(workspace_id, seed, "cycle")
    rng = Random(seed + 41)
    commit_samples: list[float] = []
    undo_samples: list[float] = []
    redo_samples: list[float] = []

    total_runs = warmup_runs + iterations
    for index in range(total_runs):
        row_index = rng.randint(0, 15)
        operation_id = f"{workspace_id}-cycle-{index}"
        started = perf_counter()
        commit_response = await client.post(
            "/api/server-demo/edits",
            headers=headers,
            json={
                "operationId": operation_id,
                **scope,
                "edits": [
                    {
                        "rowId": f"{workspace_id}-cycle-{row_index:06d}",
                        "columnId": "status",
                        "value": "Paused",
                    }
                ],
            },
        )
        commit_elapsed = (perf_counter() - started) * 1000.0
        commit_response.raise_for_status()
        commit_body = commit_response.json()
        if index >= warmup_runs:
            assert commit_body["canUndo"] is True
            assert commit_body["canRedo"] is False
            commit_samples.append(commit_elapsed)

        started = perf_counter()
        undo_response = await client.post(f"/api/server-demo/operations/{operation_id}/undo", headers=headers)
        undo_elapsed = (perf_counter() - started) * 1000.0
        undo_response.raise_for_status()
        if index >= warmup_runs:
            undo_samples.append(undo_elapsed)

        started = perf_counter()
        redo_response = await client.post(f"/api/server-demo/operations/{operation_id}/redo", headers=headers)
        redo_elapsed = (perf_counter() - started) * 1000.0
        redo_response.raise_for_status()
        if index >= warmup_runs:
            redo_samples.append(redo_elapsed)

    return ScenarioMetrics(
        samples_ms=commit_samples + undo_samples + redo_samples,
        extra={
            "commit": latency_metrics(commit_samples),
            "undo": latency_metrics(undo_samples),
            "redo": latency_metrics(redo_samples),
        },
    )


async def benchmark_histogram(client: AsyncClient, *, workspace_id: str, seed: int, iterations: int, warmup_runs: int) -> ScenarioMetrics:
    await seed_workspace_rows(workspace_id, row_count=512, id_prefix=f"{workspace_id}-hist")
    scope = build_scope(workspace_id, seed, "histogram")
    headers = workspace_headers(workspace_id)

    async def run(_index: int) -> dict[str, Any]:
        response = await client.post(
            "/api/server-demo/histogram",
            headers=headers,
            json={
                "columnId": "region",
                "filterModel": None,
            },
        )
        response.raise_for_status()
        body = response.json()
        assert body["columnId"] == "region"
        return body

    samples_ms, payloads = await measure(iterations, warmup_runs, run)
    return ScenarioMetrics(samples_ms=samples_ms, extra={
        "sampleCount": len(payloads),
        "entriesMean": statistics.fmean(len(payload["entries"]) for payload in payloads) if payloads else 0.0,
    })


async def run_benchmark() -> dict[str, Any]:
    seeds = parse_seeds(os.environ.get("BENCH_SEEDS"))
    warmup_runs = parse_int_env("BENCH_WARMUP_RUNS", DEFAULT_WARMUP_RUNS)
    iterations = parse_int_env("BENCH_ITERATIONS", DEFAULT_ITERATIONS)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output_path = Path(os.environ.get("DATAGRID_BENCH_REPORT", str(DEFAULT_OUTPUT_PATH)))
    output_path.parent.mkdir(parents=True, exist_ok=True)

    scenarios: dict[str, list[ScenarioMetrics]] = {
        "pull-viewport": [],
        "edit-commit": [],
        "fill-commit": [],
        "history-status": [],
        "undo-redo-cycle": [],
        "histogram": [],
    }
    all_samples: list[float] = []

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for seed in seeds:
            seed_prefix = f"bench-{run_id}-{seed}"
            scenarios["pull-viewport"].append(
                await benchmark_pull_viewport(client, workspace_id=f"{seed_prefix}-pull", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )
            scenarios["edit-commit"].append(
                await benchmark_edit_commit(client, workspace_id=f"{seed_prefix}-edit", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )
            scenarios["fill-commit"].append(
                await benchmark_fill_commit(client, workspace_id=f"{seed_prefix}-fill", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )
            scenarios["history-status"].append(
                await benchmark_history_status(client, workspace_id=f"{seed_prefix}-status", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )
            scenarios["undo-redo-cycle"].append(
                await benchmark_undo_redo_cycle(client, workspace_id=f"{seed_prefix}-cycle", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )
            scenarios["histogram"].append(
                await benchmark_histogram(client, workspace_id=f"{seed_prefix}-hist", seed=seed, iterations=iterations, warmup_runs=warmup_runs)
            )

    report_scenarios: dict[str, Any] = {}
    for scenario_name, scenario_runs in scenarios.items():
        sample_sets = [run.samples_ms for run in scenario_runs]
        flattened_samples = [sample for samples in sample_sets for sample in samples]
        all_samples.extend(flattened_samples)
        merged_extra: dict[str, Any] = {"runs": [run.extra for run in scenario_runs]}
        report_scenarios[scenario_name] = {
            "samples": flattened_samples,
            "metrics": compute_stats(flattened_samples),
            **merged_extra,
        }

    report = {
        "benchmark": BENCHMARK_NAME,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "observationMode": True,
        "config": {
            "seeds": seeds,
            "warmupRuns": warmup_runs,
            "iterations": iterations,
        },
        "policy": {
            "requiredLocalRuns": 3,
            "requiredCiRuns": 3,
            "baselinePath": "docs/perf/affino-grid-backend-baseline.local.json",
            "note": "no hard drift thresholds until baseline captured",
        },
        "aggregate": {
            "metrics": compute_stats(all_samples),
            "sampleCount": len(all_samples),
        },
        "scenarios": report_scenarios,
        "budgetErrors": [],
        "ok": True,
    }

    output_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return {
        "report": report,
        "output_path": str(output_path),
    }


def main() -> None:
    result = asyncio.run(run_benchmark())
    report = result["report"]
    aggregate = report["aggregate"]["metrics"]
    print(f"Wrote backend benchmark report to {result['output_path']}")
    print(
        "Summary: "
        f"pull p95={report['scenarios']['pull-viewport']['metrics']['p95']:.2f} ms, "
        f"edit p95={report['scenarios']['edit-commit']['metrics']['p95']:.2f} ms, "
        f"history p95={report['scenarios']['history-status']['metrics']['p95']:.2f} ms, "
        f"overall mean={aggregate['mean']:.2f} ms",
    )


if __name__ == "__main__":
    main()
