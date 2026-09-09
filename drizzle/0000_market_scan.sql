CREATE TABLE IF NOT EXISTS market_scan (
  date TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  listings TEXT NOT NULL,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0
);
