"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card } from "@/components/atoms/Card";

export function PreferencesClient({
  initialParticipateMlFeedback,
  initialDeveloperMode
}: {
  initialParticipateMlFeedback: boolean;
  initialDeveloperMode: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialParticipateMlFeedback);
  const [developerMode, setDeveloperMode] = useState(initialDeveloperMode);
  const [saving, setSaving] = useState<"ml" | "dev" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOn(initialParticipateMlFeedback);
  }, [initialParticipateMlFeedback]);

  useEffect(() => {
    setDeveloperMode(initialDeveloperMode);
  }, [initialDeveloperMode]);

  async function patch(body: Record<string, boolean>, kind: "ml" | "dev") {
    setErr(null);
    setSaving(kind);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save");
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      throw e;
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
          Model training & feedback
        </p>
        <p className="mt-1 text-sm text-ink/60">
          When enabled, you can use the Feedback page and optional training
          fields when adding plants, so your images and labels can improve
          future models. You can turn this off at any time.
        </p>

        {err && (
          <p className="mt-3 text-sm text-rose-600" role="alert">
            {err}
          </p>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-white/50 p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/40">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/20 text-leaf focus:ring-leaf"
            checked={on}
            disabled={saving !== null}
            onChange={(e) => {
              const next = e.target.checked;
              const prev = on;
              setOn(next);
              void patch({ participateMlFeedback: next }, "ml").catch(() =>
                setOn(prev)
              );
            }}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Participate in feedback and training
            </span>
            <span className="mt-0.5 block text-xs text-ink/45">
              {saving === "ml"
                ? "Saving…"
                : on
                  ? "Enabled — feedback entry points are available."
                  : "Off — you will not be able to submit training data."}
            </span>
          </span>
        </label>
      </Card>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
          Developer tools
        </p>
        <p className="mt-1 text-sm text-ink/60">
          Shows manual Raspberry Pi / Klipper controls on tray pages: Take
          picture, Get position, Home axes, Pi0 servo &amp; LED, and stepper
          G-code moves. Leave off for day-to-day use.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-white/50 p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-leaf/40">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink/20 text-leaf focus:ring-leaf"
            checked={developerMode}
            disabled={saving !== null}
            onChange={(e) => {
              const next = e.target.checked;
              const prev = developerMode;
              setDeveloperMode(next);
              void patch({ developerMode: next }, "dev").catch(() =>
                setDeveloperMode(prev)
              );
            }}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Enable developer controls
            </span>
            <span className="mt-0.5 block text-xs text-ink/45">
              {saving === "dev"
                ? "Saving…"
                : developerMode
                  ? "On — manual Pi / Klipper tools appear on tray pages."
                  : "Off — only status and device linking are shown."}
            </span>
          </span>
        </label>
      </Card>
    </div>
  );
}
