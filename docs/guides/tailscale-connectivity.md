# tailscale-connectivity

This guide explains how to use **Tailscale** as the remote connectivity layer between the ALFRED mobile app (`apps/native`) and a home ALFRED server (`apps/web`).

The goal is a **private**, **encrypted**, **identity-aware** connection without opening any router ports.

## Quick start

1. Install Tailscale on the server machine that runs ALFRED.

2. Install Tailscale on your phone.

3. Confirm both devices are signed into the same tailnet and online.

4. Run ALFRED and confirm health locally:

```bash
# dev (apps/web): defaults to port 3001
bun run dev:web
curl -sS http://localhost:3001/healthz

# production (common): port 3000
curl -sS http://127.0.0.1:3000/healthz
```

5. Publish ALFRED privately to the tailnet with Tailscale Serve + HTTPS:

```bash
# Publish the local ALFRED HTTP service as a tailnet HTTPS endpoint.
# Choose the correct local port for your deployment (3000 prod, 3001 dev).
tailscale serve https / http://127.0.0.1:3000

# Inspect current Serve config
tailscale serve status
```

6. From your phone (with Tailscale connected), open:

- `https://<your-device>.<your-tailnet>.ts.net/healthz`

You should see JSON with `"ok": true`.

7. In the ALFRED mobile app, go to **Settings → Server** and set:

- `https://<your-device>.<your-tailnet>.ts.net`

Then run the **Connectivity check** (it calls `GET /healthz`).

## Notes and troubleshooting

### Which endpoint should I use?

Prefer the tailnet HTTPS hostname:

- `https://<device>.<tailnet>.ts.net`

Avoid using raw `100.x` addresses for the primary configuration unless you have a specific reason; hostnames are more stable and readable.

### “Run check” fails

- Confirm Tailscale is connected on the phone.
- Confirm the server host is online in the Tailscale admin console.
- Confirm `tailscale serve status` shows the expected mapping.
- Confirm ALFRED is running and responding locally on the configured port.

### Recovery (safe reset)

If you misconfigure Serve, reset it and try again:

```bash
tailscale serve reset
tailscale serve status
```

## Security model (what Tailscale does and does not do)

- Tailscale provides a secure network path and identity-aware access control at the network layer.
- ALFRED still requires normal application authentication (Better Auth). Do not treat tailnet access as “logged in”.
