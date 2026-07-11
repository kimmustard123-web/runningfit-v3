"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.querySelector(".home-layout")) return;

  renderHomeWeather();

  try {
    const payload = await RF.loadJSON("./data/shoes.json");
    const raw = Array.isArray(payload) ? payload : payload.shoes || [];
    const shoes = raw.map(normalizeHomeShoe);

    renderStrip("weeklyPopularShoes", [...shoes].sort((a, b) => (b.daily ?? -1) - (a.daily ?? -1)).slice(0, 5), "popular");
    renderStrip("newReleaseShoes", shoes.slice(-8).reverse(), "new");
    renderRank("beginnerTopShoes", shoes, "first");
    renderRank("dailyTopShoes", shoes, "daily");
    renderRank("trainingTopShoes", shoes, "training");
    renderRank("raceTopShoes", shoes, "race");
    renderUpcomingRaces();
    renderFeaturedCourse();
  } catch (error) {
    console.error(error);
  }
});

function normalizeHomeShoe(shoe) {
  const derived = shoe.runningFitDerived || shoe.runningFit || {};
  const recommendation = derived.recommendation13 || {};
  const scores = derived.scores || recommendation.purpose || {};

  return {
    brand: shoe.brand || "-",
    ko: shoe.modelKo || shoe.modelEn || "-",
    en: shoe.modelEn || "-",
    id: shoe.id,
    first: toNumber(scores.firstRunning),
    daily: toNumber(scores.dailyRunning),
    training: toNumber(scores.training),
    race: toNumber(scores.race)
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function renderStrip(id, list, view) {
  const element = document.getElementById(id);
  if (!element) return;

  element.innerHTML = list.map((shoe) => `
    <a class="strip-card" href="./shoes.html?view=${view}#browse">
      <p class="eyebrow">${RF.esc(shoe.brand)}</p>
      <h3>${RF.esc(shoe.ko)}</h3>
      <p>${RF.esc(shoe.en)}</p>
    </a>
  `).join("");
}

function renderRank(id, shoes, key) {
  const element = document.getElementById(id);
  if (!element) return;

  element.innerHTML = [...shoes]
    .sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1))
    .slice(0, 10)
    .map((shoe, index) => `
      <div class="mini-rank-item">
        <span>${index + 1}</span>
        <span>${RF.esc(shoe.ko)}</span>
        <span>${shoe[key] ?? "-"}</span>
      </div>
    `).join("");
}


async function renderUpcomingRaces() {
  const title = document.getElementById("nextRaceTitle");
  const list = document.getElementById("nextRaceList");
  if (!title || !list) return;

  try {
    const payload = await RF.loadJSON("./data/races.json");
    const races = (Array.isArray(payload) ? payload : payload.races || [])
      .filter((race) => race.date >= "2026-07-12")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);

    title.textContent = races.length ? `가장 가까운 대회 ${races.length}개` : "등록된 예정 대회가 없습니다.";
    list.innerHTML = races.map((race) => `
      <a href="./races.html?month=${encodeURIComponent(race.date.slice(5,7))}">
        <strong>${RF.esc(race.name)}</strong>
        <span>${RF.esc(race.date)} · ${RF.esc(race.region)}</span>
      </a>
    `).join("");
  } catch (error) {
    title.textContent = "대회 정보를 불러오지 못했습니다.";
    console.error(error);
  }
}


async function renderHomeWeather() {
  const title = document.getElementById("todayWeatherTitle");
  const text = document.getElementById("todayWeatherText");
  if (!title || !text || !window.RFWeather) return;
  try {
    const location = await RFWeather.resolvePreferredLocation();
    const data = await RFWeather.fetchWeather(location);
    const c = data.current || {};
    const r = data.running || {};
    title.textContent = `${RFWeather.weatherIcon(c)} ${location.name} ${formatHomeWeatherValue(c.temperature, "℃")} · ${r.level || "확인"}`;
    text.textContent = `${r.recommendation || "날씨를 확인하세요."} 습도 ${formatHomeWeatherValue(c.humidity, "%")}, 풍속 ${formatHomeWeatherValue(c.windSpeed, "m/s")}`;
  } catch (error) {
    title.textContent = "날씨를 불러오지 못했습니다.";
    text.textContent = error.message;
  }
}

function formatHomeWeatherValue(value, suffix) {
  return value == null || Number.isNaN(Number(value)) ? "-" : `${Math.round(Number(value) * 10) / 10}${suffix}`;
}


async function renderFeaturedCourse(){
  const title=document.getElementById("featuredCourseTitle");
  const text=document.getElementById("featuredCourseText");
  const link=document.getElementById("featuredCourseLink");
  if(!title||!text||!link)return;
  try{
    const payload=await RF.loadJSON("./data/courses.json");
    const courses=Array.isArray(payload)?payload:(payload.courses||[]);
    const featured=courses.filter(x=>x.featured);
    const pool=featured.length?featured:courses;
    if(!pool.length)throw new Error("등록된 코스가 없습니다.");
    const course=pool[new Date().getDate()%pool.length];
    title.textContent=course.name||"추천 러닝코스";
    text.textContent=`${course.region||"지역 미확인"} · ${course.distanceText||"거리 미확인"}`;
    link.href=`./courses.html?q=${encodeURIComponent(course.name||"")}`;
  }catch(error){title.textContent="추천 코스를 확인하세요";text.textContent="전국 대표 러닝 장소 100개를 준비했습니다.";console.error(error)}
}
