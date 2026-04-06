"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { Card } from "@/components/atoms/Card";
import { Badge } from "@/components/atoms/Badge";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<VisionPayload | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

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
      setFileName(null);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Tray Analysis</p>
            <p className="mt-1 text-xs text-ink/45">
              Upload a top-down tray photo to detect and count plant instances.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf to-moss text-white shadow-fab transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {busy ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            )}
          </button>
        </div>

        <input
          ref={fileRef}
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFileName(f.name);
              e.target.form?.requestSubmit();
            }
          }}
        />

        {fileName && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-lime/10 px-3 py-2 text-xs text-ink/60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            {fileName}
          </div>
        )}

        {busy && (
          <div className="mt-3 flex items-center gap-2 text-sm text-ink/50">
            <span className="h-2 w-2 rounded-full bg-leaf animate-live-pulse" />
            Detecting plant instances...
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p>
        )}
      </Card>

      {/* Detection results */}
      {last && (
        <Card className="p-5 animate-scale-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Detection Results</p>
            <Badge tone={last.source === "remote" ? "success" : "default"}>
              {last.source}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-lime/20 to-leaf/10 p-4 text-center">
              <p className="text-3xl font-bold text-ink">{last.count}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink/45">Plants Found</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 text-center">
              <p className="text-3xl font-bold text-ink">{(last.countConfidence * 100).toFixed(0)}%</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink/45">Confidence</p>
            </div>
          </div>

          {last.instances.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink/40">{last.instances.length} bounding boxes detected</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {last.instances.slice(0, 12).map((inst, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-medium text-ink/60 ring-1 ring-ink/5"
                  >
                    {inst.label ?? `#${i + 1}`}
                    <span className="text-leaf">{(inst.score * 100).toFixed(0)}%</span>
                  </span>
                ))}
                {last.instances.length > 12 && (
                  <span className="inline-flex items-center rounded-lg bg-ink/5 px-2 py-1 text-[10px] text-ink/40">
                    +{last.instances.length - 12} more
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </form>
  );
}
