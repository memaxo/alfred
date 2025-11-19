# Observability Dashboard Configuration

**Status**: Phase 8 Complete ✅ (November 2025)

This document contains detailed dashboard configuration archived from `.ruler/20-observability-dashboards.md` after Phase 8 completion.

## Dashboard Structure

1. **System Health Dashboard**
   - Request rates (tRPC, HTTP)
   - Error rates by procedure/endpoint
   - Response times (p50, p95, p99)
   - Database connection pool usage
   - Memory/CPU usage

2. **Workflow Dashboard**
   - Workflow runs by status
   - Event persistence latency
   - Resume dispatch duration
   - Workflow completion rates
   - Error rates by workflow type

3. **AI Operations Dashboard**
   - Assistant stream events
   - Tool call counts
   - Escalation rates
   - Token usage (if available)
   - Stream duration by status

4. **Policy Dashboard**
   - Policy decisions by action
   - Obligation rates
   - Cache hit rates
   - Audit log volume

## Key Metrics

### Request Metrics
- `trpc_requests_total` - Total requests by procedure/type
- `trpc_request_errors_total` - Errors by procedure/type/code
- `trpc_request_duration_seconds` - Request duration histogram

### Workflow Metrics
- `workflow_stream_events_total` - Events by type
- `workflow_stream_duration_seconds` - Stream duration by status
- `run_registry_events_total` - Registry events by event/backend/outcome
- `run_registry_dispatch_duration_seconds` - Dispatch duration

### AI Metrics
- `assistant_stream_events_total` - Stream events by type
- `assistant_stream_duration_seconds` - Stream duration by status
- `assistant_tool_calls_total` - Tool calls by tool name
- `assistant_escalations_total` - Escalations by kind

### Policy Metrics
- `policy_decisions_total` - Decisions by action/decision
- `policy_obligations_total` - Obligations by action/obligation
- `pdp_cache_hits_total` - Cache hits/misses

## Alert Thresholds

- **Error rate:** >5% of requests (5-minute window)
- **Response time:** p99 >1s (5-minute window)
- **Workflow failures:** >10% failure rate (15-minute window)
- **Database connections:** >80% pool utilization
- **Memory usage:** >90% of available

## Dashboard Organization

1. **Top row:** System health (uptime, request rate, error rate)
2. **Second row:** Performance (response times, throughput)
3. **Third row:** Domain-specific (workflows, AI, policy)
4. **Bottom row:** Resource usage (CPU, memory, connections)

## PromQL Queries

### Error rate by procedure
```promql
rate(trpc_request_errors_total[5m]) / rate(trpc_requests_total[5m]) > 0.05
```

### p99 response time
```promql
histogram_quantile(0.99, rate(trpc_request_duration_seconds_bucket[5m])) > 1
```

### Workflow failure rate
```promql
rate(workflow_stream_events_total{event="error"}[15m]) / 
  rate(workflow_stream_events_total{event="run"}[15m]) > 0.10
```

### Database connection pool utilization
```promql
pg_pool_active_connections / pg_pool_max_connections > 0.8
```

### Memory usage percentage
```promql
process_resident_memory_bytes / node_memory_MemTotal_bytes > 0.9
```

## Implementation References

- Metrics registry: `packages/api/src/metrics.ts`
- Runtime metrics: `packages/runtime/src/metrics.ts`
- Grafana dashboard: See `docs/observability/runtime-dashboard.md`

