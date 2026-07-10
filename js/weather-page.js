"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-live-weather]");
  if (!root) return;

  const select = document.querySelector("[data-weather-location]");
  const currentButton = document.querySelector("[data-use-current-location]");
  const status = document.querySelector("[data-weather-page-status]");
  const currentBox = document.querySelector("[data-weather-current]");
  const hourlyBox = document.querySelector("[data-weather-hourly]");
  const source = document.querySelector("[data-weather-source]");

  select.innerHTML = RFWeather.LOCATIONS.map((item) =>
    `<option value="${item.name}">${item.name}</option>`
  ).join("");

  const setLoading = (message) => {
    status.textContent = message;
    currentBox.setAttribute("aria-busy", "true");
  };

  async function load(location) {
    setLoading(`${location.name} 날씨를 불러오는 중입니다.`);
    try {
      const data = await RFWeather.fetchWeather(location);
      RFWeather.saveLocation(location);
      renderCurrent(data);
      renderHourly(data.hourly || []);
      status.textContent = `${location.name} · ${RFWeather.formatUpdated(data.updatedAt)} 갱신`;
      source.textContent = `출처: ${data.source}`;
    } catch (error) {
      status.textContent = error.message;
      currentBox.innerHTML = `<div class="weather-error"><strong>날씨를 불러오지 못했습니다.</strong><p>${RF.esc(error.message)}</p></div>`;
      hourlyBox.innerHTML = "";
    } finally {
      currentBox.removeAttribute("aria-busy");
    }
  }

  function renderCurrent(data) {
    const c = data.current || {};
    const r = data.running || {};
    currentBox.innerHTML = `
      <div class="weather-now-main">
        <span class="weather-now-icon" aria-hidden="true">${RFWeather.weatherIcon(c)}</span>
        <div>
          <p class="eyebrow">${RF.esc(data.location.name)} · ${RFWeather.weatherLabel(c)}</p>
          <strong class="weather-now-temp">${fmt(c.temperature, "℃")}</strong>
          <p>체감 ${fmt(c.apparentTemperature, "℃")}</p>
        </div>
      </div>
      <div class="weather-metrics">
        <div><span>습도</span><strong>${fmt(c.humidity, "%")}</strong></div>
        <div><span>풍속</span><strong>${fmt(c.windSpeed, "m/s")}</strong></div>
        <div><span>강수확률</span><strong>${fmt(c.precipitationProbability, "%")}</strong></div>
      </div>
      <div class="running-weather-result is-${levelClass(r.level)}">
        <div><span>러닝 적합도</span><strong>${RF.esc(r.level || "확인 필요")} · ${Number(r.score) || 0}점</strong></div>
        <p>${RF.esc(r.recommendation || "")}</p>
        ${(r.reasons || []).length ? `<ul>${r.reasons.map(x => `<li>${RF.esc(x)}</li>`).join("")}</ul>` : ""}
      </div>`;
  }

  function renderHourly(items) {
    hourlyBox.innerHTML = items.slice(0, 12).map((item) => `
      <article class="hourly-weather-item">
        <span>${RFWeather.formatHour(item)}</span>
        <b aria-hidden="true">${RFWeather.weatherIcon(item)}</b>
        <strong>${fmt(item.temperature, "℃")}</strong>
        <small>비 ${fmt(item.precipitationProbability, "%")}</small>
      </article>`).join("") || '<p class="muted">시간별 예보가 없습니다.</p>';
  }

  select.addEventListener("change", () => {
    const location = RFWeather.LOCATIONS.find(x => x.name === select.value) || RFWeather.DEFAULT_LOCATION;
    load(location);
  });

  currentButton.addEventListener("click", async () => {
    setLoading("현재 위치를 확인하는 중입니다.");
    try {
      const location = await RFWeather.getCurrentLocation();
      select.value = "";
      await load(location);
    } catch (error) {
      status.textContent = error.message;
    }
  });

  RFWeather.resolvePreferredLocation().then((location) => {
    if (RFWeather.LOCATIONS.some(x => x.name === location.name)) select.value = location.name;
    load(location);
  });
});

function fmt(value, suffix) {
  return value == null || value === "" || Number.isNaN(Number(value)) ? "-" : `${Math.round(Number(value) * 10) / 10}${suffix}`;
}

function levelClass(level) {
  return ({ 좋음: "good", 보통: "normal", 주의: "caution", 나쁨: "bad" })[level] || "normal";
}
