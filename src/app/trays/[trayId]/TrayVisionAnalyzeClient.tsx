"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Card } from "@/components/app/Section";

type VisionPayload = {
  count: number;
  countConfidence: number;
  instances: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    score: number;
    label?: string;
  }>;
  source: "simulated" | "remote";
};

export function TrayVisionAnalyzeClient({ trayId }: { trayId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<VisionPayload | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch(`/api/trays/${encodeURIComponent(trayId)}/vision`, {
        method: "POST",
        body: fd
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { vision: VisionPayload };
      };
      if (!res.ok) {
        setError(json.error ?? "Request failed");
        return;
      }
      if (json.data?.vision) {
        setLast(json.data.vision);
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-4">
      <p className="text-sm font-medium text-ink">Tray computer vision</p>
      <p className="mt-1 text-xs leading-relaxed text-ink/50">
        Upload a top-down tray photo to estimate plant instances and count. Compare with the
        catalog plant count above. Wire{" "}
        <span className="font-mono text-[0.65rem]">CV_TRAY_INFERENCE_URL</span> to your model
        service trained on Kaggle (or other) data.
      </p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink/45">
          Tray image
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-mist file:px-2 file:py-1"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-leaf px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze tray"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs text-ember" role="alert">
          {error}
        </p>
      ) : null}
      {last ? (
        <p className="mt-2 text-xs text-ink/60">
          Last run: {last.count} plants detected ({(last.countConfidence * 100).toFixed(1)}%
          confidence, {last.source}). {last.instances.length} boxes returned.
        </p>
      ) : null}
    </Card>
  );
}
