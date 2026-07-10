"use strict";

const KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return response(405, { error: "GET 요청만 지원합니다." });
  }

  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) {
    return response(500, { error: "KMA_API_KEY 환경 변수가 설정되지 않았습니다." });
  }

  const lat = Number(event.queryStringParameters?.lat);
  const lon = Number(event.queryStringParameters?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 30 || lat > 44 || lon < 123 || lon > 132) {
    return response(400, { error: "대한민국 범위의 올바른 위도·경도가 필요합니다." });
  }

  try {
    const { x: nx, y: ny } = latLonToGrid(lat, lon);
    const now = kstNow();
    const ultraBase = getUltraBase(now);
    const villageBase = getVillageBase(now);

    const [currentResult, forecastResult] = await Promise.allSettled([
      fetchKma(apiKey, "getUltraSrtNcst", {
        base_date: ultraBase.date,
        base_time: ultraBase.time,
        nx,
        ny
      }),
      fetchKma(apiKey, "getVilageFcst", {
        base_date: villageBase.date,
        base_time: villageBase.time,
        nx,
        ny
      })
    ]);

    const currentItems = currentResult.status === "fulfilled" ? currentResult.value : [];
    const forecastItems = forecastResult.status === "fulfilled" ? forecastResult.value : [];

    if (!currentItems.length && !forecastItems.length) {
      const reason = currentResult.status === "rejected"
        ? currentResult.reason?.message
        : forecastResult.status === "rejected"
          ? forecastResult.reason?.message
          : "기상청 응답에 데이터가 없습니다.";
      throw new Error(reason || "날씨 데이터를 불러오지 못했습니다.");
    }

    const currentMap = mapCurrent(currentItems);
    const hourly = mapHourlyForecast(forecastItems, now).slice(0, 18);
    const nearest = hourly[0] || {};

    const current = {
      temperature: numberOrNull(currentMap.T1H ?? nearest.temperature),
      humidity: numberOrNull(currentMap.REH ?? nearest.humidity),
      windSpeed: numberOrNull(currentMap.WSD ?? nearest.windSpeed),
      precipitationType: String(currentMap.PTY ?? nearest.precipitationType ?? "0"),
      precipitation: normalizeRain(currentMap.RN1),
      precipitationProbability: numberOrNull(nearest.precipitationProbability),
      sky: String(nearest.sky ?? "1")
    };

    const apparentTemperature = calculateFeelsLike(
      current.temperature,
      current.humidity,
      current.windSpeed
    );
    const running = calculateRunningAdvice({ ...current, apparentTemperature });

    return response(200, {
      source: "기상청 단기예보 조회서비스",
      sourceUrl: "https://www.data.go.kr/data/15084084/openapi.do",
      coordinates: { lat, lon, nx, ny },
      updatedAt: new Date().toISOString(),
      base: { ultra: ultraBase, village: villageBase },
      current: { ...current, apparentTemperature },
      hourly,
      running
    }, {
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=300"
    });
  } catch (error) {
    console.error("KMA weather function error", error);
    return response(502, {
      error: "기상청 날씨 데이터를 불러오지 못했습니다.",
      detail: safeErrorMessage(error)
    });
  }
};

async function fetchKma(apiKey, endpoint, params) {
  const key = apiKey.includes("%") ? apiKey : encodeURIComponent(apiKey);
  const query = new URLSearchParams({
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  });
  const url = `${KMA_BASE}/${endpoint}?ServiceKey=${key}&${query.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`기상청 API HTTP ${res.status}`);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("기상청 API가 JSON이 아닌 응답을 반환했습니다. 인증키 활성화 상태를 확인하세요.");
  }

  const header = data?.response?.header;
  if (header?.resultCode !== "00") {
    throw new Error(`기상청 API 오류: ${header?.resultMsg || header?.resultCode || "알 수 없음"}`);
  }
  return data?.response?.body?.items?.item || [];
}

function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function ymd(date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

function hhmm(hour) {
  return `${String(hour).padStart(2, "0")}00`;
}

function getUltraBase(now) {
  const d = new Date(now);
  d.setUTCHours(d.getUTCHours() - 1, 0, 0, 0);
  return { date: ymd(d), time: hhmm(d.getUTCHours()) };
}

function getVillageBase(now) {
  const available = [2, 5, 8, 11, 14, 17, 20, 23];
  const threshold = new Date(now.getTime() - 20 * 60 * 1000);
  let selected = available.filter((hour) => hour <= threshold.getUTCHours()).pop();
  const d = new Date(threshold);
  if (selected == null) {
    d.setUTCDate(d.getUTCDate() - 1);
    selected = 23;
  }
  return { date: ymd(d), time: hhmm(selected) };
}

function mapCurrent(items) {
  const result = {};
  for (const item of items) result[item.category] = item.obsrValue;
  return result;
}

function mapHourlyForecast(items, now) {
  const grouped = new Map();
  for (const item of items) {
    const key = `${item.fcstDate}${item.fcstTime}`;
    if (!grouped.has(key)) grouped.set(key, { date: item.fcstDate, time: item.fcstTime });
    const row = grouped.get(key);
    const value = item.fcstValue;
    if (item.category === "TMP") row.temperature = numberOrNull(value);
    if (item.category === "POP") row.precipitationProbability = numberOrNull(value);
    if (item.category === "SKY") row.sky = String(value);
    if (item.category === "PTY") row.precipitationType = String(value);
    if (item.category === "REH") row.humidity = numberOrNull(value);
    if (item.category === "WSD") row.windSpeed = numberOrNull(value);
    if (item.category === "PCP") row.precipitation = value;
  }

  const nowKey = Number(`${ymd(now)}${String(now.getUTCHours()).padStart(2, "0")}00`);
  return [...grouped.values()]
    .filter((row) => Number(`${row.date}${row.time}`) >= nowKey)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeRain(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : String(value);
}

function calculateFeelsLike(temp, humidity, windSpeed) {
  if (!Number.isFinite(temp)) return null;
  if (temp >= 27 && Number.isFinite(humidity)) {
    const tF = temp * 9 / 5 + 32;
    const rh = humidity;
    const hiF = -42.379 + 2.04901523 * tF + 10.14333127 * rh - 0.22475541 * tF * rh
      - 0.00683783 * tF * tF - 0.05481717 * rh * rh
      + 0.00122874 * tF * tF * rh + 0.00085282 * tF * rh * rh
      - 0.00000199 * tF * tF * rh * rh;
    return Math.round(((hiF - 32) * 5 / 9) * 10) / 10;
  }
  if (temp <= 10 && Number.isFinite(windSpeed) && windSpeed > 1.3) {
    const kmh = windSpeed * 3.6;
    const wc = 13.12 + 0.6215 * temp - 11.37 * Math.pow(kmh, 0.16) + 0.3965 * temp * Math.pow(kmh, 0.16);
    return Math.round(wc * 10) / 10;
  }
  return temp;
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
  else if (pop >= 40) { score -= 18; reasons.push("우산이 필요할 수 있습니다."); }

  if (wind >= 10) { score -= 35; reasons.push("강풍으로 달리기 어렵습니다."); }
  else if (wind >= 7) { score -= 20; reasons.push("바람이 강합니다."); }

  if (humidity >= 85 && apparent >= 24) { score -= 12; reasons.push("습도가 높아 체감 부담이 큽니다."); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let level = "좋음", recommendation = "가벼운 러닝부터 템포런까지 무난합니다.";
  if (score < 40) { level = "나쁨"; recommendation = "실외 러닝 대신 실내 운동을 권장합니다."; }
  else if (score < 65) { level = "주의"; recommendation = "강도를 낮추고 짧게 달리세요."; }
  else if (score < 85) { level = "보통"; recommendation = "컨디션을 확인하며 평소 강도로 달리세요."; }

  return { score, level, recommendation, reasons };
}

function safeErrorMessage(error) {
  const text = String(error?.message || error || "알 수 없는 오류");
  return text.replace(/[A-Za-z0-9%+/_=-]{30,}/g, "[숨김]").slice(0, 220);
}

// 기상청 DFS 격자 변환 공식
function latLonToGrid(lat, lon) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    x: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    y: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  };
}
