/**
 * Client-side helpers for Firebase web / PWA Google sign-in.
 * Standalone PWAs and many mobile browsers block or break popups;
 * redirect + local persistence is the reliable path there.
 */

export const isStandaloneDisplayMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    Boolean(nav.standalone) ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
};

export const shouldUseRedirectForGoogle = () => {
  if (typeof window === "undefined") {
    return false;
  }

  if (isStandaloneDisplayMode()) {
    return true;
  }

  if (window.matchMedia("(pointer: coarse)").matches) {
    return true;
  }

  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }

  // iPadOS desktop UA
  if (
    window.navigator.platform === "MacIntel" &&
    window.navigator.maxTouchPoints > 1
  ) {
    return true;
  }

  return false;
};

export const isGooglePopupFailure = (error: unknown) => {
  if (
    typeof error !== "object" ||
    !error ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return false;
  }

  return (
    error.code === "auth/popup-blocked" ||
    error.code === "auth/operation-not-supported-in-this-environment"
  );
};

/** Prefer Secure cookies on HTTPS (including Cloudflare tunnels) even in next dev. */
export const shouldUseSecureSessionCookie = (request: Request) => {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }

  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
};
