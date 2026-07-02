import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { checkRateLimit } from "@/lib/api/rate-limit-memory";
import { requireApiAccountUser } from "@/lib/auth/session";
import {
  parseTrainingFeedbackTags,
  recordTrainingFeedbackSample,
  trainingFeedbackFieldsPresent
} from "@/lib/feedback/training-sample";
import { getParticipateMlFeedback } from "@/lib/services/user-preferences-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVICE_HEADER = "x-agrihome-feedback-key";

const MAX_IMAGE_BYTES = Number(
  process.env.FEEDBACK_MAX_IMAGE_BYTES ?? 8 * 1024 * 1024
);
const RATE_USER_PER_MIN = Number(
  process.env.FEEDBACK_INGEST_MAX_PER_USER_PER_MIN ?? 20
);
const RATE_IP_PER_MIN = Number(
  process.env.FEEDBACK_INGEST_MAX_PER_IP_PER_MIN ?? 60
);
const WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`fb-ip:${ip}`, RATE_IP_PER_MIN, WINDOW_MS);
  if (!ipLimit.ok) {
    return apiErrorResponse(
      API_ERROR_CODES.RATE_LIMITED,
      "Too many uploads from this network. Try again shortly.",
      429,
      { headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
    );
  }

  const serviceKeyEnv = process.env.FEEDBACK_INGEST_SERVICE_KEY?.trim();
  const serviceKeyHeader = request.headers.get(SERVICE_HEADER)?.trim();

  let userUid: string;
  let ownerEmail: string;

  if (serviceKeyEnv && serviceKeyHeader === serviceKeyEnv) {
    let formEarly: FormData;
    try {
      formEarly = await request.formData();
    } catch {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        "Invalid multipart body",
        400
      );
    }
    const uid = String(formEarly.get("userUid") ?? "").trim();
    const email = String(formEarly.get("userEmail") ?? "").trim();
    if (!uid || !email) {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        "Service uploads require userUid and userEmail form fields.",
        400
      );
    }
    userUid = uid;
    ownerEmail = email.toLowerCase();
    const svcLimit = checkRateLimit(
      `fb-svc:${ip}`,
      RATE_IP_PER_MIN,
      WINDOW_MS
    );
    if (!svcLimit.ok) {
      return apiErrorResponse(
        API_ERROR_CODES.RATE_LIMITED,
        "Rate limit exceeded for service uploads.",
        429,
        { headers: { "Retry-After": String(svcLimit.retryAfterSec) } }
      );
    }
    return handleIngestForm(formEarly, userUid, ownerEmail, ip);
  }

  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const userLimit = checkRateLimit(
    `fb-user:${authResult.uid}`,
    RATE_USER_PER_MIN,
    WINDOW_MS
  );
  if (!userLimit.ok) {
    return apiErrorResponse(
      API_ERROR_CODES.RATE_LIMITED,
      "Upload rate limit exceeded. Try again in a minute.",
      429,
      { headers: { "Retry-After": String(userLimit.retryAfterSec) } }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Invalid multipart body",
      400
    );
  }

  userUid = authResult.uid;
  ownerEmail = authResult.email;

  return handleIngestForm(form, userUid, ownerEmail, ip);
}

async function handleIngestForm(
  form: FormData,
  userUid: string,
  ownerEmail: string,
  ip: string
) {
  const canFeedback = await getParticipateMlFeedback(ownerEmail);
  if (!canFeedback) {
    return apiErrorResponse(
      API_ERROR_CODES.FORBIDDEN,
      "Model training feedback is off. Turn it on in Settings → Preferences to submit images for training.",
      403
    );
  }

  const file = form.get("image");
  if (!file || !(file instanceof File)) {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Missing image file (field name: image)",
      400
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return apiErrorResponse(
      API_ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Image too large (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB)`,
      413
    );
  }

  const feedbackCategoryRaw = String(form.get("feedbackCategory") ?? "").trim();
  const feedbackCategory = feedbackCategoryRaw
    ? feedbackCategoryRaw.slice(0, 120)
    : null;

  const feedbackCropRaw = String(form.get("feedbackCrop") ?? "").trim();
  const feedbackCrop = feedbackCropRaw ? feedbackCropRaw.slice(0, 120) : null;

  const commentRaw = String(form.get("comment") ?? "").trim();
  const commentText = commentRaw ? commentRaw.slice(0, 4000) : null;

  const tags = parseTrainingFeedbackTags(
    form.get("tags") != null ? String(form.get("tags")) : null
  );

  const modelPredictionRaw = String(
    form.get("modelPrediction") ?? ""
  ).trim();
  const modelPredictionLabel = modelPredictionRaw
    ? modelPredictionRaw.slice(0, 120)
    : null;

  if (!trainingFeedbackFieldsPresent(feedbackCategory, commentText, tags, feedbackCrop)) {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Provide at least one of: crop + category, category, tags, or comment (min 3 characters).",
      400
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Could not read upload",
      400
    );
  }

  try {
    const row = await recordTrainingFeedbackSample({
      userUid,
      ownerEmail,
      buffer,
      mimeType: file.type || "application/octet-stream",
      maxBytes: MAX_IMAGE_BYTES,
      feedbackCategory,
      feedbackCrop,
      feedbackTags: tags,
      commentText,
      modelPredictionLabel
    });

    return NextResponse.json({
      data: {
        id: row.id,
        imageUrl: row.imageUrl,
        createdAt: row.createdAt,
        feedbackCategory: row.feedbackCategory,
        feedbackCrop: row.feedbackCrop,
        feedbackTags: row.feedbackTags,
        commentText: row.commentText,
        storageProvider: row.imageStorageProvider,
        plantvillageDatasetRelpath: row.plantvillageDatasetRelpath
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[feedback/ingest]", ip, msg);
    return mapErrorToApiResponse(e, "Upload failed");
  }
}
