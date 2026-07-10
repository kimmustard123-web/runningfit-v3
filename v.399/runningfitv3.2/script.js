const SHOES_DATA_PATH = "./data/shoes.json";

let allShoes = [];
let currentShoes = [];

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  bindSearchOverlay();
  bindMobileNav();
  bindLoginModal();
  bindPaceCalculator();

  try {
    const res = await fetch(SHOES_DATA_PATH);
    if (!res.ok) throw new Error("shoes.json 로드 실패");

    const data = await res.json();
    allShoes = Array.isArray(data) ? data : [];
    currentShoes = [...allShoes];

    initHomeSections();
    initShoesPage();
    bindGlobalSearch();
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   COMMON
========================= */

function getName(shoe) {
  return shoe.nameKo || shoe.koreanName || shoe.modelKo || shoe.name || shoe.model || "이름 없음";
}

function getBrand(shoe) {
  return shoe.brand || "브랜드 없음";
}

function getScore(shoe) {
  return shoe.score || shoe.rfScore || shoe.recommendScore || 0;
}

function getPurpose(shoe) {
  const p = shoe.purpose || shoe.category || shoe.type || "";
  return Array.isArray(p) ? p.join(" ") : String(p);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s/g, "");
}

function getSearchText(shoe) {
  return normalizeText([
    shoe.brand,
    shoe.name,
    shoe.model,
    shoe.nameKo,
    shoe.modelKo,
    shoe.koreanName,
    shoe.alias,
    shoe.aliases,
    shoe.searchTerms,
    shoe.koreanSearch,
    shoe.initial,
    shoe.chosung,
    shoe.purpose,
    shoe.category,
    shoe.type
  ].flat().join(" "));
}

function filterShoes(keyword) {
  const q = normalizeText(keyword);
  if (!q) return allShoes;
  return allShoes.filter((shoe) => getSearchText(shoe).includes(q));
}

/* =========================
   SEARCH
========================= */

function bindSearchOverlay() {
  const overlay = document.querySelector(".search-overlay");
  const openBtns = document.querySelectorAll("[data-open-search], .global-search");
  const closeBtn = document.querySelector("[data-close-search], #closeSearch");
  const input = document.querySelector("#overlaySearchInput, .search-top input");
  const results = document.querySelector("#simpleResults, .simple-results");

  if (!overlay) return;

  openBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      overlay.classList.add("active");
      setTimeout(() => input && input.focus(), 50);
    });
  });

  closeBtn?.addEventListener("click", () => {
    overlay.classList.remove("active");
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("active");
  });

  input?.addEventListener("input", () => {
    if (!results) return;

    const items = filterShoes(input.value).slice(0, 8);

    if (!input.value.trim()) {
      results.innerHTML = "";
      return;
    }

    results.innerHTML = items.map((shoe) => `
      <button type="button" onclick="goShoesSearch('${escapeQuote(getName(shoe))}')">
        ${getName(shoe)}
        <span>${getBrand(shoe)} · ${getPurpose(shoe) || "러닝화"}</span>
      </button>
    `).join("");
  });
}

function bindGlobalSearch() {
  const inputs = document.querySelectorAll(".global-search input, #globalSearchInput");

  inputs.forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const q = input.value.trim();
      if (!q) return;
      location.href = `shoes.html?search=${encodeURIComponent(q)}`;
    });
  });
}

function goShoesSearch(keyword) {
  location.href = `shoes.html?search=${encodeURIComponent(keyword)}`;
}

function escapeQuote(text) {
  return String(text).replace(/'/g, "\\'");
}

/* =========================
   HOME
========================= */

function initHomeSections() {
  renderTopShoes();
  renderNewShoes();
  renderPurposeCards();
}

function renderTopShoes() {
  const target =
    document.querySelector("#weeklyTop5") ||
    document.querySelector("[data-section='weekly-top5']");

  if (!target) return;

  const shoes = [...allShoes]
    .sort((a, b) => getScore(b) - getScore(a))
    .slice(0, 5);

  target.innerHTML = shoes.map((shoe, index) => createTopShoeCard(shoe, index + 1)).join("");
}

function renderNewShoes() {
  const target =
    document.querySelector("#newShoes") ||
    document.querySelector("[data-section='new-shoes']");

  if (!target) return;

  const shoes = [...allShoes]
    .filter((shoe) => shoe.isNew || shoe.releaseYear || shoe.year)
    .sort((a, b) => Number(b.releaseYear || b.year || 0) - Number(a.releaseYear || a.year || 0))
    .slice(0, 8);

  target.innerHTML = shoes.map((shoe, index) => createTopShoeCard(shoe, index + 1)).join("");
}

function createTopShoeCard(shoe, rank) {
  return `
    <article class="top-shoe-card">
      <div class="top-shoe-rank">${rank}</div>
      <strong>${getName(shoe)}</strong>
      <span>${getBrand(shoe)}</span>
      <span>${getPurpose(shoe) || "러닝화 추천"}</span>
    </article>
  `;
}

function renderPurposeCards() {
  const target =
    document.querySelector("#purposeTopGrid") ||
    document.querySelector("[data-section='purpose-top']");

  if (!target) return;

  const cards = [
    {
      key: "첫",
      label: "FIRST",
      title: "첫 러닝화 TOP10",
      desc: "처음 러닝을 시작하는 사람을 위한 추천"
    },
    {
      key: "매일",
      label: "DAILY",
      title: "매일 러닝 TOP10",
      desc: "꾸준히 신기 좋은 데일리 러닝화"
    },
    {
      key: "훈련",
      label: "TRAINING",
      title: "훈련용 TOP10",
      desc: "페이스주, 지속주, 장거리 훈련용"
    },
    {
      key: "대회",
      label: "RACE",
      title: "대회용 TOP10",
      desc: "기록 향상과 레이스를 위한 추천"
    }
  ];

  target.innerHTML = cards.map((card) => `
    <a class="purpose-card" href="shoes.html?purpose=${encodeURIComponent(card.key)}">
      <span>${card.label}</span>
      <h3>${card.title}</h3>
      <p>${card.desc}</p>
    </a>
  `).join("");
}

/* =========================
   SHOES PAGE
========================= */

function initShoesPage() {
  const listEl =
    document.querySelector("#shoesList") ||
    document.querySelector("#shoeList") ||
    document.querySelector(".shoe-grid") ||
    document.querySelector(".shoes-grid");

  if (!listEl) return;

  bindRecommendTabs();
  bindShoeFilters(listEl);
  applyUrlSearch(listEl);
}

function bindRecommendTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".reco-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      document.querySelector(`[data-panel="${target}"]`)?.classList.add("active");
    });
  });
}

function bindShoeFilters(listEl) {
  const searchInput =
    document.querySelector("#shoeSearch") ||
    document.querySelector("#searchInput") ||
    document.querySelector(".filter-panel input[type='search']") ||
    document.querySelector(".filter-panel input");

  const brandSelect = document.querySelector("#brandFilter");
  const purposeSelect = document.querySelector("#purposeFilter");

  const render = () => {
    let shoes = [...allShoes];

    if (searchInput?.value.trim()) {
      shoes = filterShoes(searchInput.value);
    }

    if (brandSelect?.value) {
      shoes = shoes.filter((shoe) => normalizeText(getBrand(shoe)) === normalizeText(brandSelect.value));
    }

    if (purposeSelect?.value) {
      shoes = shoes.filter((shoe) => normalizeText(getPurpose(shoe)).includes(normalizeText(purposeSelect.value)));
    }

    currentShoes = shoes;
    renderShoes(listEl, shoes);
  };

  searchInput?.addEventListener("input", render);
  brandSelect?.addEventListener("change", render);
  purposeSelect?.addEventListener("change", render);

  render();
}

function applyUrlSearch(listEl) {
  const params = new URLSearchParams(location.search);
  const search = params.get("search");
  const purpose = params.get("purpose");

  if (search) {
    const input =
      document.querySelector("#shoeSearch") ||
      document.querySelector("#searchInput") ||
      document.querySelector(".filter-panel input");

    if (input) input.value = search;
    renderShoes(listEl, filterShoes(search));
    return;
  }

  if (purpose) {
    const shoes = allShoes.filter((shoe) =>
      normalizeText(getPurpose(shoe)).includes(normalizeText(purpose))
    );
    renderShoes(listEl, shoes);
  }
}

function renderShoes(target, shoes) {
  if (!target) return;

  if (!shoes.length) {
    target.innerHTML = `
      <div class="empty-state">
        <h3>검색 결과가 없습니다.</h3>
        <p>브랜드명, 모델명, 한글명, 초성으로 다시 검색해보세요.</p>
      </div>
    `;
    return;
  }

  target.innerHTML = shoes.map((shoe) => `
    <article class="shoe-card">
      <div class="shoe-top">
        <div>
          <div class="brand-label">${getBrand(shoe)}</div>
          <h3>${getName(shoe)}</h3>
        </div>
        <div class="score-pill">${getScore(shoe) || "-"}</div>
      </div>

      <div class="badge-row">
        ${createRankBadges(shoe)}
      </div>

      <div class="spec-list">
        <div><span>용도</span><strong>${getPurpose(shoe) || "-"}</strong></div>
        <div><span>드롭</span><strong>${shoe.drop ?? shoe.offset ?? "-"}</strong></div>
        <div><span>무게</span><strong>${shoe.weight ?? "-"}</strong></div>
        <div><span>가격</span><strong>${shoe.price ?? shoe.priceKo ?? "-"}</strong></div>
      </div>

      <button class="btn ghost" type="button">자세히 보기</button>
    </article>
  `).join("");
}

function createRankBadges(shoe) {
  const badges = [];

  if (shoe.popularRank && shoe.popularRank <= 10) badges.push(`인기 TOP${shoe.popularRank}`);
  if (shoe.beginnerRank && shoe.beginnerRank <= 10) badges.push(`첫 러닝화 TOP${shoe.beginnerRank}`);
  if (shoe.dailyRank && shoe.dailyRank <= 10) badges.push(`매일 러닝 TOP${shoe.dailyRank}`);
  if (shoe.trainingRank && shoe.trainingRank <= 10) badges.push(`훈련용 TOP${shoe.trainingRank}`);
  if (shoe.raceRank && shoe.raceRank <= 10) badges.push(`대회용 TOP${shoe.raceRank}`);

  return badges.map((badge) => `<span class="rank-badge">${badge}</span>`).join("");
}

/* =========================
   MOBILE NAV / LOGIN
========================= */

function bindMobileNav() {
  const links = document.querySelectorAll(".mobile-bottom-nav a, .desktop-nav a, .site-nav a");
  const path = location.pathname.split("/").pop() || "index.html";

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    if (href === path || (path === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

function bindLoginModal() {
  const modal = document.querySelector(".modal-backdrop");
  const openBtns = document.querySelectorAll("[data-open-login], .login-btn");
  const closeBtn = document.querySelector(".modal-close");

  if (!modal) return;

  openBtns.forEach((btn) => {
    btn.addEventListener("click", () => modal.classList.add("show"));
  });

  closeBtn?.addEventListener("click", () => modal.classList.remove("show"));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("show");
  });
}

/* =========================
   PACE CALCULATOR
========================= */

function bindPaceCalculator() {
  const distanceInput = document.querySelector("#paceDistance");
  const hourInput = document.querySelector("#paceHour");
  const minInput = document.querySelector("#paceMinute");
  const secInput = document.querySelector("#paceSecond");
  const result = document.querySelector("#paceResult");

  if (!distanceInput || !result) return;

  const calculate = () => {
    const km = Number(distanceInput.value || 0);
    const h = Number(hourInput?.value || 0);
    const m = Number(minInput?.value || 0);
    const s = Number(secInput?.value || 0);

    const totalSeconds = h * 3600 + m * 60 + s;

    if (!km || !totalSeconds) {
      result.textContent = "-";
      return;
    }

    const pace = totalSeconds / km;
    const paceMin = Math.floor(pace / 60);
    const paceSec = Math.round(pace % 60);

    result.textContent = `${paceMin}'${String(paceSec).padStart(2, "0")}"/km`;
  };

  [distanceInput, hourInput, minInput, secInput].forEach((input) => {
    input?.addEventListener("input", calculate);
  });
}

