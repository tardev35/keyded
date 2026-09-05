ALTER TABLE keyword_cache ADD COLUMN latest_month DATE;

CREATE INDEX keyword_cache_watermark_idx
  ON keyword_cache (location_code, language_code, latest_month DESC);
