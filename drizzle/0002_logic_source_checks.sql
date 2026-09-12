CREATE TABLE logic_source_checks (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX idx_logic_source_checks_owner_evidence ON logic_source_checks(owner,evidence_id,checked_at);
