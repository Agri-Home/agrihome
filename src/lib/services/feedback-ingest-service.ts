import { requirePostgresPool } from "@/lib/db/postgres";

export interface FeedbackIngestRow {
  id: string;
  userUid: string;
  ownerEmail: string;
  imageUrl: string;
  imageStorageProvider: "local" | "s3";
  imageStorageKey: string | null;
  imageMimeType: string;
  imageBytes: number;
  feedbackCategory: string | null;
  feedbackCrop: string | null;
  feedbackTags: string[];
  commentText: string | null;
  modelPredictionLabel: string | null;
  /** Path under PLANTVILLAGE_FEEDBACK_DATASET_DIR, e.g. Tomato___Early_blight/fb-....jpg */
  plantvillageDatasetRelpath: string | null;
  createdAt: string;
}

export async function insertFeedbackIngest(input: {
  id: string;
  userUid: string;
  ownerEmail: string;
  imageUrl: string;
  imageStorageProvider: "local" | "s3";
  imageStorageKey: string | null;
  imageMimeType: string;
  imageBytes: number;
  feedbackCategory: string | null;
  feedbackCrop: string | null;
  feedbackTags: string[];
  commentText: string | null;
  modelPredictionLabel: string | null;
  plantvillageDatasetRelpath?: string | null;
}): Promise<FeedbackIngestRow> {
  const pool = requirePostgresPool();

  const res = await pool.query<{
    id: string;
    user_uid: string;
    owner_email: string;
    image_url: string;
    image_storage_provider: string;
    image_storage_key: string | null;
    image_mime_type: string;
    image_bytes: number;
    feedback_category: string | null;
    feedback_crop: string | null;
    feedback_tags: string[] | unknown;
    comment_text: string | null;
    model_prediction_label: string | null;
    plantvillage_dataset_relpath: string | null;
    created_at: Date;
  }>(
    `INSERT INTO feedback_ingest (
       id, user_uid, owner_email, image_url, image_storage_provider, image_storage_key,
       image_mime_type, image_bytes, feedback_category, feedback_crop, feedback_tags, comment_text,
       model_prediction_label, plantvillage_dataset_relpath
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::json,$12,$13,$14)
     RETURNING id, user_uid, owner_email, image_url, image_storage_provider, image_storage_key,
               image_mime_type, image_bytes, feedback_category, feedback_crop, feedback_tags, comment_text,
               model_prediction_label, plantvillage_dataset_relpath, created_at`,
    [
      input.id,
      input.userUid,
      input.ownerEmail,
      input.imageUrl,
      input.imageStorageProvider,
      input.imageStorageKey,
      input.imageMimeType,
      input.imageBytes,
      input.feedbackCategory,
      input.feedbackCrop,
      JSON.stringify(input.feedbackTags),
      input.commentText,
      input.modelPredictionLabel,
      input.plantvillageDatasetRelpath ?? null
    ]
  );

  const r = res.rows[0];
  if (!r) {
    throw new Error("Insert did not return a row");
  }

  const tags = Array.isArray(r.feedback_tags)
    ? (r.feedback_tags as string[])
    : typeof r.feedback_tags === "string"
      ? (JSON.parse(r.feedback_tags) as string[])
      : [];

  return {
    id: r.id,
    userUid: r.user_uid,
    ownerEmail: r.owner_email,
    imageUrl: r.image_url,
    imageStorageProvider: r.image_storage_provider as "local" | "s3",
    imageStorageKey: r.image_storage_key,
    imageMimeType: r.image_mime_type,
    imageBytes: Number(r.image_bytes),
    feedbackCategory: r.feedback_category,
    feedbackCrop: r.feedback_crop ?? null,
    feedbackTags: tags,
    commentText: r.comment_text,
    modelPredictionLabel: r.model_prediction_label,
    plantvillageDatasetRelpath: r.plantvillage_dataset_relpath ?? null,
    createdAt: new Date(r.created_at).toISOString()
  };
}
