"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import type {
  CameraCapture,
  MeshNetwork,
  MonitoringEvent,
  PredictionResult,
  TraySystem
} from "@/lib/types/domain";
import { clampPercent, formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

const AUTO_REFRESH_MS = Number(process.env.NEXT_PUBLIC_AUTO_REFRESH_MS ?? 15000);

interface DashboardTemplateProps {
  initialLatestImage: CameraCapture | null;
  initialLatestPrediction: PredictionResult | null;
  initialMonitoringLog: MonitoringEvent[];
  initialTrays: TraySystem[];
  initialMeshes: MeshNetwork[];
}

interface ApiResponse<T> {
  data: T;
  refreshedAt?: string;
}

const navItems = ["Overview", "Trays", "Mesh", "Hardware"];

const toneForSeverity = (severity?: PredictionResult["severity"]) => {
  if (severity === "high") return "critical" as const;
  if (severity === "medium") return "warning" as const;
  return "success" as const;
};

const toneForLevel = (level: MonitoringEvent["level"]) => {
  if (level === "critical") return "critical" as const;
  if (level === "warning") return "warning" as const;
  return "success" as const;
};

const toneForTrayStatus = (status: TraySystem["status"]) => {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
};

function MiniStat({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-gray-200 hover:shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        {value}
      </span>
      {detail ? <span className="mt-1 text-sm text-gray-500">{detail}</span> : null}
    </div>
  );
}

function EventRow({
  event,
  active,
  onSelect
}: {
  event: MonitoringEvent;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-gray-200 bg-gray-50 shadow-sm"
          : "border-transparent hover:border-gray-100 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={toneForLevel(event.level)}>{event.level}</Badge>
            <span className="text-sm font-semibold text-gray-900">
              {event.title}
            </span>
          </div>
          <p className="line-clamp-1 pr-4 text-sm text-gray-500">
            {event.message}
          </p>
        </div>
        <span className="mt-1 whitespace-nowrap text-xs font-medium text-gray-400">
          {formatRelativeTimestamp(event.createdAt)}
        </span>
      </div>
    </button>
  );
}

function TrayCard({
  tray,
  active,
  onSelect
}: {
  tray: TraySystem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-2xl border p-5 text-left transition-all ${
        active
          ? "border-emerald-200 bg-emerald-50/80 shadow-sm"
          : "border-gray-200/70 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold tracking-tight text-gray-900">
            {tray.name}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {tray.crop} · {tray.zone}
          </p>
        </div>
        <Badge tone={toneForTrayStatus(tray.status)}>{tray.status}</Badge>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Health
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {tray.healthScore}%
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Plants
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900">
            {tray.plantCount}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Camera
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-700">
            {tray.deviceId}
          </p>
        </div>
      </div>
    </button>
  );
}

function MeshCard({
  mesh,
  trays
}: {
  mesh: MeshNetwork;
  trays: TraySystem[];
}) {
  const trayNames = mesh.trayIds
    .map((trayId) => trays.find((tray) => tray.id === trayId)?.name ?? trayId)
    .join(", ");

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-900">{mesh.name}</p>
          <p className="mt-1 text-sm text-gray-500">{mesh.summary}</p>
        </div>
        <Badge tone={mesh.status === "active" ? "success" : "default"}>
          {mesh.status}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat
          label="Nodes"
          value={String(mesh.nodeCount)}
          detail="Connected trays"
        />
        <MiniStat
          label="Created"
          value={formatDateTime(mesh.createdAt)}
          detail="Mesh registration"
        />
      </div>
      <p className="mt-4 text-sm leading-6 text-gray-500">{trayNames}</p>
    </div>
  );
}

export function DashboardTemplate({
  initialLatestImage,
  initialLatestPrediction,
  initialMonitoringLog,
  initialTrays,
  initialMeshes
}: DashboardTemplateProps) {
  const [latestImage, setLatestImage] = useState(initialLatestImage);
  const [latestPrediction, setLatestPrediction] = useState(initialLatestPrediction);
  const [monitoringLog, setMonitoringLog] = useState(initialMonitoringLog);
  const [trays, setTrays] = useState(initialTrays);
  const [meshes, setMeshes] = useState(initialMeshes);
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(
    initialLatestImage?.trayId ?? initialTrays[0]?.id ?? null
  );
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialMonitoringLog[0]?.id ?? null
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    new Date().toISOString()
  );
  const [meshName, setMeshName] = useState("");
  const [meshDraftTrayIds, setMeshDraftTrayIds] = useState<string[]>(
    initialTrays[0]?.id ? [initialTrays[0].id] : []
  );
  const [meshFeedback, setMeshFeedback] = useState<string | null>(null);
  const [isCreatingMesh, setIsCreatingMesh] = useState(false);

  const selectedTray =
    trays.find((tray) => tray.id === selectedTrayId) ?? trays[0] ?? null;

  const refreshDashboard = async (targetTrayId = selectedTrayId) => {
    setIsRefreshing(true);

    try {
      const trayQuery = targetTrayId
        ? `?${new URLSearchParams({ trayId: targetTrayId }).toString()}`
        : "";
      const monitoringParams = new URLSearchParams({ limit: "8" });

      if (targetTrayId) {
        monitoringParams.set("trayId", targetTrayId);
      }

      const [imgRes, predRes, monRes, trayRes] = await Promise.all([
        fetch(`/api/camera/latest${trayQuery}`, { cache: "no-store" }),
        fetch(`/api/predictions/latest${trayQuery}`, { cache: "no-store" }),
        fetch(`/api/monitoring/log?${monitoringParams.toString()}`, {
          cache: "no-store"
        }),
        fetch("/api/trays", { cache: "no-store" })
      ]);

      const [imgJson, predJson, monJson, trayJson] = (await Promise.all([
        imgRes.json(),
        predRes.json(),
        monRes.json(),
        trayRes.json()
      ])) as [
        ApiResponse<CameraCapture | null>,
        ApiResponse<PredictionResult | null>,
        ApiResponse<MonitoringEvent[]>,
        ApiResponse<TraySystem[]>
      ];

      setLatestImage(imgJson.data);
      setLatestPrediction(predJson.data);
      setMonitoringLog(monJson.data);
      setTrays(trayJson.data);
      setLastUpdatedAt(
        imgJson.refreshedAt ??
          predJson.refreshedAt ??
          monJson.refreshedAt ??
          trayJson.refreshedAt ??
          new Date().toISOString()
      );
      setErrorMessage(null);
    } catch {
      setErrorMessage("System failed to re-sync. Displaying cached tray data.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateMesh = async () => {
    if (!meshName.trim() || meshDraftTrayIds.length < 2) {
      setMeshFeedback("Provide a mesh name and select at least two trays.");
      return;
    }

    setIsCreatingMesh(true);

    try {
      const response = await fetch("/api/mesh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: meshName.trim(),
          trayIds: meshDraftTrayIds
        })
      });

      const payload = (await response.json()) as ApiResponse<MeshNetwork> & {
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setMeshFeedback(payload.error ?? "Mesh creation failed.");
        return;
      }

      setMeshes((current) => [payload.data, ...current]);
      setMeshName("");
      setMeshFeedback("Mesh created and ready for future hardware routing.");
    } catch {
      setMeshFeedback("Mesh creation failed.");
    } finally {
      setIsCreatingMesh(false);
    }
  };

  useEffect(() => {
    if (!selectedTrayId) {
      return;
    }

    void refreshDashboard(selectedTrayId);
  }, [selectedTrayId]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const intervalId = window.setInterval(() => {
      void refreshDashboard();
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled, selectedTrayId]);

  useEffect(() => {
    setSelectedEventId((current) =>
      monitoringLog.some((event) => event.id === current)
        ? current
        : monitoringLog[0]?.id ?? null
    );
  }, [monitoringLog]);

  useEffect(() => {
    if (!selectedTrayId && trays[0]?.id) {
      setSelectedTrayId(trays[0].id);
    }
  }, [selectedTrayId, trays]);

  const summaryLog = monitoringLog.slice(0, 8);
  const selectedEvent =
    summaryLog.find((event) => event.id === selectedEventId) ?? summaryLog[0] ?? null;
  const captureAvailable = Boolean(latestImage?.imageUrl);

  return (
    <main className="min-h-screen bg-[#fafafa] p-4 font-sans sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
        <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                Multi-tray monitoring
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              AgriHome Vision
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              View one tray at a time, keep its health in focus, and connect
              trays into meshes for coordinated monitoring.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex gap-2">
              {navItems.map((item, idx) => (
                <button
                  key={item}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    idx === 1
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={captureAvailable ? "success" : "warning"}>
                {captureAvailable ? "camera online" : "placeholder mode"}
              </Badge>
              {selectedTray ? (
                <Badge tone={toneForTrayStatus(selectedTray.status)}>
                  {selectedTray.name}
                </Badge>
              ) : null}
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-4">
          {trays.map((tray) => (
            <TrayCard
              key={tray.id}
              tray={tray}
              active={tray.id === selectedTray?.id}
              onSelect={() => {
                startTransition(() => {
                  setSelectedTrayId(tray.id);
                  setMeshDraftTrayIds((current) =>
                    current.includes(tray.id) ? current : [tray.id, ...current]
                  );
                });
              }}
            />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card className="group flex flex-col overflow-hidden border border-gray-200/50 bg-white p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedTray?.name ?? "Selected tray"}
                  </h2>
                  <Badge tone={captureAvailable ? "success" : "warning"}>
                    {captureAvailable ? "Online" : "Holding"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAutoRefreshEnabled((current) => !current)}
                  >
                    {autoRefreshEnabled ? "Pause sync" : "Resume"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void refreshDashboard()}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Syncing..." : "Sync now"}
                  </Button>
                </div>
              </div>

              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-50">
                {captureAvailable ? (
                  <>
                    <Image
                      src={latestImage?.imageUrl as string}
                      alt={latestImage?.trayName ?? "Feed"}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                      priority
                      sizes="(max-width: 1280px) 100vw, 70vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                      <div className="text-white">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">
                          {latestImage?.deviceId ?? "DEV_01"}
                        </span>
                        <h3 className="mt-1 text-2xl font-bold tracking-tight">
                          {latestPrediction?.label ?? "Capturing..."}
                        </h3>
                        <p className="mt-1 text-sm text-white/70">
                          {latestImage?.trayName} · Captured{" "}
                          {latestImage?.capturedAt
                            ? formatRelativeTimestamp(latestImage.capturedAt)
                            : "recently"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-right backdrop-blur-md">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                          Score
                        </span>
                        <p className="text-2xl font-bold text-white">
                          {latestPrediction
                            ? clampPercent(latestPrediction.confidence)
                            : "0%"}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                      <svg
                        className="h-8 w-8 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-500">
                      No current frame for this tray
                    </span>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <MiniStat
                label="Tray"
                value={selectedTray?.crop ?? "N/A"}
                detail={selectedTray?.zone ?? "No zone selected"}
              />
              <MiniStat
                label="Plants"
                value={String(selectedTray?.plantCount ?? 0)}
                detail="Active plants in tray"
              />
              <MiniStat
                label="Health"
                value={`${selectedTray?.healthScore ?? 0}%`}
                detail="Tray health score"
              />
              <MiniStat
                label="Sync"
                value={lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "N/A"}
                detail="Latest dashboard pull"
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="flex h-full flex-col border border-gray-200/50 bg-white p-6 shadow-sm">
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Tray intelligence
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Health state for the selected tray only.
                  </p>
                </div>
                <Badge tone={toneForSeverity(latestPrediction?.severity)}>
                  {latestPrediction?.severity ?? "pending"}
                </Badge>
              </div>

              <div className="flex-1">
                <div className="mb-8">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Classification
                  </span>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                    {latestPrediction?.label ?? "Analyzing environment"}
                  </p>
                </div>

                <div className="mb-8">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Director output
                  </span>
                  <p className="mt-3 border-l-2 border-gray-100 pl-4 text-sm leading-relaxed text-gray-600">
                    {latestPrediction?.recommendation ??
                      "No operational guidance required at this moment. The intelligence engine is actively monitoring."}
                  </p>
                </div>

                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Nearest vectors
                  </span>
                  <div className="space-y-2">
                    {latestPrediction?.similarMatches?.length ? (
                      latestPrediction.similarMatches.slice(0, 3).map((match) => (
                        <div
                          key={match.id}
                          className="group flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
                        >
                          <span className="text-sm font-semibold text-gray-700">
                            {match.label}
                          </span>
                          <span className="rounded-md border border-gray-100 bg-white px-2 py-1 font-mono text-xs shadow-sm">
                            {clampPercent(match.score)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm italic text-gray-400">
                        No vector data established.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="border border-gray-200/50 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  System trace
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Events for {selectedTray?.name ?? "the selected tray"}.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
                {summaryLog.length} events
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-2">
                {summaryLog.length ? (
                  summaryLog.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      active={selectedEvent?.id === event.id}
                      onSelect={() => setSelectedEventId(event.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    Event history empty for this tray.
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-gray-50 p-6">
                {selectedEvent ? (
                  <>
                    <div>
                      <Badge tone={toneForLevel(selectedEvent.level)} className="mb-4">
                        {selectedEvent.level}
                      </Badge>
                      <h4 className="text-2xl font-bold tracking-tight text-gray-900">
                        {selectedEvent.title}
                      </h4>
                      <p className="mt-4 text-sm leading-relaxed text-gray-600">
                        {selectedEvent.message}
                      </p>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Recorded
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-gray-900">
                          {formatDateTime(selectedEvent.createdAt)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Tray
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-gray-900">
                          {selectedTray?.name ?? selectedEvent.trayId ?? "System"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-gray-400">
                    Select an event from the logs.
                  </div>
                )}
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="border border-gray-200/50 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Create mesh
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Group trays into a shared mesh for future routing, alerts, and
                  coordinated control logic.
                </p>
              </div>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Mesh name
                </span>
                <input
                  value={meshName}
                  onChange={(event) => setMeshName(event.target.value)}
                  placeholder="North rack supervision mesh"
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-300"
                />
              </label>

              <div className="mt-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tray nodes
                </span>
                <div className="mt-3 grid gap-2">
                  {trays.map((tray) => {
                    const selected = meshDraftTrayIds.includes(tray.id);

                    return (
                      <button
                        key={tray.id}
                        onClick={() =>
                          setMeshDraftTrayIds((current) =>
                            current.includes(tray.id)
                              ? current.filter((id) => id !== tray.id)
                              : [...current, tray.id]
                          )
                        }
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-gray-100 bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {tray.name}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {tray.zone} · {tray.crop}
                          </p>
                        </div>
                        <Badge tone={toneForTrayStatus(tray.status)}>
                          {tray.status}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {meshFeedback ? (
                <p className="mt-4 text-sm text-gray-500">{meshFeedback}</p>
              ) : null}

              <div className="mt-5">
                <Button onClick={() => void handleCreateMesh()} disabled={isCreatingMesh}>
                  {isCreatingMesh ? "Creating..." : "Create mesh"}
                </Button>
              </div>
            </Card>

            <Card className="border border-gray-200/50 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  Existing meshes
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Current mesh definitions across trays and systems.
                </p>
              </div>

              <div className="space-y-3">
                {meshes.length ? (
                  meshes.map((mesh) => (
                    <MeshCard key={mesh.id} mesh={mesh} trays={trays} />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    No meshes created yet.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
