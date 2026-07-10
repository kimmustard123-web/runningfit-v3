"use strict";

const rfJsonCache = new Map();

window.RF = {
  async loadJSON(path, options = {}) {
    const useMemoryCache = options.memoryCache !== false;
    if (useMemoryCache && rfJsonCache.has(path)) return rfJsonCache.get(path);

    const request = fetch(path, {
      cache: options.cache || "default",
      signal: options.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error(`${path} 로드 실패 (${response.status})`);
      return response.json();
    }).catch((error) => {
      rfJsonCache.delete(path);
      throw error;
    });

    if (useMemoryCache) rfJsonCache.set(path, request);
    return request;
  },

  debounce(callback, delay = 140) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  },

  esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  },

  chosung(text) {
    const initials = [
      "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
      "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
    ];

    return String(text).split("").map((character) => {
      const code = character.charCodeAt(0) - 0xac00;
      return code < 0 || code > 11171
        ? character
        : initials[Math.floor(code / 588)];
    }).join("");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  bindHeader();
  await bindGlobalSearch();
});

function bindHeader() {
  const nav = document.querySelector("[data-nav]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const header = document.querySelector(".rf-header");

  let backdrop = document.querySelector(".mobile-nav-backdrop");
  if (!backdrop && header) {
    backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "mobile-nav-backdrop";
    backdrop.setAttribute("aria-label", "메뉴 닫기");
    header.insertAdjacentElement("afterend", backdrop);
  }

  const setMenu = (isOpen) => {
    nav?.classList.toggle("open", isOpen);
    backdrop?.classList.toggle("open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
    navToggle?.setAttribute("aria-expanded", String(isOpen));
    navToggle?.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
  };

  navToggle?.setAttribute("aria-expanded", "false");
  navToggle?.setAttribute("aria-haspopup", "true");

  navToggle?.addEventListener("click", () => {
    setMenu(!nav?.classList.contains("open"));
  });

  backdrop?.addEventListener("click", () => setMenu(false));
  nav?.querySelectorAll("a").forEach((anchor) => {
    anchor.addEventListener("click", () => setMenu(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenu(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) setMenu(false);
  });

  const savedTheme = localStorage.getItem("rf-theme");
  if (savedTheme === "dark") {
    document.documentElement.dataset.theme = "dark";
  }

  document.querySelector("#themeToggle")?.addEventListener("click", () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = isDark ? "light" : "dark";
    localStorage.setItem("rf-theme", isDark ? "light" : "dark");
  });

  const page = location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".top-nav a[href]").forEach((anchor) => {
    const href = (anchor.getAttribute("href") || "")
      .split("#")[0]
      .replace("./", "");

    anchor.classList.toggle("active", href === page);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".rf-header-row") && !event.target.closest(".top-nav")) {
      setMenu(false);
    }
  });

  ensureMobileBottomNav(page);
}

function ensureMobileBottomNav(page) {
  let bottomNav = document.querySelector(".mobile-bottom-nav");

  if (!bottomNav) {
    bottomNav = document.createElement("nav");
    bottomNav.className = "mobile-bottom-nav";
    bottomNav.setAttribute("aria-label", "모바일 하단 메뉴");
    bottomNav.innerHTML = `
      <a href="./index.html">홈</a>
      <a href="./shoes.html">러닝화</a>
      <a href="./pace.html">페이스</a>
      <a href="./races.html">대회</a>
      <a href="./profile.html">프로필</a>
    `;
    document.body.append(bottomNav);
  }

  const aliases = {
    "my-shoes.html": "profile.html",
    "run-log.html": "profile.html",
    "weather.html": "index.html",
    "courses.html": "index.html"
  };
  const activePage = aliases[page] || page;

  bottomNav.querySelectorAll("a[href]").forEach((anchor) => {
    const href = (anchor.getAttribute("href") || "").replace("./", "");
    anchor.classList.toggle("active", href === activePage);
    if (href === activePage) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  });
}

async function bindGlobalSearch() {
  const input = document.getElementById("globalSearchInput");
  const box = document.getElementById("globalSearchSuggestions");
  const form = document.getElementById("globalSearchForm");

  if (!input || !box || !form) return;

  let shoes = [];

  try {
    const payload = await RF.loadJSON("./data/shoes.json");
    const raw = Array.isArray(payload) ? payload : payload.shoes || [];

    shoes = raw.map((shoe) => {
      const searchValues = [
        shoe.brand,
        shoe.modelKo,
        shoe.modelEn,
        ...(shoe.search?.ko || []),
        ...(shoe.search?.en || []),
        ...(shoe.search?.aliases || [])
      ].filter(Boolean);

      const searchText = searchValues.join(" ").toLowerCase();

      return {
        id: shoe.id,
        brand: shoe.brand || "-",
        ko: shoe.modelKo || shoe.modelEn || "-",
        en: shoe.modelEn || "-",
        search: searchText,
        chosung: RF.chosung(searchText)
      };
    });
  } catch (error) {
    console.error(error);
  }

  const close = () => {
    box.classList.remove("open");
    box.innerHTML = "";
  };

  const showSuggestions = () => {
    const query = input.value.trim().toLowerCase();

    if (!query || !shoes.length) {
      close();
      return;
    }

    const queryChosung = RF.chosung(query);
    const matches = shoes
      .filter((shoe) =>
        shoe.search.includes(query) ||
        shoe.chosung.includes(queryChosung)
      )
      .slice(0, 7);

    box.innerHTML = matches.map((shoe) => `
      <a href="./shoes.html?q=${encodeURIComponent(query)}#browse">
        <strong>${RF.esc(shoe.ko)}</strong>
        <small>${RF.esc(shoe.brand)} · ${RF.esc(shoe.en)}</small>
      </a>
    `).join("");

    box.classList.toggle("open", matches.length > 0);
  };

  input.addEventListener("input", RF.debounce(showSuggestions, 120));

  form.addEventListener("submit", () => {
    close();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-search-wrap")) {
      close();
    }
  });
}
