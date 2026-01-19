# voice.md

Owner: voice

## Purpose

Define the minimum observability surface for production voice-to-voice (WebRTC primary, WebSocket fallback): what to measure, what dashboards to build, and what alerts are actionable.

## Key SLOs (starting point)

- **Turn latency (p95)**: < 3.0s from `final_transcript` → first audible TTS.
- **STT latency (p95)**: < 0.7s per streamed chunk (`voice_stt_duration_seconds`).
- **TTS latency (p95)**: < 0.6s per synthesis call (`voice_tts_duration_seconds`).
- **Transport stability**:
  - WebRTC session close rate due to `failed`/`inactivity_timeout`: near-zero during normal use.
  - WebSocket upgrade reject rate: near-zero (except deliberate load tests).

## Metrics (Prometheus)

### Core pipeline

- **STT**: `voice_stt_total`, `voice_stt_duration_seconds`
- **Assistant**: `voice_assistant_total`, `voice_assistant_duration_seconds`
- **TTS**: `voice_tts_total`, `voice_tts_duration_seconds`
- **Stream stage latency**: `voice_stream_latency_seconds{stage=...}`

### WebSocket fallback transport

- **Connections**: `voice_websocket_connections_current`
- **Upgrade**: `voice_websocket_upgrade_duration_seconds`, `voice_websocket_upgrade_rate_limit_hits_total{type=ip|user}`, `voice_websocket_connection_rejected_total{reason=...}`
- **Message handling**: `voice_websocket_message_latency_seconds{message_type=...}`
- **Backpressure + payload**: `voice_websocket_backpressure_events_total`, `voice_websocket_payload_too_large_total`, `voice_websocket_send_failures_total{reason=...}`
- **Keepalive**: `voice_websocket_ping_timeout_total`

### WebRTC primary transport

- **Sessions**: `voice_webrtc_sessions_current`, `voice_webrtc_sessions_created_total{surface=...}`, `voice_webrtc_sessions_closed_total{reason=...}`
- **Signaling**: `voice_webrtc_offer_duration_seconds`
- **RTP**: `voice_webrtc_rtp_packets_received_total`, `voice_webrtc_rtp_packets_sent_total`

## Dashboard panels (Grafana)

- **Voice overview**
  - `rate(voice_stt_total[5m])` + `rate(voice_tts_total[5m])` + `rate(voice_assistant_total[5m])` split by `status`
  - `histogram_quantile(0.95, sum by (le) (rate(voice_stt_duration_seconds_bucket[5m])))` (repeat for TTS + assistant)
- **WebRTC health**
  - `voice_webrtc_sessions_current`
  - `rate(voice_webrtc_sessions_closed_total[5m])` split by `reason`
  - `histogram_quantile(0.95, sum by (le) (rate(voice_webrtc_offer_duration_seconds_bucket[5m])))`
- **WebSocket health (fallback)**
  - `voice_websocket_connections_current`
  - `rate(voice_websocket_upgrade_rate_limit_hits_total[5m])` split by `type`
  - `rate(voice_websocket_connection_rejected_total[5m])` split by `reason`
  - `histogram_quantile(0.95, sum by (le, message_type) (rate(voice_websocket_message_latency_seconds_bucket[5m])))`

## Alerts (actionable)

- **STT degraded**
  - Trigger: `histogram_quantile(0.95, sum by (le) (rate(voice_stt_duration_seconds_bucket[10m]))) > 1.5`
  - Action: check GPU/CPU saturation, STT pool size, model load failures.
- **TTS degraded**
  - Trigger: `histogram_quantile(0.95, sum by (le) (rate(voice_tts_duration_seconds_bucket[10m]))) > 1.0`
  - Action: check TTS pool health, model availability, disk I/O.
- **WebRTC sessions failing**
  - Trigger: `rate(voice_webrtc_sessions_closed_total{reason=~"pc_state:failed|inactivity_timeout"}[10m]) > 0`
  - Action: TURN/ICE config, NAT issues, server resource exhaustion.
- **WebSocket overload**
  - Trigger: `rate(voice_websocket_connection_rejected_total[5m]) > 0`
  - Action: reduce connection churn, adjust limits, investigate runaway clients.

