"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card, SectionTitle } from "@/components/app/Section";
import { PlantImage } from "@/components/media/PlantImage";
import { MANUAL_TRAY_ID } from "@/lib/constants/manual-tray";
import type { PlantReport, PlantUnit, TraySystem } from "@/lib/types/domain";

type Detection = {
  commonName: string;
  cultivar: string;
  identificationConfidence: number;
};

export function NewPlantClient({ trays }: { trays: TraySystem[] }) {
  const router = useRouter();
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
    <div>
      <Link href="/trays" className="text-sm font-semibold text-leaf hover:underline">
        ← Trays
      </Link>
      <h1 className="mt-2 bg-gradient-to-r from-moss to-leaf bg-clip-text text-xl font-bold tracking-tight text-transparent">
        Add a plant
      </h1>
      <p className="mt-1 text-sm text-ink/50">
        Take or upload a clear photo. The model identifies the species, creates the plant, and
        scores health in one step.
      </p>

      {err ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-5">
        <label className="block text-sm">
          <span className="font-medium text-ink/80">Tray</span>
          <select
            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
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

        <label className="block">
          <span className="text-sm font-medium text-ink/80">Plant photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="mt-2 block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-lime file:px-3 file:py-2 file:font-semibold file:text-ink"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void submitPhoto(f);
            }}
          />
        </label>

        {busy ? (
          <p className="text-sm text-ink/50">Detecting species and analyzing health…</p>
        ) : null}

        {detection && plant ? (
          <section>
            <SectionTitle>Identification</SectionTitle>
            <Card className="space-y-2 p-4">
              <p className="text-lg font-semibold text-ink">{detection.commonName}</p>
              <p className="text-sm text-ink/65">{detection.cultivar}</p>
              <p className="text-xs tabular-nums text-ink/50">
                Species confidence {(detection.identificationConfidence * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-ink/45">
                Saved as <span className="font-medium text-ink/70">{plant.name}</span> — rename on
                the plant page if needed.
              </p>
            </Card>
          </section>
        ) : null}

        {report && photoUrl && plant ? (
          <section>
            <SectionTitle>Health report</SectionTitle>
            <Card className="space-y-3 p-4">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-mist">
                <PlantImage src={photoUrl} alt="" fill className="object-cover" sizes="100vw" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    report.severity === "high"
                      ? "critical"
                      : report.severity === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {report.severity}
                </Badge>
                <span className="text-sm tabular-nums text-ink/60">
                  Report confidence {(report.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="font-semibold text-ink">{report.diagnosis}</p>
              <p className="text-sm text-ink/65">{report.summary}</p>
              <p className="text-sm font-medium text-leaf">{report.recommendedAction}</p>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => router.push(`/plants/${plant.id}`)}
              >
                Open plant
              </Button>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
