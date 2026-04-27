import {
  insertFeedbackIngest,
  type FeedbackIngestRow
} from "@/lib/services/feedback-ingest-service";
import {
  resolvePlantVillageClassFolderName,
  writeFeedbackImageToPlantVillageLayout
} from "@/lib/feedback/plantvillage-dataset-export";
import {
  saveFeedbackImageLocal,
  type FeedbackImageExt
} from "@/lib/storage/save-feedback-image";

export function parseTrainingFeedbackTags(raw: string | null): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const v = JSON.parse(t) as unknown;
      if (!Array.isArray(v)) {
        return [];
      }
      return v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.normalize("NFKC").trim())
        .filter(Boolean)
        .slice(0, 32);
    } catch {
      return [];
    }
  }
  return t
    .split(/[,;]+/)
    .map((s) => s.normalize("NFKC").trim())
    .filter(Boolean)
    .slice(0, 32);
}

export function trainingFeedbackFieldsPresent(
  category: string | null,
  comment: string | null,
  tags: string[]
): boolean {
  if (category && category.length > 0) {
    return true;
  }
  if (tags.length > 0) {
    return true;
  }
  if (comment && comment.trim().length >= 3) {
    return true;
  }
  return false;
}

export function mimeToTrainingImageExt(mime: string): FeedbackImageExt {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  throw new Error("Unsupported image type (use JPEG, PNG, or WebP)");
}

const DEFAULT_MAX = 8 * 1024 * 1024;

export async function recordTrainingFeedbackSample(input: {
  userUid: string;
  ownerEmail: string;
  buffer: Buffer;
  mimeType: string;
  maxBytes?: number;
  feedbackCategory: string | null;
  feedbackTags: string[];
  commentText: string | null;
  modelPredictionLabel: string | null;
}): Promise<FeedbackIngestRow> {
  const {
    userUid,
    ownerEmail,
    buffer,
    mimeType,
    feedbackCategory,
    feedbackTags,
    commentText,
    modelPredictionLabel
  } = input;

  if (
    !trainingFeedbackFieldsPresent(feedbackCategory, commentText, feedbackTags)
  ) {
    throw new Error(
      "Provide at least one of: feedbackCategory, tags, or comment (min 3 characters)."
    );
  }

  const maxBytes = input.maxBytes ?? Number(process.env.FEEDBACK_MAX_IMAGE_BYTES ?? DEFAULT_MAX);
  if (buffer.length > maxBytes) {
    throw new Error(
      `Image too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`
    );
  }

  const ext = mimeToTrainingImageExt(mimeType);
  const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const local = await saveFeedbackImageLocal(buffer, ext, { filenameBase: id });

  const classFolder = resolvePlantVillageClassFolderName(
    feedbackCategory,
    feedbackTags
  );
  const pv = await writeFeedbackImageToPlantVillageLayout({
    buffer,
    ext,
    feedbackId: id,
    classFolder
  });
  const plantvillageDatasetRelpath = pv?.relpath ?? null;

  return insertFeedbackIngest({
    id,
    userUid,
    ownerEmail,
    imageUrl: local.imageUrl,
    imageStorageProvider: "local",
    imageStorageKey: local.storageKey,
    imageMimeType: local.mimeType,
    imageBytes: buffer.length,
    feedbackCategory,
    feedbackTags,
    commentText,
    modelPredictionLabel,
    plantvillageDatasetRelpath
  });
}
