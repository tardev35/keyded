import { runSearch, runBulkSearch } from "../services/search.js";
import { queueStatus } from "../services/queue.js";
import {
  LOCATIONS,
  LANGUAGES,
  DEFAULT_LOCATION,
  DEFAULT_LANGUAGE,
  isKnownLocation,
  isKnownLanguage,
} from "../config/markets.js";

export async function search(req, res, next) {
  try {
    const keyword = req.body?.keyword;
    const locationCode = Number(req.body?.locationCode ?? DEFAULT_LOCATION);
    const languageCode = String(req.body?.languageCode ?? DEFAULT_LANGUAGE);

    if (!isKnownLocation(locationCode)) return res.status(400).json({ error: "ยังไม่รองรับประเทศนี้" });
    if (!isKnownLanguage(languageCode)) return res.status(400).json({ error: "ยังไม่รองรับภาษานี้" });

    const result = await runSearch({ user: req.user, keyword, locationCode, languageCode });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkSearch(req, res, next) {
  try {
    const body = req.body || {};
    const raw = Array.isArray(body.keywords)
      ? body.keywords
      : String(body.keywords || "").split(/[\r\n,]+/);
    const keywords = raw.map((k) => String(k).trim()).filter(Boolean);

    const locationCode = Number(body.locationCode ?? DEFAULT_LOCATION);
    const languageCode = String(body.languageCode ?? DEFAULT_LANGUAGE);
    if (!isKnownLocation(locationCode)) return res.status(400).json({ error: "ยังไม่รองรับประเทศนี้" });
    if (!isKnownLanguage(languageCode)) return res.status(400).json({ error: "ยังไม่รองรับภาษานี้" });
    if (!keywords.length) return res.status(400).json({ error: "กรุณากรอกคำค้นหาอย่างน้อยหนึ่งคำ" });

    const result = await runBulkSearch({ user: req.user, keywords, locationCode, languageCode });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export function markets(req, res) {
  return res.json({
    locations: LOCATIONS,
    languages: LANGUAGES,
    defaultLocation: DEFAULT_LOCATION,
    defaultLanguage: DEFAULT_LANGUAGE,
  });
}

export function status(req, res) {
  return res.json(queueStatus());
}
