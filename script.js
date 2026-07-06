const DATA_PATHS = {
  shoes: "data/shoes.json",
  weather: "data/weather.json",
  races: "data/races.json",
  courses: "data/courses.json"
};

const state = {
  shoes: [],
  compare: []
};

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initHome();
  initShoesPage();
  initWeatherPage();
  initRacesPage();
  initCoursesPage();
});

function initNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
}

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("데이터를 불러오지 못했습니다:", error);
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function hasUse(shoe, key) {
  return Array.isArray(shoe.use) && shoe.use.includes(key);
}

function calculateScore(shoe, filters = {}) {
  let score = 50;

  if (filters.use && hasUse(shoe, filters.use)) score += 18;
  if (filters.width && shoe.width === filters.width) score += 12;
  if (filters.weeklyKm === "0-10" && (hasUse(shoe, "beginner") || hasUse(shoe, "daily"))) score += 10;
  if (filters.weeklyKm === "10-30" && hasUse(shoe, "daily")) score += 10;
  if (filters.weeklyKm === "30-60" && (hasUse(shoe, "daily") || hasUse(shoe, "max-cushion"))) score += 10;
  if (filters.weeklyKm === "60+" && (hasUse(shoe, "max-cushion") || hasUse(shoe, "stability"))) score += 12;

  if (filters.pain === "knee" && shoe.cushion >= 4) score += 10;
  if (filters.pain === "ankle" && shoe.stability >= 4) score += 10;
  if (filters.pain === "plantar" && shoe.cushion >= 4) score += 8;
  if (filters.pain === "shin" && shoe.cushion >= 4) score += 8;

  score += Math.min(10, Number(shoe.cushion || 0) + Number(shoe.stability || 0));

  return Math.max(1, Math.min(99, Math.round(score)));
}

function scoreLabel(score) {
  if (score >= 85) return "강력 추천";
  if (score >= 72) return "추천";
  if (score >= 60) return "조건부 추천";
  return "비교 필요";
}

async function loadShoes() {
  if (state.shoes.length) return state.shoes;
  const data = await fetchJson(DATA_PATHS.shoes, []);
  state.shoes = Array.isArray(data) ? data : data.shoes || [];
  return state.shoes;
}

async function initHome() {
  const miniForm = document.querySelector("[data-mini-reco-form]");
  if (miniForm) {
    const shoes = await loadShoes();
    const results = document.querySelector("[data-mini-reco-results]");

    miniForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(miniForm);
      const filters = {
        weeklyKm: formData.get("weeklyKm"),
        width: formData.get("width"),
        use: formData.get("currentShoe") === "none" || formData.get("currentShoe") === "sneakers" ? "beginner" : "daily"
      };

      const top = shoes
        .map(shoe => ({ ...shoe, score: calculateScore(shoe, filters) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      results.innerHTML = top.map(shoe => `
        <div class="mini-result-card">
          <strong>${shoe.brand} ${shoe.model}</strong>
          <p>${shoe.score}점 · ${scoreLabel(shoe.score)}</p>
          <small>${shoe.recommendReason}</small>
        </div>
      `).join("");
    });
  }

  const weatherSummary = document.querySelector("[data-weather-summary]");
  if (weatherSummary) {
    const weather = await fetchJson(DATA_PATHS.weather, { status: "not_connected" });
    if (weather.status === "not_connected") {
      weatherSummary.querySelector("h2").textContent = "실제 날씨 API 연결 필요";
      weatherSummary.querySelector("p").textContent = weather.message || "현재 날씨를 임의로 표시하지 않습니다.";
    }
  }
}

async function initShoesPage() {
  const grid = document.querySelector("[data-shoe-grid]");
  const form = document.querySelector("[data-shoe-filter]");
  if (!grid || !form) return;

  const shoes = await loadShoes();
  fillBrandOptions(shoes);
  renderShoes(shoes, getFilters(form));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderShoes(shoes, getFilters(form));
  });

  form.addEventListener("reset", () => {
    setTimeout(() => renderShoes(shoes, getFilters(form)), 0);
  });

  form.addEventListener("input", () => renderShoes(shoes, getFilters(form)));

  const modal = document.querySelector("[data-shoe-modal]");
  const close = document.querySelector("[data-modal-close]");
  if (modal && close) close.addEventListener("click", () => modal.close());

  const clear = document.querySelector("[data-clear-compare]");
  if (clear) clear.addEventListener("click", () => {
    state.compare = [];
    updateCompare();
  });
}

function fillBrandOptions(shoes) {
  const select = document.querySelector('[data-shoe-filter] select[name="brand"]');
  if (!select) return;
  const brands = [...new Set(shoes.map(shoe => shoe.brand))].sort();
  select.innerHTML = `<option value="">전체</option>` + brands.map(brand => `<option value="${brand}">${brand}</option>`).join("");
}

function getFilters(form) {
  const data = new FormData(form);
  return {
    q: normalizeText(data.get("q")),
    brand: data.get("brand"),
    use: data.get("use"),
    width: data.get("width"),
    pain: data.get("pain"),
    weeklyKm: data.get("weeklyKm")
  };
}

function filterShoes(shoes, filters) {
  return shoes.filter(shoe => {
    const haystack = normalizeText([
      shoe.brand, shoe.model, shoe.priceRange, shoe.targetUser, shoe.recommendReason,
      Array.isArray(shoe.use) ? shoe.use.join(" ") : ""
    ].join(" "));

    if (filters.q && !haystack.includes(filters.q)) return false;
    if (filters.brand && shoe.brand !== filters.brand) return false;
    if (filters.use && !hasUse(shoe, filters.use)) return false;
    if (filters.width && shoe.width !== filters.width) return false;
    return true;
  });
}

function renderShoes(shoes, filters) {
  const grid = document.querySelector("[data-shoe-grid]");
  const count = document.querySelector("[data-result-count]");
  const result = filterShoes(shoes, filters)
    .map(shoe => ({ ...shoe, score: calculateScore(shoe, filters) }))
    .sort((a, b) => b.score - a.score);

  if (count) count.textContent = `${result.length}개`;

  if (!result.length) {
    grid.innerHTML = `<div class="empty-state">조건에 맞는 러닝화가 없습니다. 필터를 줄여보세요.</div>`;
    return;
  }

  grid.innerHTML = result.map(shoe => shoeCard(shoe)).join("");

  grid.querySelectorAll("[data-detail]").forEach(button => {
    button.addEventListener("click", () => openShoeModal(button.dataset.detail));
  });

  grid.querySelectorAll("[data-compare]").forEach(button => {
    button.addEventListener("click", () => addCompare(button.dataset.compare));
  });
}

function shoeCard(shoe) {
  const imageSafe = shoe.officialImage && shoe.officialImageStatus === "verified";
  return `
    <article class="shoe-card">
      ${imageSafe
        ? `<img src="${shoe.officialImage}" alt="${shoe.brand} ${shoe.model} 공식 이미지" />`
        : `<div class="shoe-image-placeholder">공식 이미지 확인 필요<br><small>무단 이미지 사용 안 함</small></div>`
      }
      <div class="shoe-top">
        <div>
          <p class="eyebrow">${shoe.brand}</p>
          <h3>${shoe.model}</h3>
        </div>
        <div class="score">${shoe.score}</div>
      </div>
      <div class="specs">
        <span>${shoe.priceRange}</span>
        <span>쿠션 ${shoe.cushion}/5</span>
        <span>안정 ${shoe.stability}/5</span>
        <span>${widthLabel(shoe.width)}</span>
        <span>${shoe.dropMm}mm drop</span>
      </div>
      <p class="reason">${shoe.recommendReason}</p>
      <span class="source-status need">${shoe.officialImageStatusText || "공식 이미지 확인 필요"}</span>
      <div class="card-actions">
        <button class="btn primary" type="button" data-detail="${shoe.id}">상세보기</button>
        <button class="btn ghost" type="button" data-compare="${shoe.id}">비교담기</button>
      </div>
    </article>
  `;
}

function widthLabel(width) {
  if (width === "wide") return "발볼 넓음";
  if (width === "narrow") return "발볼 좁음";
  return "발볼 보통";
}

function openShoeModal(id) {
  const shoe = state.shoes.find(item => item.id === id);
  const modal = document.querySelector("[data-shoe-modal]");
  const content = document.querySelector("[data-modal-content]");
  if (!shoe || !modal || !content) return;

  content.innerHTML = `
    <p class="eyebrow">${shoe.brand}</p>
    <h2>${shoe.model}</h2>
    <p>${shoe.targetUser}</p>
    <div class="specs">
      <span>${shoe.priceRange}</span>
      <span>${shoe.weightG ? shoe.weightG + "g" : "무게 확인 필요"}</span>
      <span>${shoe.dropMm}mm drop</span>
      <span>${widthLabel(shoe.width)}</span>
      <span>${shoe.use.join(", ")}</span>
    </div>
    <h3>추천 이유</h3>
    <p class="reason">${shoe.recommendReason}</p>
    <h3>출처 상태</h3>
    <p>${shoe.officialSourceLink ? `<a href="${shoe.officialSourceLink}" target="_blank" rel="noopener">공식 출처 보기</a>` : "공식 출처 확인 필요"}</p>
    <h3>구매 링크</h3>
    <p>${shoe.buyLink && shoe.buyLink !== "#" ? `<a href="${shoe.buyLink}" target="_blank" rel="noopener">구매 페이지</a>` : "제휴/구매 링크 입력 전"}</p>
  `;
  modal.showModal();
}

function addCompare(id) {
  const shoe = state.shoes.find(item => item.id === id);
  if (!shoe) return;
  if (!state.compare.some(item => item.id === id)) {
    state.compare.push(shoe);
  }
  updateCompare();
}

function updateCompare() {
  const drawer = document.querySelector("[data-compare-drawer]");
  const list = document.querySelector("[data-compare-list]");
  const count = document.querySelector("[data-compare-count]");
  if (!drawer || !list || !count) return;

  drawer.hidden = state.compare.length === 0;
  count.textContent = `${state.compare.length}개 선택`;
  list.innerHTML = state.compare.map(shoe => `
    <span class="compare-item">${shoe.brand} ${shoe.model}</span>
  `).join("");
}

async function initWeatherPage() {
  const grid = document.querySelector("[data-weather-grid]");
  const status = document.querySelector("[data-weather-page-status]");
  if (!grid) return;

  const data = await fetchJson(DATA_PATHS.weather, { status: "not_connected", days: [] });
  if (status) status.textContent = data.message || "실제 API 연결 전입니다.";

  if (!data.days || !data.days.length) {
    grid.innerHTML = `<div class="empty-state">표시할 실제 날씨 데이터가 없습니다. API 연결 후 갱신 시간과 출처를 함께 표시하세요.</div>`;
    return;
  }

  grid.innerHTML = data.days.map(day => `
    <article class="weather-card">
      <h3>${day.date}</h3>
      <p>${day.summary}</p>
      <div class="specs">
        <span>${day.minTemp}~${day.maxTemp}℃</span>
        <span>강수 ${day.rainChance}%</span>
      </div>
    </article>
  `).join("");
}

async function initRacesPage() {
  const list = document.querySelector("[data-race-list]");
  if (!list) return;

  const data = await fetchJson(DATA_PATHS.races, { races: [] });
  const races = data.races || [];

  const search = document.querySelector("[data-race-search]");
  const status = document.querySelector("[data-race-status]");

  const render = () => {
    const q = normalizeText(search?.value);
    const s = status?.value || "";
    const filtered = races.filter(race => {
      const text = normalizeText(`${race.name} ${race.region} ${race.date}`);
      if (q && !text.includes(q)) return false;
      if (s && race.status !== s) return false;
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state">공식 링크가 확인된 대회 데이터가 아직 없습니다. 확인 전 대회는 접수 가능으로 표시하지 않습니다.</div>`;
      return;
    }

    list.innerHTML = filtered.map(race => `
      <article class="race-card">
        <span class="chip">${raceStatusLabel(race.status)}</span>
        <h3>${race.name}</h3>
        <p>${race.region} · ${race.date}</p>
        <p>${race.officialLink ? `<a class="btn primary" href="${race.officialLink}" target="_blank" rel="noopener">공식 페이지</a>` : "공식 링크 확인 필요"}</p>
      </article>
    `).join("");
  };

  search?.addEventListener("input", render);
  status?.addEventListener("change", render);
  render();
}

function raceStatusLabel(status) {
  return {
    open: "접수 가능",
    closed: "접수 마감",
    pending: "접수 전",
    verify: "확인 필요"
  }[status] || "확인 필요";
}

async function initCoursesPage() {
  const grid = document.querySelector("[data-course-grid]");
  if (!grid) return;

  const data = await fetchJson(DATA_PATHS.courses, { courses: [] });
  const courses = data.courses || [];
  const search = document.querySelector("[data-course-search]");
  const level = document.querySelector("[data-course-level]");

  const render = () => {
    const q = normalizeText(search?.value);
    const l = level?.value || "";

    const filtered = courses.filter(course => {
      const text = normalizeText(`${course.name} ${course.region} ${course.description}`);
      if (q && !text.includes(q)) return false;
      if (l && course.level !== l) return false;
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">검증된 코스 데이터가 아직 없습니다. 지도 API 또는 직접 제작 지도 연결 후 등록하세요.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(course => `
      <article class="course-card">
        <span class="chip">${course.region}</span>
        <h3>${course.name}</h3>
        <p>${course.description}</p>
        <div class="specs">
          <span>${course.distanceKm}km</span>
          <span>${courseLevelLabel(course.level)}</span>
          <span>${course.surface}</span>
        </div>
      </article>
    `).join("");
  };

  search?.addEventListener("input", render);
  level?.addEventListener("change", render);
  render();
}

function courseLevelLabel(level) {
  return {
    easy: "쉬움",
    normal: "보통",
    hard: "어려움"
  }[level] || "난이도 확인 필요";
}
