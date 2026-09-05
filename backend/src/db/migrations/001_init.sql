CREATE TABLE users (
  id               BIGSERIAL PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  name             TEXT,
  role             TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('admin', 'free', 'paid')),
  credits_daily    INTEGER NOT NULL DEFAULT 5,
  credits_left     INTEGER NOT NULL DEFAULT 5,
  credits_reset_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ,
  disabled_at      TIMESTAMPTZ
);

CREATE TABLE subscriptions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  price      NUMERIC(10, 2),
  note       TEXT
);

CREATE INDEX subscriptions_user_idx ON subscriptions (user_id, status);

CREATE TABLE search_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  keyword       TEXT NOT NULL,
  location_code INTEGER NOT NULL,
  language_code TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN (
                  'ok', 'cached', 'api_error', 'quota_exceeded',
                  'timeout', 'invalid_keyword', 'throttled')),
  credits_used  INTEGER NOT NULL DEFAULT 0,
  result_count  INTEGER,
  duration_ms   INTEGER,
  api_cost      NUMERIC(10, 4),
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX search_logs_user_idx ON search_logs (user_id, created_at DESC);
CREATE INDEX search_logs_status_idx ON search_logs (status, created_at DESC);

CREATE TABLE keyword_cache (
  id            BIGSERIAL PRIMARY KEY,
  keyword       TEXT NOT NULL,
  location_code INTEGER NOT NULL,
  language_code TEXT NOT NULL,
  payload       JSONB NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword, location_code, language_code)
);

CREATE INDEX keyword_cache_fetched_idx ON keyword_cache (fetched_at DESC);
