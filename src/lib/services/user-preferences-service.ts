import { requirePostgresPool } from "@/lib/db/postgres";

const DEFAULT_PARTICIPATE = true;

/**
 * When true, the user may use feedback/training upload flows. Default: participate (opt-out).
 */
export async function getParticipateMlFeedback(
  ownerEmail: string
): Promise<boolean> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    return DEFAULT_PARTICIPATE;
  }
  const pool = requirePostgresPool();
  const r = await pool.query<{ participate_ml_feedback: boolean }>(
    `SELECT participate_ml_feedback FROM user_preferences WHERE owner_email = $1`,
    [email]
  );
  const row = r.rows[0];
  if (!row) {
    return DEFAULT_PARTICIPATE;
  }
  return row.participate_ml_feedback;
}

export async function setParticipateMlFeedback(
  ownerEmail: string,
  participate: boolean
): Promise<void> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("Missing account email");
  }
  const pool = requirePostgresPool();
  await pool.query(
    `INSERT INTO user_preferences (owner_email, participate_ml_feedback, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (owner_email) DO UPDATE SET
       participate_ml_feedback = EXCLUDED.participate_ml_feedback,
       updated_at = CURRENT_TIMESTAMP`,
    [email, participate]
  );
}
