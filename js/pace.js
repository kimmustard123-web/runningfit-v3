"use strict";

const RACE_DISTANCES = [
  { key: "5K", label: "5K", km: 5 },
  { key: "10K", label: "10K", km: 10 },
  { key: "half", label: "하프", km: 21.0975 },
  { key: "full", label: "풀", km: 42.195 }
];

let currentDistanceKm = 10;
let currentGoalSeconds = 3000;
let currentPaceSeconds = 300;
let currentVdot = null;
let shoes = [];
let treadmillMode = "paceToSpeed";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  bindGoalForm();
  bindTools();
  await loadShoes();
  calculateAll();
});

function bindGoalForm() {
  $("raceDistancePreset")?.addEventListener("change", (event) => {
    const custom = event.target.value === "custom";
    $("customDistanceLabel").hidden = !custom;
  });

  $("goalForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateAll();
  });

  $("splitStep")?.addEventListener("change", renderSplits);
  $("strategyLevel")?.addEventListener("change", renderStrategy);
}

function bindTools() {
  $("intervalCalculate")?.addEventListener("click", renderIntervals);
  $("calorieCalculate")?.addEventListener("click", renderCalories);
  $("treadmillCalculate")?.addEventListener("click", renderTreadmill);

  document.querySelectorAll("[data-convert-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      treadmillMode = button.dataset.convertMode;
      document.querySelectorAll("[data-convert-mode]").forEach((item) => item.classList.toggle("active", item === button));
      $("treadmillPaceLabel").hidden = treadmillMode !== "paceToSpeed";
      $("treadmillSpeedLabel").hidden = treadmillMode !== "speedToPace";
      renderTreadmill();
    });
  });
}

async function loadShoes() {
  try {
    const payload = await fetch("./data/shoes.json").then((response) => {
      if (!response.ok) throw new Error(`shoes.json 로드 실패 (${response.status})`);
      return response.json();
    });
    const raw = Array.isArray(payload) ? payload : payload.shoes || [];
    shoes = raw.map(normalizeShoe);
  } catch (error) {
    console.error(error);
    shoes = [];
  }
}

function normalizeShoe(raw) {
  const derived = raw.runningFitDerived || raw.runningFit || {};
  const rec = derived.recommendation13 || {};
  const scores = derived.scores || {};
  const distance = rec.distance || derived.distanceFit || {};
  return {
    id: raw.id,
    brand: raw.brand || "-",
    modelKo: raw.modelKo || raw.modelEn || "-",
    modelEn: raw.modelEn || "-",
    carbonPlate: Boolean(raw.carbonPlate),
    scores: {
      training: numberOrNull(rec.purpose?.training ?? scores.training),
      race: numberOrNull(rec.purpose?.race ?? scores.race),
      dailyRunning: numberOrNull(rec.purpose?.dailyRunning ?? scores.dailyRunning)
    },
    distance: {
      "5K": numberOrNull(distance["5K"] ?? distance["5k"]),
      "10K": numberOrNull(distance["10K"] ?? distance["10k"]),
      half: numberOrNull(distance.half),
      full: numberOrNull(distance.full)
    }
  };
}

function calculateAll() {
  const preset = $("raceDistancePreset").value;
  const customDistance = Number($("customDistance").value);
  const distance = preset === "custom" ? customDistance : Number(preset);
  const hours = clampInt($("goalHours").value, 0, 99);
  const minutes = clampInt($("goalMinutes").value, 0, 59);
  const seconds = clampInt($("goalSeconds").value, 0, 59);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  if (!Number.isFinite(distance) || distance <= 0 || totalSeconds <= 0) {
    alert("거리와 목표 시간을 확인해주세요.");
    return;
  }

  currentDistanceKm = distance;
  currentGoalSeconds = totalSeconds;
  currentPaceSeconds = totalSeconds / distance;
  currentVdot = calculateVdot(distance, totalSeconds);

  renderPrimaryResults();
  renderSplits();
  renderPredictions();
  renderVdot();
  renderTrainingPaces();
  renderIntervals(true);
  renderTreadmill(true);
  renderStrategy();
  renderCalories();
  renderShoeRecommendations();
}

function renderPrimaryResults() {
  const paceText = formatPace(currentPaceSeconds);
  const speed = 3600 / currentPaceSeconds;
  $("resultGoalTime").textContent = formatDuration(currentGoalSeconds);
  $("resultPace").textContent = paceText;
  $("resultSpeed").textContent = speed.toFixed(1);
  $("result400").textContent = formatShort(currentPaceSeconds * 0.4);
  $("heroPace").textContent = `${paceText}/km`;
  $("heroSpeed").textContent = `${speed.toFixed(1)}km/h`;
  $("heroVdot").textContent = currentVdot ? currentVdot.toFixed(1) : "-";
}

function renderSplits() {
  const tbody = $("splitTableBody");
  if (!tbody) return;
  const step = Number($("splitStep").value) || 5;
  const points = [];
  for (let km = step; km < currentDistanceKm; km += step) points.push(km);
  if (!points.includes(currentDistanceKm)) points.push(currentDistanceKm);

  tbody.innerHTML = points.map((km) => {
    const label = Math.abs(km - currentDistanceKm) < 0.0001 ? finishLabel(currentDistanceKm) : `${trimNumber(km)}km`;
    return `<tr><td>${label}</td><td><strong>${formatDuration(currentPaceSeconds * km)}</strong></td><td>${formatPace(currentPaceSeconds)}/km</td></tr>`;
  }).join("");
}

function renderPredictions() {
  const container = $("predictionResults");
  if (!container) return;
  const predictions = RACE_DISTANCES.map((race) => {
    const predicted = riegelPrediction(currentGoalSeconds, currentDistanceKm, race.km);
    return `<div><span>${race.label}</span><strong>${formatDuration(predicted)}</strong><small>${formatPace(predicted / race.km)}/km</small></div>`;
  });
  container.innerHTML = predictions.join("");
}

function renderVdot() {
  $("vdotValue").textContent = currentVdot ? currentVdot.toFixed(1) : "-";
}

function renderTrainingPaces() {
  const container = $("trainingPaces");
  if (!container || !currentVdot) return;
  const vvo2 = velocityAtVo2(currentVdot); // m/min
  const zones = [
    { name: "회복·이지런", desc: "대화 가능한 강도", min: 0.59, max: 0.74 },
    { name: "롱런", desc: "오래 유지하는 유산소", min: 0.65, max: 0.78 },
    { name: "마라톤 페이스", desc: "지속주·목표 마라톤", min: 0.75, max: 0.84 },
    { name: "템포·역치", desc: "20~40분 지속", min: 0.83, max: 0.88 },
    { name: "인터벌", desc: "3~5분 반복", min: 0.95, max: 1.00 },
    { name: "반복주", desc: "짧고 빠른 질주", min: 1.05, max: 1.10 }
  ];
  container.innerHTML = zones.map((zone) => {
    const slow = paceFromVelocity(vvo2 * zone.min);
    const fast = paceFromVelocity(vvo2 * zone.max);
    return `<div><span>${zone.name}</span><strong>${formatPace(fast)}~${formatPace(slow)}</strong><small>${zone.desc}</small></div>`;
  }).join("");
}

function renderIntervals(syncWithGoal = false) {
  if (syncWithGoal && $("intervalBasePace")) $("intervalBasePace").value = formatPace(currentPaceSeconds * 0.92);
  const pace = parseClock($("intervalBasePace")?.value);
  const count = clampInt($("intervalCount")?.value, 1, 50);
  const container = $("intervalResults");
  if (!container || !pace) return;
  const distances = [100, 200, 400, 800, 1000];
  container.innerHTML = distances.map((meters) => `<div><span>${meters}m</span><strong>${formatShort(pace * meters / 1000)}</strong></div>`).join("") + `<p class="interval-total">${count}회 기준 · 빠른 구간 총 ${(count * 400 / 1000).toFixed(1)}km</p>`;
}

function renderTreadmill(syncWithGoal = false) {
  if (syncWithGoal && $("treadmillPace")) $("treadmillPace").value = formatPace(currentPaceSeconds);
  const result = $("treadmillResult");
  if (!result) return;
  if (treadmillMode === "paceToSpeed") {
    const pace = parseClock($("treadmillPace").value);
    result.textContent = pace ? `${(3600 / pace).toFixed(1)} km/h` : "입력 확인";
  } else {
    const speed = Number($("treadmillSpeed").value);
    result.textContent = speed > 0 ? `${formatPace(3600 / speed)} /km` : "입력 확인";
  }
}

function renderStrategy() {
  const container = $("strategyResults");
  if (!container) return;
  const level = $("strategyLevel").value;
  const config = {
    safe: [1.025, 1.00, 0.975],
    balanced: [1.015, 1.00, 0.985],
    aggressive: [1.008, 1.00, 0.992]
  }[level];
  const labels = ["초반 30%", "중반 50%", "후반 20%"];
  container.innerHTML = labels.map((label, index) => {
    const pace = currentPaceSeconds * config[index];
    return `<div><span>${label}</span><strong>${formatPace(pace)}/km</strong></div>`;
  }).join("");
}

function renderCalories() {
  const weight = Number($("runnerWeight")?.value);
  const result = $("calorieResult");
  if (!result) return;
  result.textContent = weight > 0 ? Math.round(weight * currentDistanceKm).toLocaleString("ko-KR") : "-";
}

function renderShoeRecommendations() {
  const container = $("paceShoeRecommendations");
  if (!container) return;
  if (!shoes.length) {
    container.innerHTML = '<p class="empty-message">러닝화 데이터를 불러오지 못했습니다.</p>';
    return;
  }
  const distanceKey = nearestDistanceKey(currentDistanceKm);
  const fastPace = currentPaceSeconds <= 300;
  const sorted = shoes.map((shoe) => {
    const distanceScore = shoe.distance[distanceKey] ?? 60;
    const purposeScore = fastPace ? (shoe.scores.race ?? shoe.scores.training ?? 60) : (shoe.scores.training ?? shoe.scores.dailyRunning ?? 60);
    const carbonBonus = fastPace && shoe.carbonPlate ? 4 : 0;
    return { ...shoe, match: Math.round(distanceScore * 0.58 + purposeScore * 0.42 + carbonBonus) };
  }).sort((a, b) => b.match - a.match).slice(0, 4);

  container.innerHTML = sorted.map((shoe, index) => `<a class="pace-shoe-card" href="./shoes.html?view=${fastPace ? 'race' : 'training'}#browse"><span class="shoe-rank">${index + 1}</span><div><small>${escapeHtml(shoe.brand)}</small><strong>${escapeHtml(shoe.modelKo)}</strong><span>${escapeHtml(shoe.modelEn)}</span></div><b>${shoe.match}</b></a>`).join("");
  $("seeAllShoesLink").href = `./shoes.html?view=${fastPace ? "race" : "training"}#browse`;
}

function calculateVdot(distanceKm, totalSeconds) {
  const minutes = totalSeconds / 60;
  const velocity = distanceKm * 1000 / minutes; // m/min
  const oxygenCost = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
  const percent = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
  const value = oxygenCost / percent;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function velocityAtVo2(vdot) {
  // Positive root of 0.000104v² + 0.182258v - (VDOT+4.60) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -(vdot + 4.60);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

function paceFromVelocity(metersPerMinute) {
  return 1000 / metersPerMinute * 60;
}

function riegelPrediction(timeSeconds, distanceKm, targetKm) {
  return timeSeconds * Math.pow(targetKm / distanceKm, 1.06);
}

function nearestDistanceKey(km) {
  if (km <= 7.5) return "5K";
  if (km <= 15.5) return "10K";
  if (km <= 31) return "half";
  return "full";
}

function finishLabel(km) {
  if (Math.abs(km - 5) < 0.01) return "5K Finish";
  if (Math.abs(km - 10) < 0.01) return "10K Finish";
  if (Math.abs(km - 21.0975) < 0.01) return "Half Finish";
  if (Math.abs(km - 42.195) < 0.01) return "Full Finish";
  return `${trimNumber(km)}km Finish`;
}

function parseClock(value) {
  const parts = String(value || "").trim().split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function formatPace(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  let minutes = Math.floor(seconds / 60);
  let secs = Math.round(seconds % 60);
  if (secs === 60) { minutes += 1; secs = 0; }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatShort(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return minutes ? `${minutes}:${String(secs).padStart(2, "0")}` : `${secs}초`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "-";
  let rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  rounded -= hours * 3600;
  const minutes = Math.floor(rounded / 60);
  const secs = rounded - minutes * 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(2)).toString();
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
