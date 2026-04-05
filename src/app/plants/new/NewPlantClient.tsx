"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { SectionTitle } from "@/components/app/Section";
import { PlantImage } from "@/components/media/PlantImage";
import { MANUAL_TRAY_ID } from "@/lib/constants/manual-tray";
import type { PlantReport, PlantUnit, TraySystem } from "@/lib/types/domain";

type Detection = {
  commonName: string;
  cultivar: string;
  identificationConfidence: number;
  plantCondition?: string;
  rawLabel?: string;
  isHealthy?: boolean;
};

export function NewPlantClient({ trays }: { trays: TraySystem[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const sorted = [...trays].sort((a, b) => {
    if (a.id === MANUAL_TRAY_ID) return -1;
    if (b.id === MANUAL_TRAY_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  const [trayId, setTrayId] = useState(MANUAL_TRAY_ID);
  const [plant, setPlant] = useState<PlantUnit | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [report, setReport] = useState<PlantReport | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitPhoto(file: File) {
    setErr(null);
    setBusy(true);
    setPlant(null);
    setDetection(null);
    setReport(null);
    setPhotoUrl(null);

    const fd = new FormData();
    fd.append("photo", file);
    fd.append("trayId", trayId);

    try {
      const res = await fetch("/api/plants/from-photo", {
        method: "POST",
        body: fd
      });
      const json = (await res.json()) as {
        data?: {
          plant: PlantUnit;
          detection: Detection;
          report: PlantReport;
          imageUrl: string;
        };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not analyze photo");
      if (!json.data) throw new Error("Invalid response");
      setPlant(json.data.plant);
      setDetection(json.data.detection);
      setReport(json.data.report);
      setPhotoUrl(json.data.imageUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Add a Plant
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          Take or upload a clear photo. The model identifies the species, creates the plant, and scores health in one step.
        </p>
      </div>

      {err && (
        <div className="animate-fade-in rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100" role="alert">
          {err}
        </div>
      )}

      {/* Tray selector */}
      <Card className="animate-fade-in stagger-1 p-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">Target Tray</span>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            value={trayId}
            onChange={(e) => setTrayId(e.target.value)}
            disabled={busy}
          >
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === MANUAL_TRAY_ID ? " — default for new plants" : ""}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {/* Upload area */}
      <div className="animate-fade-in stagger-2">
        {!detection ? (
          <Card className="p-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-ink/10 p-12 transition-all hover:border-leaf/30 hover:bg-lime/5 active:scale-[0.98] disabled:opacity-60"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf to-moss text-white shadow-fab">
                {busy ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                )}
              </span>
              <div className="text-center">
                <p className="text-sm font-semibold text-ink/60">
                  {busy ? "Detecting species and analyzing health..." : "Tap to add plant photo"}
                </p>
                <p className="mt-1 text-xs text-ink/30">JPEG, PNG, or WebP</p>
              </div>
              {busy && (
                <div className="flex items-center gap-2 text-xs text-leaf">
                  <span className="h-2 w-2 rounded-full bg-leaf animate-live-pulse" />
                  Processing...
                </div>
              )}
            </button>
          </Card>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void submitPhoto(f);
          e.target.value = "";
        }}
      />

      {/* Identification result */}
      {detection && plant && (
        <section className="animate-scale-in space-y-4">
          <SectionTitle>Identification</SectionTitle>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime/25 text-leaf">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              <div>
                <p className="text-lg font-bold text-ink">{detection.commonName}</p>
                <p className="text-sm text-ink/50">
                  {detection.plantCondition ?? detection.cultivar}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {detection.isHealthy === true && <Badge tone="success">Healthy</Badge>}
              {detection.isHealthy === false && <Badge tone="warning">Condition flagged</Badge>}
              <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink/50">
                {(detection.identificationConfidence * 100).toFixed(1)}% confidence
              </span>
            </div>

            {detection.rawLabel && (
              <p className="mt-3 rounded-lg bg-ink/5 px-3 py-1.5 font-mono text-[11px] text-ink/40">
                {detection.rawLabel}
              </p>
            )}

            <p className="mt-3 text-xs text-ink/45">
              Saved as <span className="font-semibold text-ink/65">{plant.name}</span>
            </p>
          </Card>
        </section>
      )}

      {/* Health report */}
      {report && photoUrl && plant && (
        <section className="animate-scale-in space-y-4">
          <SectionTitle>Health Report</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-[4/3] w-full bg-mist">
              <PlantImage src={photoUrl} alt="" fill className="object-cover" sizes="100vw" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                <Badge
                  tone={
                    report.severity === "high"
                      ? "critical"
                      : report.severity === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {report.severity} severity
                </Badge>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-ink">{report.diagnosis}</p>
                <span className="text-sm tabular-nums text-ink/50">
                  {(report.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm text-ink/60">{report.summary}</p>

              {(report.diseases.length > 0 || report.deficiencies.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {report.diseases.map((d) => (
                    <span key={d} className="rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-100">{d}</span>
                  ))}
                  {report.deficiencies.map((d) => (
                    <span key={d} className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">{d}</span>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-leaf/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-leaf/70">Recommendation</p>
                <p className="mt-1 text-sm font-medium text-ink/75">{report.recommendedAction}</p>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={() => router.push(`/plants/${plant.id}`)}
              >
                Open plant
              </Button>

              <button
                type="button"
                onClick={() => {
                  setDetection(null);
                  setPlant(null);
                  setReport(null);
                  setPhotoUrl(null);
                }}
                className="w-full text-center text-sm font-medium text-ink/40 transition-colors hover:text-ink/60"
              >
                Add another plant
              </button>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
