export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { BackLink } from "@/components/app/BackLink";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import {
  listEdgeDevicesForOwner,
  markStaleDevicesOffline
} from "@/lib/services/edge-device-service";
import { queryRows } from "@/lib/db/postgres";
import { formatRelativeTimestamp } from "@/lib/utils";

import { UnregisterDeviceButton } from "./UnregisterDeviceButton";

function statusLabel(status: string, revokedAt: string | null) {
  if (revokedAt) return "Removed";
  if (status === "online") return "Online";
  if (status === "error") return "Needs attention";
  return "Offline";
}

function isMissingKlipperColumn(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /klipper_url|moonraker_url/i.test(msg) && /does not exist|undefined column/i.test(msg);
}

export default async function DevicesPage() {
  const user = await requireSessionAccountUser();

  let devices: Awaited<ReturnType<typeof listEdgeDevicesForOwner>> = [];
  let loadError: string | null = null;
  let needsMigrate = false;

  try {
    await markStaleDevicesOffline(env.device.heartbeatStaleMinutes);
    devices = await listEdgeDevicesForOwner(user.email);
  } catch (error) {
    needsMigrate = isMissingKlipperColumn(error);
    loadError = needsMigrate
      ? "Device storage needs a quick update. On the server, run npm run db:migrate (migration 012_klipper_url), then refresh."
      : error instanceof Error
        ? error.message
        : "Could not load devices.";
  }

  const trayLinks =
    devices.length === 0
      ? []
      : await queryRows<{ edge_device_id: string; id: string; name: string }>(
          `SELECT edge_device_id, id, name FROM tray_systems
           WHERE owner_email = $1
             AND edge_device_id IN (${devices.map((_, i) => `$${i + 2}`).join(",")})`,
          [user.email.toLowerCase(), ...devices.map((d) => d.id)]
        );

  const trayByDevice = new Map(
    trayLinks.map((t) => [t.edge_device_id, { id: t.id, name: t.name }])
  );

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/dashboard">Dashboard</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Devices</h1>
        <p className="mt-1 text-sm text-ink/55">
          Raspberry Pi benches linked to your trays. A device goes offline if it
          has not checked in for {env.device.heartbeatStaleMinutes} minutes.
        </p>
      </div>

      {loadError ? (
        <Card className="space-y-2 p-6">
          <p className="text-sm font-medium text-rose-800">Could not load devices</p>
          <p className="text-sm text-ink/65">{loadError}</p>
          {needsMigrate ? (
            <p className="text-xs text-ink/45">
              This usually happens right after a Klipper update if the database
              migration has not been applied yet.
            </p>
          ) : null}
        </Card>
      ) : devices.length === 0 ? (
        <Card className="space-y-3 p-6">
          <p className="text-sm font-medium text-ink">No devices yet</p>
          <p className="text-sm text-ink/65">
            On your Pi, clone{" "}
            <span className="font-medium text-ink">Agri-Home/klipper</span> (includes
            the agrihome agent), then run register-once with your provisioning
            secret. A tray is created automatically on first registration.
          </p>
          <p className="text-xs text-ink/45">
            Setup guide: docs/ops/RASPBERRY_PI_KLIPPER.md
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {devices.map((d) => {
            const tray = trayByDevice.get(d.id);
            const tone = d.revokedAt
              ? ("critical" as const)
              : d.status === "online"
                ? ("success" as const)
                : d.status === "error"
                  ? ("warning" as const)
                  : ("default" as const);
            const title = d.hostname || d.model || "Raspberry Pi";
            return (
              <li key={d.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{title}</p>
                      <Badge tone={tone}>
                        {statusLabel(d.status, d.revokedAt)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink/55">
                      Last check-in{" "}
                      {d.lastHeartbeatAt
                        ? formatRelativeTimestamp(d.lastHeartbeatAt)
                        : "never"}
                      {tray ? (
                        <>
                          {" · "}
                          <Link
                            href={`/trays/${encodeURIComponent(tray.id)}`}
                            className="text-leaf underline-offset-2 hover:underline"
                          >
                            {tray.name}
                          </Link>
                        </>
                      ) : (
                        " · not linked to a tray"
                      )}
                    </p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-ink/40 hover:text-ink/55">
                        Technical details
                      </summary>
                      <p className="mt-1 break-all font-mono text-[11px] text-ink/45">
                        Serial {d.cpuSerial}
                        {d.klipperUrl ? ` · ${d.klipperUrl}` : ""}
                      </p>
                    </details>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {tray && (
                      <Link
                        href={`/trays/${encodeURIComponent(tray.id)}`}
                        className="text-sm font-medium text-leaf hover:underline"
                      >
                        Open tray →
                      </Link>
                    )}
                    <UnregisterDeviceButton
                      deviceId={d.id}
                      label={title}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
