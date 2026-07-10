"use strict";

window.RF = {
  async loadJSON(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path} 로드 실패 (${response.status})`);
    return response.json();
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

  navToggle?.addEventListener("click", () => {
    nav?.classList.toggle("open");
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
    if (!event.target.closest(".rf-header-row")) {
      nav?.classList.remove("open");
    }
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

  input.addEventListener("input", showSuggestions);

  form.addEventListener("submit", () => {
    close();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-search-wrap")) {
      close();
    }
  });
}
