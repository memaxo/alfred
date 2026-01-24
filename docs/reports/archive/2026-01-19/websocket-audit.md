# WebSocket Usage Audit

**Date:** 2025-01-27  
**Scope:** Complete audit of WebSocket implementations across the ALFRED codebase

## Executive Summary

The codebase uses WebSockets in two primary contexts:

1. **Voice Streaming** - Native Bun WebSocket server for bidirectional audio streaming
2. **tRPC Subscriptions** - Observable-based streaming (not WebSocket, but included for completeness)

No critical security vulnerabilities found, but several areas need attention for production readiness.

---

## 1. Voice Streaming WebSocket (`packages/api/src/voice/streaming.ts`)

### Implementation Details

**Server:** Native Bun WebSocket via `Bun.serve`  
**Endpoint:** `ws://<host>:<VOICE_STREAMING_PORT|8788>/voice/stream`  
**Protocol:** Binary audio chunks + JSON control messages  
**Status:** Prototype (gated by `VOICE_STREAMING_PROTO=1`)

### Architecture

```typescript
Bun.serve<VoiceSocketData>({
  port: VOICE_STREAMING_PORT,
  fetch(req, server) {
    // Upgrade with auth + policy checks
    server.upgrade(req, { data: { userId, runtime, lastActivity } });
  },
  websocket: {
    open(ws) {
      /* Send ready */
    },
    message(ws, message) {
      /* Handle binary/JSON */
    },
    close(ws) {
      /* Cleanup session */
    },
  },
});
```

### Security Assessment

#### ✅ Strengths

1. **Authentication:** Upgrades require valid session cookie via `authorizeVoiceStreamRequest()`
2. **Policy Enforcement:** Evaluates both `voice.stt` and `voice.tts` policies before upgrade
3. **Audit Logging:** All policy decisions logged via `policyRepo.createAuditLog()`
4. **Session Isolation:** Each socket tied to `userId` from session

#### ⚠️ Concerns

1. **No Rate Limiting:** WebSocket upgrade lacks rate limiting (unlike tRPC procedures)
   - **Risk:** DoS via rapid connection attempts
   - **Recommendation:** Add connection rate limit per IP/userId

2. **Inactivity Timeout:** 30-second timeout enforced via cleanup interval
   - **Issue:** Cleanup runs every 10 seconds, so timeout can be 30-40 seconds
   - **Recommendation:** Use per-socket timeout instead of interval scan

3. **Error Handling:** Silent catch blocks in `send()` function

   ```typescript
   function send(ws: ServerWebSocket<VoiceSocketData>, payload: unknown) {
     try {
       ws.send(JSON.stringify(payload));
     } catch (_error) {} // ⚠️ Silent failure
   }
   ```

   - **Risk:** Errors swallowed, no visibility into send failures
   - **Recommendation:** Log errors with context (sessionId, event type)

4. **No Backpressure Handling:** Missing `drain` handler
   - **Risk:** Memory buildup if client can't keep up
   - **Recommendation:** Implement `drain` handler or check `ws.readyState` before send

5. **Binary Message Size:** No `maxPayloadLength` configured
   - **Risk:** Memory exhaustion from oversized audio chunks
   - **Recommendation:** Set `maxPayloadLength: 64 * 1024` (64KB) in websocket config

### Resource Management

#### ✅ Strengths

1. **Session Cleanup:** Removes sessions from registry on close
2. **Active Socket Tracking:** `activeSockets` Set for cleanup monitoring
3. **Cleanup Interval:** Periodic cleanup of inactive sockets

#### ⚠️ Concerns

1. **Memory Leak Risk:** `activeSockets` Set never cleared on normal close

   ```typescript
   close(ws) {
     activeSockets.delete(ws); // ✅ Good
   }
   ```

   - Actually handled correctly, but cleanup interval could miss rapid connect/disconnect

2. **No Connection Limits:** No max concurrent connections enforced
   - **Risk:** Resource exhaustion under load
   - **Recommendation:** Track connection count, reject after threshold

3. **Cleanup Timer:** Global interval never cleared if server stops without calling `stopVoiceStreamingPrototype()`
   - **Risk:** Timer leak if server restarts
   - **Recommendation:** Store timer reference, clear in `stopVoiceStreamingPrototype()`

### Error Handling

#### ⚠️ Issues

1. **Silent Send Failures:** `send()` catches all errors silently
2. **No Error Metrics:** Send failures not tracked in Prometheus
3. **Client Error Visibility:** Errors sent to client but not logged server-side consistently

### Performance

#### ✅ Strengths

1. **Binary Transport:** Audio sent as binary frames (not Base64 JSON)
2. **Native Bun Performance:** Uses Bun's high-performance WebSocket implementation

#### ⚠️ Concerns

1. **No Compression:** `perMessageDeflate` not enabled
   - **Impact:** Higher bandwidth for control messages
   - **Recommendation:** Enable for JSON messages (not binary audio)

2. **No Ping/Pong:** Keepalive not configured
   - **Risk:** Stale connections not detected quickly
   - **Recommendation:** Enable `sendPings: true` with 30s interval

---

## 2. Voice Socket Handler (`packages/voice/src/server/socket.ts`)

### Implementation

**Purpose:** Protocol handler for voice WebSocket messages  
**Pattern:** Pure message routing, delegates to hooks

### Security Assessment

#### ✅ Strengths

1. **Input Validation:** JSON parsing with error handling
2. **Session Validation:** Checks session exists before processing chunks
3. **Codec Validation:** Normalizes codec to supported values

#### ⚠️ Concerns

1. **Base64 Decoding:** Converts binary to Base64 then back to Buffer

   ```typescript
   audioBase64: Buffer.from(message as any).toString("base64");
   ```

   - **Issue:** Unnecessary conversion overhead
   - **Recommendation:** Process binary directly when possible

2. **No Message Size Limits:** Accepts arbitrary-sized audio chunks
   - **Risk:** Memory exhaustion
   - **Recommendation:** Validate chunk size before processing

3. **Error Propagation:** Errors sent to client but hooks may fail silently
   - **Recommendation:** Ensure hooks log errors appropriately

### Resource Management

#### ✅ Strengths

1. **Session Lifecycle:** Properly manages session creation/removal
2. **Transcript Clearing:** Clears transcript buffer after finalization

#### ⚠️ Concerns

1. **Session Removal Timing:** Removes session before TTS synthesis completes

   ```typescript
   // Line 371: Removes session
   this.sessionRegistry.removeSession(sessionId);
   // Line 383: But then uses session for TTS
   session.clearTranscript();
   ```

   - **Issue:** Comment indicates confusion about when to remove
   - **Status:** Actually works because session object still exists, but confusing

---

## 3. Voice Stream Client (`packages/voice/src/stream.ts`)

### Implementation

**Purpose:** Client-side WebSocket wrapper for voice streaming  
**Environments:** Browser, Node.js, React Native

### Security Assessment

#### ✅ Strengths

1. **Connection State Checks:** Validates `readyState` before send
2. **Error Handling:** Proper error propagation to handlers

#### ⚠️ Concerns

1. **No Reconnection Logic:** Client doesn't auto-reconnect on disconnect
   - **Impact:** User must manually reconnect
   - **Recommendation:** Add exponential backoff reconnection

2. **No Heartbeat:** Client doesn't send ping messages
   - **Risk:** Stale connections not detected
   - **Recommendation:** Send periodic ping if server supports it

3. **Binary Type:** Sets `binaryType = "arraybuffer"` but may fail silently

   ```typescript
   try {
     (ws as WebSocket).binaryType = "arraybuffer";
   } catch {
     // Ignore when not supported
   }
   ```

   - **Status:** Acceptable fallback, but no logging

### Resource Management

#### ✅ Strengths

1. **Cleanup:** Properly closes socket and clears timers
2. **Session Promise Management:** Cleans up pending promises on close

#### ⚠️ Concerns

1. **Memory Leak:** Event listeners not explicitly removed
   - **Status:** Browser/Node cleanup handles this, but explicit removal is safer

---

## 4. Test WebSocket Servers

### E2E Test Server (`apps/web/tests/voice-session.e2e.spec.ts`)

**Library:** `ws` (Node.js WebSocket)  
**Purpose:** Mock server for Playwright tests

#### ✅ Strengths

1. **Proper Cleanup:** Closes all connections and server on stop
2. **Authorization Mock:** Simple token-based auth for testing
3. **Fixture Integration:** Uses `@alfred/test-kit/voice/runtime-fixture`

#### ⚠️ Concerns

1. **No TLS:** Test server uses `ws://` not `wss://`
   - **Status:** Acceptable for local testing, but document requirement

---

## 5. tRPC Subscriptions (Not WebSocket)

**Note:** tRPC subscriptions use Server-Sent Events (SSE) or HTTP streaming, not WebSocket. Included for completeness.

### Implementation

**Routers:** `workflow.stream`, `codex.stream`, `voice.stream`, `droid.stream`  
**Pattern:** Observable-based streaming via tRPC

### Security Assessment

#### ✅ Strengths

1. **Rate Limiting:** Subscriptions use `rateLimit` middleware
2. **Authentication:** All subscriptions require `authedProcedure`
3. **Cleanup:** Proper unsubscribe handlers

#### ⚠️ Concerns

1. **No Connection Limits:** Multiple subscriptions per user allowed
   - **Risk:** Resource exhaustion
   - **Recommendation:** Track active subscriptions per user

---

## 6. Cross-Cutting Issues

### Metrics & Observability

#### ⚠️ Missing Metrics

1. **WebSocket Connection Count:** No gauge for active connections
2. **Send Failure Rate:** No counter for failed sends
3. **Message Latency:** No histogram for message processing time
4. **Binary Chunk Size:** No histogram for audio chunk sizes

**Recommendation:** Add metrics in `packages/api/src/metrics.ts`:

```typescript
export const voiceWebSocketConnections = new client.Gauge({
  name: "voice_websocket_connections_current",
  help: "Current active WebSocket connections",
  registers: [metricsRegistry],
});

export const voiceWebSocketSendFailures = new client.Counter({
  name: "voice_websocket_send_failures_total",
  help: "Total WebSocket send failures",
  labelNames: ["reason"],
  registers: [metricsRegistry],
});
```

### Error Handling Patterns

#### Inconsistent Error Handling

1. **Silent Failures:** `send()` function swallows errors
2. **Client Errors:** Some errors logged, others not
3. **Hook Errors:** Hook failures may not propagate properly

**Recommendation:** Standardize error handling:

- Always log errors with context
- Emit metrics for error rates
- Surface critical errors to monitoring

### Documentation

#### ⚠️ Missing Documentation

1. **Protocol Specification:** Message format documented but incomplete
2. **Error Codes:** No comprehensive error code reference
3. **Rate Limits:** No documented connection limits
4. **Reconnection Strategy:** No client reconnection guidance

---

## 7. Recommendations Priority

### Critical (Fix Before Production)

1. **Add Rate Limiting:** Implement connection rate limit per IP/userId
2. **Fix Silent Errors:** Log all send failures with context
3. **Add Connection Limits:** Enforce max concurrent connections
4. **Configure Payload Limits:** Set `maxPayloadLength` in websocket config

### High Priority

1. **Add Metrics:** WebSocket connection count, send failures, latency
2. **Implement Backpressure:** Add `drain` handler or check `readyState`
3. **Add Ping/Pong:** Enable keepalive with `sendPings: true`
4. **Fix Cleanup Timer:** Ensure timer cleared on server stop

### Medium Priority

1. **Add Reconnection Logic:** Client-side auto-reconnect with backoff
2. **Optimize Binary Handling:** Avoid Base64 conversion when possible
3. **Add Compression:** Enable `perMessageDeflate` for JSON messages
4. **Improve Documentation:** Protocol spec, error codes, limits

### Low Priority

1. **Explicit Event Listener Cleanup:** Remove listeners explicitly
2. **Session Removal Clarity:** Clarify session lifecycle comments
3. **Test TLS:** Document WSS requirement for production

---

## 8. Code Quality Issues

### Type Safety

#### ✅ Strengths

1. **Typed Socket Data:** `VoiceSocketData` interface for socket state
2. **Typed Events:** `VoiceStreamServerEvent` discriminated union

#### ⚠️ Concerns

1. **Runtime Type:** `runtime?: unknown` in socket data
   - **Status:** Acceptable for pass-through, but could be typed

### Test Coverage

#### ✅ Strengths

1. **Integration Tests:** `voice.streaming.integration.test.ts`
2. **E2E Tests:** `voice-session.e2e.spec.ts`
3. **Unit Tests:** `socket.test.ts` for handler logic

#### ⚠️ Concerns

1. **No Load Tests:** No tests for connection limits or backpressure
2. **No Error Path Tests:** Limited coverage of error scenarios

---

## 9. Compliance with Project Rules

### `.ruler/25-voice-architecture.md` Compliance

#### ✅ Compliant

1. **Binary Transport:** ✅ Audio sent as binary frames
2. **Registry Pattern:** ✅ Uses `VoiceRegistry` for session management
3. **Process Isolation:** ✅ Model inference in separate processes
4. **Native Codecs:** ✅ Uses `@discordjs/opus` for encoding

#### ⚠️ Partially Compliant

1. **Telemetry:** ✅ Reports packet loss, jitter, RTT
   - **Issue:** Telemetry only reported if client sends it
   - **Recommendation:** Server should track connection metrics

2. **Session Lifecycle:** ✅ 5-minute timeout mentioned in docs
   - **Issue:** Actually 30 seconds in code
   - **Recommendation:** Align timeout with documentation

### `.ruler/13-streaming-patterns.md` Compliance

#### ✅ Compliant

1. **Typed Events:** ✅ Uses canonical `VoiceStreamServerEvent` types
2. **Pure Handlers:** ✅ Handler delegates to hooks (side effects isolated)
3. **Error Isolation:** ✅ Errors sent to client, logged server-side

#### ⚠️ Partially Compliant

1. **AbortSignal Propagation:** ⚠️ Not applicable (no abort signal in WebSocket)
2. **Resource Scoping:** ✅ Thread/agent/resource identifiers present

---

## 10. Summary

### Overall Assessment: **Good Foundation, Needs Hardening**

**📋 TODO List:** See `docs/reports/websocket-audit-todos.md` for prioritized, actionable tasks to address all identified issues.

The WebSocket implementation is well-architected with proper separation of concerns, but needs production hardening:

- **Security:** Good authentication/policy, but missing rate limiting and connection limits
- **Reliability:** Proper cleanup, but silent error handling and no backpressure
- **Observability:** Missing key metrics for production monitoring
- **Performance:** Good binary transport, but missing compression and keepalive

### Next Steps

1. Implement critical recommendations (rate limiting, error logging, connection limits)
2. Add comprehensive metrics
3. Write load tests for connection limits and backpressure
4. Update documentation with protocol spec and error codes

---

## Appendix: File Inventory

### WebSocket Server Implementations

- `packages/api/src/voice/streaming.ts` - Main WebSocket server (Bun)
- `packages/voice/src/server/socket.ts` - Protocol handler
- `apps/web/tests/voice-session.e2e.spec.ts` - Test mock server (`ws`)

### WebSocket Client Implementations

- `packages/voice/src/stream.ts` - Voice stream client
- `apps/web/src/hooks/use-voice-capture.ts` - React hook wrapper

### Related Streaming (Not WebSocket)

- `packages/api/src/routers/workflow.ts` - tRPC subscription (SSE)
- `packages/api/src/routers/codex.ts` - tRPC subscription (SSE)
- `packages/api/src/routers/voice.ts` - tRPC subscription (SSE)
- `packages/api/src/routers/droids.ts` - tRPC subscription (SSE)

### Tests

- `packages/api/test/voice.streaming.integration.test.ts` - Integration tests
- `packages/api/test/voice.streaming.e2e.test.ts` - E2E tests
- `packages/voice/src/server/socket.test.ts` - Unit tests
- `apps/web/tests/voice-session.e2e.spec.ts` - Playwright E2E tests
