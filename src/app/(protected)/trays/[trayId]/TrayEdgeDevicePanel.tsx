"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";

type DeviceSummary = {
  id: string;
  cpuSerial: string;
  hostname: string | null;
  model: string | null;
  status: string;
  lastHeartbeatAt: string | null;
  apiKeyPrefix: string;
  revokedAt: string | null;
  actuatorLimits: {
    hingeMinDeg: number | null;
    hingeMaxDeg: number | null;
    motorMinMm: number | null;
    motorMaxMm: number | null;
  };
};

type PoseSequence = {
  id: string;
  name: string;
  active: boolean;
  poses: Array<{
    poseOrder: number;
    slotLabel: string;
    plantId: string | null;
    hingeDeg: number;
    motorMm: number;
    dwellMs: number;
  }>;
};

function statusLabel(status: string, revokedAt: string | null) {
  if (revokedAt) return "revoked";
  return status;
}

function statusColor(status: string, revokedAt: string | null) {
  if (revokedAt) return "text-red-700";
  if (status === "online") return "text-emerald-700";
  if (status === "error") return "text-amber-700";
  return "text-ink/50";
}

export function TrayEdgeDevicePanel({
  trayId,
  edgeDeviceId,
  plants
}: {
  trayId: string;
  edgeDeviceId?: string | null;
  plants: Array<{ id: string; name: string; slotLabel: string }>;
}) {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceSummary | null>(null);
  const [sequences, setSequences] = useState<PoseSequence[]>([]);
  const [plantId, setPlantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkDeviceId, setLinkDeviceId] = useState("");
  const [allDevices, setAllDevices] = useState<DeviceSummary[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [devicesRes, posesRes] = await Promise.all([
        fetch("/api/devices"),
        fetch(`/api/trays/${encodeURIComponent(trayId)}/poses`)
      ]);
      const devicesJson = (await devicesRes.json()) as {
        data?: DeviceSummary[];
        error?: { message?: string };
      };
      const posesJson = (await posesRes.json()) as { data?: PoseSequence[] };

      if (!devicesRes.ok) {
        throw new Error(devicesJson.error?.message ?? "Could not load devices");
      }

      const devices = devicesJson.data ?? [];
      setAllDevices(devices);
      const linked = edgeDeviceId
        ? devices.find((d) => d.id === edgeDeviceId) ?? null
        : null;
      setDevice(linked);
      setSequences(posesJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load device panel");
    }
  }, [trayId, edgeDeviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function takePicture() {
    if (!device) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "capture",
            trayId,
            plantId: plantId || undefined,
            runPoses: false
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        error?: { message?: string };
        data?: { id?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Capture failed");
      }
      setMessage(
        json.message ??
          `Capture queued (${json.data?.id ?? "ok"}). Wait for the Pi heartbeat.`
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePoses() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/trays/${encodeURIComponent(trayId)}/poses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generateFromLayout: true,
            deviceId: device?.id,
            name: "Generated from plant layout"
          })
        }
      );
      const json = (await res.json()) as {
        error?: { message?: string };
        data?: PoseSequence;
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Could not generate poses");
      }
      setMessage(
        `Generated ${json.data?.poses.length ?? 0} poses from plant layout`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function linkDevice() {
    if (!linkDeviceId.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(linkDeviceId.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "linkTray", trayId })
        }
      );
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Link failed");
      }
      setMessage("Device linked to this tray");
      router.refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusy(false);
    }
  }

  if (!device) {
    return (
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Raspberry Pi</h2>
          <p className="mt-1 text-sm text-ink/55">
            No edge device is linked to this tray yet. Power on a Moonraker Pi
            with the AgriHome agent, or link an existing device below.
          </p>
        </div>
        {allDevices.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[12rem] flex-1 text-sm">
              <span className="text-ink/60">Link device</span>
              <select
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5"
                value={linkDeviceId}
                onChange={(e) => setLinkDeviceId(e.target.value)}
              >
                <option value="">Select…</option>
                {allDevices
                  .filter((d) => !d.revokedAt)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.hostname || d.cpuSerial} ({d.status})
                    </option>
                  ))}
              </select>
            </label>
            <Button
              type="button"
              disabled={busy || !linkDeviceId}
              onClick={() => void linkDevice()}
            >
              Link to tray
            </Button>
          </div>
        ) : (
          <p className="text-sm text-ink/50">
            No devices registered yet. Run the Pi agent register-once script
            with your provisioning secret.
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </Card>
    );
  }

  const activeSeq = sequences.find((s) => s.active) ?? sequences[0];

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Raspberry Pi</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            {device.hostname || device.model || device.cpuSerial}
          </p>
        </div>
        <span
          className={`text-sm font-medium capitalize ${statusColor(device.status, device.revokedAt)}`}
        >
          {statusLabel(device.status, device.revokedAt)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink/45">Serial</dt>
          <dd className="font-mono text-ink">{device.cpuSerial}</dd>
        </div>
        <div>
          <dt className="text-ink/45">Last heartbeat</dt>
          <dd className="text-ink">
            {device.lastHeartbeatAt
              ? new Date(device.lastHeartbeatAt).toLocaleString()
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="text-ink/45">Key prefix</dt>
          <dd className="font-mono text-ink">{device.apiKeyPrefix}…</dd>
        </div>
        <div>
          <dt className="text-ink/45">Actuator limits</dt>
          <dd className="text-ink">
            hinge {device.actuatorLimits.hingeMinDeg ?? "—"}–
            {device.actuatorLimits.hingeMaxDeg ?? "—"}° · motor{" "}
            {device.actuatorLimits.motorMinMm ?? "—"}–
            {device.actuatorLimits.motorMaxMm ?? "—"} mm
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-4">
        <label className="block min-w-[10rem] flex-1 text-sm">
          <span className="text-ink/60">Plant (optional)</span>
          <select
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5"
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
          >
            <option value="">Whole tray / first plant</option>
            {plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.slotLabel || p.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          disabled={busy || Boolean(device.revokedAt) || device.status === "offline"}
          onClick={() => void takePicture()}
        >
          {busy ? "Queuing…" : "Take picture"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void generatePoses()}
        >
          Generate poses from layout
        </Button>
      </div>

      {device.status === "offline" && !device.revokedAt && (
        <p className="text-sm text-amber-800">
          Device looks offline (no recent heartbeat). Ensure the AgriHome agent
          is running on the Pi before taking a picture.
        </p>
      )}

      {activeSeq ? (
        <div className="rounded-md bg-ink/[0.03] p-3 text-sm">
          <p className="font-medium text-ink">
            Active poses · {activeSeq.name} ({activeSeq.poses.length})
          </p>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-ink/70">
            {activeSeq.poses.map((p) => (
              <li key={`${activeSeq.id}-${p.poseOrder}`}>
                #{p.poseOrder} {p.slotLabel || "slot"} · hinge {p.hingeDeg}° ·
                motor {p.motorMm} mm · dwell {p.dwellMs} ms
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink/50">
          No capture pose sequence yet. Add plants, then generate poses, or
          configure hinge/motor angles via the poses API.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </Card>
  );
}
