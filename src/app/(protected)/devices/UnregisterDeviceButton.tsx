"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";

export function UnregisterDeviceButton({
  deviceId,
  label
}: {
  deviceId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unregister() {
    const ok = window.confirm(
      `Remove “${label}” from your account? You can register the same Pi again later. This cannot be undone.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/devices/${encodeURIComponent(deviceId)}`,
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unregister failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
        disabled={busy}
        onClick={() => void unregister()}
      >
        {busy ? "Removing…" : "Remove"}
      </Button>
      {error && <p className="max-w-[14rem] text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
