import type { NextRequest } from "next/server";

import { env } from "@/lib/config/env";

const firstHeaderValue = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  return value.split(",")[0]?.trim() || null;
};

const socketIp = (request: NextRequest): string => {
  const withIp = request as NextRequest & { ip?: string };
  const direct = withIp.ip?.trim();
  return direct || "unknown";
};

/**
 * Resolves the client IP for rate limiting and audit logs.
 *
 * When `TRUST_PROXY=true` (production behind Cloudflare Tunnel), honors
 * `CF-Connecting-IP` then `X-Forwarded-For`. Otherwise uses the socket IP
 * from Next.js when available, without reading spoofable proxy headers.
 */
export const resolveClientIp = (request: NextRequest): string => {
  if (env.trustProxy) {
    const cfIp = firstHeaderValue(request.headers.get("cf-connecting-ip"));
    if (cfIp) {
      return cfIp;
    }

    const forwardedIp = firstHeaderValue(request.headers.get("x-forwarded-for"));
    if (forwardedIp) {
      return forwardedIp;
    }

    return socketIp(request);
  }

  return socketIp(request);
};
