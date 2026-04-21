import { createHash } from "crypto";

import { MANUAL_TRAY_ID } from "@/lib/constants/manual-tray";

export const ADMIN_ACCOUNT_EMAIL = "admin@email.com";

export const normalizeAccountEmail = (email?: string | null) => {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

export const buildManualTrayId = (ownerEmail: string) => {
  const normalized = normalizeAccountEmail(ownerEmail);

  if (!normalized) {
    throw new Error("Owner email is required");
  }

  if (normalized === ADMIN_ACCOUNT_EMAIL) {
    return MANUAL_TRAY_ID;
  }

  const suffix = createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 12);

  return `${MANUAL_TRAY_ID}-${suffix}`;
};
