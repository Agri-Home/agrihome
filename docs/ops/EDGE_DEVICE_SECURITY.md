# Edge device security (AGRI-109)

## Threat model (bench network)

- Rogue hardware joining AgriHome with a guessed provisioning code
- Stolen device API keys used to upload spam images or poll commands
- Replay of registration to mint unlimited trays

## Controls shipped

| Control | Implementation |
| --- | --- |
| Rotatable provisioning secret | `DEVICE_PROVISIONING_SECRET` — rotate in `.env` / secrets manager; old code stops working immediately |
| Open registration disabled by default | Register endpoint rejects when the secret is unset |
| Hashed device keys | SHA-256 of plaintext stored in `edge_devices.api_key_hash`; plaintext returned **once** at register / rotate |
| Revoke | `POST /api/devices/{id}` `{ "action": "revoke" }` clears usability and replaces the hash |
| Rotate key | `POST /api/devices/{id}` `{ "action": "rotateKey" }` — new plaintext shown once |
| Ingest rate limits | Per-device and per-IP (`DEVICE_INGEST_MAX_PER_*`) |
| Max upload size | `DEVICE_INGEST_MAX_BYTES` |
| Device identity ≠ Firebase user | Registration never creates a human account |

## Production checklist

1. Set a long random `DEVICE_PROVISIONING_SECRET` (32+ bytes).
2. Set `DEVICE_DEFAULT_OWNER_EMAIL` only for single-tenant benches; otherwise require `ownerEmail` on register.
3. Prefer TLS termination in front of AgriHome; Pi agents should use HTTPS.
4. Rotate provisioning secret when an operator leaves or a bench is decommissioned.
5. Revoke devices that leave the facility; re-provision with `reProvision: true` only when intentional.
6. Keep Moonraker API auth enabled on the Pi LAN; do not expose Moonraker to the public internet without auth.

## Re-provision flow

```http
POST /api/raspberry-pi/register
Content-Type: application/json

{
  "cpuSerial": "<same serial>",
  "provisioningCode": "<current secret>",
  "ownerEmail": "operator@example.com",
  "reProvision": true
}
```

Duplicate serial without `reProvision` returns **409**.
