const AutoApplyRegistry = require("../schemas/AutoApplyRegistrySchema");
const Daycare = require("../schemas/DaycareSchema");

const CACHE_MS = 5 * 60 * 1000;
let cache = { ids: null, at: 0 };

function toStringSafe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizePart(value) {
  return toStringSafe(value)
    .replace(/[\u00a0\u202f\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function buildKey(record) {
  return [record.name, record.city, record.region].map(normalizePart).join("|");
}

/**
 * Resolve daycares_master _id values that correspond to auto_apply rows with status Done.
 * Match: name + city + region, with name-only fallback for known Excel city typos.
 */
async function resolveAutoApplyDaycareIds() {
  if (cache.ids && Date.now() - cache.at < CACHE_MS) {
    return cache.ids;
  }

  const [autoRows, masterRows] = await Promise.all([
    AutoApplyRegistry.find({ status: /^done$/i })
      .select("name city region status")
      .lean(),
    Daycare.find().select("name city region").lean(),
  ]);

  const byExact = new Map();
  const byName = new Map();

  for (const daycare of masterRows) {
    const record = {
      name: toStringSafe(daycare.name),
      city: toStringSafe(daycare.city),
      region: toStringSafe(daycare.region),
    };
    const exactKey = buildKey(record);
    if (!byExact.has(exactKey)) byExact.set(exactKey, daycare);

    const nameKey = normalizePart(record.name);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(daycare);
  }

  const ids = new Set();

  for (const row of autoRows) {
    const record = {
      name: toStringSafe(row.name),
      city: toStringSafe(row.city),
      region: toStringSafe(row.region),
    };

    let hit = byExact.get(buildKey(record));
    if (!hit) {
      const nameHits = byName.get(normalizePart(record.name)) || [];
      if (nameHits.length > 0) hit = nameHits[0];
    }

    if (hit?._id) ids.add(String(hit._id));
  }

  cache = { ids: [...ids], at: Date.now() };
  return cache.ids;
}

function invalidateAutoApplyDaycareCache() {
  cache = { ids: null, at: 0 };
}

module.exports = {
  resolveAutoApplyDaycareIds,
  invalidateAutoApplyDaycareCache,
};
