"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { useSnackbar } from "@/components/providers/SnackbarProvider";
import {
  getFirebaseClientAuth,
  hasFirebaseClientConfig,
} from "@/lib/firebase/client";
import type { FirebaseClientConfig } from "@/lib/types/auth";

export function LogoutButton({
  firebaseConfig,
}: {
  firebaseConfig: FirebaseClientConfig;
}) {
  const router = useRouter();
  const { show } = useSnackbar();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!confirmOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen]);

  const onLogout = async () => {
    setBusy(true);

    try {
      if (hasFirebaseClientConfig(firebaseConfig)) {
        await signOut(getFirebaseClientAuth(firebaseConfig));
      }

      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not clear your session.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      show(
        error instanceof Error
          ? error.message
          : "Could not sign out right now.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="rounded-xl px-3 py-2 text-xs font-semibold text-ink/65 hover:bg-ink/[0.06]"
      >
        Sign out
      </Button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 backdrop-blur-sm"
          onMouseDown={() => setConfirmOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sign-out-dialog-title"
            aria-describedby="sign-out-dialog-description"
            className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2
              id="sign-out-dialog-title"
              className="text-lg font-bold text-ink"
            >
              Sign out?
            </h2>
            <p
              id="sign-out-dialog-description"
              className="mt-2 text-sm text-ink/55"
            >
              You will need to sign in again to manage your greenhouse.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                autoFocus
                disabled={busy}
                onClick={() => void onLogout()}
              >
                {busy ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
