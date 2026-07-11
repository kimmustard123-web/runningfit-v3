"use strict";

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

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
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

function toLegacyShoe(row) {
  const raw = row && typeof row.raw_data === "object" && row.raw_data ? row.raw_data : {};
  const scores = {
    firstRunning: numberOrZero(row.score_beginner),
    dailyRunning: numberOrZero(row.score_daily),
    training: numberOrZero(row.score_training),
    race: numberOrZero(row.score_race)
  };

  const aliases = Array.isArray(row.aliases) ? row.aliases : [];
  const purpose = Array.isArray(row.purpose) ? row.purpose : [];

  return {
    ...raw,
    id: raw.id || row.slug,
    brand: raw.brand || row.brand,
    modelEn: raw.modelEn || row.model_name,
    modelKo: raw.modelKo || row.model_name_ko || row.model_name,
    carbonPlate: raw.carbonPlate ?? Boolean(row.carbon_plate),
    plateType: raw.plateType || row.plate_type || (row.carbon_plate ? "carbon" : "none"),
    search: raw.search || {
      ko: [row.model_name_ko, row.brand].filter(Boolean),
      en: [row.model_name, row.brand].filter(Boolean),
      aliases
    },
    source: raw.source || {
      primary: row.source_name || "RunningFit DB",
      url: row.official_url || "",
      checkedAt: row.source_checked_at || null
    },
    specs: raw.specs || {
      weightG: numberOrNull(row.weight_g),
      heelStackMm: numberOrNull(row.heel_stack_mm),
      forefootStackMm: numberOrNull(row.forefoot_stack_mm),
      dropMm: numberOrNull(row.drop_mm),
      width: row.width_fit || null,
      toeBoxHeight: row.toe_box_height || null,
      heelSupport: row.heel_support || null
    },
    runningFit: raw.runningFit || {
      primary: row.category || purpose[0] || "daily",
      scores
    },
    runningFitDerived: raw.runningFitDerived || undefined,
    detail: {
      ...(raw.detail || {}),
      description: row.description || raw.detail?.description || "",
      pros: Array.isArray(row.pros) && row.pros.length ? row.pros : (raw.detail?.pros || []),
      cons: Array.isArray(row.cons) && row.cons.length ? row.cons : (raw.detail?.cons || [])
    },
    purchase: raw.purchase || {},
    image: raw.image || {
      src: row.image_url || "",
      alt: row.image_alt || `${row.brand || ""} ${row.model_name_ko || row.model_name || "러닝화"}`,
      type: "ai-generated"
    }
  };
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
