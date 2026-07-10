"use strict";

const SHOES_DATA_PATH = "./data/shoes.json";

let allShoes = [];
let visibleShoes = [];
let activeMode = "beginner";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindNavigation();
  bindTabs();

  try {
    const response = await fetch(SHOES_DATA_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`shoes.json 로드 실패: ${response.status}`);

    const payload = await response.json();
    allShoes = Array.isArray(payload) ? payload : Array.isArray(payload.shoes) ? payload.shoes : [];

    if (!allShoes.length) throw new Error("신발 데이터가 비어 있습니다.");

    allShoes = allShoes.map(normalizeShoe);
    visibleShoes = [...allShoes];

    populateBrandSelects();
    bindBrowse();
    bindBeginner();
    bindAdvanced();
    renderCards(sortByScore(allShoes, "dailyRunning"));
    updateResultCount(allShoes.length);
  } catch (error) {
    console.error(error);
    showLoadError(error.message);
  }
}

function normalizeShoe(raw) {
  const derived = raw.runningFitDerived || raw.runningFit || {};
  const scores = derived.scores || {};
  const rec = derived.recommendation13 || {};
  const rr = raw.runRepeatRaw || raw.runRepeat || {};
  const specs = raw.specs || {};
  const search = raw.search || {};

  const purpose = rec.purpose || scores;
  const distance = rec.distance || derived.distanceFit || {};

  return {
    ...raw,
    brand: raw.brand || "-",
    modelEn: raw.modelEn || raw.model || raw.name || "-",
    modelKo: raw.modelKo || raw.modelKr || raw.modelEn || raw.model || "-",
    carbonPlate: Boolean(raw.carbonPlate),
    plateType: raw.plateType || "none",
    searchText: buildSearchText(raw, search),
    scores: {
      firstRunning: safeNumber(purpose.firstRunning ?? scores.firstRunning),
      dailyRunning: safeNumber(purpose.dailyRunning ?? scores.dailyRunning),
      training: safeNumber(purpose.training ?? scores.training),
      race: safeNumber(purpose.race ?? scores.race)
    },
    distanceFit: {
      "5K": safeNumber(distance["5K"] ?? distance["5k"]),
      "10K": safeNumber(distance["10K"] ?? distance["10k"]),
      half: safeNumber(distance.half),
      full: safeNumber(distance.full)
    },
    rec: {
      gender: rec.gender || ["men", "women"],
      weightSupport: rec.weightSupport || {},
      sizeFit: rec.sizeFit ?? rr.sizeFit ?? null,
      widthFit: rec.widthFit ?? rr.widthFit ?? specs.widthFit ?? null,
      toeBoxHeight: rec.toeBoxHeight ?? rr.toeBoxHeight ?? rr.toeBoxHeightClass ?? null,
      heelSupport: rec.heelSupport ?? rr.heelSupport ?? rr.heelSupportClass ?? null,
      pain: rec.painConsideration || {},
      carbonPreference: rec.carbonPreference || (raw.carbonPlate ? "carbon" : "non_carbon"),
      strikeFit: rec.strikeFit || {},
      budgetTier: rec.budgetTier || getBudgetTier(rr.priceUsd),
      brand: rec.brand || raw.brand
    },
    priceUsd: safeNumber(rr.priceUsd),
    weightG: safeNumber(rr.weightG),
    dropMm: safeNumber(rr.dropMm),
    heelStackMm: safeNumber(rr.heelStackMm),
    forefootStackMm: safeNumber(rr.forefootStackMm),
    sourceUrl: raw.source?.url || rr.url || "",
    notes: Array.isArray(rr.notes) ? rr.notes : [],
    primaryUse: derived.primaryUse || derived.primary || raw.runningFit?.primary || "daily"
  };
}

function buildSearchText(raw, search) {
  const values = [
    raw.brand,
    raw.modelEn,
    raw.modelKo,
    ...(Array.isArray(search.ko) ? search.ko : []),
    ...(Array.isArray(search.en) ? search.en : []),
    ...(Array.isArray(search.aliases) ? search.aliases : []),
    ...(Array.isArray(search.alias) ? search.alias : [])
  ].filter(Boolean);

  const joined = values.join(" ").toLowerCase();
  return `${joined} ${getChosung(joined)}`;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getBudgetTier(priceUsd) {
  if (!priceUsd) return null;
  if (priceUsd >= 190) return "premium";
  if (priceUsd >= 150) return "high";
  return "mid";
}

function bindNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  toggle?.addEventListener("click", () => nav?.classList.toggle("open"));

  const themeToggle = document.querySelector("#themeToggle");
  const savedTheme = localStorage.getItem("rf-theme");
  if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";

  themeToggle?.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("rf-theme", isDark ? "light" : "dark");
  });
}

function bindTabs() {
  const buttons = [...document.querySelectorAll("[data-reco-tab]")];
  const panels = [...document.querySelectorAll("[data-reco-panel]")];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      activeMode = button.dataset.recoTab;
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.recoPanel === activeMode));

      const sorted = activeMode === "beginner"
        ? sortByScore(allShoes, "firstRunning")
        : activeMode === "advanced"
          ? sortByScore(allShoes, "dailyRunning")
          : [...allShoes];

      renderCards(sorted);
      updateResultCount(sorted.length);
      updateSummary("");
    });
  });
}

function populateBrandSelects() {
  const brands = [...new Set(allShoes.map((shoe) => shoe.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  document.querySelectorAll('select[name="brand"]').forEach((select) => {
    const current = select.value;
    const first = select.querySelector("option")?.outerHTML || '<option value="">전체</option>';
    select.innerHTML = first + brands.map((brand) => `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`).join("");
    select.value = current;
  });
}

function bindBrowse() {
  const form = document.querySelector("[data-shoe-filter]");
  if (!form) return;

  const apply = () => {
    const data = new FormData(form);
    const query = String(data.get("q") || "").trim().toLowerCase();
    const queryChosung = getChosung(query);
    const brand = String(data.get("brand") || "");
    const budget = String(data.get("budget") || "");

    const filtered = allShoes.filter((shoe) => {
      const matchQuery = !query || shoe.searchText.includes(query) || shoe.searchText.includes(queryChosung);
      const matchBrand = !brand || shoe.brand === brand;
      const matchBudget = !budget || matchesBudget(shoe, budget);
      return matchQuery && matchBrand && matchBudget;
    });

    visibleShoes = filtered;
    renderCards(filtered);
    updateResultCount(filtered.length);
    updateSummary(query ? `“${escapeHtml(query)}” 검색 결과 ${filtered.length}개` : "");
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  form.addEventListener("input", apply);
  form.addEventListener("reset", () => setTimeout(() => {
    visibleShoes = [...allShoes];
    renderCards(visibleShoes);
    updateResultCount(visibleShoes.length);
    updateSummary("");
  }));
}

function bindBeginner() {
  const form = document.querySelector("[data-beginner-form]");
  if (!form) return;

  const weightSelect = form.querySelector("[data-weight-range]");
  if (weightSelect && !weightSelect.options.length) {
    weightSelect.innerHTML = `
      <option value="light">70kg 미만</option>
      <option value="normal" selected>70~90kg</option>
      <option value="heavy">90kg 이상</option>
    `;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    const results = allShoes
      .map((shoe) => scoreBeginner(shoe, data))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    renderCards(results, true);
    updateResultCount(results.length);
    updateSummary("첫 러닝화 추천 TOP10");
  });
}

function scoreBeginner(shoe, answers) {
  let total = shoe.scores.firstRunning ?? shoe.scores.dailyRunning ?? 50;
  const reasons = [];

  const widthValue = normalizeWidthAnswer(answers.width);
  const shoeWidth = normalizeWidth(shoe.rec.widthFit);
  if (widthValue && shoeWidth) {
    if (widthValue === shoeWidth) {
      total += 8;
      reasons.push("선택한 발볼과 잘 맞음");
    } else if (widthValue === "normal") {
      total += 3;
    } else {
      total -= 6;
    }
  }

  const weightKey = beginnerWeightKey(answers.weightRange);
  const weightScore = safeNumber(shoe.rec.weightSupport?.[weightKey]);
  if (weightScore !== null) {
    total += (weightScore - 50) * 0.15;
    if (weightScore >= 85) reasons.push("체중 구간 적합도가 높음");
  }

  if (!shoe.carbonPlate) {
    total += 4;
    reasons.push("첫 러닝화에 부담이 적은 비카본 구조");
  }

  if (matchesBudget(shoe, answers.budget)) {
    total += 3;
  } else if (answers.budget) {
    total -= 8;
  }

  return { ...shoe, matchScore: clamp(Math.round(total), 0, 100), matchReasons: reasons };
}

function beginnerWeightKey(value) {
  if (["under50", "50to60", "60to70", "light"].includes(value)) return "light";
  if (["90to100", "100to110", "over110", "heavy"].includes(value)) return "heavy";
  return "normal";
}

function bindAdvanced() {
  const form = document.querySelector("[data-advanced-form]");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const answers = Object.fromEntries(new FormData(form).entries());

    const results = allShoes
      .map((shoe) => scoreAdvanced(shoe, answers))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    renderCards(results, true);
    updateResultCount(results.length);
    updateSummary(`정밀추천 TOP10 · ${purposeLabel(answers.purpose)} · ${distanceLabel(answers.distance)}`);
  });
}

function scoreAdvanced(shoe, answers) {
  let score = 0;
  let weights = 0;
  const reasons = [];

  const add = (value, weight, reason, threshold = 82) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return;
    score += Number(value) * weight;
    weights += weight;
    if (Number(value) >= threshold && reason) reasons.push(reason);
  };

  add(shoe.scores[answers.purpose], 0.30, `${purposeLabel(answers.purpose)} 적합도가 높음`);
  add(shoe.distanceFit[answers.distance], 0.18, `${distanceLabel(answers.distance)} 사용에 적합`);
  add(getWeightScore(shoe, answers.weightRange), 0.12, "선택한 체중 구간과 잘 맞음");
  add(getWidthScore(shoe, answers.width), 0.10, "발볼 조건과 잘 맞음");
  add(getCategoryMatch(shoe.rec.toeBoxHeight, answers.toeBoxHeight), 0.06, "토박스 높이가 적합");
  add(getCategoryMatch(shoe.rec.heelSupport, answers.heelSupport), 0.06, "뒤꿈치 지지 조건과 적합");
  add(getPainScore(shoe, answers.pain), 0.07, "선택한 통증·고민 조건을 고려");
  add(getStrikeScore(shoe, answers.strike), 0.06, "착지 방식과 적합");
  add(getCarbonScore(shoe, answers.carbonPreference), 0.03, shoe.carbonPlate ? "카본 선호 반영" : "비카본 선호 반영");
  add(getBrandScore(shoe, answers.brand), 0.02, "선호 브랜드 반영");

  let final = weights ? score / weights : 50;

  if (answers.budget) {
    if (matchesBudget(shoe, answers.budget)) {
      final += 3;
      reasons.push("예산 조건 충족");
    } else {
      final -= 10;
    }
  }

  return {
    ...shoe,
    matchScore: clamp(Math.round(final), 0, 100),
    matchReasons: [...new Set(reasons)].slice(0, 5)
  };
}

function getWeightScore(shoe, range) {
  const key = beginnerWeightKey(range);
  return safeNumber(shoe.rec.weightSupport?.[key]) ?? 70;
}

function getWidthScore(shoe, answer) {
  const wanted = normalizeWidthAnswer(answer);
  const actual = normalizeWidth(shoe.rec.widthFit);
  if (!wanted || !actual) return 65;
  if (wanted === actual) return 95;
  if (wanted === "normal" || actual === "normal") return 78;
  return 45;
}

function normalizeWidthAnswer(value) {
  return value === "wide" ? "wide" : value === "narrow" ? "narrow" : "normal";
}

function normalizeWidth(value) {
  if (!value) return null;
  const text = String(value).toLowerCase();
  if (text.includes("wide") || text.includes("넓")) return "wide";
  if (text.includes("narrow") || text.includes("좁")) return "narrow";
  if (text.includes("standard") || text.includes("medium") || text.includes("normal") || text.includes("보통")) return "normal";
  return null;
}

function getCategoryMatch(actual, wanted) {
  if (!wanted || !actual) return 65;
  const normalize = (value) => String(value).toLowerCase()
    .replace("medium", "normal")
    .replace("standard", "normal");
  const a = normalize(actual);
  const w = normalize(wanted);
  return a === w ? 95 : a.includes(w) || w.includes(a) ? 82 : 55;
}

function getPainScore(shoe, pain) {
  if (!pain || pain === "none" || pain === "other" || pain === "shin" || pain === "instep") return 75;
  return safeNumber(shoe.rec.pain?.[pain]) ?? 65;
}

function getStrikeScore(shoe, strike) {
  if (!strike || strike === "unknown") return 75;
  const key = strike === "mid" ? "midfoot" : strike === "fore" ? "forefoot" : "heel";
  return safeNumber(shoe.rec.strikeFit?.[key]) ?? 65;
}

function getCarbonScore(shoe, preference) {
  if (!preference || preference === "any") return 80;
  if (preference === "carbon") return shoe.carbonPlate ? 100 : 20;
  return shoe.carbonPlate ? 20 : 100;
}

function getBrandScore(shoe, brand) {
  if (!brand) return 80;
  return shoe.brand === brand ? 100 : 35;
}

function matchesBudget(shoe, budget) {
  if (!budget) return true;

  const tier = shoe.rec.budgetTier;
  if (!tier && !shoe.priceUsd) return true;

  const approxKrw = shoe.priceUsd ? shoe.priceUsd * 1400 : null;
  if (approxKrw) {
    if (budget === "under100") return approxKrw < 100000;
    if (budget === "100to150") return approxKrw >= 100000 && approxKrw < 150000;
    if (budget === "150to200") return approxKrw >= 150000 && approxKrw < 200000;
    if (budget === "200to250") return approxKrw >= 200000 && approxKrw < 250000;
    if (budget === "over250") return approxKrw >= 250000;
  }

  if (budget === "under100") return tier === "mid";
  if (budget === "100to150") return ["mid", "high"].includes(tier);
  if (budget === "150to200") return ["high", "premium"].includes(tier);
  if (budget === "200to250" || budget === "over250") return tier === "premium";
  return true;
}

function sortByScore(shoes, key) {
  return [...shoes].sort((a, b) => (b.scores[key] ?? -1) - (a.scores[key] ?? -1));
}

function renderCards(shoes, showMatch = false) {
  const grid = document.querySelector("[data-shoe-grid]");
  if (!grid) return;

  if (!shoes.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>조건에 맞는 러닝화가 없습니다.</h3>
        <p>조건을 조금 넓혀 다시 검색해보세요.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = shoes.map((shoe, index) => cardHtml(shoe, index, showMatch)).join("");
}

function cardHtml(shoe, index, showMatch) {
  const score = showMatch ? shoe.matchScore : bestDisplayScore(shoe);
  const scoreLabel = showMatch ? "적합도" : purposeShortLabel(bestPurpose(shoe));
  const reasons = showMatch && shoe.matchReasons?.length
    ? `<ul class="reason-list">${shoe.matchReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
    : "";
  const rank = index < 10 ? `<span class="rank-badge">${index + 1}</span>` : "";

  return `
    <article class="shoe-card">
      <div class="shoe-card-top">
        ${rank}
        <div class="shoe-brand">${escapeHtml(shoe.brand)}</div>
        <div class="score-badge">
          <strong>${score ?? "-"}</strong>
          <span>${scoreLabel}</span>
        </div>
      </div>

      <div class="shoe-visual" aria-hidden="true">
        <span>${escapeHtml(shoe.modelKo.slice(0, 1))}</span>
      </div>

      <div class="shoe-card-body">
        <p class="shoe-category">${primaryUseLabel(shoe.primaryUse)}</p>
        <h3>${escapeHtml(shoe.modelKo)}</h3>
        <p class="shoe-name-en">${escapeHtml(shoe.modelEn)}</p>

        <div class="shoe-tags">
          <span>${shoe.carbonPlate ? "카본" : "비카본"}</span>
          <span>${widthLabel(shoe.rec.widthFit)}</span>
          <span>${heelSupportLabel(shoe.rec.heelSupport)}</span>
        </div>

        ${reasons}

        <div class="mini-scores">
          ${miniScore("첫 러닝화", shoe.scores.firstRunning)}
          ${miniScore("매일 러닝", shoe.scores.dailyRunning)}
          ${miniScore("훈련용", shoe.scores.training)}
          ${miniScore("대회용", shoe.scores.race)}
        </div>

        <button class="btn ghost card-detail-btn" type="button" data-open-shoe="${escapeHtml(shoe.id)}">상세 보기</button>
      </div>
    </article>
  `;
}

function miniScore(label, score) {
  return `<div><span>${label}</span><strong>${score ?? "-"}</strong></div>`;
}

function bestPurpose(shoe) {
  return Object.entries(shoe.scores).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))[0]?.[0] || "dailyRunning";
}

function bestDisplayScore(shoe) {
  const key = bestPurpose(shoe);
  return shoe.scores[key];
}

function purposeShortLabel(key) {
  return {
    firstRunning: "첫 러닝",
    dailyRunning: "매일 러닝",
    training: "훈련",
    race: "대회"
  }[key] || "점수";
}

function purposeLabel(key) {
  return {
    firstRunning: "첫 러닝화",
    dailyRunning: "매일 러닝",
    training: "훈련용",
    race: "대회용"
  }[key] || "추천";
}

function distanceLabel(key) {
  return { "5K": "5K", "10K": "10K", half: "하프", full: "풀" }[key] || key;
}

function primaryUseLabel(value) {
  return {
    beginner: "첫 러닝화",
    firstRunning: "첫 러닝화",
    daily: "매일 러닝",
    easy: "매일 러닝",
    stability: "안정형",
    training: "훈련용",
    super_trainer: "훈련용",
    race: "대회용"
  }[value] || "러닝화";
}

function widthLabel(value) {
  const normalized = normalizeWidth(value);
  return normalized === "wide" ? "넓은 발볼" : normalized === "narrow" ? "좁은 발볼" : normalized === "normal" ? "보통 발볼" : "발볼 정보 없음";
}

function heelSupportLabel(value) {
  if (!value) return "힐 정보 없음";
  const text = String(value).toLowerCase();
  if (text.includes("high") || text.includes("강")) return "힐 지지 강함";
  if (text.includes("low") || text.includes("약")) return "힐 지지 약함";
  return "힐 지지 보통";
}

function updateResultCount(count) {
  const element = document.querySelector("[data-result-count]");
  if (element) element.textContent = `${count}개`;
}

function updateSummary(text) {
  const summary = document.querySelector("[data-recommend-summary]");
  if (!summary) return;
  if (!text) {
    summary.hidden = true;
    summary.innerHTML = "";
    return;
  }
  summary.hidden = false;
  summary.innerHTML = `<strong>${text}</strong><span>RunRepeat 원천 데이터와 RunningFit 분류 점수를 함께 반영했습니다.</span>`;
}

function showLoadError(message) {
  const grid = document.querySelector("[data-shoe-grid]");
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state error-state">
      <h3>신발 데이터를 불러오지 못했습니다.</h3>
      <p>${escapeHtml(message)}</p>
      <p><code>data/shoes.json</code> 위치와 JSON 문법을 확인하세요.</p>
    </div>
  `;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-shoe]");
  if (!button) return;
  const shoe = allShoes.find((item) => item.id === button.dataset.openShoe);
  if (shoe) openModal(shoe);
});

document.querySelector("[data-modal-close]")?.addEventListener("click", () => {
  document.querySelector("[data-shoe-modal]")?.close();
});

function openModal(shoe) {
  const dialog = document.querySelector("[data-shoe-modal]");
  const content = document.querySelector("[data-modal-content]");
  if (!dialog || !content) return;

  content.innerHTML = `
    <div class="modal-heading">
      <p>${escapeHtml(shoe.brand)}</p>
      <h2>${escapeHtml(shoe.modelKo)}</h2>
      <span>${escapeHtml(shoe.modelEn)}</span>
    </div>

    <div class="modal-score-grid">
      ${miniScore("첫 러닝화", shoe.scores.firstRunning)}
      ${miniScore("매일 러닝", shoe.scores.dailyRunning)}
      ${miniScore("훈련용", shoe.scores.training)}
      ${miniScore("대회용", shoe.scores.race)}
    </div>

    <dl class="spec-list">
      <div><dt>카본</dt><dd>${shoe.carbonPlate ? "포함" : "없음"}</dd></div>
      <div><dt>발볼</dt><dd>${widthLabel(shoe.rec.widthFit)}</dd></div>
      <div><dt>토박스 높이</dt><dd>${escapeHtml(shoe.rec.toeBoxHeight || "정보 없음")}</dd></div>
      <div><dt>뒤꿈치 지지</dt><dd>${escapeHtml(shoe.rec.heelSupport || "정보 없음")}</dd></div>
      <div><dt>무게</dt><dd>${shoe.weightG ? `${shoe.weightG}g` : "정보 없음"}</dd></div>
      <div><dt>드롭</dt><dd>${shoe.dropMm ? `${shoe.dropMm}mm` : "정보 없음"}</dd></div>
    </dl>

    ${shoe.notes.length ? `<div class="modal-notes"><h3>데이터 요약</h3><ul>${shoe.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>` : ""}

    ${shoe.sourceUrl ? `<a class="btn primary modal-source" href="${escapeHtml(shoe.sourceUrl)}" target="_blank" rel="noopener noreferrer">원천 데이터 확인</a>` : ""}
  `;

  dialog.showModal();
}

function getChosung(text) {
  const initial = [
    "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ",
    "ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"
  ];
  return String(text).split("").map((char) => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return char;
    return initial[Math.floor(code / 588)];
  }).join("");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
