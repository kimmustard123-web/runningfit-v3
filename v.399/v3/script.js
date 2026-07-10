const DATA_PATHS = {
  shoes: "data/shoes.json",
  nikeShoes: "database/nike/shoes-nike-batch-01.json",
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


/* V3.3 Recommendation MVP overrides */
function calculateScore(shoe, filters = {}) {
  let score = 48;
  const trainingToUse = { easy:["daily","jogging","neutral"], recovery:["recovery","max-cushion","daily"], lsd:["lsd","max-cushion","daily"], tempo:["tempo","lightweight","daily"], interval:["interval","lightweight","carbon"], race:["race","carbon","lightweight","marathon"], trail:["trail"] };
  if (filters.use && hasUse(shoe, filters.use)) score += 16;
  if (filters.training) (trainingToUse[filters.training] || []).forEach((use, i) => { if (hasUse(shoe, use)) score += i === 0 ? 14 : 8; });
  if (filters.runnerType === "beginnerPlus" && (hasUse(shoe,"daily") || hasUse(shoe,"beginner"))) score += 10;
  if (filters.runnerType === "heavy" && shoe.cushion >= 4) score += 12;
  if (filters.runnerType === "heavy" && shoe.stability >= 4) score += 8;
  if (filters.runnerType === "racePrep" && (hasUse(shoe,"tempo") || hasUse(shoe,"marathon") || hasUse(shoe,"race"))) score += 10;
  if (filters.runnerType === "record" && (hasUse(shoe,"carbon") || hasUse(shoe,"lightweight") || hasUse(shoe,"tempo"))) score += 12;
  if (filters.width && shoe.width === filters.width) score += 12;
  if (filters.width === "wide" && hasUse(shoe,"wide")) score += 8;
  if (filters.weeklyKm === "0-10" && (hasUse(shoe,"beginner") || hasUse(shoe,"daily"))) score += 10;
  if (filters.weeklyKm === "10-30" && (hasUse(shoe,"daily") || hasUse(shoe,"neutral"))) score += 10;
  if (filters.weeklyKm === "30-60" && (hasUse(shoe,"daily") || hasUse(shoe,"lsd") || hasUse(shoe,"max-cushion"))) score += 11;
  if (filters.weeklyKm === "60-100" && (hasUse(shoe,"max-cushion") || hasUse(shoe,"stability") || hasUse(shoe,"lsd"))) score += 13;
  if (filters.weeklyKm === "100+" && (hasUse(shoe,"max-cushion") || hasUse(shoe,"stability"))) score += 15;
  const weight = Number(filters.weight || 0);
  if (weight >= 100 && shoe.cushion >= 4) score += 12; else if (weight >= 90 && shoe.cushion >= 4) score += 10;
  if (weight >= 90 && shoe.stability >= 4) score += 8;
  if (weight <= 65 && (hasUse(shoe,"lightweight") || hasUse(shoe,"tempo"))) score += 6;
  if (filters.pain === "knee" && shoe.cushion >= 4) score += 12;
  if (filters.pain === "ankle" && shoe.stability >= 4) score += 12;
  if (filters.pain === "plantar" && shoe.cushion >= 4) score += 9;
  if (filters.pain === "shin" && shoe.cushion >= 4) score += 9;
  if (filters.pain === "achilles" && Number(shoe.dropMm || 0) >= 8) score += 8;
  if (filters.pain === "overpronation" && hasUse(shoe,"stability")) score += 14;
  if (filters.raceGoal === "half" && (hasUse(shoe,"tempo") || hasUse(shoe,"marathon") || hasUse(shoe,"daily"))) score += 8;
  if (filters.raceGoal === "full" && (hasUse(shoe,"marathon") || hasUse(shoe,"max-cushion") || hasUse(shoe,"lsd"))) score += 10;
  if (filters.raceGoal === "5k" && (hasUse(shoe,"interval") || hasUse(shoe,"lightweight"))) score += 8;
  if (filters.raceGoal === "10k" && (hasUse(shoe,"tempo") || hasUse(shoe,"race"))) score += 8;
  if (filters.preference === "soft" && shoe.cushion >= 4) score += 9;
  if (filters.preference === "stable" && shoe.stability >= 4) score += 9;
  if (filters.preference === "fast" && (hasUse(shoe,"tempo") || hasUse(shoe,"race") || hasUse(shoe,"carbon"))) score += 9;
  if (filters.preference === "light" && shoe.weightG <= 245) score += 9;
  if (filters.preference === "durable" && (hasUse(shoe,"daily") || hasUse(shoe,"stability"))) score += 7;
  if (!budgetMatch(shoe, filters.budget)) score -= 8;
  score += Math.min(8, Number(shoe.cushion || 0) + Number(shoe.stability || 0));
  return Math.max(1, Math.min(99, Math.round(score)));
}

function buildExpertAnalysis(shoe, filters = {}) {
  const reasons = [], cautions = [], matched = [];
  const weight = Number(filters.weight || 0);
  if (filters.training === "lsd") { if (hasUse(shoe,"lsd") || hasUse(shoe,"max-cushion") || hasUse(shoe,"daily")) { reasons.push("오늘 훈련이 LSD라면 빠른 반발력보다 장거리 후반까지 부담을 줄이는 쿠션과 안정적인 착화감이 중요합니다. 이 모델은 장거리 또는 데일리 성향과 맞아 우선순위가 올라갔습니다."); matched.push("LSD"); } else cautions.push("LSD 목적이라면 너무 공격적인 레이스화보다 쿠션이 충분한 모델도 함께 비교하는 것이 좋습니다."); }
  if (filters.training === "recovery" && shoe.cushion >= 4) { reasons.push("회복런은 기록보다 피로 누적을 줄이는 것이 중요합니다. 쿠션 점수가 높은 모델이라 회복 목적에 비교적 잘 맞습니다."); matched.push("회복런"); }
  if ((filters.training === "interval" || filters.training === "tempo")) { if (hasUse(shoe,"tempo") || hasUse(shoe,"interval") || hasUse(shoe,"lightweight")) { reasons.push("템포/인터벌은 발이 빨리 넘어가는 느낌과 무게가 중요합니다. 이 모델은 빠른 훈련에 맞는 성향이 포함되어 있습니다."); matched.push("스피드 훈련"); } else cautions.push("인터벌이나 템포런을 자주 한다면 더 가볍고 반발감이 있는 모델을 추가로 비교해볼 수 있습니다."); }
  if (filters.training === "race") { if (hasUse(shoe,"race") || hasUse(shoe,"carbon")) { reasons.push("레이스 목적이라면 무게, 반발감, 추진감이 중요합니다. 이 모델은 레이스 성향이 있어 기록 목표에 맞는 후보입니다."); matched.push("레이스"); } else cautions.push("순수 기록 단축만 목표라면 탄소화나 레이스 전용 모델을 별도로 비교하는 것이 좋습니다."); }
  if (filters.training === "trail") { if (hasUse(shoe,"trail")) { reasons.push("트레일은 접지력과 발 보호가 우선입니다. 이 모델은 트레일 용도로 분류되어 로드화보다 목적 적합성이 높습니다."); matched.push("트레일"); } else cautions.push("산길이나 비포장길 비중이 높다면 로드화보다 트레일화를 우선 비교해야 합니다."); }
  if (weight >= 90) { if (shoe.cushion >= 4) { reasons.push(`입력한 체중 ${weight}kg 기준에서는 충격 흡수 여유가 있는 모델이 실패 확률을 낮출 수 있습니다. 이 모델은 쿠션 점수가 높아 체중 부담을 고려한 선택지입니다.`); matched.push("체중 부담"); } else cautions.push("체중 부담을 고려하면 쿠션이 더 높은 모델도 함께 비교하는 것이 좋습니다."); }
  if (["30-60","60-100","100+"].includes(filters.weeklyKm) && (hasUse(shoe,"daily") || hasUse(shoe,"lsd") || hasUse(shoe,"stability") || hasUse(shoe,"max-cushion"))) { reasons.push(`주간 ${filters.weeklyKm}를 달리는 사용자는 한 번의 빠른 기록보다 누적 피로 관리가 중요합니다. 데일리/장거리 성향이 있는 모델이라 훈련 지속성 측면에서 유리합니다.`); matched.push("주간 거리"); }
  if (filters.raceGoal && filters.raceGoal !== "none") { if (["half","full"].includes(filters.raceGoal) && (hasUse(shoe,"marathon") || hasUse(shoe,"lsd") || hasUse(shoe,"max-cushion") || hasUse(shoe,"daily"))) { reasons.push(`${raceGoalLabel(filters.raceGoal)} 준비라면 대회 당일뿐 아니라 준비 과정의 긴 훈련을 소화할 신발이 필요합니다. 이 모델은 장거리 준비용 후보로 볼 수 있습니다.`); matched.push("대회 준비"); } if (["5k","10k"].includes(filters.raceGoal) && (hasUse(shoe,"tempo") || hasUse(shoe,"race") || hasUse(shoe,"lightweight"))) { reasons.push(`${raceGoalLabel(filters.raceGoal)} 기록을 노린다면 빠른 훈련과 레이스 대응이 중요합니다. 이 모델은 스피드 성향과 맞습니다.`); matched.push("기록 목표"); } }
  if (filters.pain === "knee" && shoe.cushion >= 4) { reasons.push("무릎 부담을 입력했습니다. 러닝화가 통증을 치료하지는 않지만, 쿠션 여유가 있는 모델은 충격 부담을 줄이는 선택지로 비교할 수 있습니다."); matched.push("무릎 부담"); }
  if (filters.pain === "overpronation") { if (hasUse(shoe,"stability") || shoe.stability >= 4) { reasons.push("과내전 고민이 있다면 중립 레이스화보다 안정성 높은 모델이 더 안전한 선택일 수 있습니다. 이 모델은 안정성 점수가 높습니다."); matched.push("과내전"); } else cautions.push("과내전이 뚜렷하다면 안정화 카테고리를 함께 비교하는 것이 좋습니다."); }
  if (filters.width === "wide") { if (shoe.width === "wide" || hasUse(shoe,"wide")) { reasons.push("발볼이 넓다고 입력했습니다. 이 모델은 발볼 고려 후보로 분류되어 일반 폭 모델보다 실착 실패 가능성을 낮출 수 있습니다."); matched.push("발볼"); } else cautions.push("발볼이 넓다면 같은 사이즈라도 압박이 생길 수 있어 와이드 옵션 또는 5mm 업을 비교하세요."); }
  if (filters.preference === "soft" && shoe.cushion >= 4) reasons.push("푹신한 착화감을 선호한다고 입력했습니다. 쿠션 점수가 높은 모델이라 선호 성향과 맞습니다.");
  if (filters.preference === "fast" && (hasUse(shoe,"tempo") || hasUse(shoe,"race") || hasUse(shoe,"carbon"))) reasons.push("빠른 반발감을 선호한다면 데일리 쿠션화보다 템포/레이스 성향의 모델이 더 만족스러울 수 있습니다. 이 모델은 빠른 훈련 후보입니다.");
  if (!budgetMatch(shoe, filters.budget)) cautions.push("선택한 예산 범위와 완전히 맞지 않을 수 있습니다. 실제 판매가는 시기와 판매처에 따라 달라지므로 구매 전 확인이 필요합니다.");
  if (!reasons.length) reasons.push("입력 조건과 완전히 특화되어 맞지는 않지만, 기본 스펙과 용도 분류 기준으로 비교 후보에 포함되었습니다.");
  if (!cautions.length) cautions.push("최종 선택 전 실제 착화감, 발볼, 반품 가능 여부를 확인하는 것이 좋습니다.");
  return { reasons:[...new Set(reasons)].slice(0,6), cautions:[...new Set(cautions)].slice(0,4), matched:[...new Set(matched)].slice(0,6) };
}

function buildCoachMessage(topShoe, filters, result) {
  if (!topShoe) return "조건을 조금 줄이면 더 좋은 추천을 만들 수 있습니다.";
  const parts = ["입력하신 조건을 종합해 보면, 단순히 브랜드 인기보다 현재 훈련 목적과 누적 피로 관리가 더 중요합니다."];
  if (filters.runnerType === "beginnerPlus" || filters.use === "beginner") parts.push("입문 단계에서는 너무 공격적인 레이스화보다 데일리 훈련을 안정적으로 시작할 수 있는 모델을 우선 추천합니다.");
  if (filters.training) parts.push(`오늘 훈련은 ${trainingLabel(filters.training)}로 입력되었습니다. 그래서 이 훈련에 맞는 용도 태그를 가진 모델의 점수를 높였습니다.`);
  if (filters.weeklyKm) parts.push(`주간 거리 ${filters.weeklyKm} 기준에서는 한 번의 빠른 기록보다 반복 사용 시 부담이 적은지가 중요합니다.`);
  if (Number(filters.weight || 0) >= 90) parts.push("체중 부담을 고려해 쿠션과 안정성 점수를 추천에 더 크게 반영했습니다.");
  if (filters.pain) parts.push(`${painLabel(filters.pain)} 고민이 입력되어 해당 부위에 부담을 줄일 가능성이 있는 성향을 우선 비교했습니다.`);
  parts.push(`그 결과 현재 조건에서는 ${topShoe.brand} ${topShoe.model}이 가장 높은 우선순위로 계산되었습니다.`);
  return parts.join(" ");
}

function renderRecommendedShoes(shoes, filters, title) {
  state.lastFilters = filters;
  const result = shoes.map(shoe => ({ ...shoe, score: calculateScore(shoe, filters), analysis: buildExpertAnalysis(shoe, filters) })).sort((a,b) => b.score - a.score).slice(0, 12);
  renderSummary(title, filters, result);
  renderShoeCards(result);
}

function renderShoes(shoes, filters, title) {
  state.lastFilters = filters;
  const result = filterShoes(shoes, filters).map(shoe => ({ ...shoe, score: calculateScore(shoe, filters), analysis: buildExpertAnalysis(shoe, filters) })).sort((a,b) => b.score - a.score);
  const count = document.querySelector("[data-result-count]");
  if (count) count.textContent = `${result.length}개`;
  renderSummary(title, filters, result.slice(0,3));
  renderShoeCards(result);
}

function renderSummary(title, filters, result) {
  const summary = document.querySelector("[data-recommend-summary]");
  if (!summary) return;
  summary.hidden = false;
  const top = result[0];
  summary.innerHTML = `<p class="eyebrow">${title}</p><h2>${top ? `${top.brand} ${top.model}` : "추천 후보 없음"}</h2><p class="coach-message">${buildCoachMessage(top, filters, result)}</p><div class="summary-grid"><div class="summary-box"><strong>추천 점수</strong><p>${top ? `${top.score}점 · ${scoreLabel(top.score)}` : "없음"}</p></div><div class="summary-box"><strong>훈련 목적</strong><p>${trainingLabel(filters.training || filters.use || "미선택")}</p></div><div class="summary-box"><strong>검증 상태</strong><p>공식 이미지/스펙 확인 전 항목은 확인 필요</p></div></div>`;
}

function shoeCard(shoe) {
  const imageSafe = shoe.officialImage && shoe.officialImageStatus === "verified";
  const reasons = shoe.analysis?.reasons?.slice(0,3) || [];
  const cautions = shoe.analysis?.cautions?.slice(0,2) || [];
  return `<article class="shoe-card">${imageSafe ? `<img src="${shoe.officialImage}" alt="${shoe.brand} ${shoe.model} 공식 이미지" />` : brandVisualCard(shoe)}<div class="shoe-top"><div><p class="eyebrow">${shoe.brand}</p><h3>${shoe.model}</h3></div><div class="score">${shoe.score}</div></div><div class="specs"><span>${shoe.priceRange}</span><span>${useLabelList(shoe.use)}</span><span>쿠션 ${shoe.cushion}/5</span><span>안정 ${shoe.stability}/5</span><span>${widthLabel(shoe.width)}</span><span>${shoe.dropMm}mm drop</span></div><p class="reason">${shoe.recommendReason}</p><div class="analysis-block"><strong>왜 추천하나요?</strong><ul class="mini-list">${reasons.map(item => `<li>${item}</li>`).join("")}</ul></div><div class="analysis-block caution"><strong>이런 경우는 비교 필요</strong><ul class="mini-list">${cautions.map(item => `<li>${item}</li>`).join("")}</ul></div><span class="source-status need">${shoe.officialImageStatusText || "공식 이미지 확인 필요"}</span><div class="card-actions"><button class="btn primary" type="button" data-detail="${shoe.id}">상세보기</button><button class="btn ghost" type="button" data-compare="${shoe.id}">비교담기</button></div></article>`;
}

function brandVisualCard(shoe) {
  const visual = shoe.brandVisual || { bg:"#111827", accent:"#ffffff" };
  const tags = (shoe.expertTags || []).slice(0,3).join(" · ");
  return `<div class="brand-visual-card" style="--brand-bg:${visual.bg}; --brand-accent:${visual.accent};"><div class="brand-visual-top"><span>${shoe.brand}</span><small>${shoe.officialImageStatusText || "공식 이미지 확인 필요"}</small></div><strong>${shoe.model}</strong><p>${tags}</p><div class="brand-visual-specs"><span>${shoe.weightG || "-"}g</span><span>${shoe.dropMm || "-"}mm</span><span>${useLabelList(shoe.use).split(" · ")[0] || "RUN"}</span></div></div>`;
}

function fillSizeTargetOptions(shoes) {
  const select = document.querySelector("[data-size-target-select]");
  if (!select) return;
  select.innerHTML = shoes.map(shoe => `<option value="${shoe.id}">${shoe.brand} ${shoe.model}</option>`).join("");
}

function initSizeForm(shoes) {
  const form = document.querySelector("[data-size-form]");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const shoe = shoes.find(item => item.id === data.targetShoe);
    renderSizeResult(data, shoe);
  });
}

function renderSizeResult(data, shoe) {
  const result = document.querySelector("[data-size-result]");
  if (!result || !shoe) return;
  const baseSize = Number(data.baseSize);
  let adjust = 0;
  const notes = [];
  if (data.baseFit === "tight") { adjust += 5; notes.push("기준 신발이 딱 맞는다고 입력해 러닝 중 발 붓기를 고려해 5mm 여유를 반영했습니다."); }
  if (data.baseFit === "loose") { adjust -= 5; notes.push("기준 신발이 조금 크다고 입력해 5mm 다운 가능성을 반영했습니다."); }
  if (data.baseFit === "narrow") { adjust += 5; notes.push("기준 신발에서 발볼 압박이 있었다면 5mm 업 또는 와이드 옵션을 비교하는 것이 안전합니다."); }
  if (data.footWidth === "wide" && (shoe.width !== "wide" && !hasUse(shoe,"wide"))) { adjust += 5; notes.push("구매 예정 모델이 넓은 발볼 특화로 분류되지 않아 발볼이 넓은 사용자는 5mm 업을 비교하는 쪽으로 계산했습니다."); }
  const profile = shoe.sizeProfile || {};
  if (profile.fitLength === "slightly-short") { adjust += 5; notes.push("구매 예정 모델은 앞코 여유가 짧게 느껴질 수 있는 베타 성향으로 분류되어 5mm 업을 반영했습니다."); }
  if (profile.fitLength === "slightly-long" && data.baseFit !== "tight") { adjust -= 5; notes.push("구매 예정 모델은 여유 있는 성향으로 분류되어 무조건 업사이즈하지 않도록 계산했습니다."); }
  if (profile.widthFeel === "narrow" && data.footWidth === "wide") { adjust += 5; notes.push("발볼이 좁게 느껴질 수 있는 모델이라 발볼 넓은 사용자는 추가 여유가 필요할 수 있습니다."); }
  adjust = Math.max(-5, Math.min(10, adjust));
  const recommended = Math.round((baseSize + adjust) / 5) * 5;
  if (!notes.length) notes.push("기준 신발이 잘 맞고 구매 예정 모델도 큰 특이 성향이 없어 같은 사이즈 우선으로 계산했습니다.");
  result.hidden = false;
  result.innerHTML = `<div class="size-result-card"><p class="eyebrow">Size guide beta</p><h2>${shoe.brand} ${shoe.model}</h2><div class="size-number">${recommended}mm</div><p>추천 사이즈: <strong>${recommended}mm</strong> · 신뢰도: <strong>보통</strong></p><ul>${notes.map(note => `<li>${note}</li>`).join("")}</ul><div class="notice">사이즈 추천은 참고용입니다. 최종 구매 전 공식 사이즈표, 와이드 옵션, 반품 가능 여부를 반드시 확인하세요.</div></div>`;
}

function painLabel(value) { return { knee:"무릎", ankle:"발목", plantar:"족저근막", shin:"정강이", achilles:"아킬레스", overpronation:"과내전" }[value] || value; }
function raceGoalLabel(value) { return { "5k":"5km", "10k":"10km", half:"하프", full:"풀코스", ultra:"울트라" }[value] || value; }

async function initShoesPage() {
  const grid = document.querySelector("[data-shoe-grid]");
  if (!grid) return;
  const shoes = await loadShoes();
  fillBrandOptions(shoes);
  fillSizeTargetOptions(shoes);
  initRecommendationTabs();
  initBeginnerForm(shoes);
  initAdvancedForm(shoes);
  initSizeForm(shoes);
  initBrowseForm(shoes);
  const initialPanel = location.hash.replace("#", "");
  if (["advanced", "beginner", "browse", "size"].includes(initialPanel)) activateRecoTab(initialPanel);
  renderRecommendedShoes(shoes, { use:"beginner", training:"easy", weeklyKm:"0-10" }, "입문 추천 TOP");
  const modal = document.querySelector("[data-shoe-modal]");
  const close = document.querySelector("[data-modal-close]");
  if (modal && close) close.addEventListener("click", () => modal.close());
  const clear = document.querySelector("[data-clear-compare]");
  if (clear) clear.addEventListener("click", () => { state.compare = []; updateCompare(); });
}

/* =========================================================
   RunningFit V3 Update #001
   - Nike official batch merge
   - Official image / AI representative image rendering
   - Safe null handling for unverified specs
   ========================================================= */

function rfNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rfNormalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "").trim();
}

function rfShoeKey(shoe) {
  return `${rfNormalizeKey(shoe.brand)}::${rfNormalizeKey(shoe.model)}`;
}

function rfCushionScore(value) {
  if (typeof value === "number") return value;
  const text = normalizeText(value);
  if (text.includes("maximum") || text.includes("max") || text.includes("plush") || text.includes("premium")) return 5;
  if (text.includes("responsive") || text.includes("soft")) return 4;
  return 3;
}

function rfStabilityScore(value) {
  if (typeof value === "number") return value;
  const text = normalizeText(value);
  if (text.includes("stability") || text.includes("support")) return 5;
  if (text.includes("moderate") || text.includes("broad")) return 4;
  return 3;
}

function rfWidthValue(value) {
  const text = normalizeText(value);
  if (text.includes("wide")) return "wide";
  if (text.includes("narrow")) return "narrow";
  return "normal";
}

function rfPriceTierFromUsd(value) {
  const price = rfNumberOrNull(value);
  if (price === null) return "";
  if (price < 100) return "under100";
  if (price < 150) return "100to150";
  if (price < 200) return "150to200";
  return "over200";
}

function rfPriceRangeFromUsd(value) {
  const price = rfNumberOrNull(value);
  return price === null ? "가격 확인 필요" : `$${price}`;
}

function rfUsageToUse(shoe) {
  const source = [...(Array.isArray(shoe.usage) ? shoe.usage : []), shoe.category, shoe.surface].join(" ").toLowerCase();
  const uses = new Set();
  if (source.includes("daily") || source.includes("training") || source.includes("trainer")) uses.add("daily");
  if (source.includes("jog")) uses.add("jogging");
  if (source.includes("long")) uses.add("lsd");
  if (source.includes("recovery") || source.includes("easy")) uses.add("recovery");
  if (source.includes("race")) uses.add("race");
  if (source.includes("marathon")) uses.add("marathon");
  if (source.includes("trail")) uses.add("trail");
  if (source.includes("max") || source.includes("maximum") || source.includes("plush")) uses.add("max-cushion");
  if (source.includes("stability") || source.includes("support")) uses.add("stability");
  if (source.includes("responsive")) uses.add("tempo");
  if (!uses.size) uses.add("daily");
  return [...uses];
}

function rfNormalizeOfficialNikeShoe(shoe) {
  const use = rfUsageToUse(shoe);
  const officialImageVerified = Boolean(shoe.officialImage && shoe.verified);
  return {
    id: shoe.id || `nike-${rfNormalizeKey(shoe.model)}`,
    brand: shoe.brand || "Nike",
    model: shoe.model || "모델명 확인 필요",
    priceRange: rfPriceRangeFromUsd(shoe.price_usd),
    priceTier: rfPriceTierFromUsd(shoe.price_usd),
    use,
    rotationRole: use,
    cushion: rfCushionScore(shoe.cushion),
    stability: rfStabilityScore(shoe.stability),
    width: rfWidthValue(shoe.width),
    weightG: rfNumberOrNull(shoe.weight_g),
    dropMm: rfNumberOrNull(shoe.drop_mm),
    targetUser: `${shoe.category || "공식 검증 Nike 러닝화"} · ${shoe.surface || "surface null"}`,
    recommendReason: shoe.verificationNotes || `${shoe.brand || "Nike"} ${shoe.model || ""} 공식 검증 데이터입니다.`,
    officialImage: shoe.officialImage || "",
    officialImageStatus: officialImageVerified ? "verified" : "need_verification",
    officialImageStatusText: officialImageVerified ? "Nike 공식 이미지" : "공식 이미지 URL 미확인 · AI 생성 대표 이미지",
    officialImageSource: shoe.officialImageSource || null,
    officialSourceLink: shoe.officialProductUrl || shoe.officialNewsroomUrl || "",
    officialProductUrl: shoe.officialProductUrl || null,
    officialNewsroomUrl: shoe.officialNewsroomUrl || null,
    buyLink: "#",
    verified: Boolean(shoe.verified),
    verificationNotes: shoe.verificationNotes || null,
    brandVisual: { bg: "#111827", accent: "#f9fafb" },
    sizeProfile: {
      fitLength: "true-to-size",
      toeRoom: "normal",
      widthFeel: rfWidthValue(shoe.width),
      instep: "normal",
      heelHold: "normal",
      sizeAdvice: "공식 사이즈표와 실착 후 구매하세요."
    },
    expertTags: [shoe.category, shoe.surface].filter(Boolean),
    mvpNote: Boolean(shoe.verified) ? "공식 출처 검증 데이터" : "검증 필요"
  };
}

function rfMergeShoes(baseShoes, officialNikeShoes) {
  const map = new Map();
  (Array.isArray(baseShoes) ? baseShoes : []).forEach(shoe => map.set(rfShoeKey(shoe), shoe));
  (Array.isArray(officialNikeShoes) ? officialNikeShoes : [])
    .map(rfNormalizeOfficialNikeShoe)
    .forEach(shoe => map.set(rfShoeKey(shoe), shoe));
  return [...map.values()];
}

async function loadShoes() {
  if (state.shoes.length) return state.shoes;

  const baseData = await fetchJson(DATA_PATHS.shoes, []);
  const nikeData = await fetchJson(DATA_PATHS.nikeShoes, []);

  const baseShoes = Array.isArray(baseData) ? baseData : (baseData.shoes || []);
  const officialNikeShoes = Array.isArray(nikeData) ? nikeData : (nikeData.shoes || []);

  state.shoes = rfMergeShoes(baseShoes, officialNikeShoes);
  console.info(`RunningFit shoes loaded: ${state.shoes.length} models / Nike official batch: ${officialNikeShoes.length}`);
  return state.shoes;
}

function rfSpecValue(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "확인 필요" : `${value}${suffix}`;
}

function rfOfficialImageUsable(shoe) {
  return Boolean(shoe.officialImage && (shoe.officialImageStatus === "verified" || shoe.verified === true));
}

function rfShoeImageHtml(shoe) {
  if (rfOfficialImageUsable(shoe)) {
    return `
      <div class="rf-shoe-image-wrap" style="position:relative;overflow:hidden;border-radius:24px;background:#f8fafc;margin-bottom:18px;">
        <img src="${shoe.officialImage}" alt="${shoe.brand} ${shoe.model} 공식 이미지" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:contain;display:block;background:#f8fafc;padding:14px;box-sizing:border-box;" />
        <span style="position:absolute;left:14px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:12px;font-weight:800;">공식 이미지</span>
      </div>`;
  }

  const src = typeof getAIRepresentativeShoeImage === "function" ? getAIRepresentativeShoeImage(shoe) : "";
  return `
    <div class="rf-shoe-image-wrap" style="position:relative;overflow:hidden;border-radius:24px;background:#f8fafc;margin-bottom:18px;">
      ${src
        ? `<img src="${src}" alt="${shoe.brand} ${shoe.model} AI 생성 대표 이미지" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;" />`
        : brandVisualCard(shoe)
      }
      <span style="position:absolute;left:14px;top:14px;padding:7px 10px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:12px;font-weight:800;">AI 생성 대표 이미지</span>
    </div>`;
}

function shoeCard(shoe) {
  const reasons = shoe.analysis?.reasons?.slice(0,3) || shoe.explanation?.pros?.slice(0,3) || [];
  const cautions = shoe.analysis?.cautions?.slice(0,2) || shoe.explanation?.cons?.slice(0,2) || [];
  const imageStatusClass = rfOfficialImageUsable(shoe) ? "ok" : "need";
  const imageStatusText = rfOfficialImageUsable(shoe) ? "공식 이미지 사용" : "AI 생성 대표 이미지";

  return `
    <article class="shoe-card">
      ${rfShoeImageHtml(shoe)}
      <div class="shoe-top">
        <div>
          <p class="eyebrow">${shoe.brand}</p>
          <h3>${shoe.model}</h3>
        </div>
        <div class="score">${shoe.score || "-"}</div>
      </div>
      <div class="specs">
        <span>${shoe.priceRange || "가격 확인 필요"}</span>
        <span>${useLabelList(shoe.use || [])}</span>
        <span>쿠션 ${rfSpecValue(shoe.cushion, "/5")}</span>
        <span>안정 ${rfSpecValue(shoe.stability, "/5")}</span>
        <span>${widthLabel(shoe.width)}</span>
        <span>${rfSpecValue(shoe.dropMm, "mm drop")}</span>
      </div>
      <p class="reason">${shoe.recommendReason || shoe.verificationNotes || "공식 출처 확인이 필요한 항목입니다."}</p>
      <div class="analysis-block"><strong>왜 추천하나요?</strong><ul class="mini-list">${reasons.map(item => `<li>${item}</li>`).join("") || "<li>조건에 따라 비교 후보로 표시되었습니다.</li>"}</ul></div>
      <div class="analysis-block caution"><strong>이런 경우는 비교 필요</strong><ul class="mini-list">${cautions.map(item => `<li>${item}</li>`).join("") || "<li>최종 구매 전 공식 스펙과 실착감을 확인하세요.</li>"}</ul></div>
      <span class="source-status ${imageStatusClass}">${imageStatusText}</span>
      <div class="card-actions">
        <button class="btn primary" type="button" data-detail="${shoe.id}">상세보기</button>
        <button class="btn ghost" type="button" data-compare="${shoe.id}">비교담기</button>
      </div>
    </article>`;
}

function brandVisualCard(shoe) {
  const visual = shoe.brandVisual || { bg:"#111827", accent:"#ffffff" };
  const tags = (shoe.expertTags || []).slice(0,3).join(" · ");
  return `<div class="brand-visual-card" style="--brand-bg:${visual.bg}; --brand-accent:${visual.accent};"><div class="brand-visual-top"><span>${shoe.brand}</span><small>AI 생성 대표 이미지</small></div><strong>${shoe.model}</strong><p>${tags || "RunningFit"}</p><div class="brand-visual-specs"><span>${shoe.weightG || "-"}g</span><span>${shoe.dropMm || "-"}mm</span><span>${useLabelList(shoe.use || []).split(" · ")[0] || "RUN"}</span></div></div>`;
}
