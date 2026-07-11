"use strict";

const { requireAdmin, missingConfig, supabaseRequest } = require("./_admin-auth");

module.exports = async function handler(req, res) {
  const missing = missingConfig();
  if (missing.length) {
    res.status(503).json({ error: "관리자 서버 설정이 끝나지 않았습니다.", missing });
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const rows = await supabaseRequest("shoes?select=*&order=brand.asc,model_name.asc", { method: "GET" });
      res.status(200).json({ count: Array.isArray(rows) ? rows.length : 0, shoes: rows || [] });
      return;
    }

    if (req.method === "POST") {
      const row = sanitizeShoe(req.body || {});
      if (!row.slug || !row.brand || !row.model_name) {
        res.status(400).json({ error: "slug, 브랜드, 영문 모델명은 필수입니다." });
        return;
      }
      const created = await supabaseRequest("shoes", { method: "POST", body: JSON.stringify(row) });
      res.status(201).json({ shoe: Array.isArray(created) ? created[0] : created });
      return;
    }

    if (req.method === "PUT") {
      const slug = String(req.query.slug || req.body?.slug || "").trim();
      if (!slug) {
        res.status(400).json({ error: "수정할 slug가 필요합니다." });
        return;
      }
      const row = sanitizeShoe(req.body || {});
      delete row.slug;
      const updated = await supabaseRequest(`shoes?slug=eq.${encodeURIComponent(slug)}`, { method: "PATCH", body: JSON.stringify(row) });
      res.status(200).json({ shoe: Array.isArray(updated) ? updated[0] : updated });
      return;
    }

    if (req.method === "DELETE") {
      const slug = String(req.query.slug || "").trim();
      if (!slug) {
        res.status(400).json({ error: "삭제할 slug가 필요합니다." });
        return;
      }
      await supabaseRequest(`shoes?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE" });
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    res.status(405).json({ error: "지원하지 않는 요청입니다." });
  } catch (error) {
    console.error("admin-shoes error", error);
    res.status(error.status || 500).json({ error: error.message || "관리자 DB 요청 실패" });
  }
};

function sanitizeShoe(input) {
  const score = (value) => clampNumber(value, 0, 100, 0);
  const nullableNumber = (value) => value === "" || value == null ? null : Number(value);
  const aliases = arrayValue(input.aliases);
  const purpose = arrayValue(input.purpose);
  const status = ["draft", "published", "hidden", "archived"].includes(input.status) ? input.status : "published";
  const row = {
    slug: String(input.slug || "").trim(),
    brand: String(input.brand || "").trim(),
    model_name: String(input.model_name || "").trim(),
    model_name_ko: String(input.model_name_ko || "").trim() || null,
    aliases,
    category: String(input.category || "daily").trim(),
    purpose,
    price: nullableNumber(input.price),
    weight_g: nullableNumber(input.weight_g),
    drop_mm: nullableNumber(input.drop_mm),
    carbon_plate: Boolean(input.carbon_plate),
    image_url: String(input.image_url || "").trim() || null,
    image_alt: String(input.image_alt || "").trim() || null,
    score_beginner: score(input.score_beginner),
    score_daily: score(input.score_daily),
    score_training: score(input.score_training),
    score_race: score(input.score_race),
    description: String(input.description || "").trim() || null,
    pros: arrayValue(input.pros),
    cons: arrayValue(input.cons),
    official_url: String(input.official_url || "").trim() || null,
    status,
    plate_type: String(input.plate_type || (input.carbon_plate ? "carbon" : "none")).trim(),
    heel_stack_mm: nullableNumber(input.heel_stack_mm),
    forefoot_stack_mm: nullableNumber(input.forefoot_stack_mm),
    width_fit: String(input.width_fit || "").trim() || null,
    toe_box_height: String(input.toe_box_height || "").trim() || null,
    heel_support: String(input.heel_support || "").trim() || null,
    source_name: String(input.source_name || "RunningFit Admin").trim(),
    source_checked_at: input.source_checked_at || null,
    updated_at: new Date().toISOString()
  };
  row.raw_data = buildRawData(row, input);
  return row;
}

function buildRawData(row, input) {
  const previous = input?.raw_data && typeof input.raw_data === "object" ? input.raw_data : {};
  const previousDetail = previous.detail && typeof previous.detail === "object" ? previous.detail : {};
  const previousPurchase = previous.purchase && typeof previous.purchase === "object" ? previous.purchase : {};
  return {
    ...previous,
    id: row.slug,
    brand: row.brand,
    modelEn: row.model_name,
    modelKo: row.model_name_ko || row.model_name,
    carbonPlate: row.carbon_plate,
    plateType: row.plate_type,
    search: { ko: [row.model_name_ko, row.brand].filter(Boolean), en: [row.model_name, row.brand].filter(Boolean), aliases: row.aliases },
    source: { primary: "RunningFit 리서치", url: "", checkedAt: row.source_checked_at },
    specs: { weightG: row.weight_g, heelStackMm: row.heel_stack_mm, forefootStackMm: row.forefoot_stack_mm, dropMm: row.drop_mm, width: row.width_fit, toeBoxHeight: row.toe_box_height, heelSupport: row.heel_support },
    runningFit: { primary: row.category, scores: { firstRunning: row.score_beginner, dailyRunning: row.score_daily, training: row.score_training, race: row.score_race } },
    detail: {
      ...previousDetail,
      summary: String(input.summary || previousDetail.summary || "").trim(),
      description: row.description || previousDetail.description || "",
      pros: row.pros,
      cons: row.cons,
      recommendedFor: String(input.recommended_for || previousDetail.recommendedFor || "").trim(),
      recommendedDistances: arrayValue(input.recommended_distances || previousDetail.recommendedDistances),
      recommendedTraining: String(input.recommended_training || previousDetail.recommendedTraining || "").trim(),
      sizeAdvice: String(input.size_advice || previousDetail.sizeAdvice || "").trim(),
      specs: { weightG: row.weight_g, heelStackMm: row.heel_stack_mm, forefootStackMm: row.forefoot_stack_mm, dropMm: row.drop_mm, widthFit: row.width_fit, toeBoxHeight: row.toe_box_height, heelSupport: row.heel_support }
    },
    purchase: {
      ...previousPurchase,
      officialStoreUrl: String(input.purchase_url || previousPurchase.officialStoreUrl || "").trim(),
      brandStoreUrl: String(input.brand_store_url || previousPurchase.brandStoreUrl || "").trim(),
      status: ["available", "sold_out", "discontinued", "hidden"].includes(input.purchase_status) ? input.purchase_status : (previousPurchase.status || "available"),
      checkedAt: new Date().toISOString().slice(0, 10),
      label: "공식 스토어에서 제품 보기"
    },
    image: { src: row.image_url || "", alt: row.image_alt || `${row.brand} ${row.model_name_ko || row.model_name}`, type: "ai-generated" }
  };
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  return String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
