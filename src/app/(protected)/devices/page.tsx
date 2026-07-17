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

export default async function DevicesPage() {
  const user = await requireSessionAccountUser();
  await markStaleDevicesOffline(env.device.heartbeatStaleMinutes);
  const devices = await listEdgeDevicesForOwner(user.email);

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
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Edge devices
        </h1>
        <p className="mt-1 text-sm text-ink/55">
          Raspberry Pi / Moonraker benches linked to your trays. Heartbeats older
          than {env.device.heartbeatStaleMinutes} minutes are shown as offline.
        </p>
      </div>

      {devices.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-ink/65">
            No devices yet. On the Pi, run the AgriHome Moonraker agent
            register-once script with{" "}
            <code className="rounded bg-ink/5 px-1">DEVICE_PROVISIONING_SECRET</code>
            . A tray is created automatically on first registration.
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
            return (
              <li key={d.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">
                        {d.hostname || d.model || d.cpuSerial}
                      </p>
                      <Badge tone={tone}>
                        {d.revokedAt ? "revoked" : d.status}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-ink/50">
                      {d.cpuSerial}
                    </p>
                    <p className="mt-1 text-sm text-ink/55">
                      Heartbeat{" "}
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
                        " · no tray linked"
                      )}
                    </p>
                  </div>
                  {tray && (
                    <Link
                      href={`/trays/${encodeURIComponent(tray.id)}`}
                      className="text-sm font-medium text-leaf hover:underline"
                    >
                      Open tray →
                    </Link>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
