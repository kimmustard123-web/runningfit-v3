"use strict";

let rows = [];
let editingSlug = null;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const shoeFields = [
  ["slug", "ID / slug", "text", true],
  ["brand", "브랜드", "text", true],
  ["model_name_ko", "한글 모델명", "text"],
  ["model_name", "영문 모델명", "text", true],
  ["category", "주 용도", "select", false, "daily|training|race|stability|easy"],
  ["purpose", "목적 태그(쉼표)", "text"],
  ["aliases", "검색 별칭(쉼표)", "text"],
  ["price", "가격", "number"],
  ["weight_g", "무게(g)", "number"],
  ["drop_mm", "드롭(mm)", "number"],
  ["heel_stack_mm", "뒤꿈치 스택(mm)", "number"],
  ["forefoot_stack_mm", "앞꿈치 스택(mm)", "number"],
  ["width_fit", "발볼", "select", false, "narrow|narrow_to_standard|standard|wide"],
  ["toe_box_height", "토박스 높이", "select", false, "low|standard|high|unknown"],
  ["heel_support", "힐 지지", "select", false, "low|medium|high"],
  ["carbon_plate", "카본 플레이트", "checkbox"],
  ["plate_type", "플레이트 유형", "text"],
  ["score_beginner", "첫 러닝 점수", "number"],
  ["score_daily", "매일 러닝 점수", "number"],
  ["score_training", "훈련용 점수", "number"],
  ["score_race", "대회용 점수", "number"],
  ["image_url", "이미지 경로", "text"],
  ["image_alt", "이미지 설명", "text"],
  ["official_url", "출처 / 공식 URL", "url"],
  ["source_name", "출처명", "text"],
  ["source_checked_at", "확인일", "date"],
  ["description", "설명", "textarea"],
  ["pros", "장점(쉼표)", "text"],
  ["cons", "단점(쉼표)", "text"],
  ["status", "공개 상태", "select", false, "published|draft|hidden|archived"]
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  const session = await api("/api/admin-session");
  if (!session.configured) {
    showLogin(`Vercel 환경변수가 더 필요합니다: ${(session.missing || []).join(", ")}`);
    return;
  }
  if (session.authenticated) openApp();
  else showLogin("");
}

function bindEvents() {
  $("#serverLogin").onclick = login;
  $("#localLogin").hidden = true;
  $("#logout").onclick = logout;
  $("#addNew").onclick = () => openEditor();
  $("#search").oninput = renderList;
  $("#statusFilter").onchange = renderList;
  $("#closeEditor").onclick = $("#cancelEditor").onclick = () => $("#editor").close();
  $("#editorForm").onsubmit = saveEditor;
  $("#list").onclick = onListClick;
  $$(".sidebar nav button").forEach((button) => {
    button.onclick = () => {
      const view = button.dataset.view;
      if (view === "dashboard") showView("dashboard");
      else if (view === "shoes") showView("shoes");
      else alert("대회·코스 관리자 DB 연결은 다음 단계에서 활성화됩니다.");
    };
  });
}

function showLogin(message) {
  $("#loginView").hidden = false;
  $("#appView").hidden = true;
  $("#loginMessage").textContent = message || "Vercel에 등록한 ADMIN_PASSWORD를 입력하세요.";
  const details = $("#serverLogin").closest("details");
  details.open = true;
  $("#adminEmail").closest("label").hidden = true;
  $("#adminPassword").placeholder = "관리자 비밀번호";
}

async function login() {
  const password = $("#adminPassword").value;
  if (!password) {
    $("#loginMessage").textContent = "관리자 비밀번호를 입력하세요.";
    return;
  }
  try {
    await api("/api/admin-login", { method: "POST", body: JSON.stringify({ password }) });
    openApp();
  } catch (error) {
    $("#loginMessage").textContent = error.message;
  }
}

async function logout() {
  await api("/api/admin-logout", { method: "POST" }).catch(() => null);
  location.reload();
}

async function openApp() {
  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  $("#modeBadge").textContent = "Supabase 운영 모드";
  showView("dashboard");
  await loadShoes();
}

function showView(view) {
  $$(".view").forEach((element) => element.classList.remove("active"));
  $$(".sidebar nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#addNew").hidden = view !== "shoes";
  if (view === "dashboard") {
    $("#pageTitle").textContent = "대시보드";
    $("#dashboardView").classList.add("active");
  } else {
    $("#pageTitle").textContent = "러닝화 관리";
    $("#listView").classList.add("active");
    renderList();
  }
}

async function loadShoes() {
  try {
    const data = await api("/api/admin-shoes");
    rows = data.shoes || [];
    renderDashboard();
    renderList();
  } catch (error) {
    alert(error.message);
  }
}

function renderDashboard() {
  const published = rows.filter((row) => row.status === "published").length;
  const hidden = rows.length - published;
  $("#summaryCards").innerHTML = `
    <article class="summary-card"><span>러닝화</span><b>${rows.length}</b><small>Supabase 전체</small></article>
    <article class="summary-card"><span>공개</span><b>${published}</b><small>사이트 노출</small></article>
    <article class="summary-card"><span>비공개</span><b>${hidden}</b><small>초안·숨김·보관</small></article>
  `;
}

function renderList() {
  const q = $("#search").value.trim().toLowerCase();
  const filter = $("#statusFilter").value;
  const visible = rows.filter((row) => {
    const haystack = `${row.slug} ${row.brand} ${row.model_name} ${row.model_name_ko}`.toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    const isPublished = row.status === "published";
    const matchesStatus = filter === "all" || (filter === "published" && isPublished) || (filter === "hidden" && !isPublished);
    return matchesSearch && matchesStatus;
  });
  $("#stats").innerHTML = `<span>전체 <b>${rows.length}</b></span><span>검색 결과 <b>${visible.length}</b></span>`;
  $("#list").innerHTML = visible.map((row) => {
    const image = row.image_url ? `<img src="../${String(row.image_url).replace(/^\.\//, "")}" alt="" loading="lazy">` : `<div class="row-placeholder"></div>`;
    return `<article class="row">
      ${image}
      <div><h3>${esc(row.brand)} ${esc(row.model_name_ko || row.model_name)}</h3><p>${esc(row.slug)} · ${esc(row.category || "용도 미정")} · ${row.status === "published" ? "공개" : "비공개"}</p></div>
      <div class="row-actions">
        <button data-action="edit" data-slug="${esc(row.slug)}">수정</button>
        <button data-action="toggle" data-slug="${esc(row.slug)}">${row.status === "published" ? "숨김" : "공개"}</button>
        <button data-action="delete" data-slug="${esc(row.slug)}">삭제</button>
      </div>
    </article>`;
  }).join("") || `<div class="empty">검색 결과가 없습니다.</div>`;
}

function fieldHtml(row, field) {
  const [key, label, kind, required, options] = field;
  const value = row[key];
  if (kind === "checkbox") return `<label class="checkbox-line"><input name="${key}" type="checkbox" ${value ? "checked" : ""}><span>${label}</span></label>`;
  if (kind === "textarea") return `<label class="wide"><span>${label}</span><textarea name="${key}">${esc(value)}</textarea></label>`;
  if (kind === "select") return `<label><span>${label}</span><select name="${key}">${options.split("|").map((option) => `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
  return `<label><span>${label}${required ? " *" : ""}</span><input name="${key}" type="${kind}" value="${esc(Array.isArray(value) ? value.join(", ") : value)}" ${required ? "required" : ""} ${key === "slug" && editingSlug ? "readonly" : ""}></label>`;
}

function openEditor(row = null) {
  editingSlug = row?.slug || null;
  const draft = row ? structuredClone(row) : {
    slug: "", brand: "", model_name: "", model_name_ko: "", category: "daily", purpose: ["dailyRunning"], aliases: [],
    carbon_plate: false, plate_type: "none", score_beginner: 0, score_daily: 0, score_training: 0, score_race: 0,
    status: "published", source_name: "RunningFit Admin"
  };
  $("#editorTitle").textContent = row ? "러닝화 수정" : "새 러닝화 추가";
  $("#fields").innerHTML = shoeFields.map((field) => fieldHtml(draft, field)).join("");
  $("#editor").showModal();
}

async function saveEditor(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {};
  for (const [key, , kind] of shoeFields) {
    const element = event.currentTarget.elements[key];
    if (kind === "checkbox") payload[key] = element.checked;
    else if (kind === "number") payload[key] = element.value === "" ? null : Number(element.value);
    else payload[key] = String(form.get(key) || "").trim();
  }
  try {
    if (editingSlug) {
      await api(`/api/admin-shoes?slug=${encodeURIComponent(editingSlug)}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/admin-shoes", { method: "POST", body: JSON.stringify(payload) });
    }
    $("#editor").close();
    await loadShoes();
  } catch (error) {
    alert(error.message);
  }
}

async function onListClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const row = rows.find((item) => item.slug === button.dataset.slug);
  if (!row) return;
  if (button.dataset.action === "edit") openEditor(row);
  if (button.dataset.action === "toggle") {
    const status = row.status === "published" ? "hidden" : "published";
    await api(`/api/admin-shoes?slug=${encodeURIComponent(row.slug)}`, { method: "PUT", body: JSON.stringify({ ...row, status }) });
    await loadShoes();
  }
  if (button.dataset.action === "delete" && confirm(`${row.model_name_ko || row.model_name}을 완전히 삭제할까요?`)) {
    await api(`/api/admin-shoes?slug=${encodeURIComponent(row.slug)}`, { method: "DELETE" });
    await loadShoes();
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
