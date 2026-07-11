"use strict";

const fs = require("fs");
const path = require("path");

let baselineMapCache = null;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "GET 요청만 지원합니다." });
    return;
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");

  if (!supabaseUrl || !publishableKey) {
    res.status(500).json({
      error: "Supabase 환경변수가 설정되지 않았습니다.",
      required: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"]
    });
    return;
  }

  try {
    const endpoint = new URL(`${supabaseUrl}/rest/v1/shoes`);
    endpoint.searchParams.set("select", "*");
    endpoint.searchParams.set("status", "eq.published");
    endpoint.searchParams.set("order", "brand.asc,model_name.asc");

    const response = await fetch(endpoint, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json"
      }
    });

    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase HTTP ${response.status}: ${bodyText.slice(0, 240)}`);
    }

    const rows = JSON.parse(bodyText);
    const shoes = Array.isArray(rows) ? rows.map(toLegacyShoe) : [];

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.status(200).json({
      source: "supabase",
      count: shoes.length,
      shoes
    });
  } catch (error) {
    console.error("shoes api error", error);
    res.status(502).json({
      error: "Supabase에서 러닝화 데이터를 불러오지 못했습니다.",
      detail: String(error?.message || error || "알 수 없는 오류").slice(0, 300)
    });
  }
};

function getBaselineMap() {
  if (baselineMapCache) return baselineMapCache;
  try {
    const filePath = path.join(process.cwd(), "data", "shoes.json");
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.shoes) ? parsed.shoes : []);
    baselineMapCache = new Map(rows.map((shoe) => [String(shoe.id || shoe.slug || ""), shoe]));
  } catch (error) {
    console.warn("baseline shoes.json load failed", error);
    baselineMapCache = new Map();
  }
  return baselineMapCache;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toLegacyShoe(row) {
  const dbRaw = row && typeof row.raw_data === "object" && row.raw_data ? row.raw_data : {};
  const baseline = getBaselineMap().get(String(row.slug || dbRaw.id || "")) || {};
  const raw = deepMerge(baseline, dbRaw);

  const baselineScores = raw.runningFit?.scores || raw.runningFitDerived?.scores || {};
  const scores = {
    firstRunning: numberOrFallback(row.score_beginner, baselineScores.firstRunning),
    dailyRunning: numberOrFallback(row.score_daily, baselineScores.dailyRunning),
    training: numberOrFallback(row.score_training, baselineScores.training),
    race: numberOrFallback(row.score_race, baselineScores.race)
  };

  const aliases = Array.isArray(row.aliases) && row.aliases.length ? row.aliases : (raw.search?.aliases || []);
  const purpose = Array.isArray(row.purpose) && row.purpose.length ? row.purpose : [];
  const category = firstDefined(row.category, raw.runningFit?.primary, raw.runningFitDerived?.primaryUse, purpose[0], "daily");

  const specs = {
    ...(raw.specs || {}),
    weightG: numberOrFallback(row.weight_g, raw.specs?.weightG ?? raw.detail?.specs?.weightG),
    heelStackMm: numberOrFallback(row.heel_stack_mm, raw.specs?.heelStackMm ?? raw.detail?.specs?.heelStackMm),
    forefootStackMm: numberOrFallback(row.forefoot_stack_mm, raw.specs?.forefootStackMm ?? raw.detail?.specs?.forefootStackMm),
    dropMm: numberOrFallback(row.drop_mm, raw.specs?.dropMm ?? raw.detail?.specs?.dropMm),
    width: firstDefined(row.width_fit, raw.specs?.width, raw.detail?.specs?.widthFit),
    toeBoxHeight: firstDefined(row.toe_box_height, raw.specs?.toeBoxHeight, raw.detail?.specs?.toeBoxHeight),
    heelSupport: firstDefined(row.heel_support, raw.specs?.heelSupport, raw.detail?.specs?.heelSupport)
  };

  const detail = {
    ...(raw.detail || {}),
    description: firstDefined(row.description, raw.detail?.description, raw.detail?.summary, ""),
    pros: Array.isArray(row.pros) && row.pros.length ? row.pros : (raw.detail?.pros || []),
    cons: Array.isArray(row.cons) && row.cons.length ? row.cons : (raw.detail?.cons || []),
    specs: {
      ...(raw.detail?.specs || {}),
      weightG: specs.weightG,
      heelStackMm: specs.heelStackMm,
      forefootStackMm: specs.forefootStackMm,
      dropMm: specs.dropMm,
      widthFit: specs.width,
      toeBoxHeight: specs.toeBoxHeight,
      heelSupport: specs.heelSupport
    }
  };

  const runningFit = {
    ...(raw.runningFit || {}),
    primary: category,
    scores
  };
  const runningFitDerived = raw.runningFitDerived ? {
    ...raw.runningFitDerived,
    primaryUse: category,
    scores,
    recommendation13: {
      ...(raw.runningFitDerived.recommendation13 || {}),
      purpose: scores
    }
  } : undefined;

  return {
    ...raw,
    id: row.slug || raw.id,
    brand: firstDefined(row.brand, raw.brand, ""),
    modelEn: firstDefined(row.model_name, raw.modelEn, ""),
    modelKo: firstDefined(row.model_name_ko, raw.modelKo, row.model_name, ""),
    carbonPlate: row.carbon_plate == null ? Boolean(raw.carbonPlate) : Boolean(row.carbon_plate),
    plateType: firstDefined(row.plate_type, raw.plateType, row.carbon_plate ? "carbon" : "none"),
    search: {
      ...(raw.search || {}),
      ko: [row.model_name_ko, row.brand, ...(raw.search?.ko || [])].filter(Boolean),
      en: [row.model_name, row.brand, ...(raw.search?.en || [])].filter(Boolean),
      aliases
    },
    source: {
      ...(raw.source || {}),
      primary: "RunningFit",
      url: firstDefined(row.official_url, raw.source?.url, ""),
      checkedAt: firstDefined(row.source_checked_at, raw.source?.checkedAt, null)
    },
    specs,
    runningFit,
    runningFitDerived,
    detail,
    purchase: raw.purchase || {},
    image: {
      ...(raw.image || {}),
      src: firstDefined(row.image_url, raw.image?.src, ""),
      alt: firstDefined(row.image_alt, raw.image?.alt, `${row.brand || raw.brand || ""} ${row.model_name_ko || row.model_name || raw.modelKo || raw.modelEn || "러닝화"}`)
    }
  };
}

function deepMerge(base, override) {
  if (!base || typeof base !== "object" || Array.isArray(base)) return override;
  if (!override || typeof override !== "object" || Array.isArray(override)) return override === undefined ? base : override;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function numberOrFallback(value, fallback) {
  if (value !== null && value !== undefined && value !== "") {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : null;
}
