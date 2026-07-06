const SHOES_DATA_PATH = "./data/shoes.json";

let allShoes = [];
let currentShoes = [];

document.addEventListener("DOMContentLoaded", () => {
  initShoesPage();
});

async function initShoesPage() {
  const listEl = getListElement();
  if (!listEl) return;

  try {
    const res = await fetch(SHOES_DATA_PATH);
    if (!res.ok) throw new Error("data/shoes.json 로드 실패");

    allShoes = await res.json();
    if (!Array.isArray(allShoes)) throw new Error("shoes.json은 배열 구조여야 합니다.");

    allShoes = addRankData(allShoes);
    currentShoes = [...allShoes];

    bindRecoTabs();
    populateBrandFilter();
    bindFilterForm();
    bindBeginnerForm();
    bindAdvancedForm();

    renderByHash();
  } catch (error) {
    console.error(error);
    listEl.innerHTML = `
      <div class="empty-state">
        <h3>신발 데이터를 불러오지 못했습니다.</h3>
        <p>data/shoes.json 경로와 JSON 문법을 확인해 주세요.</p>
      </div>
    `;
  }
}

function getListElement() {
  return document.querySelector("[data-shoe-grid]") || document.querySelector(".shoe-grid");
}

function bindRecoTabs() {
  document.querySelectorAll("[data-reco-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.recoTab;
      activateRecoTab(tab);
      history.replaceState(null, "", `#${tab}`);

      if (tab === "browse") applyFilters();
      if (tab === "beginner") renderBeginnerShoes();
      if (tab === "advanced") renderShoes(allShoes, getListElement());
    });
  });

  window.addEventListener("hashchange", renderByHash);
}

function activateRecoTab(tab) {
  document.querySelectorAll("[data-reco-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.recoTab === tab);
  });

  document.querySelectorAll("[data-reco-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.recoPanel === tab);
  });
}

function renderByHash() {
  const hash = window.location.hash.replace("#", "") || "beginner";
  const tab = ["browse", "beginner", "advanced"].includes(hash) ? hash : "beginner";

  activateRecoTab(tab);

  if (tab === "browse") applyFilters();
  if (tab === "beginner") renderBeginnerShoes();
  if (tab === "advanced") renderShoes(allShoes, getListElement());
}

function populateBrandFilter() {
  const brandSelect = document.querySelector("[data-shoe-filter] select[name='brand']");
  if (!brandSelect) return;

  const brands = [...new Set(allShoes.map((shoe) => shoe.brand).filter(Boolean))].sort();

  brandSelect.innerHTML = `<option value="">전체</option>`;
  brands.forEach((brand) => {
    brandSelect.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHTML(brand)}">${escapeHTML(brand)}</option>`
    );
  });
}

function bindFilterForm() {
  const form = document.querySelector("[data-shoe-filter]");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    applyFilters();
  });

  form.addEventListener("reset", () => {
    setTimeout(applyFilters, 0);
  });

  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", applyFilters);
    el.addEventListener("change", applyFilters);
  });
}

function bindBeginnerForm() {
  const form = document.querySelector("[data-beginner-form]");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    renderBeginnerShoes(new FormData(form));
  });
}

function bindAdvancedForm() {
  const form = document.querySelector("[data-advanced-form]");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);

    const shoes = [...allShoes]
      .map((shoe) => ({
        shoe,
        score: getAdvancedMatchScore(shoe, data),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((item) => item.shoe);

    currentShoes = shoes;
    renderShoes(shoes, getListElement());
  });
}

function renderBeginnerShoes(formData = null) {
  const shoes = [...allShoes]
    .map((shoe) => ({
      shoe,
      score: getBeginnerMatchScore(shoe, formData),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((item) => item.shoe);

  currentShoes = shoes;
  renderShoes(shoes, getListElement());
}

function applyFilters() {
  const form = document.querySelector("[data-shoe-filter]");
  const listEl = getListElement();

  if (!form) {
    renderShoes(allShoes, listEl);
    return;
  }

  const data = new FormData(form);

  const keyword = normalizeText(data.get("q") || "");
  const brandValue = normalizeText(data.get("brand") || "");
  const useValue = normalizeText(data.get("use") || "");
  const widthValue = normalizeText(data.get("width") || "");
  const painValue = normalizeText(data.get("pain") || "");

  currentShoes = allShoes.filter((shoe) => {
    const searchable = normalizeText(
      [
        shoe.id,
        shoe.brand,
        shoe.modelEn,
        shoe.modelKo,
        shoe.oneLine,
        shoe.summary,
        shoe.carbonLabel,
        shoe.rfClassification?.primaryLabel,
        shoe.rfClassification?.primary,
        ...(shoe.purpose || []),
        ...(shoe.search?.ko || []),
        ...(shoe.search?.en || []),
        ...(shoe.search?.alias || []),
      ].join(" ")
    );

    const brand = normalizeText(shoe.brand || "");
    const purposes = normalizeText((shoe.purpose || []).join(" "));
    const width = normalizeText(shoe.width || shoe.fit || "");
    const pain = normalizeText((shoe.pain || shoe.recommendedPain || []).join?.(" ") || "");

    return (
      (!keyword || searchable.includes(keyword)) &&
      (!brandValue || brand === brandValue) &&
      (!useValue || purposes.includes(useValue) || searchable.includes(useValue)) &&
      (!widthValue || width.includes(widthValue) || purposes.includes(widthValue)) &&
      (!painValue || pain.includes(painValue) || searchable.includes(painValue))
    );
  });

  renderShoes(currentShoes, listEl);
}

function addRankData(shoes) {
  const categories = ["popularity", "beginner", "daily", "training", "race"];

  const ranked = shoes.map((shoe) => ({
    ...shoe,
    rfRank: {},
  }));

  categories.forEach((category) => {
    [...ranked]
      .sort((a, b) => getScore(b, category) - getScore(a, category))
      .forEach((shoe, index) => {
        shoe.rfRank[category] = index + 1;
      });
  });

  return ranked;
}

function renderShoes(shoes, listEl) {
  if (!listEl) return;

  const countEl = document.querySelector("[data-result-count]");
  if (countEl) countEl.textContent = `${shoes.length}개`;

  if (!shoes.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <h3>검색 결과가 없습니다.</h3>
        <p>모델명, 브랜드명, 한글명, 목적을 다시 입력해 보세요.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = shoes.map(createShoeCard).join("");
}

function createShoeCard(shoe) {
  const brand = shoe.brand || "브랜드 미확인";
  const modelKo = shoe.modelKo || "";
  const modelEn = shoe.modelEn || "모델명 미확인";
  const overall = getScore(shoe, "overall");
  const badges = createRankBadges(shoe);
  const purposes = getPurposeLabels(shoe.purpose || []);
  const image = shoe.image || "";
  const summary = shoe.summary || shoe.oneLine || "추천 설명은 준비 중입니다.";

  return `
    <article class="shoe-card">
      ${
        image
          ? `
            <div class="shoe-image-wrap">
              <img src="${escapeHTML(image)}" alt="${escapeHTML(modelKo || modelEn)}" class="shoe-image" loading="lazy">
            </div>
          `
          : ""
      }

      <div class="shoe-card-top">
        <div>
          <p class="shoe-brand">${escapeHTML(brand)}</p>
          <h3 class="shoe-name">${escapeHTML(modelKo || modelEn)}</h3>
          ${modelKo ? `<p class="shoe-korean-name">${escapeHTML(modelEn)}</p>` : ""}
        </div>

        <div class="shoe-score">
          <strong>${overall}</strong>
          <span>점</span>
        </div>
      </div>

      ${badges.length ? `<div class="shoe-badges">${badges.join("")}</div>` : ""}

      <div class="shoe-purpose">
        ${purposes.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
      </div>

      <div class="shoe-specs">
        <div><span>쿠션</span><strong>${displayPerformance(shoe, "cushion")}</strong></div>
        <div><span>안정성</span><strong>${displayPerformance(shoe, "stability")}</strong></div>
        <div><span>반발감</span><strong>${displayPerformance(shoe, "energyReturn")}</strong></div>
        <div><span>카본</span><strong>${shoe.carbonPlate ? "있음" : "없음"}</strong></div>
      </div>

      <p class="shoe-reason">${escapeHTML(summary)}</p>
    </article>
  `;
}

function createRankBadges(shoe) {
  const badges = [];

  if (shoe.rfRank?.popularity <= 10) badges.push(`<span class="rank-badge popular">🔥 인기 TOP${shoe.rfRank.popularity}</span>`);
  if (shoe.rfRank?.beginner <= 10) badges.push(`<span class="rank-badge beginner">🌱 첫 러닝화 TOP${shoe.rfRank.beginner}</span>`);
  if (shoe.rfRank?.daily <= 10) badges.push(`<span class="rank-badge daily">🏃 매일러닝 TOP${shoe.rfRank.daily}</span>`);
  if (shoe.rfRank?.training <= 10) badges.push(`<span class="rank-badge training">💪 훈련 TOP${shoe.rfRank.training}</span>`);
  if (shoe.rfRank?.race <= 10) badges.push(`<span class="rank-badge race">🏁 대회준비 TOP${shoe.rfRank.race}</span>`);

  return badges;
}

function getBeginnerMatchScore(shoe, formData = null) {
  let score = getScore(shoe, "beginner") * 1.5;
  score += getScore(shoe, "daily") * 0.8;
  score += getScore(shoe, "stability") * 0.5;
  score += getScore(shoe, "value") * 0.4;

  if (shoe.carbonPlate) score -= 20;
  if (hasPurpose(shoe, "race")) score -= 10;
  if (hasPurpose(shoe, "beginner")) score += 15;

  if (formData) {
    const width = formData.get("width");
    const weight = Number(formData.get("weight") || 0);

    if (width === "wide" && hasPurpose(shoe, "wide")) score += 12;
    if (weight >= 85) score += getScore(shoe, "stability") * 0.8;
  }

  return score;
}

function getAdvancedMatchScore(shoe, formData) {
  let score = getScore(shoe, "overall");

  const training = formData.get("training");
  const runnerType = formData.get("runnerType");
  const width = formData.get("width");
  const pain = formData.get("pain");
  const weight = Number(formData.get("weight") || 0);

  if (training === "easy" || training === "recovery" || training === "lsd") {
    score += getScore(shoe, "daily") + getScore(shoe, "stability") * 0.5;
  }

  if (training === "tempo" || training === "interval") {
    score += getScore(shoe, "training") + getScore(shoe, "energyReturn");
  }

  if (training === "race") {
    score += getScore(shoe, "race") + (shoe.carbonPlate ? 15 : 0);
  }

  if (runnerType === "heavy" || weight >= 85) {
    score += getScore(shoe, "stability") + getScore(shoe, "cushion");
  }

  if (width === "wide" && hasPurpose(shoe, "wide")) score += 12;
  if (pain && (hasPurpose(shoe, "stability") || getScore(shoe, "stability") >= 75)) score += 10;

  return score;
}

function getScore(shoe, key) {
  return Number(shoe?.scores?.[key] ?? shoe?.performance?.[key] ?? 0);
}

function hasPurpose(shoe, key) {
  return Array.isArray(shoe.purpose) && shoe.purpose.includes(key);
}

function getPurposeLabels(purposes) {
  const map = {
    daily: "매일러닝",
    beginner: "첫 러닝화",
    training: "훈련",
    race: "대회준비",
    stability: "안정화",
    value: "가성비",
    trail: "트레일",
    wide: "발볼 넓음",
  };

  return purposes.map((item) => map[item] || item);
}

function displayPerformance(shoe, key) {
  const value = shoe?.performance?.[key];

  if (value === null || value === undefined || value === "") {
    return "미확인";
  }

  return `${value}/10`;
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replaceAll("입문", "첫러닝화")
    .replaceAll("데일리", "매일러닝")
    .replaceAll("daily", "매일러닝")
    .replaceAll("beginner", "첫러닝화")
    .replace(/\s+/g, "")
    .trim();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}