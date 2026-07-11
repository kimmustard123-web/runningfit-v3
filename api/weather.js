"use strict";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET 요청만 지원합니다." });
    return;
  }

  const lat = Number(req.query?.lat);
  const lon = Number(req.query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 30 || lat > 44 || lon < 123 || lon > 132) {
    res.status(400).json({ error: "대한민국 범위의 올바른 위도·경도가 필요합니다." });
    return;
  }

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "Asia/Seoul",
      forecast_days: "3",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "rain",
        "weather_code",
        "wind_speed_10m"
      ].join(","),
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "wind_speed_10m"
      ].join(",")
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`날씨 API HTTP ${response.status}`);
    const raw = await response.json();

    const currentRaw = raw.current || {};
    const weather = weatherCodeToLegacy(currentRaw.weather_code);
    const current = {
      temperature: numberOrNull(currentRaw.temperature_2m),
      humidity: numberOrNull(currentRaw.relative_humidity_2m),
      apparentTemperature: numberOrNull(currentRaw.apparent_temperature),
      windSpeed: kmhToMs(currentRaw.wind_speed_10m),
      precipitationType: weather.precipitationType,
      precipitation: numberOrNull(currentRaw.precipitation ?? currentRaw.rain),
      precipitationProbability: nearestHourlyValue(raw.hourly, "precipitation_probability", currentRaw.time),
      sky: weather.sky
    };

    const hourly = buildHourly(raw.hourly).slice(0, 24);
    const running = calculateRunningAdvice(current);

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=300");
    res.status(200).json({
      source: "Open-Meteo Weather Forecast API",
      sourceUrl: "https://open-meteo.com/",
      coordinates: { lat, lon },
      updatedAt: new Date().toISOString(),
      current,
      hourly,
      running
    });
  } catch (error) {
    console.error("weather api error", error);
    res.status(502).json({
      error: "날씨 데이터를 불러오지 못했습니다.",
      detail: String(error?.message || error || "알 수 없는 오류").slice(0, 180)
    });
  }
};

function buildHourly(hourly = {}) {
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const now = Date.now() - 60 * 60 * 1000;
  return times.map((time, index) => {
    const weather = weatherCodeToLegacy(hourly.weather_code?.[index]);
    return {
      date: String(time).slice(0, 10).replaceAll("-", ""),
      time: String(time).slice(11, 16).replace(":", ""),
      temperature: numberOrNull(hourly.temperature_2m?.[index]),
      humidity: numberOrNull(hourly.relative_humidity_2m?.[index]),
      apparentTemperature: numberOrNull(hourly.apparent_temperature?.[index]),
      precipitationProbability: numberOrNull(hourly.precipitation_probability?.[index]),
      precipitation: numberOrNull(hourly.precipitation?.[index]),
      windSpeed: kmhToMs(hourly.wind_speed_10m?.[index]),
      precipitationType: weather.precipitationType,
      sky: weather.sky,
      __timestamp: new Date(time).getTime()
    };
  }).filter(item => Number.isFinite(item.__timestamp) && item.__timestamp >= now)
    .map(({ __timestamp, ...item }) => item);
}

function nearestHourlyValue(hourly = {}, key, currentTime) {
  const times = hourly.time || [];
  if (!times.length) return null;
  const target = new Date(currentTime || Date.now()).getTime();
  let best = 0;
  let distance = Infinity;
  times.forEach((time, index) => {
    const next = Math.abs(new Date(time).getTime() - target);
    if (next < distance) { distance = next; best = index; }
  });
  return numberOrNull(hourly[key]?.[best]);
}

function weatherCodeToLegacy(codeValue) {
  const code = Number(codeValue);
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { precipitationType: "3", sky: "4" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return { precipitationType: "1", sky: "4" };
  if ([1, 2].includes(code)) return { precipitationType: "0", sky: "3" };
  if ([3, 45, 48].includes(code)) return { precipitationType: "0", sky: "4" };
  return { precipitationType: "0", sky: "1" };
}

function kmhToMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number / 3.6) * 10) / 10 : null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function calculateRunningAdvice(w) {
  let score = 100;
  const reasons = [];
  const apparent = w.apparentTemperature ?? w.temperature;
  const pop = w.precipitationProbability ?? 0;
  const pty = Number(w.precipitationType || 0);
  const wind = w.windSpeed ?? 0;
  const humidity = w.humidity ?? 50;

  if (apparent >= 35) { score -= 55; reasons.push("체감온도가 매우 높습니다."); }
  else if (apparent >= 31) { score -= 35; reasons.push("더위와 열 스트레스에 주의하세요."); }
  else if (apparent >= 27) { score -= 15; reasons.push("수분 보충이 필요합니다."); }
  else if (apparent <= -5) { score -= 45; reasons.push("한랭 위험이 큽니다."); }
  else if (apparent <= 2) { score -= 20; reasons.push("보온과 충분한 워밍업이 필요합니다."); }

  if (pty > 0 || pop >= 70) { score -= 40; reasons.push("강수 가능성이 높습니다."); }
  else if (pop >= 40) { score -= 18; reasons.push("비에 대비하세요."); }

  if (wind >= 10) { score -= 35; reasons.push("강풍으로 달리기 어렵습니다."); }
  else if (wind >= 7) { score -= 20; reasons.push("바람이 강합니다."); }
  if (humidity >= 85 && apparent >= 24) { score -= 12; reasons.push("습도가 높아 체감 부담이 큽니다."); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level = "좋음";
  let recommendation = "가벼운 러닝부터 템포런까지 무난합니다.";
  if (score < 40) { level = "나쁨"; recommendation = "실외 러닝 대신 실내 운동을 권장합니다."; }
  else if (score < 65) { level = "주의"; recommendation = "강도를 낮추고 짧게 달리세요."; }
  else if (score < 85) { level = "보통"; recommendation = "컨디션을 확인하며 평소 강도로 달리세요."; }
  return { score, level, recommendation, reasons };
}
