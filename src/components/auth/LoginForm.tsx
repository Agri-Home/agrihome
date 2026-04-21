"use client";

import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { useSnackbar } from "@/components/providers/SnackbarProvider";
import {
  createGoogleProvider,
  getFirebaseClientAuth,
  hasFirebaseClientConfig
} from "@/lib/firebase/client";
import type { FirebaseClientConfig } from "@/lib/types/auth";

import { LoginMascot } from "./LoginMascot";

type AuthMode = "sign-in" | "register";

type LoginFormVariant = "default" | "playful";

const modeCopy: Record<
  AuthMode,
  { title: string; action: string; switchLabel: string }
> = {
  "sign-in": {
    title: "Sign in",
    action: "Sign in",
    switchLabel: "Create an account"
  },
  register: {
    title: "Create account",
    action: "Create account",
    switchLabel: "Sign in instead"
  }
};

const mapAuthError = (error: unknown) => {
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "That email already has an account.";
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Invalid email or password.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/weak-password":
        return "Use a password with at least 6 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a moment and try again.";
      case "auth/popup-blocked":
        return "The Google sign-in popup was blocked. Allow popups and try again.";
      case "auth/popup-closed-by-user":
        return "The Google sign-in popup was closed before completion.";
      case "auth/cancelled-popup-request":
        return "Another sign-in attempt is already in progress.";
      case "auth/account-exists-with-different-credential":
        return "This email already exists with another sign-in method. Use that method first, then link Google if needed.";
      case "auth/operation-not-supported-in-this-environment":
        return "Google sign-in is not supported in this browser context.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized for Google sign-in in Firebase Authentication.";
      default:
        return "Authentication failed. Check your Firebase Auth setup.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed.";
};

const createServerSession = async (idToken: string) => {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });
  const json = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(json.error ?? "Could not create an authenticated session.");
  }
};

const syncCurrentFirebaseUserToServerSession = async (
  firebaseConfig: FirebaseClientConfig
) => {
  const auth = getFirebaseClientAuth(firebaseConfig);

  try {
    const idToken = await auth.currentUser?.getIdToken(true);

    if (!idToken) {
      throw new Error("Could not read the Firebase ID token.");
    }

    await createServerSession(idToken);
  } finally {
    try {
      await auth.signOut();
    } catch {
      // Ignore cleanup failures after session creation attempts.
    }
  }
};

export function LoginForm({
  firebaseConfig,
  isServerConfigured,
  variant = "default"
}: {
  firebaseConfig: FirebaseClientConfig;
  isServerConfigured: boolean;
  variant?: LoginFormVariant;
}) {
  const router = useRouter();
  const { show } = useSnackbar();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const showPasswordToggleRef = useRef<HTMLInputElement>(null);

  const playful = variant === "playful";

  useEffect(() => {
    if (!playful || typeof window === "undefined") {
      return;
    }
    if (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) {
      setShowPassword(true);
    }
  }, [playful]);

  const isClientConfigured = hasFirebaseClientConfig(firebaseConfig);
  const isConfigured = isClientConfigured && isServerConfigured;

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    let active = true;

    const consumeRedirectResult = async () => {
      try {
        const auth = getFirebaseClientAuth(firebaseConfig);
        const result = await getRedirectResult(auth);

        if (!active || !result?.user) {
          return;
        }

        setBusy(true);
        setError(null);
        await syncCurrentFirebaseUserToServerSession(firebaseConfig);
        show("Signed in with Google.");
        startTransition(() => {
          router.replace("/dashboard");
          router.refresh();
        });
      } catch (redirectError) {
        if (!active) {
          return;
        }

        const message = mapAuthError(redirectError);
        setError(message);
        show(message, "error");
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    };

    void consumeRedirectResult();

    return () => {
      active = false;
    };
  }, [firebaseConfig, isConfigured, router, show]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isConfigured) {
      setError(
        "Firebase auth is not fully configured yet. Add both the web app config and admin service account variables first."
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const auth = getFirebaseClientAuth(firebaseConfig);
      await setPersistence(auth, inMemoryPersistence);
      if (
        mode === "register"
      ) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      await syncCurrentFirebaseUserToServerSession(firebaseConfig);
      show(mode === "register" ? "Account created." : "Signed in.");
      startTransition(() => {
        router.replace("/dashboard");
        router.refresh();
      });
    } catch (submitError) {
      try {
        await getFirebaseClientAuth(firebaseConfig).signOut();
      } catch {
        // Ignore client cleanup errors after a failed sign-in.
      }
      const message = mapAuthError(submitError);
      setError(message);
      show(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onGoogleSignIn = async () => {
    if (!isConfigured) {
      setError(
        "Firebase auth is not fully configured yet. Add both the web app config and admin service account variables first."
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const auth = getFirebaseClientAuth(firebaseConfig);
      const provider = createGoogleProvider();
      const prefersRedirect =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;

      await setPersistence(auth, browserSessionPersistence);

      if (prefersRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }

      await signInWithPopup(auth, provider);
      await syncCurrentFirebaseUserToServerSession(firebaseConfig);
      show("Signed in with Google.");
      startTransition(() => {
        router.replace("/dashboard");
        router.refresh();
      });
    } catch (googleError) {
      try {
        await getFirebaseClientAuth(firebaseConfig).signOut();
      } catch {
        // Ignore cleanup failures after a failed Google sign-in.
      }
      const message = mapAuthError(googleError);
      setError(message);
      show(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="animate-scale-in relative w-full max-w-xl overflow-hidden border border-white/60 bg-white/[0.82] p-6 shadow-[0_28px_70px_rgba(15,31,23,0.11)] backdrop-blur-2xl sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,251,128,0.2),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(61,159,108,0.12),transparent_28%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/90 to-transparent animate-gradient-shift" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf">
              Account
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">
              {modeCopy[mode].title}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-ink/55">
              Email and password, or Google.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setMode((current) =>
                current === "sign-in" ? "register" : "sign-in"
              )
            }
            className="rounded-full border border-leaf/10 bg-lime/35 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-lime/55"
          >
            {modeCopy[mode].switchLabel}
          </button>
        </div>

        {!isConfigured && (
          <div
            className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            Missing Firebase configuration. Set the web app keys and the admin
            service account variables in your environment before using auth.
          </div>
        )}

        {error && (
          <div
            className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {error}
          </div>
        )}

        {playful ? (
          <form className="mt-6 flex flex-col gap-6" onSubmit={onSubmit}>
            <div className="order-2 space-y-3">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !isConfigured}
                onClick={onGoogleSignIn}
                className="w-full rounded-2xl border-white/80 bg-white/90 py-3 text-sm shadow-sm"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h5.846c-.257 1.326-1.542 3.89-5.846 3.89-3.52 0-6.389-2.915-6.389-6.514s2.869-6.514 6.389-6.514c2.003 0 3.346.854 4.114 1.59l2.814-2.73C17.357 2.44 15.054 1.5 12.24 1.5 6.99 1.5 2.727 5.763 2.727 11.013s4.263 9.513 9.513 9.513c5.491 0 9.132-3.86 9.132-9.301 0-.624-.069-1.099-.153-1.57H12.24z"
                  />
                  <path
                    fill="#34A853"
                    d="M2.727 6.819l3.384 2.482c.916-1.814 2.798-3.065 5.129-3.065 2.003 0 3.346.854 4.114 1.59l2.814-2.73C17.357 2.44 15.054 1.5 12.24 1.5c-3.65 0-6.772 2.08-8.306 5.319z"
                  />
                  <path
                    fill="#4A90E2"
                    d="M12.24 20.526c2.738 0 5.033-.902 6.71-2.449l-3.188-2.619c-.854.597-1.993 1.014-3.522 1.014-4.237 0-5.538-2.845-5.787-4.228l-3.41 2.628c1.526 3.278 4.857 5.654 9.197 5.654z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.453 12.244a5.705 5.705 0 01-.319-1.891c0-.655.111-1.292.31-1.89L3.06 5.98A9.497 9.497 0 002.727 11c0 1.535.367 2.99 1.016 4.272l3.41-2.628z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-ink/10" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/35">
                  Or use email
                </span>
                <div className="h-px flex-1 bg-ink/10" />
              </div>
            </div>

            <div className="order-4 space-y-5">
              <div>
                <label
                  htmlFor="playful-email"
                  className="mb-3 block text-lg font-bold text-[#1a3d2e]"
                >
                  Email
                </label>
                <input
                  id="playful-email"
                  ref={emailInputRef}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="box-border h-[65px] w-full rounded-lg border-2 border-[#1a3d2e]/75 bg-[#f3fafd] px-4 pb-2 pt-7 text-lg font-semibold text-ink shadow-sm outline-none transition-[box-shadow,border-color] focus:border-moss focus:shadow-md"
                  placeholder="grower@agrihome.local"
                  required
                  disabled={busy}
                />
                <p className="mt-1.5 text-xs text-ink/45">email@domain.com</p>
              </div>

              <div className="relative pb-1">
                <label
                  htmlFor="playful-password"
                  className="mb-3 block text-lg font-bold text-[#1a3d2e]"
                >
                  Password
                </label>
                <input
                  id="playful-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="box-border h-[65px] w-full rounded-lg border-2 border-[#1a3d2e]/75 bg-[#f3fafd] px-4 py-3 pr-[5.5rem] text-lg font-semibold text-ink shadow-sm outline-none transition-[box-shadow,border-color] focus:border-moss focus:shadow-md"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                  disabled={busy}
                />
                <label
                  htmlFor="playful-show-password"
                  className="absolute right-3 top-[2.85rem] flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-[#1a3d2e]"
                >
                  <span>Show</span>
                  <input
                    id="playful-show-password"
                    ref={showPasswordToggleRef}
                    type="checkbox"
                    className="h-4 w-4 rounded border-2 border-[#1a3d2e]/80 accent-moss"
                    checked={showPassword}
                    onChange={(event) =>
                      setShowPassword(event.target.checked)
                    }
                  />
                </label>
              </div>

              <Button
                type="submit"
                disabled={busy || !isConfigured}
                className="h-[65px] w-full rounded-lg bg-gradient-to-r from-moss to-[#214a37] py-3 text-lg font-semibold text-white shadow-[0_18px_50px_rgba(15,31,23,0.18)] hover:opacity-95"
              >
                {busy ? "Working..." : modeCopy[mode].action}
              </Button>
            </div>

            <div className="order-1 flex justify-center">
              <LoginMascot
                emailRef={emailInputRef}
                passwordRef={passwordInputRef}
                showPasswordToggleRef={showPasswordToggleRef}
                showPassword={showPassword}
              />
            </div>
          </form>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !isConfigured}
                onClick={onGoogleSignIn}
                className="w-full rounded-2xl border-white/80 bg-white/90 py-3 text-sm shadow-sm"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h5.846c-.257 1.326-1.542 3.89-5.846 3.89-3.52 0-6.389-2.915-6.389-6.514s2.869-6.514 6.389-6.514c2.003 0 3.346.854 4.114 1.59l2.814-2.73C17.357 2.44 15.054 1.5 12.24 1.5 6.99 1.5 2.727 5.763 2.727 11.013s4.263 9.513 9.513 9.513c5.491 0 9.132-3.86 9.132-9.301 0-.624-.069-1.099-.153-1.57H12.24z"
                  />
                  <path
                    fill="#34A853"
                    d="M2.727 6.819l3.384 2.482c.916-1.814 2.798-3.065 5.129-3.065 2.003 0 3.346.854 4.114 1.59l2.814-2.73C17.357 2.44 15.054 1.5 12.24 1.5c-3.65 0-6.772 2.08-8.306 5.319z"
                  />
                  <path
                    fill="#4A90E2"
                    d="M12.24 20.526c2.738 0 5.033-.902 6.71-2.449l-3.188-2.619c-.854.597-1.993 1.014-3.522 1.014-4.237 0-5.538-2.845-5.787-4.228l-3.41 2.628c1.526 3.278 4.857 5.654 9.197 5.654z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.453 12.244a5.705 5.705 0 01-.319-1.891c0-.655.111-1.292.31-1.89L3.06 5.98A9.497 9.497 0 002.727 11c0 1.535.367 2.99 1.016 4.272l3.41-2.628z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-ink/10" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/35">
                  Or use email
                </span>
                <div className="h-px flex-1 bg-ink/10" />
              </div>
            </div>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-leaf focus:ring-4 focus:ring-lime/15"
                  placeholder="grower@agrihome.local"
                  required
                  disabled={busy}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm outline-none transition-colors focus:border-leaf focus:ring-4 focus:ring-lime/15"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                  disabled={busy}
                />
              </label>

              <Button
                type="submit"
                disabled={busy || !isConfigured}
                className="w-full rounded-2xl bg-gradient-to-r from-ink via-moss to-[#214a37] py-3 text-sm text-white shadow-[0_18px_50px_rgba(15,31,23,0.18)] hover:bg-none"
              >
                {busy ? "Working..." : modeCopy[mode].action}
              </Button>
            </form>
          </>
        )}
      </div>
    </Card>
  );
}
