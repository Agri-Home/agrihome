import { requirePostgresPool } from "@/lib/db/postgres";

const DEFAULT_PARTICIPATE = true;
const DEFAULT_DEVELOPER_MODE = false;

export type UserPreferences = {
  participateMlFeedback: boolean;
  developerMode: boolean;
};

/**
 * When true, the user may use feedback/training upload flows. Default: participate (opt-out).
 */
export async function getParticipateMlFeedback(
  ownerEmail: string
): Promise<boolean> {
  const prefs = await getUserPreferences(ownerEmail);
  return prefs.participateMlFeedback;
}

export async function getDeveloperMode(ownerEmail: string): Promise<boolean> {
  const prefs = await getUserPreferences(ownerEmail);
  return prefs.developerMode;
}

export async function getUserPreferences(
  ownerEmail: string
): Promise<UserPreferences> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    return {
      participateMlFeedback: DEFAULT_PARTICIPATE,
      developerMode: DEFAULT_DEVELOPER_MODE
    };
  }
  const pool = requirePostgresPool();
  const r = await pool.query<{
    participate_ml_feedback: boolean;
    developer_mode: boolean | null;
  }>(
    `SELECT participate_ml_feedback, developer_mode
     FROM user_preferences WHERE owner_email = $1`,
    [email]
  );
  const row = r.rows[0];
  if (!row) {
    return {
      participateMlFeedback: DEFAULT_PARTICIPATE,
      developerMode: DEFAULT_DEVELOPER_MODE
    };
  }
  return {
    participateMlFeedback: row.participate_ml_feedback,
    developerMode: Boolean(row.developer_mode)
  };
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

export async function setDeveloperMode(
  ownerEmail: string,
  developerMode: boolean
): Promise<void> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("Missing account email");
  }
  const pool = requirePostgresPool();
  await pool.query(
    `INSERT INTO user_preferences (owner_email, developer_mode, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (owner_email) DO UPDATE SET
       developer_mode = EXCLUDED.developer_mode,
       updated_at = CURRENT_TIMESTAMP`,
    [email, developerMode]
  );
}

export async function setUserPreferences(
  ownerEmail: string,
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const email = ownerEmail.trim().toLowerCase();
  if (!email) {
    throw new Error("Missing account email");
  }
  if (patch.participateMlFeedback !== undefined) {
    await setParticipateMlFeedback(email, patch.participateMlFeedback);
  }
  if (patch.developerMode !== undefined) {
    await setDeveloperMode(email, patch.developerMode);
  }
  return getUserPreferences(email);
}
