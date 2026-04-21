"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";
import { useSnackbar } from "@/components/providers/SnackbarProvider";
import {
  getFirebaseClientAuth,
  hasFirebaseClientConfig
} from "@/lib/firebase/client";
import type { FirebaseClientConfig } from "@/lib/types/auth";

export function LogoutButton({
  firebaseConfig
}: {
  firebaseConfig: FirebaseClientConfig;
}) {
  const router = useRouter();
  const { show } = useSnackbar();
  const [busy, setBusy] = useState(false);

  const onLogout = async () => {
    setBusy(true);

    try {
      if (hasFirebaseClientConfig(firebaseConfig)) {
        await signOut(getFirebaseClientAuth(firebaseConfig));
      }

      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Could not clear your session.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      show(
        error instanceof Error ? error.message : "Could not sign out right now.",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onLogout}
      disabled={busy}
      className="rounded-xl px-3 py-2 text-xs font-semibold text-ink/65 hover:bg-ink/[0.06]"
    >
      {busy ? "Signing out..." : "Sign out"}
    </Button>
  );
}
