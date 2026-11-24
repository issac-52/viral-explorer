-- Nullable so the previous Worker keeps inserting rows during a deploy.
ALTER TABLE analyses ADD COLUMN ai TEXT;
