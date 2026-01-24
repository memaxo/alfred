# webrtc-turn.md

Owner: infra

## Purpose

Document how to run TURN (coturn) for ALFRED voice WebRTC, including ports, TLS, and the exact `VOICE_ICE_SERVERS_JSON` shape expected by the API.

## Quick start (local, Docker Compose)

- Start TURN:

```bash
docker compose --profile turn up -d turn
```

- Configure the API:

```bash
VOICE_WEBRTC_PROTO=1
VOICE_ICE_SERVERS_JSON=[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:localhost:3478?transport=udp"],"username":"alfred","credential":"alfred"}]
```

## Required ports

TURN requires **one control port** plus a **UDP relay range**:

- **STUN/TURN (UDP/TCP)**: `3478`
- **TURN over TLS (TCP/UDP)**: `5349` (optional but recommended for production)
- **Relay ports (UDP)**: `49160-49200` (dev default in `docker/turn/turnserver.conf`)

If you deploy to a server behind a firewall/NAT, you must open the relay range in both the cloud firewall and the host firewall.

## Production notes

- **TLS**: configure coturn with `cert` / `pkey` and expose `turns:` URLs on 5349.
- **NAT**: set `external-ip` in the coturn config when behind NAT, otherwise candidates may be unusable.
- **Credentials**:
  - Dev uses static `user=alfred:alfred` in `docker/turn/turnserver.conf`.
  - Production should use strong credentials (or `use-auth-secret` + time-limited TURN REST credentials).

## Common failure modes

- **WebRTC works on LAN but not mobile network**: missing relay ports or no TURN configured.
- **ICE stuck in `checking`**: `external-ip` wrong/missing on NATed hosts.
- **Only TCP works**: UDP relay range not open.
