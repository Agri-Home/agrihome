# Load Balancer Configuration

| Field | Value |
|-------|-------|
| **Product** | AgriHome Vision Console |
| **Production domain** | [https://agrihome.tech](https://agrihome.tech) |
| **Current edge** | **Cloudflare Tunnel** (`cloudflared`) |
| **Origin** | `agrihome` container on TrueNAS (`:3000`) |
| **Alternative platforms** | NGINX, Traefik (multi-replica or no-Cloudflare LAN) |
| **Last updated** | June 2025 |

---

## Executive summary

AgriHome is served publicly at **`https://agrihome.tech`** through **Cloudflare Tunnel** (`cloudflared`). TLS terminates at the **Cloudflare edge**; the tunnel agent on TrueNAS forwards traffic to the local `agrihome` container over HTTP. There is **no inbound firewall rule** required for ports 80/443 on the NAS — the tunnel maintains an outbound connection to Cloudflare.

This document describes the current Cloudflare Tunnel architecture, required application configuration, operational constraints (upload size, CV timeouts), client IP handling, and future options if the deployment grows to multiple app replicas.

---

## Current production access pattern

```
Browser / PWA / camera device
         │
         ▼
┌─────────────────────┐
│  Cloudflare Edge    │  TLS (HTTPS), WAF, DNS for agrihome.tech
│  (global CDN)       │
└──────────┬──────────┘
           │ outbound tunnel (no public NAS ports required)
           ▼
┌─────────────────────┐
│  cloudflared        │  TrueNAS host or Dockge container
│  (tunnel agent)     │
└──────────┬──────────┘
           │ http://127.0.0.1:3000  or  http://agrihome:3000
           ▼
┌─────────────────────┐
│  agrihome           │  Next.js standalone
│  (Docker)           │
└─────────────────────┘

Internal only (Docker network):
  postgres:5432 · qdrant:6333 · plant-classifier:8765
```

| Property | Production value |
|----------|------------------|
| Public URL | `https://agrihome.tech` |
| TLS | Cloudflare-managed (edge termination) |
| Origin protocol | HTTP to localhost/Docker (tunnel → app) |
| Sticky sessions | Not required (Firebase session cookie) |
| WebSockets | Not used by application |
| Upload size | Up to ~8 MB in app; Cloudflare allows larger (see limits below) |
| Long requests | CV inference up to 60s — within Cloudflare proxy timeout |

---

## Why Cloudflare Tunnel fits AgriHome

| Benefit | Detail |
|---------|--------|
| No open inbound ports | TrueNAS stays off the public internet except outbound tunnel |
| Automatic HTTPS | Valid certificate for `agrihome.tech` at the edge |
| DDoS protection | Cloudflare network absorbs volumetric attacks |
| Simple homelab ops | No certbot, no NGINX TLS maintenance on the NAS |
| Same domain for API and UI | `NEXT_PUBLIC_API_BASE_URL=https://agrihome.tech` |

---

## Cloudflare Tunnel configuration

### DNS (Cloudflare dashboard)

| Record | Type | Target | Proxy |
|--------|------|--------|-------|
| `agrihome.tech` | CNAME | `<tunnel-id>.cfargotunnel.com` | Proxied (orange cloud) |
| `www` (optional) | CNAME | `agrihome.tech` | Proxied |

The tunnel UUID and hostname are created when you run `cloudflared tunnel create agrihome` in the Cloudflare Zero Trust dashboard.

### Example `config.yml`

**Host-installed cloudflared** (origin on Docker-published port):

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: agrihome.tech
    service: http://127.0.0.1:3000
    originRequest:
      # CV classify can take up to 60s; stay under Cloudflare's ~100s proxy limit
      connectTimeout: 30s
      noTLSVerify: false
  - hostname: www.agrihome.tech
    service: http://127.0.0.1:3000
  - service: http_status:404
```

**Docker network origin** (cloudflared on same Compose network as `agrihome`):

```yaml
ingress:
  - hostname: agrihome.tech
    service: http://agrihome:3000
  - service: http_status:404
```

### Example Dockge / Compose service

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  container_name: agrihome-cloudflared
  restart: unless-stopped
  command: tunnel --config /etc/cloudflared/config.yml run
  volumes:
    - /mnt/mainpool/apps/agrihome/cloudflared:/etc/cloudflared:ro
  networks:
    - agrihome_net
  # No ports published — tunnel is outbound-only
```

Store the tunnel credentials JSON and `config.yml` on the TrueNAS dataset (e.g. `/mnt/mainpool/apps/agrihome/cloudflared/`). **Do not commit credentials to git.**

### Install and run (host)

```bash
# One-time: authenticate and create tunnel (Cloudflare Zero Trust dashboard)
cloudflared tunnel login
cloudflared tunnel create agrihome
cloudflared tunnel route dns agrihome agrihome.tech

# Run as a service
cloudflared service install
systemctl enable --now cloudflared
```

---

## Application configuration for `agrihome.tech`

### Required environment variables

Update the `agrihome` service in Dockge (`agrihome-core` stack):

```yaml
environment:
  NEXT_PUBLIC_API_BASE_URL: https://agrihome.tech
  NEXT_PUBLIC_APP_NAME: AgriHome Vision Console
  # Firebase client vars unchanged — auth domain remains agri-home.firebaseapp.com
```

Rebuild or redeploy the app image if `NEXT_PUBLIC_*` values were baked in at build time without runtime override.

### Firebase console

| Setting | Value |
|---------|-------|
| Authorized domains | Add `agrihome.tech` |
| OAuth redirect URIs | Include `https://agrihome.tech` if using redirect flows |

Session cookies use `secure` in production — **HTTPS via Cloudflare satisfies this**.

---

## Cloudflare-specific limits and tuning

| Concern | Cloudflare default | AgriHome need | Action |
|---------|-------------------|---------------|--------|
| Proxy timeout | ~100 seconds | CV up to 60s | OK; avoid increasing CV timeout beyond ~90s without bypass |
| Upload body size | 100 MB (Free/Pro) | 8 MB max (`FEEDBACK_MAX_IMAGE_BYTES`) | OK |
| Cache | May cache static assets | API is `force-dynamic` | Do not cache `/api/*` — use Cache Rule: Bypass |
| WAF | Optional | Recommended for public app | Enable managed rules in Cloudflare dashboard |
| Bot fight mode | Optional | May affect camera ingest | Allowlist `/api/camera/ingest` if needed |

### Recommended Cloudflare cache rules

| Path pattern | Cache level |
|--------------|-------------|
| `/api/*` | Bypass |
| `/_next/static/*` | Standard (long TTL) |
| `/api/files/*` | Bypass (auth-required content) |

### Page Rules / Configuration Rules (optional)

- **Always Use HTTPS** — enabled (default with proxied DNS).
- **Minimum TLS Version** — TLS 1.2+.

---

## Health check contract

AgriHome exposes `GET /api/health` (no authentication).

| Check | Purpose |
|-------|---------|
| HTTP 200 | Process alive |
| Response body | JSON with `postgres`, `qdrant`, `cv` status |

### With Cloudflare Tunnel

| Layer | Health monitoring |
|-------|-------------------|
| **cloudflared** | Tunnel status in Cloudflare Zero Trust dashboard; local `cloudflared tunnel info` |
| **Origin** | Poll `http://127.0.0.1:3000/api/health` from TrueNAS (cron or Uptime Kuma) |
| **Public** | `curl -s https://agrihome.tech/api/health` through the tunnel |

**Drain policy:** Qdrant or CV degradation in the health body should **not** take the site offline — core CRUD works without them. Only drain when Postgres is unreachable or the app process is down.

Suggested external monitor:

- URL: `https://agrihome.tech/api/health`
- Interval: 60s
- Alert if: non-200 for 3 consecutive checks

---

## Client IP and rate limiting

AgriHome feedback ingest rate limits by IP (`FEEDBACK_INGEST_MAX_PER_IP_PER_MIN`). Behind Cloudflare, the socket IP seen by Node is the **tunnel or Cloudflare edge**, not the end user.

### Headers Cloudflare sends

| Header | Use |
|--------|-----|
| `CF-Connecting-IP` | **Preferred** — real client IP |
| `X-Forwarded-For` | Chain including client IP |
| `CF-Ray` | Request tracing in logs |

### Application configuration

Set in the `agrihome` service environment when traffic enters only through Cloudflare Tunnel:

```yaml
environment:
  TRUST_PROXY: "true"
```

| `TRUST_PROXY` | Client IP source | Use when |
|---------------|------------------|----------|
| `false` (default) | Socket IP (`request.ip`) | Local dev, direct `:3000` access |
| `true` | `CF-Connecting-IP` → `X-Forwarded-For` → socket fallback | Production via `https://agrihome.tech` |

Implementation: `src/lib/api/client-ip.ts` (`resolveClientIp`) used by `POST /api/feedback/ingest`.

> **Security:** Enable `TRUST_PROXY=true` only when **all** public traffic passes through Cloudflare Tunnel. If host port `:3000` is reachable on the public internet, clients can spoof `CF-Connecting-IP` or `X-Forwarded-For` and bypass per-IP rate limits. Bind the origin to `127.0.0.1:3000` or the Docker internal network only.

### Edge rate limiting (Cloudflare)

Optional WAF rate limit rule in the Cloudflare dashboard:

| Path | Suggested limit |
|------|-----------------|
| `/api/feedback/ingest` | 30 requests/minute per IP |
| `/api/auth/session` | 10 requests/minute per IP |

Complements in-app limits; does not replace them.

---

## Camera device ingest

`POST /api/camera/ingest` uses tray ID + device ID (no Firebase).

| Concern | Guidance |
|---------|----------|
| URL | `https://agrihome.tech/api/camera/ingest` |
| TLS | Terminated at Cloudflare; devices need standard CA trust |
| Timeout | 30s sufficient (no CV in this path) |
| Body size | Within 8–16 MB app limits |
| Bot protection | If Cloudflare blocks devices, create WAF skip rule for ingest path + device User-Agent |

---

## Port exposure hardening

With Cloudflare Tunnel, **public inbound ports on TrueNAS are optional**. Recommended production posture:

| Port | Service | Production exposure |
|------|---------|---------------------|
| — | HTTPS (443) | Handled by Cloudflare edge, not NAS |
| 3000 | agrihome | **Localhost or Docker network only** — tunnel origin |
| 5432 | Postgres | **Remove host mapping** — Docker internal only |
| 6333/6334 | Qdrant | Internal only |
| 8754 | plant-classifier | Internal only (debug) |

```yaml
# agrihome: bind to localhost only if tunnel runs on host
ports:
  - "127.0.0.1:3000:3000"

# postgres: remove public port entirely
# ports:
#   - "5432:5432"   # remove in production
```

---

## Failure scenarios

| Scenario | User impact | Recovery |
|----------|-------------|----------|
| `cloudflared` stopped | `agrihome.tech` unreachable | `docker restart agrihome-cloudflared` or `systemctl restart cloudflared` |
| `agrihome` container down | 502 / tunnel error | Docker restart; check logs |
| Cloudflare outage | Global unreachable | Rare; status.cloudflare.com |
| Origin slow (CV) | Timeout at ~100s | User sees error; tune CV or increase only with care |
| Tunnel credentials expired | Tunnel won't connect | Re-issue credentials in Zero Trust dashboard |
| Wrong `NEXT_PUBLIC_API_BASE_URL` | API calls to wrong host | Set to `https://agrihome.tech` and redeploy |

---

## Future: multi-replica behind Cloudflare

When scaling beyond one `agrihome` instance:

```
Clients ──► Cloudflare ──► cloudflared ──► local L7 balancer ──► agrihome × N
                                              (NGINX/HAProxy)
```

**Prerequisites:** shared storage, Redis rate limits, PgBouncer (see [Server Scalability](./01-server-scalability-and-backend-architecture.md)).

| Option | When to use |
|--------|-------------|
| **Single tunnel → NGINX upstream** | Multiple local replicas on TrueNAS |
| **Cloudflare Load Balancing** | Multiple origins / geographic failover (paid feature) |
| **Multiple tunnels** | Rare; prefer one tunnel + local balancer |

---

## Alternative: NGINX / Traefik (not current production)

If Cloudflare Tunnel is removed or used only for DNS (grey cloud), NGINX or Traefik on TrueNAS can terminate TLS with Let's Encrypt. See appendix in repository `deploy/nginx/` when added.

These remain valid for **LAN-only** access (`http://truenas:3000`) or **multi-replica** local load balancing but are **not** the current `agrihome.tech` production path.

---

## Implementation checklist

### Current production (Cloudflare Tunnel)

- [x] Custom domain `agrihome.tech` via Cloudflare DNS
- [x] `cloudflared` tunnel to origin `:3000`
- [ ] `NEXT_PUBLIC_API_BASE_URL=https://agrihome.tech` in compose env
- [ ] `agrihome.tech` in Firebase authorized domains
- [ ] Cache rule: bypass `/api/*`
- [ ] Bind `3000` to localhost or remove public host port
- [ ] Remove host mappings for `5432`, `6333`, `8754`
- [ ] `TRUST_PROXY=true` in production compose (see [Client IP and rate limiting](#client-ip-and-rate-limiting))
- [ ] External monitor on `https://agrihome.tech/api/health`
- [ ] Tunnel credentials backed up (encrypted, off git)

### Future — multi-replica

- [ ] Shared storage for `/data/agrihome`
- [ ] Redis for distributed rate limits
- [ ] PgBouncer
- [ ] Local NGINX `least_conn` upstream to N replicas
- [ ] Single tunnel → NGINX

---

## Related documents

- [DevOps and Infrastructure](./04-devops-and-infrastructure.md)
- [Server Scalability and Backend Architecture](./01-server-scalability-and-backend-architecture.md)
- [Storage Scalability and File Management](./06-storage-scalability-and-file-management.md)
- [Sprint Future Enhancement Stories](./07-sprint-future-enhancement-stories.md)
