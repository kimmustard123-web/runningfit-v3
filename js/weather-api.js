"use strict";

window.RFWeather = (() => {
  const DEFAULT_LOCATION = { name: "서울", lat: 37.5665, lon: 126.9780 };
  const LOCATIONS = [
    DEFAULT_LOCATION,
    { name: "부산", lat: 35.1796, lon: 129.0756 },
    { name: "거제", lat: 34.8806, lon: 128.6211 },
    { name: "대구", lat: 35.8714, lon: 128.6014 },
    { name: "대전", lat: 36.3504, lon: 127.3845 },
    { name: "광주", lat: 35.1595, lon: 126.8526 },
    { name: "인천", lat: 37.4563, lon: 126.7052 },
    { name: "제주", lat: 33.4996, lon: 126.5312 }
  ];

  async function fetchWeather(location) {
    const url = new URL("/api/weather", window.location.origin);
    url.searchParams.set("lat", location.lat);
    url.searchParams.set("lon", location.lon);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `날씨 요청 실패 (${res.status})`);
    return { ...data, location };
  }

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("이 브라우저는 위치 기능을 지원하지 않습니다."));
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          name: "현재 위치",
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }),
        () => reject(new Error("위치 권한을 허용하지 않아 기본 지역을 표시합니다.")),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }

  async function resolvePreferredLocation({ requestPermission = true } = {}) {
    const saved = readSavedLocation();
    if (saved) return saved;
    if (requestPermission) {
      try {
        const current = await getCurrentLocation();
        saveLocation(current);
        return current;
      } catch (error) {
        console.info(error.message);
      }
    }
    return DEFAULT_LOCATION;
  }

  function saveLocation(location) {
    try { localStorage.setItem("rf_weather_location", JSON.stringify(location)); } catch {}
  }

  function readSavedLocation() {
    try {
      const value = JSON.parse(localStorage.getItem("rf_weather_location") || "null");
      return value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lon)) ? value : null;
    } catch { return null; }
  }

  function weatherIcon(current) {
    const pty = Number(current.precipitationType || 0);
    if ([3, 7].includes(pty)) return "❄️";
    if ([1, 2, 4, 5, 6].includes(pty)) return "🌧️";
    if (String(current.sky) === "4") return "☁️";
    if (String(current.sky) === "3") return "⛅";
    return "☀️";
  }

  function weatherLabel(current) {
    const pty = Number(current.precipitationType || 0);
    if ([3, 7].includes(pty)) return "눈";
    if ([1, 2, 4, 5, 6].includes(pty)) return "비";
    if (String(current.sky) === "4") return "흐림";
    if (String(current.sky) === "3") return "구름 많음";
    return "맑음";
  }

  function formatHour(item) {
    const h = Number(String(item.time || "0000").slice(0, 2));
    return `${h}시`;
  }

  function formatUpdated(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  return {
    DEFAULT_LOCATION,
    LOCATIONS,
    fetchWeather,
    getCurrentLocation,
    resolvePreferredLocation,
    saveLocation,
    weatherIcon,
    weatherLabel,
    formatHour,
    formatUpdated
  };
})();
