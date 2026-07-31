"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import type { FirebaseClientConfig } from "@/lib/types/auth";

export function AccountSettingsClient({
  email,
  initialDisplayName,
  firebaseConfig,
}: {
  email: string;
  initialDisplayName: string;
  firebaseConfig: FirebaseClientConfig;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveName() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || null }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save name");
      }
      setSavedDisplayName(displayName.trim());
      setEditingName(false);
      setMsg("Name saved.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
          Account
        </p>
        <p className="mt-1 text-sm text-ink/60">
          This name is shown inside AgriHome. Your sign-in email stays the same.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink/50">Name</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {savedDisplayName || "Not set"}
          </p>
        </div>
        {!editingName ? (
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 px-3 py-2 text-xs"
            onClick={() => {
              setDisplayName(savedDisplayName);
              setMsg(null);
              setEditingName(true);
            }}
          >
            Edit
          </Button>
        ) : null}
      </div>

      {editingName ? (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-white/60 p-3.5">
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Name</span>
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={120}
              disabled={saving}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              placeholder="Operator name"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving}
              className="px-3 py-2 text-xs"
              onClick={() => void saveName()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              className="px-3 py-2 text-xs"
              onClick={() => {
                setDisplayName(savedDisplayName);
                setMsg(null);
                setEditingName(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium text-ink/50">Email</p>
        <p className="mt-0.5 break-all text-sm text-ink">{email}</p>
      </div>

      {msg ? (
        <p
          className={`text-sm ${
            msg === "Name saved." ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {msg}
        </p>
      ) : null}

      <div className="border-t border-ink/10 pt-4">
        <LogoutButton firebaseConfig={firebaseConfig} />
      </div>
    </Card>
  );
}
