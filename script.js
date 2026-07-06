const DATA_PATHS = {
  shoes: "data/shoes.json",
  weather: "data/weather.json",
  races: "data/races.json",
  courses: "data/courses.json",
  profile: "data/profile.json",
  myShoes: "data/my-shoes.json",
  runLogs: "data/run-logs.json"
};

const STORAGE = {
  auth: "runningfit.auth.v3",
  profile: "runningfit.profile.v3",
  myShoes: "runningfit.myShoes.v3",
  runLogs: "runningfit.runLogs.v3"
};

const state = {
  shoes: [],
  compare: []
};

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initHome();
  initShoesPage();
  initProfilePage();
  initMyShoesPage();
  initRunLogPage();
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

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim();
}

function hasUse(shoe, key) {
  return Array.isArray(shoe.use) && shoe.use.includes(key);
}

function budgetMatch(shoe, budget) {
  if (!budget) return true;
  const price = shoe.priceTier || "";
  return price === budget;
}

function calculateScore(shoe, filters = {}) {
  let score = 50;

  const trainingToUse = {
    easy: ["daily", "jogging"],
    recovery: ["recovery", "max-cushion"],
    lsd: ["lsd", "max-cushion", "daily"],
    tempo: ["tempo", "lightweight"],
    interval: ["interval", "lightweight", "carbon"],
    race: ["race", "carbon", "lightweight"],
    trail: ["trail"]
  };

  if (filters.use && hasUse(shoe, filters.use)) score += 16;

  if (filters.training) {
    const wanted = trainingToUse[filters.training] || [];
    wanted.forEach(use => { if (hasUse(shoe, use)) score += 10; });
  }

  if (filters.runnerType === "heavy" && shoe.cushion >= 4) score += 10;
  if (filters.runnerType === "racePrep" && (hasUse(shoe, "race") || hasUse(shoe, "tempo") || hasUse(shoe, "marathon"))) score += 10;
  if (filters.runnerType === "record" && (hasUse(shoe, "carbon") || hasUse(shoe, "lightweight"))) score += 10;
  if (filters.runnerType === "rotation" && Array.isArray(shoe.rotationRole)) score += 6;

  if (filters.width && shoe.width === filters.width) score += 12;
  if (filters.width === "wide" && hasUse(shoe, "wide")) score += 8;

  if (filters.weeklyKm === "0-10" && (hasUse(shoe, "beginner") || hasUse(shoe, "daily"))) score += 10;
  if (filters.weeklyKm === "10-30" && hasUse(shoe, "daily")) score += 10;
  if (filters.weeklyKm === "30-60" && (hasUse(shoe, "daily") || hasUse(shoe, "lsd") || hasUse(shoe, "max-cushion"))) score += 10;
  if (filters.weeklyKm === "60-100" && (hasUse(shoe, "max-cushion") || hasUse(shoe, "stability") || hasUse(shoe, "lsd"))) score += 12;
  if (filters.weeklyKm === "100+" && (hasUse(shoe, "max-cushion") || hasUse(shoe, "stability"))) score += 14;

  const weight = Number(filters.weight || 0);
  if (weight >= 90 && shoe.cushion >= 4) score += 10;
  if (weight >= 90 && shoe.stability >= 4) score += 8;
  if (weight <= 65 && (hasUse(shoe, "lightweight") || hasUse(shoe, "tempo"))) score += 6;

  if (filters.pain === "knee" && shoe.cushion >= 4) score += 10;
  if (filters.pain === "ankle" && shoe.stability >= 4) score += 10;
  if (filters.pain === "plantar" && shoe.cushion >= 4) score += 8;
  if (filters.pain === "shin" && shoe.cushion >= 4) score += 8;
  if (filters.pain === "achilles" && Number(shoe.dropMm || 0) >= 8) score += 8;
  if (filters.pain === "overpronation" && hasUse(shoe, "stability")) score += 12;

  if (filters.raceGoal === "half" && (hasUse(shoe, "tempo") || hasUse(shoe, "marathon"))) score += 8;
  if (filters.raceGoal === "full" && (hasUse(shoe, "marathon") || hasUse(shoe, "max-cushion"))) score += 10;
  if (filters.raceGoal === "5k" && (hasUse(shoe, "interval") || hasUse(shoe, "lightweight"))) score += 8;
  if (filters.raceGoal === "10k" && (hasUse(shoe, "tempo") || hasUse(shoe, "race"))) score += 8;

  if (!budgetMatch(shoe, filters.budget)) score -= 10;

  score += Math.min(10, Number(shoe.cushion || 0) + Number(shoe.stability || 0));

  return Math.max(1, Math.min(99, Math.round(score)));
}

function scoreLabel(score) {
  if (score >= 88) return "강력 추천";
  if (score >= 76) return "추천";
  if (score >= 64) return "조건부 추천";
  return "비교 필요";
}

function explainShoe(shoe, filters = {}) {
  const pros = [];
  const cons = [];

  if (filters.training && hasUse(shoe, filters.training)) pros.push("오늘 훈련 목적과 직접 일치합니다.");
  if (filters.training === "lsd" && (hasUse(shoe, "lsd") || hasUse(shoe, "max-cushion"))) pros.push("장거리/LSD에 필요한 쿠션 성향이 맞습니다.");
  if (filters.training === "race" && (hasUse(shoe, "race") || hasUse(shoe, "carbon"))) pros.push("레이스 목적에 맞는 빠른 성향입니다.");
  if (filters.training === "recovery" && shoe.cushion >= 4) pros.push("회복런에 필요한 충격 완화 성향이 있습니다.");
  if (filters.width && shoe.width === filters.width) pros.push("선택한 발볼 조건과 맞습니다.");
  if (Number(filters.weight || 0) >= 90 && shoe.cushion >= 4) pros.push("체중 부담을 고려했을 때 쿠션 점수가 높습니다.");
  if (filters.pain === "overpronation" && hasUse(shoe, "stability")) pros.push("과내전/안정성 고민에 맞는 안정화 성향입니다.");
  if (filters.pain && shoe.stability >= 4) pros.push("통증 고민이 있을 때 안정성이 도움이 될 수 있습니다.");
  if (hasUse(shoe, "beginner")) pros.push("입문자가 접근하기 쉬운 데일리 성향입니다.");

  if (filters.training === "interval" && shoe.weightG > 280) cons.push("인터벌 위주라면 무게가 아쉬울 수 있습니다.");
  if (filters.training === "race" && !hasUse(shoe, "race") && !hasUse(shoe, "carbon")) cons.push("기록 단축용 레이스화만 찾는다면 우선순위가 낮을 수 있습니다.");
  if (filters.width === "wide" && shoe.width !== "wide") cons.push("발볼이 넓은 사용자에게는 실착 확인이 필요합니다.");
  if (Number(filters.weight || 0) >= 90 && shoe.cushion < 4) cons.push("체중 부담을 고려하면 더 높은 쿠션 모델도 비교해보세요.");

  if (!pros.length) pros.push(shoe.recommendReason);
  if (!cons.length) cons.push("최종 선택 전 최신 공식 스펙과 실착감을 확인해야 합니다.");

  return { pros, cons };
}


async function loadShoes() {
  if (state.shoes.length) return state.shoes;
  const data = await fetchJson(DATA_PATHS.shoes, []);
  state.shoes = Array.isArray(data) ? data : data.shoes || [];
  return state.shoes;
}

async function initHome() {
  const shoeCount = document.querySelector("[data-home-shoe-count]");
  if (shoeCount) {
    const myShoes = load(STORAGE.myShoes, []);
    shoeCount.textContent = `등록된 신발 ${myShoes.length}개`;
  }

  const lastRun = document.querySelector("[data-home-last-run]");
  if (lastRun) {
    const logs = load(STORAGE.runLogs, []);
    if (logs.length) {
      const latest = logs[logs.length - 1];
      lastRun.textContent = `${latest.distanceKm}km · ${latest.date}`;
    }
  }
}

async function initShoesPage() {
  const grid = document.querySelector("[data-shoe-grid]");
  if (!grid) return;

  const shoes = await loadShoes();
  fillBrandOptions(shoes);

  initRecommendationTabs();
  initBeginnerForm(shoes);
  initAdvancedForm(shoes);
  initBrowseForm(shoes);

  const initialPanel = location.hash.replace("#", "");
  if (initialPanel === "advanced" || initialPanel === "beginner" || initialPanel === "browse") {
    activateRecoTab(initialPanel);
  } else {
    renderRecommendedShoes(shoes, { use: "beginner", weeklyKm: "0-10" }, "입문 추천 TOP");
  }

  const modal = document.querySelector("[data-shoe-modal]");
  const close = document.querySelector("[data-modal-close]");
  if (modal && close) close.addEventListener("click", () => modal.close());

  const clear = document.querySelector("[data-clear-compare]");
  if (clear) clear.addEventListener("click", () => {
    state.compare = [];
    updateCompare();
  });
}

function initRecommendationTabs() {
  document.querySelectorAll("[data-reco-tab]").forEach(button => {
    button.addEventListener("click", () => activateRecoTab(button.dataset.recoTab));
  });
}

function activateRecoTab(name) {
  document.querySelectorAll("[data-reco-tab]").forEach(btn => btn.classList.toggle("active", btn.dataset.recoTab === name));
  document.querySelectorAll("[data-reco-panel]").forEach(panel => panel.classList.toggle("active", panel.dataset.recoPanel === name));
  history.replaceState(null, "", `#${name}`);
}

function initBeginnerForm(shoes) {
  const form = document.querySelector("[data-beginner-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const filters = {
      use: "beginner",
      training: "easy",
      weeklyKm: "0-10",
      weight: data.get("weight"),
      width: data.get("width"),
      budget: data.get("budget")
    };
    if (data.get("goal") === "first5k") filters.raceGoal = "5k";
    renderRecommendedShoes(shoes, filters, "입문 추천 TOP");
  });
}

function initAdvancedForm(shoes) {
  const form = document.querySelector("[data-advanced-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const filters = {
      runnerType: data.get("runnerType"),
      training: data.get("training"),
      weeklyKm: data.get("weeklyKm"),
      monthlyKm: data.get("monthlyKm"),
      weight: data.get("weight"),
      raceGoal: data.get("raceGoal"),
      width: data.get("width"),
      pain: data.get("pain"),
      strike: data.get("strike"),
      budget: data.get("budget")
    };
    renderRecommendedShoes(shoes, filters, "정밀 추천 TOP");
  });
}

function initBrowseForm(shoes) {
  const form = document.querySelector("[data-shoe-filter]");
  if (!form) return;

  renderShoes(shoes, getFilters(form), "전체 검색 결과");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderShoes(shoes, getFilters(form), "전체 검색 결과");
  });

  form.addEventListener("reset", () => {
    setTimeout(() => renderShoes(shoes, getFilters(form), "전체 검색 결과"), 0);
  });

  form.addEventListener("input", () => renderShoes(shoes, getFilters(form), "전체 검색 결과"));
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

function renderRecommendedShoes(shoes, filters, title) {
  const result = shoes
    .map(shoe => ({ ...shoe, score: calculateScore(shoe, filters), explanation: explainShoe(shoe, filters) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  renderSummary(title, filters, result);
  renderShoeCards(result);
}

function renderShoes(shoes, filters, title) {
  const result = filterShoes(shoes, filters)
    .map(shoe => ({ ...shoe, score: calculateScore(shoe, filters), explanation: explainShoe(shoe, filters) }))
    .sort((a, b) => b.score - a.score);

  const count = document.querySelector("[data-result-count]");
  if (count) count.textContent = `${result.length}개`;

  renderSummary(title, filters, result.slice(0, 3));
  renderShoeCards(result);
}

function renderSummary(title, filters, result) {
  const summary = document.querySelector("[data-recommend-summary]");
  if (!summary) return;
  summary.hidden = false;
  const top = result[0];
  summary.innerHTML = `
    <p class="eyebrow">${title}</p>
    <h2>${top ? `${top.brand} ${top.model}` : "추천 후보 없음"}</h2>
    <p>${top ? `${top.score}점 · ${scoreLabel(top.score)} · ${top.recommendReason}` : "조건을 다시 조정해보세요."}</p>
    <div class="summary-grid">
      <div class="summary-box"><strong>훈련</strong><p>${trainingLabel(filters.training || filters.use || "미선택")}</p></div>
      <div class="summary-box"><strong>주간 거리</strong><p>${filters.weeklyKm || "미선택"}</p></div>
      <div class="summary-box"><strong>주의</strong><p>공식 스펙/이미지 확인 전 데이터는 검증 필요</p></div>
    </div>
  `;
}

function renderShoeCards(result) {
  const grid = document.querySelector("[data-shoe-grid]");
  if (!grid) return;

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
  const pros = shoe.explanation?.pros?.slice(0, 3) || [];
  const cons = shoe.explanation?.cons?.slice(0, 2) || [];
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
        <span>${useLabelList(shoe.use)}</span>
        <span>쿠션 ${shoe.cushion}/5</span>
        <span>안정 ${shoe.stability}/5</span>
        <span>${widthLabel(shoe.width)}</span>
        <span>${shoe.dropMm}mm drop</span>
      </div>
      <p class="reason">${shoe.recommendReason}</p>
      <div>
        <strong>맞는 이유</strong>
        <ul class="mini-list">${pros.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
      <div>
        <strong>주의</strong>
        <ul class="mini-list">${cons.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
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

function useLabelList(uses = []) {
  return uses.slice(0, 3).map(trainingLabel).join(" · ");
}

function trainingLabel(value) {
  return {
    beginner: "입문",
    daily: "데일리",
    recovery: "회복런",
    jogging: "조깅",
    easy: "조깅",
    lsd: "LSD",
    tempo: "템포",
    interval: "인터벌",
    race: "레이스",
    marathon: "마라톤",
    trail: "트레일",
    stability: "안정화",
    neutral: "중립화",
    "max-cushion": "맥스쿠션",
    lightweight: "경량화",
    carbon: "탄소화",
    wide: "발볼 넓음"
  }[value] || value || "미선택";
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
      <span>${useLabelList(shoe.use)}</span>
    </div>
    <h3>추천 이유</h3>
    <p class="reason">${shoe.recommendReason}</p>
    <h3>로테이션 역할</h3>
    <p>${Array.isArray(shoe.rotationRole) ? shoe.rotationRole.map(trainingLabel).join(", ") : "확인 필요"}</p>
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
  if (!state.compare.some(item => item.id === id)) state.compare.push(shoe);
  updateCompare();
}

function updateCompare() {
  const drawer = document.querySelector("[data-compare-drawer]");
  const list = document.querySelector("[data-compare-list]");
  const count = document.querySelector("[data-compare-count]");
  if (!drawer || !list || !count) return;
  drawer.hidden = state.compare.length === 0;
  count.textContent = `${state.compare.length}개 선택`;
  list.innerHTML = state.compare.map(shoe => `<span class="compare-item">${shoe.brand} ${shoe.model}</span>`).join("");
}

function initProfilePage() {
  const authForm = document.querySelector("[data-auth-form]");
  const status = document.querySelector("[data-auth-status]");
  const logout = document.querySelector("[data-logout]");
  const profileForm = document.querySelector("[data-profile-form]");
  const preview = document.querySelector("[data-profile-photo-preview]");

  function renderAuth() {
    const auth = load(STORAGE.auth, null);
    if (status) status.textContent = auth ? `${auth.nickname} 로그인 중` : "로그인 전";
  }

  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(authForm);
      save(STORAGE.auth, { email: data.get("email"), nickname: data.get("nickname"), beta: true });
      renderAuth();
      alert("베타 로그인 상태가 저장되었습니다.");
    });
  }

  if (logout) {
    logout.addEventListener("click", () => {
      localStorage.removeItem(STORAGE.auth);
      renderAuth();
    });
  }

  if (profileForm) {
    const profile = load(STORAGE.profile, {});
    [...profileForm.elements].forEach(el => {
      if (el.name && profile[el.name] && el.type !== "file") el.value = profile[el.name];
    });

    const photo = profile.photoData;
    if (photo && preview) preview.innerHTML = `<img src="${photo}" alt="프로필 사진 미리보기">`;

    profileForm.photo?.addEventListener("change", () => fileToPreview(profileForm.photo.files[0], preview));

    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(profileForm).entries());
      if (profileForm.photo.files[0]) data.photoData = await fileToDataUrl(profileForm.photo.files[0]);
      else data.photoData = profile.photoData || "";
      save(STORAGE.profile, data);
      alert("프로필이 저장되었습니다.");
    });
  }

  renderAuth();
}

function initMyShoesPage() {
  const form = document.querySelector("[data-my-shoe-form]");
  const preview = document.querySelector("[data-my-shoe-photo-preview]");
  if (!form) return;

  form.photo?.addEventListener("change", () => fileToPreview(form.photo.files[0], preview));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const photoData = form.photo.files[0] ? await fileToDataUrl(form.photo.files[0]) : "";
    const shoe = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      brand: data.brand,
      model: data.model,
      purchaseDate: data.purchaseDate,
      price: Number(data.price || 0),
      size: data.size,
      color: data.color,
      purpose: data.purpose,
      currentKm: Number(data.currentKm || 0),
      baseLifeKm: Number(data.baseLifeKm || 600),
      photoData,
      createdAt: new Date().toISOString()
    };
    const list = load(STORAGE.myShoes, []);
    list.push(shoe);
    save(STORAGE.myShoes, list);
    form.reset();
    if (preview) preview.textContent = "신발 사진 미리보기";
    renderMyShoes();
  });

  renderMyShoes();
}

function calculateLife(shoe) {
  const profile = load(STORAGE.profile, {});
  const weight = Number(profile.weight || 0);
  let weightFactor = 1;
  if (weight >= 100) weightFactor = 0.85;
  else if (weight >= 90) weightFactor = 0.9;
  else if (weight >= 80) weightFactor = 0.95;

  const purposeFactorMap = {
    daily: 1,
    recovery: 1,
    lsd: 0.95,
    tempo: 0.9,
    interval: 0.85,
    race: 0.85,
    trail: 0.8
  };
  const purposeFactor = purposeFactorMap[shoe.purpose] || 1;
  const expectedLife = Math.round(Number(shoe.baseLifeKm || 600) * weightFactor * purposeFactor);
  const current = Number(shoe.currentKm || 0);
  const remain = Math.max(0, expectedLife - current);
  const usedRatio = expectedLife ? Math.min(100, Math.round((current / expectedLife) * 100)) : 0;
  const status = remain <= 50 ? "교체 권장" : remain <= 120 ? "주의" : "좋음";
  return { expectedLife, remain, usedRatio, status };
}

function renderMyShoes() {
  const listEl = document.querySelector("[data-my-shoes-list]");
  if (!listEl) return;

  const list = load(STORAGE.myShoes, []);
  if (!list.length) {
    listEl.innerHTML = `<div class="empty-state">아직 등록된 러닝화가 없습니다. 첫 러닝화를 등록해보세요.</div>`;
    return;
  }

  listEl.innerHTML = list.map(shoe => {
    const life = calculateLife(shoe);
    const barClass = life.status === "교체 권장" ? "bad" : life.status === "주의" ? "warn" : "";
    return `
      <article class="my-shoe-card">
        ${shoe.photoData ? `<img class="shoe-photo" src="${shoe.photoData}" alt="${shoe.brand} ${shoe.model} 사진">` : `<div class="shoe-image-placeholder">사용자 신발 사진 없음</div>`}
        <p class="eyebrow">${shoe.brand}</p>
        <h3>${shoe.model}</h3>
        <div class="specs">
          <span>${shoe.currentKm.toFixed(2)}km 사용</span>
          <span>예상 ${life.expectedLife}km</span>
          <span>남은 ${life.remain.toFixed(2)}km</span>
          <span>${life.status}</span>
        </div>
        <div class="life-bar ${barClass}"><span style="width:${life.usedRatio}%"></span></div>
        <p class="reason">베타 계산: 기본 수명, 프로필 몸무게, 사용 목적을 반영합니다.</p>
        <button class="btn ghost" type="button" data-delete-my-shoe="${shoe.id}">삭제</button>
      </article>
    `;
  }).join("");

  listEl.querySelectorAll("[data-delete-my-shoe]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = load(STORAGE.myShoes, []).filter(item => item.id !== btn.dataset.deleteMyShoe);
      save(STORAGE.myShoes, next);
      renderMyShoes();
    });
  });
}

function initRunLogPage() {
  const form = document.querySelector("[data-run-log-form]");
  if (!form) return;

  const today = new Date().toISOString().slice(0, 10);
  form.date.value = today;

  fillRunShoeSelect();
  renderRunLogs();

  const preview = document.querySelector("[data-run-upload-preview]");
  form.screenshot?.addEventListener("change", () => fileToPreview(form.screenshot.files[0], preview));

  ["distanceKm", "pace", "shoeId"].forEach(name => {
    form[name]?.addEventListener("input", updateStoryPreview);
    form[name]?.addEventListener("change", updateStoryPreview);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const distance = Number(data.distanceKm || 0);
    const logs = load(STORAGE.runLogs, []);
    const log = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: data.date,
      distanceKm: distance,
      duration: data.duration,
      pace: data.pace,
      calories: Number(data.calories || 0),
      training: data.training,
      shoeId: data.shoeId,
      createdAt: new Date().toISOString()
    };
    logs.push(log);
    save(STORAGE.runLogs, logs);

    if (data.shoeId) {
      const shoes = load(STORAGE.myShoes, []);
      const next = shoes.map(shoe => shoe.id === data.shoeId ? { ...shoe, currentKm: Number(shoe.currentKm || 0) + distance } : shoe);
      save(STORAGE.myShoes, next);
    }

    form.reset();
    form.date.value = new Date().toISOString().slice(0, 10);
    fillRunShoeSelect();
    renderRunLogs();
    updateStoryPreview();
    alert("러닝 기록이 저장되고 신발 마일리지가 누적되었습니다.");
  });

  updateStoryPreview();
}

function fillRunShoeSelect() {
  const select = document.querySelector("[data-run-shoe-select]");
  if (!select) return;
  const shoes = load(STORAGE.myShoes, []);
  if (!shoes.length) {
    select.innerHTML = `<option value="">신발장에 등록된 신발 없음</option>`;
    return;
  }
  select.innerHTML = `<option value="">선택 안 함</option>` + shoes.map(shoe => `<option value="${shoe.id}">${shoe.brand} ${shoe.model} (${Number(shoe.currentKm || 0).toFixed(1)}km)</option>`).join("");
}

function updateStoryPreview() {
  const form = document.querySelector("[data-run-log-form]");
  if (!form) return;
  const distance = document.querySelector("[data-story-distance]");
  const pace = document.querySelector("[data-story-pace]");
  const shoeText = document.querySelector("[data-story-shoe]");
  const lifeText = document.querySelector("[data-story-life]");
  const shoes = load(STORAGE.myShoes, []);
  const selected = shoes.find(shoe => shoe.id === form.shoeId?.value);

  if (distance) distance.textContent = `${Number(form.distanceKm?.value || 0).toFixed(2)}km`;
  if (pace) pace.textContent = form.pace?.value ? `pace ${form.pace.value}` : "pace -";
  if (shoeText) shoeText.textContent = selected ? `${selected.brand} ${selected.model}` : "오늘 신은 러닝화";
  if (lifeText) {
    if (selected) {
      const addKm = Number(form.distanceKm?.value || 0);
      const after = { ...selected, currentKm: Number(selected.currentKm || 0) + addKm };
      const life = calculateLife(after);
      lifeText.textContent = `기록 후 남은 수명 ${life.remain.toFixed(1)}km`;
    } else {
      lifeText.textContent = "남은 수명 계산 전";
    }
  }
}

function renderRunLogs() {
  const list = document.querySelector("[data-run-log-list]");
  if (!list) return;
  const logs = load(STORAGE.runLogs, []);
  const shoes = load(STORAGE.myShoes, []);
  if (!logs.length) {
    list.innerHTML = `<div class="empty-state">아직 러닝 기록이 없습니다.</div>`;
    return;
  }
  list.innerHTML = logs.slice().reverse().map(log => {
    const shoe = shoes.find(item => item.id === log.shoeId);
    return `
      <article class="race-card">
        <span class="chip">${trainingLabel(log.training)}</span>
        <h3>${log.distanceKm.toFixed(2)}km</h3>
        <p>${log.date} · ${log.duration || "시간 미입력"} · ${log.pace || "페이스 미입력"}</p>
        <p>${shoe ? `${shoe.brand} ${shoe.model}` : "사용 신발 미선택"}</p>
      </article>
    `;
  }).join("");
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function fileToPreview(file, target) {
  if (!target || !file) return;
  const url = await fileToDataUrl(file);
  target.innerHTML = `<img src="${url}" alt="업로드 이미지 미리보기">`;
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
  return { open: "접수 가능", closed: "접수 마감", pending: "접수 전", verify: "확인 필요" }[status] || "확인 필요";
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
  return { easy: "쉬움", normal: "보통", hard: "어려움" }[level] || "난이도 확인 필요";
}
