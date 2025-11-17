# Runtime Observability Dashboard

This document provides Prometheus queries and Grafana dashboard configuration for monitoring ALFRED's workflow runtime.

## Dashboard Overview

The Runtime Dashboard provides visibility into:
- Workflow execution status and duration
- Phase-level performance metrics
- Context build caching effectiveness  
- AI SDK call performance
- Knowledge persistence operations

## Panel Layout

### Row 1: Workflow Health (4 panels)

**Panel 1.1: Workflow Execution Rate**
```promql
rate(runtime_executions_total{status="started"}[5m])
```
- **Type:** Graph
- **Unit:** executions/sec
- **Alert:** < 0.1 for 10 minutes (no workflows starting)

**Panel 1.2: Workflow Success Rate**
```promql
rate(runtime_executions_total{status="completed"}[5m]) /
rate(runtime_executions_total{status="started"}[5m]) * 100
```
- **Type:** Stat
- **Unit:** percent
- **Alert:** < 90% for 10 minutes

**Panel 1.3: Workflow Duration (p50/p95/p99)**
```promql
histogram_quantile(0.50, rate(runtime_execution_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(runtime_execution_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(runtime_execution_duration_seconds_bucket[5m]))
```
- **Type:** Graph
- **Unit:** seconds
- **Alert:** p99 > 1800s (30 min)

**Panel 1.4: Workflow Status Breakdown**
```promql
sum by (status) (rate(runtime_executions_total[5m]))
```
- **Type:** Pie Chart
- **Legend:** started, completed, failed, cancelled

### Row 2: Phase Performance (4 panels)

**Panel 2.1: Phase Duration by Type**
```promql
histogram_quantile(0.99, rate(runtime_phase_duration_seconds_bucket[5m]))
  by (phase)
```
- **Type:** Graph
- **Unit:** seconds
- **Legend:** scan, plan, act, report

**Panel 2.2: Phase Success Rate**
```promql
rate(runtime_phases_total{status="completed"}[5m]) /
rate(runtime_phases_total{status="started"}[5m]) * 100
  by (phase)
```
- **Type:** Bar Chart
- **Unit:** percent
- **Alert:** < 95% for any phase for 10 minutes

**Panel 2.3: Phase Execution Count**
```promql
sum by (phase, status) (rate(runtime_phases_total[5m]))
```
- **Type:** Stacked Graph
- **Unit:** phases/sec

**Panel 2.4: Slowest Phase**
```promql
max by (phase) (runtime_phase_duration_seconds)
```
- **Type:** Table
- **Unit:** seconds

### Row 3: Context & Caching (4 panels)

**Panel 3.1: Context Build Duration**
```promql
histogram_quantile(0.99, rate(runtime_context_build_duration_seconds_bucket[5m]))
  by (cached)
```
- **Type:** Graph
- **Unit:** seconds
- **Alert:** cached p99 > 0.1s OR uncached p99 > 10s

**Panel 3.2: Cache Hit Rate**
```promql
rate(runtime_context_cache_hits_total{result="hit"}[5m]) /
rate(runtime_context_cache_hits_total[5m]) * 100
```
- **Type:** Stat
- **Unit:** percent
- **Alert:** < 70% for 15 minutes

**Panel 3.3: Cache Operations**
```promql
sum by (result) (rate(runtime_context_cache_hits_total[5m]))
```
- **Type:** Bar Chart
- **Legend:** hit, miss

**Panel 3.4: Context Tokens**
```promql
sum by (type) (rate(runtime_context_tokens_total[5m]))
```
- **Type:** Graph
- **Unit:** tokens/sec
- **Legend:** total, requirement, tools, overhead, context

### Row 4: AI SDK Performance (4 panels)

**Panel 4.1: AI SDK Call Duration**
```promql
histogram_quantile(0.99, rate(runtime_ai_sdk_duration_seconds_bucket[5m]))
  by (model)
```
- **Type:** Graph
- **Unit:** seconds
- **Alert:** p99 > 300s (5 min)

**Panel 4.2: AI SDK Success Rate**
```promql
rate(runtime_ai_sdk_calls_total{status="completed"}[5m]) /
rate(runtime_ai_sdk_calls_total{status="started"}[5m]) * 100
```
- **Type:** Stat
- **Unit:** percent
- **Alert:** < 95% for 10 minutes

**Panel 4.3: AI Event Types**
```promql
sum by (event_type) (rate(runtime_ai_events_total[5m]))
```
- **Type:** Graph
- **Unit:** events/sec
- **Legend:** text-delta, tool-call, tool-result, etc.

**Panel 4.4: AI SDK Calls by Model**
```promql
sum by (model, status) (rate(runtime_ai_sdk_calls_total[5m]))
```
- **Type:** Stacked Bar Chart
- **Unit:** calls/sec

### Row 5: Knowledge Persistence (2 panels)

**Panel 5.1: Knowledge Batch Duration**
```promql
histogram_quantile(0.99, rate(runtime_knowledge_batch_duration_seconds_bucket[5m]))
```
- **Type:** Graph
- **Unit:** seconds
- **Alert:** p99 > 5s

**Panel 5.2: Knowledge Update Rate**
```promql
sum by (type, status) (rate(runtime_knowledge_updates_total[5m]))
```
- **Type:** Stacked Graph
- **Unit:** updates/sec
- **Legend:** fact, relation, insight (success/failed)

## Alert Rules

### Critical Alerts (PagerDuty)

**WorkflowExecutionFailureHigh**
```yaml
alert: WorkflowExecutionFailureHigh
expr: |
  (
    rate(runtime_executions_total{status="failed"}[5m]) /
    rate(runtime_executions_total{status="started"}[5m])
  ) > 0.10
for: 10m
labels:
  severity: critical
annotations:
  summary: "Workflow failure rate > 10% for 10 minutes"
  description: "{{ $value | humanizePercentage }} of workflows are failing"
```

**ContextBuildSlow**
```yaml
alert: ContextBuildSlow
expr: |
  histogram_quantile(0.99, rate(runtime_context_build_duration_seconds_bucket{cached="false"}[5m]))
    > 10
for: 15m
labels:
  severity: critical
annotations:
  summary: "Context build p99 > 10s for 15 minutes"
  description: "Context building is taking {{ $value | humanizeDuration }}"
```

### Warning Alerts (Slack)

**CacheHitRateLow**
```yaml
alert: CacheHitRateLow
expr: |
  (
    rate(runtime_context_cache_hits_total{result="hit"}[5m]) /
    rate(runtime_context_cache_hits_total[5m])
  ) < 0.70
for: 15m
labels:
  severity: warning
annotations:
  summary: "Context cache hit rate < 70% for 15 minutes"
  description: "Cache hit rate is {{ $value | humanizePercentage }}"
```

**PhaseTimeout**
```yaml
alert: PhaseTimeout
expr: |
  histogram_quantile(0.99, rate(runtime_phase_duration_seconds_bucket[5m]))
    by (phase) > 300
for: 10m
labels:
  severity: warning
annotations:
  summary: "Phase {{ $labels.phase }} p99 > 5 minutes"
  description: "Phase taking {{ $value | humanizeDuration }}"
```

**KnowledgePersistenceFailureHigh**
```yaml
alert: KnowledgePersistenceFailureHigh
expr: |
  rate(runtime_knowledge_updates_total{status="failed"}[5m]) > 10
for: 10m
labels:
  severity: warning
annotations:
  summary: "Knowledge persistence failing > 10/sec for 10 minutes"
  description: "{{ $value }} updates/sec are failing"
```

## Grafana Dashboard JSON

Create a new dashboard with the following settings:

- **Refresh:** 10s
- **Time Range:** Last 1 hour (default)
- **Timezone:** Browser
- **Tags:** runtime, workflows, performance

Import the panels above in the specified row layout.

## Prometheus Scrape Config

Ensure runtime metrics are scraped from the API server:

```yaml
scrape_configs:
  - job_name: 'alfred-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 15s
```

## Performance Budgets Reference

| Component | Budget | Metric |
|-----------|--------|--------|
| Context build (cached) | < 50ms | `runtime_context_build_duration_seconds{cached="true"}` p99 |
| Context build (uncached) | < 5s | `runtime_context_build_duration_seconds{cached="false"}` p99 |
| Phase execution | < 5 minutes | `runtime_phase_duration_seconds` p99 |
| Workflow execution | < 30 minutes | `runtime_execution_duration_seconds` p99 |
| Knowledge batch write | < 1s per 100 | `runtime_knowledge_batch_duration_seconds` p99 |
| AI SDK call | < 5 minutes | `runtime_ai_sdk_duration_seconds` p99 |

## Troubleshooting Runbook

### High Workflow Failure Rate

1. Check phase-specific failure rates: `runtime_phases_total{status="failed"}`
2. Examine error logs: `grep "runtime_execution_failed" logs/`
3. Identify failing phase: `runtime_phase_failed`
4. Review AI SDK errors: `runtime_ai_sdk_error`

### Low Cache Hit Rate

1. Check cache size: Context builder may be evicting too aggressively
2. Verify requirement variation: High requirement diversity lowers hits
3. Review TTL: 5-minute TTL may be too short for workflows
4. Check eviction logs: `grep "runtime_context_cache_eviction" logs/`

### Slow Context Builds

1. Check uncached p99: Should be < 5s
2. Verify token counts: `runtime_context_tokens_total`
3. Review requirement complexity: Large codebases slow builds
4. Check external services: Web context gathering may timeout

### AI SDK Call Failures

1. Check model availability: API may be down
2. Review rate limits: May need backoff
3. Verify API keys: May be expired
4. Check timeout settings: May be too aggressive

## Maintenance

- **Dashboard updates:** Modify queries when adding new metrics
- **Alert tuning:** Adjust thresholds based on production behavior
- **Performance baselines:** Update budgets when optimizations land
- **Metric retention:** Prometheus retains 15 days by default

