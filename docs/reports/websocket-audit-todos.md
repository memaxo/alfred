# WebSocket Audit - TODO List

**Created:** 2025-01-27  
**Source:** `docs/reports/websocket-audit.md`  
**Status:** Pending Implementation

---

## Critical Priority

### 1. Add Rate Limiting to WebSocket Upgrades

**File:** `packages/api/src/voice/streaming.ts`  
**Issue:** WebSocket upgrades lack rate limiting, vulnerable to DoS via rapid connection attempts

**Tasks:**
- [ ] Create rate limiter for WebSocket upgrades (per IP and per userId)
- [ ] Integrate rate limiter in `authorizeVoiceStreamRequest()` or upgrade handler
- [ ] Return `429 Too Many Requests` when rate limit exceeded
- [ ] Add metric `voice_websocket_upgrade_rate_limit_hits_total`
- [ ] Test with rapid connection attempts

**Acceptance Criteria:**
- Rate limit enforced: max 10 connections per minute per IP
- Rate limit enforced: max 5 connections per minute per userId
- Proper error response with retry-after header
- Metrics emitted on rate limit hits

---

### 2. Fix Silent Error Handling in `send()` Function

**File:** `packages/voice/src/server/socket.ts` (line 91-95)  
**Issue:** `send()` function swallows all errors silently, no visibility into send failures

**Tasks:**
- [ ] Remove silent catch block in `send()` function
- [ ] Log errors with context (sessionId, event type, error message)
- [ ] Emit metric `voice_websocket_send_failures_total` with reason label
- [ ] Add error handling in all `send()` call sites
- [ ] Test error scenarios (closed socket, backpressure)

**Acceptance Criteria:**
- All send failures logged with structured context
- Metrics track send failure rate by reason
- Errors don't crash the server
- Client receives error notification when possible

---

### 3. Add Connection Limits

**File:** `packages/api/src/voice/streaming.ts`  
**Issue:** No max concurrent connections enforced, risk of resource exhaustion

**Tasks:**
- [ ] Add `MAX_CONCURRENT_CONNECTIONS` constant (default: 100)
- [ ] Track active connection count in `activeSockets` Set
- [ ] Reject upgrade if limit exceeded (return 503 Service Unavailable)
- [ ] Add metric `voice_websocket_connections_current` (gauge)
- [ ] Add metric `voice_websocket_connection_rejected_total` (counter)
- [ ] Test with connection limit exceeded

**Acceptance Criteria:**
- Max 100 concurrent connections enforced
- Proper error response when limit exceeded
- Metrics track current connections and rejections
- Connections cleaned up properly on close

---

### 4. Configure Payload Size Limits

**File:** `packages/api/src/voice/streaming.ts` (line 227)  
**Issue:** No `maxPayloadLength` configured, risk of memory exhaustion from oversized chunks

**Tasks:**
- [ ] Add `maxPayloadLength: 64 * 1024` (64KB) to websocket config
- [ ] Add `backpressureLimit: 1024 * 1024` (1MB) to websocket config
- [ ] Add `closeOnBackpressureLimit: false` (log instead of close)
- [ ] Add metric `voice_websocket_payload_too_large_total`
- [ ] Test with oversized payloads

**Acceptance Criteria:**
- Payloads > 64KB rejected with error
- Backpressure tracked and logged
- Metrics track oversized payload attempts
- Client receives clear error message

---

## High Priority

### 5. Add Comprehensive WebSocket Metrics

**File:** `packages/api/src/metrics.ts`  
**Issue:** Missing key metrics for production monitoring

**Tasks:**
- [ ] Add `voice_websocket_connections_current` (Gauge)
- [ ] Add `voice_websocket_send_failures_total` (Counter, label: reason)
- [ ] Add `voice_websocket_message_latency_seconds` (Histogram)
- [ ] Add `voice_websocket_binary_chunk_size_bytes` (Histogram)
- [ ] Add `voice_websocket_upgrade_duration_seconds` (Histogram)
- [ ] Instrument all send operations with latency tracking
- [ ] Instrument binary chunk processing with size tracking

**Acceptance Criteria:**
- All metrics registered in central registry
- Metrics exported via `/api/metrics` endpoint
- Dashboard-ready metrics with proper labels
- Zero-allocation metric collection (use labels efficiently)

---

### 6. Implement Backpressure Handling

**File:** `packages/api/src/voice/streaming.ts` and `packages/voice/src/server/socket.ts`  
**Issue:** No `drain` handler, risk of memory buildup if client can't keep up

**Tasks:**
- [ ] Add `drain` handler to websocket config
- [ ] Check `ws.readyState === WebSocket.OPEN` before all sends
- [ ] Add metric `voice_websocket_backpressure_events_total`
- [ ] Log backpressure events with sessionId
- [ ] Consider buffering strategy for backpressure (optional)

**Acceptance Criteria:**
- Drain handler logs backpressure events
- Sends check socket state before attempting
- Metrics track backpressure frequency
- No memory leaks from unbounded sends

---

### 7. Add Ping/Pong Keepalive

**File:** `packages/api/src/voice/streaming.ts` (line 227)  
**Issue:** No keepalive configured, stale connections not detected quickly

**Tasks:**
- [ ] Add `sendPings: true` to websocket config
- [ ] Configure ping interval (30 seconds)
- [ ] Add `pong` handler to track client responsiveness
- [ ] Add metric `voice_websocket_ping_timeout_total`
- [ ] Close connections that don't respond to pings

**Acceptance Criteria:**
- Server sends ping every 30 seconds
- Connections closed if no pong received within 60 seconds
- Metrics track ping timeouts
- Client receives pings and responds with pongs

---

### 8. Fix Cleanup Timer Leak

**File:** `packages/api/src/voice/streaming.ts` (line 254, 275)  
**Issue:** Cleanup timer never cleared if server stops without calling `stopVoiceStreamingPrototype()`

**Tasks:**
- [ ] Store cleanup timer reference in module scope
- [ ] Clear timer in `stopVoiceStreamingPrototype()` (already done, verify)
- [ ] Add process exit handler to cleanup on unexpected shutdown
- [ ] Test timer cleanup on server restart

**Acceptance Criteria:**
- Timer cleared on `stopVoiceStreamingPrototype()` call
- Timer cleared on process exit
- No timer leaks on server restart
- Tests verify cleanup

---

## Medium Priority

### 9. Add Client-Side Reconnection Logic

**File:** `packages/voice/src/stream.ts`  
**Issue:** Client doesn't auto-reconnect on disconnect, user must manually reconnect

**Tasks:**
- [ ] Add `reconnect` option to `VoiceStreamClientOptions`
- [ ] Implement exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
- [ ] Add `maxReconnectAttempts` option (default: 5)
- [ ] Emit reconnection events to handlers
- [ ] Preserve session state during reconnection
- [ ] Add metric `voice_websocket_client_reconnects_total`

**Acceptance Criteria:**
- Client auto-reconnects with exponential backoff
- Max 5 reconnection attempts before giving up
- Session state preserved across reconnection
- Clear error when reconnection fails

---

### 10. Optimize Binary Message Handling

**File:** `packages/voice/src/server/socket.ts` (line 132)  
**Issue:** Converts binary to Base64 then back to Buffer, unnecessary overhead

**Tasks:**
- [ ] Process binary messages directly without Base64 conversion
- [ ] Update `handleChunk()` to accept raw Buffer/Uint8Array
- [ ] Remove Base64 encoding step for binary audio chunks
- [ ] Keep Base64 only for JSON payloads with audio data
- [ ] Benchmark performance improvement

**Acceptance Criteria:**
- Binary chunks processed directly without Base64 conversion
- Reduced CPU overhead for audio processing
- Backward compatible with existing clients (if needed)
- Performance improvement measurable

---

### 11. Add Message Compression

**File:** `packages/api/src/voice/streaming.ts` (line 227)  
**Issue:** `perMessageDeflate` not enabled, higher bandwidth for control messages

**Tasks:**
- [ ] Add `perMessageDeflate: { compress: true, decompress: true }` to websocket config
- [ ] Test compression ratio for JSON messages
- [ ] Ensure binary audio chunks are NOT compressed (already compressed)
- [ ] Add metric `voice_websocket_compression_ratio` (optional)

**Acceptance Criteria:**
- JSON control messages compressed
- Binary audio chunks remain uncompressed
- Compression ratio > 50% for JSON messages
- No performance degradation

---

### 12. Improve Error Documentation

**File:** `docs/voice/streaming.md`  
**Issue:** No comprehensive error code reference, unclear error handling

**Tasks:**
- [ ] Document all error codes in protocol spec
- [ ] Add error code reference table
- [ ] Document retry strategies for each error type
- [ ] Add troubleshooting guide for common errors
- [ ] Update API reference with error responses

**Acceptance Criteria:**
- Complete error code reference
- Clear retry guidance for each error
- Troubleshooting guide for common issues
- Examples of error handling in client code

---

## Low Priority

### 13. Explicit Event Listener Cleanup

**File:** `packages/voice/src/stream.ts`  
**Issue:** Event listeners not explicitly removed (browser handles, but explicit is safer)

**Tasks:**
- [ ] Store event listener references
- [ ] Remove listeners explicitly in `close()` method
- [ ] Remove listeners on error
- [ ] Test listener cleanup

**Acceptance Criteria:**
- All event listeners removed explicitly
- No memory leaks from listeners
- Tests verify cleanup

---

### 14. Clarify Session Lifecycle Comments

**File:** `packages/voice/src/server/socket.ts` (line 370-382)  
**Issue:** Confusing comments about session removal timing

**Tasks:**
- [ ] Clarify when session is removed vs kept
- [ ] Document session lifecycle states
- [ ] Remove outdated comments
- [ ] Add clear state machine documentation

**Acceptance Criteria:**
- Clear documentation of session lifecycle
- No confusing comments
- State transitions documented

---

### 15. Add Load Tests

**File:** `tests/perf/websocket-load.test.ts` (new file)  
**Issue:** No tests for connection limits, backpressure, or high load scenarios

**Tasks:**
- [ ] Create load test suite for WebSocket server
- [ ] Test connection limit enforcement
- [ ] Test backpressure handling under load
- [ ] Test message throughput (messages/second)
- [ ] Test concurrent session handling
- [ ] Benchmark memory usage under load

**Acceptance Criteria:**
- Load tests cover connection limits
- Load tests verify backpressure handling
- Performance benchmarks documented
- Tests run in CI (optional, may be slow)

---

### 16. Document TLS/WSS Requirement

**File:** `docs/voice/streaming.md`  
**Issue:** No documentation about WSS requirement for production

**Tasks:**
- [ ] Document WSS requirement for production
- [ ] Add TLS configuration guide
- [ ] Document certificate requirements
- [ ] Add example nginx/Caddy reverse proxy config

**Acceptance Criteria:**
- Clear WSS requirement documented
- TLS setup guide available
- Example reverse proxy configs provided

---

## Implementation Notes

### Testing Strategy

For each TODO item:
1. Write unit tests for the change
2. Write integration tests if applicable
3. Update existing tests that break
4. Add E2E tests for critical paths

### Metrics Naming Convention

Follow existing patterns:
- Counters: `*_total` suffix
- Gauges: `*_current` or `*_active`
- Histograms: `*_duration_seconds` or `*_bytes`
- Labels: snake_case, lowercase

### Error Handling Pattern

```typescript
try {
  ws.send(payload);
} catch (error) {
  logger.error("voice_websocket_send_failed", {
    sessionId: ws.data.sessionId,
    eventType: payload.type,
    error: error instanceof Error ? error.message : String(error),
  });
  voiceWebSocketSendFailures.labels("send_error").inc();
  // Optionally send error to client
}
```

### Rate Limiting Pattern

Use existing rate limiter from `packages/api/src/middleware/rate-limit.ts` or create WebSocket-specific limiter:

```typescript
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = rateLimiter.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    rateLimiter.set(identifier, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  limit.count++;
  return true;
}
```

---

## Progress Tracking

**Last Updated:** 2025-01-27  
**Total TODOs:** 16  
**Completed:** 0  
**In Progress:** 0  
**Pending:** 16

### Completion Checklist

- [ ] Critical Priority (4 items)
- [ ] High Priority (4 items)
- [ ] Medium Priority (4 items)
- [ ] Low Priority (4 items)

---

## Related Files

- `docs/reports/websocket-audit.md` - Full audit report
- `packages/api/src/voice/streaming.ts` - Main WebSocket server
- `packages/voice/src/server/socket.ts` - Protocol handler
- `packages/voice/src/stream.ts` - Client implementation
- `packages/api/src/metrics.ts` - Metrics registry

