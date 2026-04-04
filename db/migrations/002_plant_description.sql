-- Optional: run on existing DBs that already applied schema.sql before description existed.
ALTER TABLE plants ADD COLUMN IF NOT EXISTS description TEXT NULL;
