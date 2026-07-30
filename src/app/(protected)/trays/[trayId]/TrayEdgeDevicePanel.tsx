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
  klipperUrl?: string | null;
  cameraServerUrl?: string | null;
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [linkDeviceId, setLinkDeviceId] = useState("");
  const [allDevices, setAllDevices] = useState<DeviceSummary[]>([]);
  const [klipperUrlDraft, setKlipperUrlDraft] = useState("");
  const [cameraServerUrlDraft, setCameraServerUrlDraft] = useState("");
  const [servoAngle, setServoAngle] = useState(45);
  const [ledRgb, setLedRgb] = useState({ r: 0, g: 255, b: 0 });
  const [lastPosition, setLastPosition] = useState<{
    hingeDeg: number;
    motorMm: number;
    source?: string;
    rawXy?: string;
  } | null>(null);

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
      setKlipperUrlDraft(linked?.klipperUrl?.trim() ?? "");
      setCameraServerUrlDraft(linked?.cameraServerUrl?.trim() ?? "");
      setSequences(posesJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load device panel");
    }
  }, [trayId, edgeDeviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pollLatestCaptureOnce(
    sinceMs: number
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/camera/latest?trayId=${encodeURIComponent(trayId)}`
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        data?: { imageUrl?: string | null; capturedAt?: string };
      };
      const url = json.data?.imageUrl;
      const at = json.data?.capturedAt
        ? Date.parse(json.data.capturedAt)
        : NaN;
      if (url && Number.isFinite(at) && at >= sinceMs - 2_000) {
        return url;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async function pollLatestCapture(sinceMs: number): Promise<string | null> {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1500));
      const url = await pollLatestCaptureOnce(sinceMs);
      if (url) return url;
    }
    return null;
  }

  function formatRawXy(result: Record<string, unknown>): string | undefined {
    const raw = result.raw;
    if (!raw || typeof raw !== "object") return undefined;
    const toolhead = (raw as { toolhead?: unknown }).toolhead;
    if (!toolhead || typeof toolhead !== "object") return undefined;
    const position = (toolhead as { position?: unknown }).position;
    if (!Array.isArray(position) || position.length < 2) return undefined;
    const x = Number(position[0]);
    const y = Number(position[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return `raw x=${x}, y=${y}`;
  }

  function readPoseFromResult(
    result: Record<string, unknown> | null | undefined
  ): {
    hingeDeg: number;
    motorMm: number;
    source?: string;
    rawXy?: string;
  } | null {
    if (!result) return null;
    const hingeDeg = Number(result.hingeDeg);
    const motorMm = Number(result.motorMm);
    if (!Number.isFinite(hingeDeg) || !Number.isFinite(motorMm)) return null;
    return {
      hingeDeg,
      motorMm,
      source:
        typeof result.source === "string" ? result.source : undefined,
      rawXy: formatRawXy(result)
    };
  }

  /** Poll a queued edge command until completed/failed or timeout. */
  async function pollQueuedCommand(input: {
    deviceId: string;
    commandId: string;
  }): Promise<{
    status: "completed" | "failed" | "timeout";
    result?: Record<string, unknown> | null;
    errorMessage?: string;
  }> {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1500));
      try {
        const cmdRes = await fetch(
          `/api/devices/${encodeURIComponent(input.deviceId)}?commandId=${encodeURIComponent(input.commandId)}`
        );
        if (!cmdRes.ok) continue;
        const cmdJson = (await cmdRes.json()) as {
          command?: {
            status?: string;
            errorMessage?: string | null;
            result?: Record<string, unknown> | null;
          };
        };
        const status = cmdJson.command?.status;
        if (status === "failed") {
          return {
            status: "failed",
            errorMessage:
              cmdJson.command?.errorMessage?.trim() ||
              "Pi agent command failed"
          };
        }
        if (status === "completed") {
          return {
            status: "completed",
            result: cmdJson.command?.result ?? null
          };
        }
      } catch {
        // keep polling
      }
    }
    return { status: "timeout" };
  }

  /** Poll queued capture; return image URL, agent failure text, or null if still waiting. */
  async function pollQueuedCapture(input: {
    deviceId: string;
    commandId: string;
    sinceMs: number;
  }): Promise<{
    imageUrl?: string;
    agentError?: string;
    pose?: { hingeDeg: number; motorMm: number; source?: string } | null;
  } | null> {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1500));
      try {
        const cmdRes = await fetch(
          `/api/devices/${encodeURIComponent(input.deviceId)}?commandId=${encodeURIComponent(input.commandId)}`
        );
        if (cmdRes.ok) {
          const cmdJson = (await cmdRes.json()) as {
            command?: {
              status?: string;
              errorMessage?: string | null;
              result?: Record<string, unknown> | null;
            };
          };
          const status = cmdJson.command?.status;
          const pose = readPoseFromResult(cmdJson.command?.result);
          if (status === "failed") {
            return {
              agentError:
                cmdJson.command?.errorMessage?.trim() ||
                "Pi agent failed to capture"
            };
          }
          if (status === "completed") {
            const url = await pollLatestCaptureOnce(input.sinceMs);
            if (url) return { imageUrl: url, pose };
            // ingest may lag a beat behind command completion
          }
        }
        const url = await pollLatestCaptureOnce(input.sinceMs);
        if (url) return { imageUrl: url };
      } catch {
        // keep polling
      }
    }
    return null;
  }

  async function takePicture() {
    if (!device) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    setPreviewUrl(null);
    const startedAt = Date.now();
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
            runPoses: false,
            hingeDeg: lastPosition?.hingeDeg,
            motorMm: lastPosition?.motorMm
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        queued?: boolean;
        reachabilityError?: string | null;
        error?: { message?: string };
        data?: {
          id?: string;
          imageUrl?: string;
          captureId?: string;
          plantId?: string | null;
          plantCreated?: boolean;
          hingeDeg?: number | null;
          motorMm?: number | null;
        };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Capture failed");
      }

      const resolvedPlantId = json.data?.plantId?.trim() || null;
      if (resolvedPlantId) {
        setPlantId(resolvedPlantId);
      }

      const directPose = readPoseFromResult(
        json.data as Record<string, unknown> | undefined
      );
      if (directPose) {
        setLastPosition(directPose);
      }

      if (json.data?.imageUrl && json.queued !== true) {
        setPreviewUrl(json.data.imageUrl);
        const plantNote = resolvedPlantId
          ? json.data.plantCreated
            ? " New plant added to this tray."
            : " Plant image updated."
          : "";
        const poseNote = directPose
          ? ` Pose saved: hinge ${directPose.hingeDeg}° · motor ${directPose.motorMm} mm.`
          : lastPosition
            ? ` Pose stamped: hinge ${lastPosition.hingeDeg}° · motor ${lastPosition.motorMm} mm.`
            : "";
        setMessage((json.message ?? "Picture captured") + plantNote + poseNote);
        await load();
        router.refresh();
        return;
      }

      const commandId = json.data?.id?.trim();
      setMessage(
        json.message ??
          `Capture queued (${commandId ?? "ok"}). Waiting for the Pi…`
      );
      if (commandId) {
        const polled = await pollQueuedCapture({
          deviceId: device.id,
          commandId,
          sinceMs: startedAt
        });
        if (polled?.pose) {
          setLastPosition(polled.pose);
        }
        if (polled?.imageUrl) {
          const pose = polled.pose;
          setPreviewUrl(polled.imageUrl);
          setMessage(
            pose
              ? `Picture arrived · hinge ${pose.hingeDeg}° · motor ${pose.motorMm} mm (saved to plant pose)`
              : "Picture arrived from the Pi agent"
          );
        } else if (polled?.agentError) {
          setError(
            `Pi agent capture failed: ${polled.agentError}` +
              (json.reachabilityError
                ? ` (server also could not reach Klipper: ${json.reachabilityError})`
                : "")
          );
          setMessage(null);
        } else {
          setMessage(
            (json.message ?? "Capture queued") +
              " Still waiting — the frame will show when the agent finishes."
          );
        }
      } else {
        const url = await pollLatestCapture(startedAt);
        if (url) {
          setPreviewUrl(url);
          setMessage("Picture arrived from the Pi agent");
        } else {
          setMessage(
            (json.message ?? "Capture queued") +
              " Still waiting — the frame will show when the agent finishes."
          );
        }
      }
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Capture failed");
    } finally {
      setBusy(false);
    }
  }

  async function getPosition() {
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
            action: "getPosition",
            trayId,
            plantId: plantId || undefined
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        error?: { message?: string };
        data?: { id?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Could not query position");
      }
      const commandId = json.data?.id?.trim();
      if (!commandId) {
        throw new Error("Position command was not queued");
      }
      setMessage("Reading hinge/motor from the Pi…");
      const polled = await pollQueuedCommand({
        deviceId: device.id,
        commandId
      });
      if (polled.status === "failed") {
        throw new Error(polled.errorMessage || "Position query failed");
      }
      if (polled.status === "timeout") {
        throw new Error(
          "Timed out waiting for the Pi agent. Check that it is online."
        );
      }
      const pose = readPoseFromResult(polled.result);
      if (!pose) {
        throw new Error("Agent returned no hinge/motor values");
      }
      setLastPosition(pose);

      let savedNote = "";
      if (plantId) {
        const saveRes = await fetch(
          `/api/trays/${encodeURIComponent(trayId)}/poses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              upsertPlantPose: true,
              plantId,
              hingeDeg: pose.hingeDeg,
              motorMm: pose.motorMm,
              deviceId: device.id
            })
          }
        );
        if (saveRes.ok) {
          savedNote = " Saved to selected plant pose.";
          await load();
        }
      }

      setMessage(
        `Hinge ${pose.hingeDeg}° · motor ${pose.motorMm} mm` +
          (pose.source ? ` (${pose.source})` : "") +
          (pose.rawXy ? ` · ${pose.rawXy}` : "") +
          savedNote
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Position query failed");
      setMessage(null);
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

  async function saveKlipperUrl() {
    if (!device) return;
    const next = klipperUrlDraft.trim();
    if (!next) {
      setError("Streamer URL is required (or clear the field)");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateKlipperUrl",
            klipperUrl: next
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        error?: { message?: string };
        data?: DeviceSummary;
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Could not update Klipper URL");
      }
      setMessage(json.message ?? "Klipper URL updated");
      if (json.data) {
        setDevice({
          ...device,
          ...json.data,
          klipperUrl:
            (json.data as { klipperUrl?: string | null }).klipperUrl ?? next
        });
        setKlipperUrlDraft(
          (json.data as { klipperUrl?: string | null }).klipperUrl?.trim() ??
            next
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveCameraServerUrl() {
    if (!device) return;
    const next = cameraServerUrlDraft.trim();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateCameraServerUrl",
            cameraServerUrl: next
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        error?: { message?: string };
        data?: DeviceSummary;
      };
      if (!res.ok) {
        throw new Error(
          json.error?.message ?? "Could not update Pi0 camera server URL"
        );
      }
      setMessage(json.message ?? "Pi0 camera server URL updated");
      const saved =
        (json.data as { cameraServerUrl?: string | null } | undefined)
          ?.cameraServerUrl ?? next;
      setDevice({
        ...device,
        ...(json.data ?? {}),
        cameraServerUrl: saved || null
      });
      setCameraServerUrlDraft(saved?.trim() ?? "");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function moveServo() {
    if (!device) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cameraServo",
            angle: servoAngle
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        queued?: boolean;
        error?: { message?: string };
        data?: { id?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Servo move failed");
      }
      if (json.queued && json.data?.id) {
        const polled = await pollQueuedCommand({
          deviceId: device.id,
          commandId: json.data.id
        });
        if (polled.status === "failed") {
          throw new Error(polled.errorMessage ?? "Servo move failed on Pi");
        }
        if (polled.status === "timeout") {
          setMessage(
            (json.message ?? "Servo queued") +
              " Waiting for the edge agent — keep the agent online."
          );
          return;
        }
        setMessage(
          `Servo moved to ${Number((polled.result as { angle?: number } | undefined)?.angle ?? servoAngle)}°`
        );
        return;
      }
      setMessage(json.message ?? `Servo at ${servoAngle}°`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Servo move failed");
    } finally {
      setBusy(false);
    }
  }

  async function setLed() {
    if (!device) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cameraLed",
            rgb: [ledRgb.r, ledRgb.g, ledRgb.b]
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        queued?: boolean;
        error?: { message?: string };
        data?: { id?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "LED update failed");
      }
      if (json.queued && json.data?.id) {
        const polled = await pollQueuedCommand({
          deviceId: device.id,
          commandId: json.data.id
        });
        if (polled.status === "failed") {
          throw new Error(polled.errorMessage ?? "LED update failed on Pi");
        }
        if (polled.status === "timeout") {
          setMessage(
            (json.message ?? "LED queued") +
              " Waiting for the edge agent — keep the agent online."
          );
          return;
        }
        setMessage("LED updated");
        return;
      }
      setMessage(json.message ?? "LED updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "LED update failed");
    } finally {
      setBusy(false);
    }
  }

  async function takePi0Photo() {
    if (!device) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreviewUrl(null);
    const sinceMs = Date.now();
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cameraPhoto",
            trayId,
            plantId: plantId || undefined,
            hingeDeg: lastPosition?.hingeDeg,
            motorMm: lastPosition?.motorMm
          })
        }
      );
      const json = (await res.json()) as {
        message?: string;
        queued?: boolean;
        error?: { message?: string };
        data?: {
          id?: string;
          imageUrl?: string;
          plantId?: string;
          plantCreated?: boolean;
        };
      };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Pi0 photo failed");
      }
      if (json.queued && json.data?.id) {
        const polled = await pollQueuedCommand({
          deviceId: device.id,
          commandId: json.data.id
        });
        if (polled.status === "failed") {
          throw new Error(polled.errorMessage ?? "Pi0 photo failed on agent");
        }
        if (polled.status === "timeout") {
          setMessage(
            (json.message ?? "Pi0 photo queued") +
              " Waiting for the edge agent…"
          );
          return;
        }
        const url =
          (typeof polled.result?.imageUrl === "string"
            ? polled.result.imageUrl
            : null) ?? (await pollLatestCapture(sinceMs));
        if (url) setPreviewUrl(url);
        setMessage("Pi0 photo captured");
        router.refresh();
        return;
      }
      if (json.data?.plantId) {
        setPlantId(json.data.plantId);
      }
      setMessage(
        json.message ??
          (json.data?.plantCreated
            ? "Pi0 photo saved; new plant created"
            : "Pi0 photo saved")
      );
      const url =
        json.data?.imageUrl ?? (await pollLatestCapture(sinceMs));
      if (url) setPreviewUrl(url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pi0 photo failed");
    } finally {
      setBusy(false);
    }
  }

  async function unregisterDevice() {
    if (!device) return;
    const label = device.hostname || device.model || device.cpuSerial;
    const ok = window.confirm(
      `Unregister “${label}”? This permanently removes the device from your account and unlinks it from this tray. The same Pi can register again afterward.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(device.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete" })
        }
      );
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Could not unregister device");
      }
      setDevice(null);
      setMessage("Device unregistered");
      router.refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unregister failed");
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
            No edge device is linked to this tray yet. Power on a Klipper Pi
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

      <div className="space-y-1 border-t border-ink/10 pt-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[16rem] flex-1 text-sm">
            <span className="text-ink/60">Streamer URL (optional)</span>
            <input
              type="url"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 font-mono text-xs"
              placeholder="http://192.168.1.x/webcam/?action=snapshot"
              value={klipperUrlDraft}
              onChange={(e) => setKlipperUrlDraft(e.target.value)}
              disabled={busy || Boolean(device.revokedAt)}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={
              busy ||
              Boolean(device.revokedAt) ||
              klipperUrlDraft.trim() === (device.klipperUrl?.trim() ?? "")
            }
            onClick={() => void saveKlipperUrl()}
          >
            Save URL
          </Button>
        </div>
        <p className="text-xs text-ink/45">
          Optional legacy HTTP still base (not used by Take Picture). Take
          Picture uses the Pi0 <span className="font-mono">camera_server.py</span>{" "}
          URL below. Get position still uses Moonraker on the bench Pi
          (localhost:7125).
        </p>
      </div>

      <div className="space-y-3 border-t border-ink/10 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Pi Zero camera server
          </h3>
          <p className="mt-0.5 text-xs text-ink/45">
            Optional LAN base for Pi0 <span className="font-mono">camera_server.py</span>{" "}
          (e.g. <span className="font-mono">http://192.168.1.154:5000</span>).
          Vision Console queues servo / LED / photo to the edge agent, which
          calls this URL on the LAN — agrihome.tech cannot reach it directly.
        </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[16rem] flex-1 text-sm">
            <span className="text-ink/60">Camera server URL</span>
            <input
              type="url"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 font-mono text-xs"
              placeholder="http://192.168.1.x:5000"
              value={cameraServerUrlDraft}
              onChange={(e) => setCameraServerUrlDraft(e.target.value)}
              disabled={busy || Boolean(device.revokedAt)}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={
              busy ||
              Boolean(device.revokedAt) ||
              cameraServerUrlDraft.trim() ===
                (device.cameraServerUrl?.trim() ?? "")
            }
            onClick={() => void saveCameraServerUrl()}
          >
            Save Pi0 URL
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[12rem] flex-1 text-sm">
            <span className="text-ink/60">Servo angle (0–90°)</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                className="w-full"
                value={servoAngle}
                onChange={(e) => setServoAngle(Number(e.target.value))}
                disabled={
                  busy ||
                  Boolean(device.revokedAt) ||
                  !device.cameraServerUrl?.trim()
                }
              />
              <span className="w-8 font-mono text-xs text-ink">{servoAngle}</span>
            </div>
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={
              busy ||
              Boolean(device.revokedAt) ||
              !device.cameraServerUrl?.trim()
            }
            onClick={() => void moveServo()}
          >
            Move servo
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {(["r", "g", "b"] as const).map((ch) => (
            <label key={ch} className="block w-20 text-sm">
              <span className="uppercase text-ink/60">{ch}</span>
              <input
                type="number"
                min={0}
                max={255}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 font-mono text-xs"
                value={ledRgb[ch]}
                onChange={(e) =>
                  setLedRgb((prev) => ({
                    ...prev,
                    [ch]: Math.min(
                      255,
                      Math.max(0, Number(e.target.value) || 0)
                    )
                  }))
                }
                disabled={
                  busy ||
                  Boolean(device.revokedAt) ||
                  !device.cameraServerUrl?.trim()
                }
              />
            </label>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={
              busy ||
              Boolean(device.revokedAt) ||
              !device.cameraServerUrl?.trim()
            }
            onClick={() => void setLed()}
          >
            Set LED
          </Button>
          <Button
            type="button"
            disabled={
              busy ||
              Boolean(device.revokedAt) ||
              !device.cameraServerUrl?.trim()
            }
            onClick={() => void takePi0Photo()}
          >
            Take Pi0 photo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-ink/10 pt-4">
        <label className="block min-w-[10rem] flex-1 text-sm">
          <span className="text-ink/60">Plant (optional)</span>
          <select
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5"
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
          >
            <option value="">Auto-create / attach plant</option>
            {plantId && !plants.some((p) => p.id === plantId) ? (
              <option value={plantId}>New plant (just captured)</option>
            ) : null}
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
          {busy ? "Working…" : "Take picture"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || Boolean(device.revokedAt) || device.status === "offline"}
          onClick={() => void getPosition()}
        >
          Get position
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void generatePoses()}
        >
          Generate poses from layout
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={busy}
          onClick={() => void unregisterDevice()}
        >
          Unregister device
        </Button>
      </div>

      {lastPosition && (
        <p className="text-sm text-ink/70">
          Current position: hinge{" "}
          <span className="font-mono text-ink">{lastPosition.hingeDeg}</span>° ·
          motor{" "}
          <span className="font-mono text-ink">{lastPosition.motorMm}</span> mm
          {lastPosition.source ? (
            <span className="text-ink/45"> ({lastPosition.source})</span>
          ) : null}
          {lastPosition.rawXy ? (
            <span className="text-ink/45"> · {lastPosition.rawXy}</span>
          ) : null}
          {plantId ? (
            <span className="text-ink/45">
              {" "}
              — associated with selected plant on capture / Get position
            </span>
          ) : null}
        </p>
      )}

      {device.status === "offline" && !device.revokedAt && (
        <p className="text-sm text-amber-800">
          Device looks offline (no recent heartbeat). Ensure the AgriHome agent
          is running on the Pi before taking a picture.
        </p>
      )}

      {activeSeq ? (
        <details className="rounded-md bg-ink/[0.03] p-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink hover:text-ink/80">
            Camera stops · {activeSeq.name} ({activeSeq.poses.length})
          </summary>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-ink/70">
            {activeSeq.poses.map((p) => (
              <li key={`${activeSeq.id}-${p.poseOrder}`}>
                Stop {p.poseOrder}: {p.slotLabel || "slot"} · hinge {p.hingeDeg}° ·
                motor {p.motorMm} mm
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-sm text-ink/50">
          No camera stops yet. Add plants, then generate a pose sequence from
          the plant layout.
        </p>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && (
        <p className="text-sm text-emerald-700">
          {message}
          {plantId ? (
            <>
              {" "}
              <a
                href={`/plants/${encodeURIComponent(plantId)}`}
                className="underline underline-offset-2 hover:text-emerald-900"
              >
                Open plant
              </a>
            </>
          ) : null}
        </p>
      )}
      {previewUrl && (
        <div className="border-t border-ink/10 pt-4">
          <p className="mb-2 text-sm text-ink/55">Latest capture</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Latest tray capture"
            className="max-h-56 w-auto max-w-full rounded-md object-contain"
          />
        </div>
      )}
    </Card>
  );
}
