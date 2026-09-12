CREATE TABLE logic_evidence (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  thesis_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  body TEXT NOT NULL,
  UNIQUE(owner, thesis_id, revision)
);
