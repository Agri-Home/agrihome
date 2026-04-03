"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { usePwa } from "@/components/providers/PwaProvider";
import type {
  CameraCapture,
  CaptureSchedule,
  MeshNetwork,
  MonitoringEvent,
  PlantReport,
  PlantUnit,
  PredictionResult,
  TraySystem
} from "@/lib/types/domain";
import { clampPercent, formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

const AUTO_REFRESH_MS = Number(process.env.NEXT_PUBLIC_AUTO_REFRESH_MS ?? 15000);

type AppTab = "overview" | "plants" | "schedule" | "mesh";

interface DashboardTemplateProps {
  activeTab: AppTab;
  initialLatestImage: CameraCapture | null;
  initialLatestPrediction: PredictionResult | null;
  initialMonitoringLog: MonitoringEvent[];
  initialTrays: TraySystem[];
  initialMeshes: MeshNetwork[];
  initialPlants: PlantUnit[];
  initialReports: PlantReport[];
  initialSchedules: CaptureSchedule[];
}

interface ApiResponse<T> {
  data: T;
  refreshedAt?: string;
}

const TABS: Array<{ id: AppTab; label: string; short: string; href: string }> = [
  { id: "overview", label: "Overview", short: "OV", href: "/" },
  { id: "plants", label: "Plants", short: "PL", href: "/plants" },
  { id: "schedule", label: "Schedule", short: "SC", href: "/schedule" },
  { id: "mesh", label: "Mesh", short: "MS", href: "/mesh" }
];

const toneForSeverity = (
  severity?: PredictionResult["severity"] | PlantReport["severity"]
) => {
  if (severity === "high") return "critical" as const;
  if (severity === "medium") return "warning" as const;
  return "success" as const;
};

const toneForLevel = (level: MonitoringEvent["level"]) => {
  if (level === "critical") return "critical" as const;
  if (level === "warning") return "warning" as const;
  return "success" as const;
};

const toneForStatus = (
  status: TraySystem["status"] | PlantUnit["status"] | MeshNetwork["status"]
) => {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
};

const monitoringValue = (level: MonitoringEvent["level"]) => {
  if (level === "critical") return 3;
  if (level === "warning") return 2;
  return 1;
};

function Panel({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[2rem] border border-white/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  detail
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-950">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[1.35rem] bg-slate-50 px-4 py-3 ring-1 ring-slate-200/70">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
        {value}
      </p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

function SidebarNavItem({
  active,
  label,
  short,
  href
}: {
  active: boolean;
  label: string;
  short: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[1.2rem] px-3 py-3 transition ${
        active
          ? "bg-slate-950 text-white"
          : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.14em] ${
          active ? "bg-white/14 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {short}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

function TrayRailItem({
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
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.35rem] px-4 py-3 text-left transition ${
        active
          ? "bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_100%)] text-white"
          : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{tray.name}</p>
          <p className={`mt-1 text-sm ${active ? "text-white/72" : "text-slate-500"}`}>
            {tray.crop} · {tray.zone}
          </p>
        </div>
        <Badge tone={toneForStatus(tray.status)}>{tray.status}</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className={active ? "text-white/72" : "text-slate-500"}>
          {tray.plantCount} plants
        </span>
        <span className="font-semibold">{tray.healthScore}%</span>
      </div>
    </button>
  );
}

function MobileTrayPill({
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
      type="button"
      onClick={onSelect}
      className={`min-w-[150px] rounded-full px-4 py-3 text-left transition ${
        active
          ? "bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] text-white"
          : "bg-white text-slate-700 ring-1 ring-slate-200/70"
      }`}
    >
      <p className="text-sm font-semibold">{tray.name}</p>
      <p className={`mt-1 text-xs ${active ? "text-white/72" : "text-slate-500"}`}>
        {tray.healthScore}% health
      </p>
    </button>
  );
}

function PlantSlot({
  plant,
  active,
  onSelect
}: {
  plant: PlantUnit;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`aspect-square rounded-[1.3rem] p-3 text-left transition ${
        active
          ? "bg-[linear-gradient(135deg,#0f766e_0%,#22d3ee_100%)] text-white"
          : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
      }`}
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
              active ? "text-white/70" : "text-slate-400"
            }`}
          >
            {plant.slotLabel}
          </p>
          <p className="mt-2 text-sm font-semibold">{plant.name}</p>
        </div>
        <div>
          <Badge tone={toneForStatus(plant.status)}>{plant.status}</Badge>
          <p className={`mt-2 text-xs ${active ? "text-white/82" : "text-slate-500"}`}>
            {plant.healthScore}% health
          </p>
        </div>
      </div>
    </button>
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
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.35rem] px-4 py-3 text-left transition ${
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={toneForLevel(event.level)}>{event.level}</Badge>
            <span className={`truncate text-sm font-semibold ${active ? "text-white" : ""}`}>
              {event.title}
            </span>
          </div>
          <p className={`mt-2 text-sm ${active ? "text-white/72" : "text-slate-500"}`}>
            {event.message}
          </p>
        </div>
        <span className={`shrink-0 text-xs ${active ? "text-white/60" : "text-slate-400"}`}>
          {formatRelativeTimestamp(event.createdAt)}
        </span>
      </div>
    </button>
  );
}

function ScheduleRow({
  schedule,
  active,
  onSelect
}: {
  schedule: CaptureSchedule;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[1.35rem] px-4 py-3 text-left transition ${
        active
          ? "bg-slate-950 text-white"
          : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{schedule.name}</p>
          <p className={`mt-1 text-sm ${active ? "text-white/72" : "text-slate-500"}`}>
            {schedule.scopeType} · {schedule.scopeId}
          </p>
        </div>
        <Badge tone={schedule.active ? "success" : "default"}>
          {schedule.active ? "active" : "paused"}
        </Badge>
      </div>
      <div className={`mt-3 text-sm ${active ? "text-white/72" : "text-slate-500"}`}>
        Every {schedule.intervalMinutes} min · {formatRelativeTimestamp(schedule.nextRunAt)}
      </div>
    </button>
  );
}

function MeshRow({
  mesh,
  trays,
  plants
}: {
  mesh: MeshNetwork;
  trays: TraySystem[];
  plants: PlantUnit[];
}) {
  const trayNames = mesh.trayIds
    .map((trayId) => trays.find((tray) => tray.id === trayId)?.name ?? trayId)
    .join(", ");
  const meshPlants = plants.filter((plant) => mesh.trayIds.includes(plant.trayId));
  const alertCount = meshPlants.filter((plant) => plant.status === "alert").length;

  return (
    <div className="rounded-[1.4rem] bg-slate-50 px-4 py-4 ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{mesh.name}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{mesh.summary}</p>
        </div>
        <Badge tone={toneForStatus(mesh.status)}>{mesh.status}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-500">
        <span>{mesh.nodeCount} trays</span>
        <span>·</span>
        <span>{alertCount} alerts</span>
        <span>·</span>
        <span>{trayNames}</span>
      </div>
    </div>
  );
}

function TrendChart({ events }: { events: MonitoringEvent[] }) {
  const reversed = events.slice().reverse();

  if (!reversed.length) {
    return (
      <div className="flex h-36 items-center justify-center rounded-[1.4rem] bg-slate-50 text-sm text-slate-400">
        No recent monitoring data.
      </div>
    );
  }

  const width = 320;
  const height = 132;
  const padding = 16;
  const stepX = reversed.length > 1 ? (width - padding * 2) / (reversed.length - 1) : 0;
  const points = reversed
    .map((event, index) => {
      const x = padding + index * stepX;
      const y =
        height - padding - ((monitoringValue(event.level) - 1) / 2) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_55%,#155e75_100%)] p-4 text-white">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <line x1="16" y1="116" x2="304" y2="116" stroke="rgba(255,255,255,0.15)" />
        <line x1="16" y1="66" x2="304" y2="66" stroke="rgba(255,255,255,0.1)" />
        <line x1="16" y1="16" x2="304" y2="16" stroke="rgba(255,255,255,0.08)" />
        <polyline
          fill="none"
          points={points}
          stroke="url(#trend-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {reversed.map((event, index) => {
          const x = padding + index * stepX;
          const y =
            height - padding - ((monitoringValue(event.level) - 1) / 2) * (height - padding * 2);

          return (
            <circle
              key={event.id}
              cx={x}
              cy={y}
              r="4.5"
              fill={
                event.level === "critical"
                  ? "#fb7185"
                  : event.level === "warning"
                    ? "#f59e0b"
                    : "#34d399"
              }
              stroke="white"
              strokeWidth="2"
            />
          );
        })}
        <defs>
          <linearGradient id="trend-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-white/70">
        <span>Info</span>
        <span>Warning</span>
        <span>Critical</span>
      </div>
    </div>
  );
}

function MonitoringSummary({
  events,
  reports,
  plants
}: {
  events: MonitoringEvent[];
  reports: PlantReport[];
  plants: PlantUnit[];
}) {
  const infoCount = events.filter((event) => event.level === "info").length;
  const warningCount = events.filter((event) => event.level === "warning").length;
  const criticalCount = events.filter((event) => event.level === "critical").length;
  const diseaseFlags = reports.reduce((total, report) => total + report.diseases.length, 0);
  const deficiencyFlags = reports.reduce(
    (total, report) => total + report.deficiencies.length,
    0
  );
  const averageHealth = plants.length
    ? Math.round(plants.reduce((total, plant) => total + plant.healthScore, 0) / plants.length)
    : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MetricTile label="Average health" value={`${averageHealth}%`} detail="Selected tray" />
      <MetricTile
        label="Critical events"
        value={String(criticalCount)}
        detail={`${warningCount} warning · ${infoCount} info`}
      />
      <MetricTile label="Disease flags" value={String(diseaseFlags)} detail="Active findings" />
      <MetricTile
        label="Deficiencies"
        value={String(deficiencyFlags)}
        detail="Nutrient concerns"
      />
    </div>
  );
}

export function DashboardTemplate({
  activeTab,
  initialLatestImage,
  initialLatestPrediction,
  initialMonitoringLog,
  initialTrays,
  initialMeshes,
  initialPlants,
  initialReports,
  initialSchedules
}: DashboardTemplateProps) {
  const { canInstall, install, isStandalone } = usePwa();

  const [latestImage, setLatestImage] = useState(initialLatestImage);
  const [latestPrediction, setLatestPrediction] = useState(initialLatestPrediction);
  const [monitoringLog, setMonitoringLog] = useState(initialMonitoringLog);
  const [trays, setTrays] = useState(initialTrays);
  const [meshes, setMeshes] = useState(initialMeshes);
  const [plants, setPlants] = useState(initialPlants);
  const [reports, setReports] = useState(initialReports);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selectedTrayId, setSelectedTrayId] = useState<string | null>(
    initialLatestImage?.trayId ?? initialTrays[0]?.id ?? null
  );
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(
    initialPlants[0]?.id ?? null
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialMonitoringLog[0]?.id ?? null
  );
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    new Date().toISOString()
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [meshName, setMeshName] = useState("");
  const [meshDraftTrayIds, setMeshDraftTrayIds] = useState<string[]>([]);
  const [meshFeedback, setMeshFeedback] = useState<string | null>(null);
  const [isCreatingMesh, setIsCreatingMesh] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [scheduleScopeType, setScheduleScopeType] =
    useState<CaptureSchedule["scopeType"]>("tray");
  const [scheduleScopeId, setScheduleScopeId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleInterval, setScheduleInterval] = useState("120");
  const [scheduleActive, setScheduleActive] = useState(true);
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const selectedTray =
    trays.find((tray) => tray.id === selectedTrayId) ?? trays[0] ?? null;
  const trayPlants = plants.filter((plant) => plant.trayId === selectedTrayId);
  const trayReports = reports.filter((report) => report.trayId === selectedTrayId);
  const selectedPlant =
    trayPlants.find((plant) => plant.id === selectedPlantId) ?? trayPlants[0] ?? null;
  const selectedReport =
    reports.find((report) => report.plantId === selectedPlant?.id) ??
    reports.find((report) => report.trayId === selectedTrayId) ??
    null;
  const summaryLog = monitoringLog.slice(0, 6);
  const selectedEvent =
    summaryLog.find((event) => event.id === selectedEventId) ?? summaryLog[0] ?? null;
  const captureAvailable = Boolean(latestImage?.imageUrl);
  const selectedTraySchedule =
    schedules.find(
      (schedule) =>
        schedule.scopeType === "tray" && schedule.scopeId === selectedTrayId
    ) ?? null;
  const plantGridColumns = Math.max(
    1,
    Math.min(4, ...trayPlants.map((plant) => plant.column))
  );
  const healthyPlants = trayPlants.filter((plant) => plant.status === "healthy").length;
  const watchPlants = trayPlants.filter((plant) => plant.status === "watch").length;
  const alertPlants = trayPlants.filter((plant) => plant.status === "alert").length;

  const refreshDashboard = async (targetTrayId = selectedTrayId) => {
    setIsRefreshing(true);

    try {
      const trayQuery = targetTrayId
        ? `?${new URLSearchParams({ trayId: targetTrayId }).toString()}`
        : "";
      const monitoringParams = new URLSearchParams({ limit: "8" });
      const reportParams = new URLSearchParams({ limit: "12" });

      if (targetTrayId) {
        monitoringParams.set("trayId", targetTrayId);
        reportParams.set("trayId", targetTrayId);
      }

      const [
        imgRes,
        predRes,
        monRes,
        trayRes,
        meshRes,
        plantRes,
        reportRes,
        scheduleRes
      ] = await Promise.all([
        fetch(`/api/camera/latest${trayQuery}`, { cache: "no-store" }),
        fetch(`/api/predictions/latest${trayQuery}`, { cache: "no-store" }),
        fetch(`/api/monitoring/log?${monitoringParams.toString()}`, { cache: "no-store" }),
        fetch("/api/trays", { cache: "no-store" }),
        fetch("/api/mesh", { cache: "no-store" }),
        fetch("/api/plants", { cache: "no-store" }),
        fetch(`/api/reports?${reportParams.toString()}`, { cache: "no-store" }),
        fetch("/api/schedules", { cache: "no-store" })
      ]);

      const [
        imgJson,
        predJson,
        monJson,
        trayJson,
        meshJson,
        plantJson,
        reportJson,
        scheduleJson
      ] = (await Promise.all([
        imgRes.json(),
        predRes.json(),
        monRes.json(),
        trayRes.json(),
        meshRes.json(),
        plantRes.json(),
        reportRes.json(),
        scheduleRes.json()
      ])) as [
        ApiResponse<CameraCapture | null>,
        ApiResponse<PredictionResult | null>,
        ApiResponse<MonitoringEvent[]>,
        ApiResponse<TraySystem[]>,
        ApiResponse<MeshNetwork[]>,
        ApiResponse<PlantUnit[]>,
        ApiResponse<PlantReport[]>,
        ApiResponse<CaptureSchedule[]>
      ];

      setLatestImage(imgJson.data);
      setLatestPrediction(predJson.data);
      setMonitoringLog(monJson.data);
      setTrays(trayJson.data);
      setMeshes(meshJson.data);
      setPlants(plantJson.data);
      setReports(reportJson.data);
      setSchedules(scheduleJson.data);
      setLastUpdatedAt(
        imgJson.refreshedAt ??
          predJson.refreshedAt ??
          monJson.refreshedAt ??
          trayJson.refreshedAt ??
          new Date().toISOString()
      );
      setErrorMessage(null);
    } catch {
      setErrorMessage("The app could not refresh. Cached tray data is still shown.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInstall = async () => {
    setIsInstalling(true);

    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  const saveSchedule = async () => {
    if (!scheduleScopeId || !scheduleName.trim()) {
      setScheduleFeedback("Select a target and provide a schedule name.");
      return;
    }

    setIsSavingSchedule(true);

    try {
      const response = await fetch("/api/schedules", {
        method: selectedScheduleId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: selectedScheduleId ?? undefined,
          scopeType: scheduleScopeType,
          scopeId: scheduleScopeId,
          name: scheduleName.trim(),
          intervalMinutes: Number(scheduleInterval),
          active: scheduleActive
        })
      });

      const payload = (await response.json()) as ApiResponse<CaptureSchedule> & {
        error?: string;
      };

      if (!response.ok || !payload.data) {
        setScheduleFeedback(payload.error ?? "Schedule save failed.");
        return;
      }

      setSchedules((current) => {
        const exists = current.some((item) => item.id === payload.data.id);
        return exists
          ? current.map((item) => (item.id === payload.data.id ? payload.data : item))
          : [payload.data, ...current];
      });
      setSelectedScheduleId(payload.data.id);
      setScheduleFeedback("Schedule saved.");
    } catch {
      setScheduleFeedback("Schedule save failed.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const createMesh = async () => {
    if (!meshName.trim() || meshDraftTrayIds.length < 2) {
      setMeshFeedback("Select at least two trays and provide a mesh name.");
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
      setMeshDraftTrayIds([]);
      setMeshFeedback("Mesh created.");
    } catch {
      setMeshFeedback("Mesh creation failed.");
    } finally {
      setIsCreatingMesh(false);
    }
  };

  useEffect(() => {
    if (!selectedTrayId) return;
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
    setSelectedPlantId((current) =>
      trayPlants.some((plant) => plant.id === current)
        ? current
        : trayPlants[0]?.id ?? null
    );
  }, [selectedTrayId, plants]);

  useEffect(() => {
    setSelectedEventId((current) =>
      monitoringLog.some((event) => event.id === current)
        ? current
        : monitoringLog[0]?.id ?? null
    );
  }, [monitoringLog]);

  useEffect(() => {
    const selectedSchedule = schedules.find((schedule) => schedule.id === selectedScheduleId);

    if (selectedSchedule) {
      setScheduleScopeType(selectedSchedule.scopeType);
      setScheduleScopeId(selectedSchedule.scopeId);
      setScheduleName(selectedSchedule.name);
      setScheduleInterval(String(selectedSchedule.intervalMinutes));
      setScheduleActive(selectedSchedule.active);
      return;
    }

    setScheduleScopeType("tray");
    setScheduleScopeId(selectedTrayId ?? "");
    setScheduleName(selectedTray ? `${selectedTray.name} scheduled scan` : "");
    setScheduleInterval("120");
    setScheduleActive(true);
  }, [selectedScheduleId, selectedTrayId, selectedTray, schedules]);

  useEffect(() => {
    if (selectedScheduleId) {
      return;
    }

    if (scheduleScopeType === "tray") {
      setScheduleScopeId(selectedTrayId ?? trays[0]?.id ?? "");
      setScheduleName(selectedTray ? `${selectedTray.name} scheduled scan` : "");
      return;
    }

    setScheduleScopeId(meshes[0]?.id ?? "");
    setScheduleName(meshes[0] ? `${meshes[0].name} coordinated scan` : "");
  }, [scheduleScopeType, selectedScheduleId, selectedTrayId, selectedTray, trays, meshes]);

  return (
    <main className="h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_24%),linear-gradient(180deg,#f7fbfa_0%,#eef6fb_45%,#f6f7ff_100%)] lg:min-h-[100svh] lg:h-auto lg:overflow-visible lg:px-6 lg:py-6">
      <div className="mx-auto h-full max-w-[1480px] lg:grid lg:min-h-[calc(100svh-3rem)] lg:h-auto lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden lg:block">
          <div className="flex h-[calc(100svh-3rem)] flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/78 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.07)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-600">
              AgriHome Vision
            </p>
            <h1 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950">
              Clean ops
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              A lighter monitoring workspace for trays, plants, schedules, and mesh groups.
            </p>

            <div className="mt-6 rounded-[1.6rem] bg-slate-100/80 p-2">
              <div className="space-y-2">
                {TABS.map((tab) => (
                  <SidebarNavItem
                    key={tab.id}
                    active={activeTab === tab.id}
                    label={tab.label}
                    short={tab.short}
                    href={tab.href}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone={captureAvailable ? "success" : "warning"}>
                {captureAvailable ? "camera online" : "image pending"}
              </Badge>
              <Badge tone={autoRefreshEnabled ? "success" : "default"}>
                {autoRefreshEnabled ? "auto-refresh" : "manual"}
              </Badge>
              <Badge tone={isStandalone ? "success" : "default"}>
                {isStandalone ? "installed" : "browser"}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button onClick={() => void refreshDashboard()} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
              {canInstall ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleInstall()}
                  disabled={isInstalling}
                >
                  {isInstalling ? "Installing..." : "Install"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setAutoRefreshEnabled((current) => !current)}
                >
                  {autoRefreshEnabled ? "Pause sync" : "Resume sync"}
                </Button>
              )}
            </div>

            <div className="mt-6 min-h-0 flex-1">
              <SectionHeader
                eyebrow="Workspace"
                title="Tray switcher"
                detail="Monitor one system at a time."
              />
              <div className="mt-4 flex max-h-full flex-col gap-3 overflow-y-auto pr-1">
                {trays.map((tray) => (
                  <TrayRailItem
                    key={tray.id}
                    tray={tray}
                    active={tray.id === selectedTray?.id}
                    onSelect={() => setSelectedTrayId(tray.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="mx-auto flex h-full max-w-[460px] flex-col overflow-hidden bg-white/78 backdrop-blur-xl lg:max-w-none lg:min-h-[calc(100svh-3rem)] lg:h-auto lg:rounded-[2.4rem] lg:border lg:border-white/80 lg:shadow-[0_26px_80px_rgba(15,23,42,0.08)]">
          <header className="safe-top shrink-0 border-b border-slate-200/70 bg-white/72 px-4 pb-4 pt-4 backdrop-blur-xl lg:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-600 lg:hidden">
                  AgriHome Vision
                </p>
                <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em] text-slate-950 lg:text-[2.2rem]">
                  {activeTab === "overview"
                    ? "Overview"
                    : activeTab === "plants"
                      ? "Plants"
                      : activeTab === "schedule"
                        ? "Schedule"
                        : "Mesh"}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedTray
                    ? `${selectedTray.name} · ${selectedTray.crop} · ${selectedTray.zone}`
                    : "Choose a tray to begin."}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="ghost"
                  className="rounded-full px-4 py-2.5"
                  onClick={() => void refreshDashboard()}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full px-4 py-2.5 lg:hidden"
                  onClick={() => setAutoRefreshEnabled((current) => !current)}
                >
                  {autoRefreshEnabled ? "Pause sync" : "Resume sync"}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={toneForStatus(selectedTray?.status ?? "healthy")}>
                {selectedTray?.status ?? "healthy"}
              </Badge>
              <Badge tone={captureAvailable ? "success" : "warning"}>
                {captureAvailable ? "capture ready" : "awaiting image"}
              </Badge>
              <Badge tone={autoRefreshEnabled ? "success" : "default"}>
                {autoRefreshEnabled ? "auto-refresh" : "manual"}
              </Badge>
            </div>

            <div className="hide-scrollbar mt-4 overflow-x-auto pb-1 lg:hidden">
              <div className="flex gap-3">
                {trays.map((tray) => (
                  <MobileTrayPill
                    key={tray.id}
                    tray={tray}
                    active={tray.id === selectedTray?.id}
                    onSelect={() => setSelectedTrayId(tray.id)}
                  />
                ))}
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 lg:px-6 lg:pb-8">
            {errorMessage ? (
              <div className="mb-4 rounded-[1.4rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {errorMessage}
              </div>
            ) : null}

            {activeTab === "overview" ? (
              <div className="space-y-4 lg:space-y-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                  <Panel className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a_0%,#134e4a_58%,#155e75_100%)] p-0 text-white">
                    <div className="relative aspect-[5/6] lg:aspect-auto lg:h-full">
                      {captureAvailable ? (
                        <>
                          <Image
                            src={latestImage?.imageUrl as string}
                            alt={latestImage?.trayName ?? "Tray image"}
                            fill
                            className="object-cover"
                            priority
                            sizes="(max-width: 1024px) 100vw, 52vw"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.72)_100%)]" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2dd4bf_0%,#0f172a_65%)]" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/62">
                          Live tray
                        </p>
                        <h2 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em]">
                          {latestPrediction?.label ?? "Awaiting analysis"}
                        </h2>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-white/76">
                          {latestPrediction?.recommendation ??
                            "The next capture submitted to the CV backend will update the tray diagnosis."}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge tone="default">{selectedTray?.name ?? "No tray"}</Badge>
                          <Badge tone={toneForSeverity(latestPrediction?.severity ?? "low")}>
                            {latestPrediction?.severity ?? "low"}
                          </Badge>
                          <Badge tone={captureAvailable ? "success" : "warning"}>
                            {latestImage?.capturedAt
                              ? formatRelativeTimestamp(latestImage.capturedAt)
                              : "No capture"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Panel>

                  <div className="space-y-4">
                    <Panel>
                      <SectionHeader
                        eyebrow="Tray health"
                        title={selectedTray?.name ?? "Tray not selected"}
                        detail="A quieter operational summary for the selected system."
                      />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MetricTile label="Health" value={`${selectedTray?.healthScore ?? 0}%`} />
                        <MetricTile label="Plants" value={String(trayPlants.length)} />
                        <MetricTile
                          label="Next scan"
                          value={
                            selectedTraySchedule
                              ? formatRelativeTimestamp(selectedTraySchedule.nextRunAt)
                              : "Not set"
                          }
                        />
                        <MetricTile
                          label="Last sync"
                          value={lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "N/A"}
                        />
                      </div>
                    </Panel>

                    <Panel className="bg-[linear-gradient(180deg,rgba(240,253,250,0.92)_0%,rgba(255,255,255,0.95)_100%)]">
                      <SectionHeader
                        eyebrow="Flow"
                        title="Open the next workspace"
                        detail="Keep the main monitoring flow simple and task-based."
                      />
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {TABS.filter((tab) => tab.id !== "overview").map((tab) => (
                          <Link
                            key={tab.id}
                            href={tab.href}
                            className="rounded-[1.35rem] bg-white px-4 py-4 text-left ring-1 ring-slate-200/70"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold tracking-[0.14em] text-slate-500">
                              {tab.short}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-950">
                              {tab.label}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </Panel>
                  </div>
                </div>

                <Panel>
                  <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
                    <div>
                      <SectionHeader
                        eyebrow="Monitoring"
                        title="Signal trend"
                        detail="Compact monitoring data from recent tray and plant events."
                      />
                      <div className="mt-4">
                        <TrendChart events={summaryLog} />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <MonitoringSummary
                        events={summaryLog}
                        reports={trayReports}
                        plants={trayPlants}
                      />
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div>
                      <SectionHeader
                        eyebrow="Current diagnosis"
                        title={latestPrediction?.label ?? "No diagnosis yet"}
                        detail={
                          latestPrediction?.recommendation ??
                          "Live diagnosis will appear here after the next image capture."
                        }
                      />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MetricTile
                          label="Confidence"
                          value={latestPrediction ? clampPercent(latestPrediction.confidence) : "0%"}
                        />
                        <MetricTile
                          label="Vector"
                          value={latestPrediction?.vectorSource ?? "mock"}
                        />
                        <MetricTile
                          label="Capture"
                          value={
                            latestImage?.capturedAt
                              ? formatRelativeTimestamp(latestImage.capturedAt)
                              : "Waiting"
                          }
                        />
                        <MetricTile label="Device" value={selectedTray?.deviceId ?? "N/A"} />
                      </div>
                    </div>

                    <div>
                      <SectionHeader
                        eyebrow="Recent events"
                        title="Monitoring log"
                        detail="Select an item to focus on the latest finding."
                      />
                      <div className="mt-4 space-y-3">
                        {summaryLog.map((event) => (
                          <EventRow
                            key={event.id}
                            event={event}
                            active={selectedEvent?.id === event.id}
                            onSelect={() => setSelectedEventId(event.id)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>

                {selectedEvent ? (
                  <Panel className="bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(240,253,250,0.92)_100%)]">
                    <SectionHeader
                      eyebrow="Focused event"
                      title={selectedEvent.title}
                      detail={selectedEvent.message}
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MetricTile label="Level" value={selectedEvent.level} />
                      <MetricTile label="Logged" value={formatDateTime(selectedEvent.createdAt)} />
                      <MetricTile label="Tray" value={selectedTray?.name ?? "N/A"} />
                    </div>
                  </Panel>
                ) : null}
              </div>
            ) : null}

            {activeTab === "plants" ? (
              <div className="space-y-4 lg:space-y-6">
                <Panel>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div>
                      <SectionHeader
                        eyebrow="Plant map"
                        title={selectedTray ? `${selectedTray.name} plants` : "Plants"}
                        detail="Tap one plant at a time. Keep the report focused."
                      />
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <MetricTile label="Healthy" value={String(healthyPlants)} />
                        <MetricTile label="Watch" value={String(watchPlants)} />
                        <MetricTile label="Alert" value={String(alertPlants)} />
                      </div>
                      <div
                        className="mt-5 grid gap-3"
                        style={{
                          gridTemplateColumns: `repeat(${plantGridColumns}, minmax(0, 1fr))`
                        }}
                      >
                        {trayPlants
                          .slice()
                          .sort((left, right) =>
                            left.row === right.row
                              ? left.column - right.column
                              : left.row - right.row
                          )
                          .map((plant) => (
                            <PlantSlot
                              key={plant.id}
                              plant={plant}
                              active={plant.id === selectedPlant?.id}
                              onSelect={() => setSelectedPlantId(plant.id)}
                            />
                          ))}
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(240,253,250,0.92)_100%)] p-5">
                      <SectionHeader
                        eyebrow="Selected plant"
                        title={selectedPlant?.name ?? "No plant selected"}
                        detail={
                          selectedPlant
                            ? `${selectedPlant.slotLabel} · ${selectedPlant.cultivar}`
                            : "Choose a plant from the grid."
                        }
                      />

                      {selectedPlant && selectedReport ? (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <Badge tone={toneForSeverity(selectedReport.severity)}>
                              {selectedReport.diagnosis}
                            </Badge>
                            <span className="text-sm font-medium text-slate-500">
                              {clampPercent(selectedReport.confidence)}
                            </span>
                          </div>
                          <p className="text-sm leading-7 text-slate-500">
                            {selectedReport.summary}
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            <MetricTile
                              label="Score"
                              value={`${selectedPlant.healthScore}%`}
                            />
                            <MetricTile
                              label="Disease"
                              value={String(selectedReport.diseases.length)}
                            />
                            <MetricTile
                              label="Deficiency"
                              value={String(selectedReport.deficiencies.length)}
                            />
                          </div>
                          <div className="rounded-[1.35rem] bg-white px-4 py-4 ring-1 ring-slate-200/70">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Recommended action
                            </p>
                            <p className="mt-2 text-sm leading-7 text-slate-700">
                              {selectedReport.recommendedAction}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-[1.35rem] border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                          No report available for this plant yet.
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader
                    eyebrow="Plant list"
                    title="All plants in tray"
                    detail="Compact list for fast switching without extra chrome."
                  />
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {trayPlants.map((plant) => (
                      <button
                        key={plant.id}
                        type="button"
                        onClick={() => setSelectedPlantId(plant.id)}
                        className={`rounded-[1.35rem] px-4 py-3 text-left transition ${
                          plant.id === selectedPlant?.id
                            ? "bg-slate-950 text-white"
                            : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{plant.name}</p>
                            <p
                              className={`mt-1 text-sm ${
                                plant.id === selectedPlant?.id ? "text-white/72" : "text-slate-500"
                              }`}
                            >
                              {plant.slotLabel} · {plant.latestDiagnosis}
                            </p>
                          </div>
                          <Badge tone={toneForStatus(plant.status)}>{plant.status}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {activeTab === "schedule" ? (
              <div className="space-y-4 lg:space-y-6">
                <Panel>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div>
                      <SectionHeader
                        eyebrow="Capture planner"
                        title="Edit schedule"
                        detail="Define capture timing without leaving the monitoring workflow."
                      />
                      <div className="mt-4 flex gap-2 rounded-full bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setScheduleScopeType("tray")}
                          className={`rounded-full px-4 py-2 text-sm font-medium ${
                            scheduleScopeType === "tray"
                              ? "bg-white text-slate-950 shadow-sm"
                              : "text-slate-500"
                          }`}
                        >
                          Tray
                        </button>
                        <button
                          type="button"
                          onClick={() => setScheduleScopeType("mesh")}
                          className={`rounded-full px-4 py-2 text-sm font-medium ${
                            scheduleScopeType === "mesh"
                              ? "bg-white text-slate-950 shadow-sm"
                              : "text-slate-500"
                          }`}
                        >
                          Mesh
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4">
                        <label className="block">
                          <span className="text-sm font-medium text-slate-700">Target</span>
                          <select
                            value={scheduleScopeId}
                            onChange={(event) => setScheduleScopeId(event.target.value)}
                            className="mt-2 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                          >
                            {(scheduleScopeType === "tray" ? trays : meshes).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-slate-700">Schedule name</span>
                          <input
                            value={scheduleName}
                            onChange={(event) => setScheduleName(event.target.value)}
                            className="mt-2 w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm font-medium text-slate-700">
                            Interval minutes
                          </span>
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={scheduleInterval}
                            onChange={(event) => setScheduleInterval(event.target.value)}
                            className="mt-2 w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm outline-none"
                          />
                        </label>

                        <label className="flex items-center gap-3 rounded-[1.25rem] bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={scheduleActive}
                            onChange={(event) => setScheduleActive(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Schedule is active
                        </label>
                      </div>

                      {scheduleFeedback ? (
                        <p className="mt-4 text-sm text-slate-500">{scheduleFeedback}</p>
                      ) : null}

                      <div className="mt-5">
                        <Button
                          className="w-full"
                          onClick={() => void saveSchedule()}
                          disabled={isSavingSchedule}
                        >
                          {isSavingSchedule ? "Saving..." : "Save schedule"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(240,249,255,0.92)_100%)] p-5">
                      <SectionHeader
                        eyebrow="Run state"
                        title="Capture flow"
                        detail="Scheduling and routing summary for the current workspace."
                      />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MetricTile label="Destination" value="computer-vision-backend" />
                        <MetricTile
                          label="Next tray run"
                          value={
                            selectedTraySchedule
                              ? formatRelativeTimestamp(selectedTraySchedule.nextRunAt)
                              : "Not set"
                          }
                        />
                        <MetricTile
                          label="Scope"
                          value={scheduleScopeType === "tray" ? "Tray" : "Mesh"}
                        />
                        <MetricTile label="Status" value={scheduleActive ? "Active" : "Paused"} />
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader
                    eyebrow="Existing schedules"
                    title="Current runs"
                    detail="Load a saved schedule into the editor with one tap."
                  />
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {schedules.map((schedule) => (
                      <ScheduleRow
                        key={schedule.id}
                        schedule={schedule}
                        active={selectedScheduleId === schedule.id}
                        onSelect={() => setSelectedScheduleId(schedule.id)}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            ) : null}

            {activeTab === "mesh" ? (
              <div className="space-y-4 lg:space-y-6">
                <Panel>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div>
                      <SectionHeader
                        eyebrow="Mesh builder"
                        title="Create a tray group"
                        detail="Build a shared monitoring topology without crowding the workspace."
                      />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MetricTile label="Selected trays" value={String(meshDraftTrayIds.length)} />
                        <MetricTile label="Existing meshes" value={String(meshes.length)} />
                      </div>

                      <label className="mt-4 block">
                        <span className="text-sm font-medium text-slate-700">Mesh name</span>
                        <input
                          value={meshName}
                          onChange={(event) => setMeshName(event.target.value)}
                          placeholder="North rack health mesh"
                          className="mt-2 w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm outline-none"
                        />
                      </label>

                      <div className="mt-4 space-y-2">
                        {trays.map((tray) => {
                          const selected = meshDraftTrayIds.includes(tray.id);

                          return (
                            <button
                              key={tray.id}
                              type="button"
                              onClick={() =>
                                setMeshDraftTrayIds((current) =>
                                  current.includes(tray.id)
                                    ? current.filter((id) => id !== tray.id)
                                    : [...current, tray.id]
                                )
                              }
                              className={`flex w-full items-center justify-between rounded-[1.25rem] px-4 py-3 text-left transition ${
                                selected
                                  ? "bg-slate-950 text-white"
                                  : "bg-slate-50 text-slate-900 ring-1 ring-slate-200/70"
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{tray.name}</p>
                                <p
                                  className={`mt-1 text-sm ${
                                    selected ? "text-white/72" : "text-slate-500"
                                  }`}
                                >
                                  {tray.crop} · {tray.zone}
                                </p>
                              </div>
                              <Badge tone={selected ? "default" : toneForStatus(tray.status)}>
                                {selected ? "selected" : tray.status}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>

                      {meshFeedback ? (
                        <p className="mt-4 text-sm text-slate-500">{meshFeedback}</p>
                      ) : null}

                      <div className="mt-5">
                        <Button
                          className="w-full"
                          onClick={() => void createMesh()}
                          disabled={isCreatingMesh}
                        >
                          {isCreatingMesh ? "Creating..." : "Create mesh"}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(240,253,250,0.92)_100%)] p-5">
                      <SectionHeader
                        eyebrow="Existing mesh groups"
                        title="Grouped systems"
                        detail="Each mesh summarizes tray coverage and active plant alerts."
                      />
                      <div className="mt-4 space-y-3">
                        {meshes.map((mesh) => (
                          <MeshRow key={mesh.id} mesh={mesh} trays={trays} plants={plants} />
                        ))}
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>
            ) : null}
          </div>

          <nav className="safe-bottom shrink-0 border-t border-slate-200/70 bg-white/94 px-2 pb-2 pt-2 lg:hidden">
            <div className="grid grid-cols-4 gap-2 rounded-[1.7rem] bg-slate-50 p-2 ring-1 ring-slate-200/70">
              {TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`rounded-[1.2rem] px-2 py-2.5 text-center transition ${
                    activeTab === tab.id ? "bg-slate-950 text-white" : "text-slate-500"
                  }`}
                >
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.14em] ${
                      activeTab === tab.id
                        ? "bg-white/14 text-white"
                        : "bg-white text-slate-500 ring-1 ring-slate-200/70"
                    }`}
                  >
                    {tab.short}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold">{tab.label}</p>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </main>
  );
}
