---
description: Profile and analyze performance — API response times, database queries, frontend bundle size, worker memory, and video stream health.
---

# Performance Command

This command invokes the **perf-profiler** agent for performance analysis.

## Usage

`/perf [subcommand]`

## Subcommands

### `smoke`
Run smoke performance tests using `scripts/perf-smoke-test.sh` and report results.

### `bundle`
Analyze frontend Vite build output — chunk sizes, code splitting effectiveness, large dependencies.

### `queries`
Scan backend service files for database query anti-patterns:
- N+1 queries (loops with individual queries)
- Missing pagination (unbounded results)
- Full table scans (missing WHERE/indexes)
- Unoptimized JOINs

### `streams`
Check video stream performance:
- go2rtc active stream count
- HLS segment generation health
- WebRTC connection rates
- MediaMTX path availability

### `full`
Run all profiling checks and generate comprehensive performance report.

## Related Agent

This command invokes the `perf-profiler` agent located at:
`.claude/agents/perf-profiler.md`

## Arguments

$ARGUMENTS can be: `smoke`, `bundle`, `queries`, `streams`, `full`
