
(async () => {
  "use strict";

  const FROM_DATE = "2026-07-11";
  const WAIT_MS = 120;
  const listRoot = document;

  const clean = (value = "") =>
    String(value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const absolute = (href, base = location.href) => {
    if (!href) return null;
    try { return new URL(href, base).href; } catch { return null; }
  };

  const parseKoreanDate = (value = "") => {
    const m = clean(value).match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (!m) return null;
    return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  };

  const parsePeriod = (value = "") => {
    const matches = [...clean(value).matchAll(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g)];
    const toIso = (m) => m ? `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}` : null;
    return {
      start: toIso(matches[0]),
      end: toIso(matches[1]),
      text: clean(value) || null
    };
  };

  const splitDistances = (value = "") =>
    clean(value)
      .split(/[,/·ㆍ|]+/)
      .map(clean)
      .filter(Boolean);

  const slug = (value = "") =>
    clean(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  function extractRows(doc) {
    const links = [...doc.querySelectorAll('a[href*="view.php?no="]')];
    const unique = new Map();

    for (const link of links) {
      const href = absolute(link.getAttribute("href"));
      if (!href) continue;
      const no = new URL(href).searchParams.get("no");
      if (!no || unique.has(no)) continue;

      const row = link.closest("tr");
      const rowText = clean(row?.innerText || link.innerText);
      unique.set(no, {
        no,
        nameFromList: clean(link.textContent),
        rowText,
        detailUrl: href
      });
    }
    return [...unique.values()];
  }

  function labelMap(doc) {
    const map = new Map();

    for (const row of doc.querySelectorAll("tr")) {
      const cells = [...row.querySelectorAll("th,td")];
      if (cells.length < 2) continue;
      const key = clean(cells[0].innerText).replace(/\s+/g, "");
      const value = clean(cells.slice(1).map(c => c.innerText).join(" "));
      if (key && value) map.set(key, value);
    }
    return map;
  }

  function pick(map, ...keys) {
    for (const key of keys) {
      const normalized = key.replace(/\s+/g, "");
      if (map.has(normalized)) return map.get(normalized);
      for (const [k, v] of map) {
        if (k.includes(normalized)) return v;
      }
    }
    return null;
  }

  function findHomepage(doc) {
    const rows = [...doc.querySelectorAll("tr")];
    for (const row of rows) {
      const first = clean(row.querySelector("th,td")?.innerText).replace(/\s+/g, "");
      if (!first.includes("홈페이지")) continue;
      const links = [...row.querySelectorAll("a[href]")];
      for (const a of links) {
        const href = absolute(a.getAttribute("href"), doc.baseURI);
        if (!href) continue;
        if (/roadrun\.co\.kr\/schedule\/view\.php/i.test(href)) continue;
        return href;
      }
      const text = clean(row.innerText);
      const url = text.match(/https?:\/\/[^\s]+/i)?.[0];
      if (url) return url.replace(/[),.;]+$/, "");
    }
    return null;
  }

  function findDescription(doc) {
    const rows = [...doc.querySelectorAll("tr")];
    for (const row of rows) {
      const cells = [...row.querySelectorAll("th,td")];
      if (cells.length < 2) continue;
      const key = clean(cells[0].innerText).replace(/\s+/g, "");
      if (key.includes("기타소개")) return clean(cells.slice(1).map(c => c.innerText).join("\n")) || null;
    }
    return null;
  }

  async function fetchDetail(item, index, total) {
    console.log(`[${index + 1}/${total}] ${item.nameFromList || item.no}`);
    const response = await fetch(item.detailUrl, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${item.detailUrl}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const map = labelMap(doc);

    const rawDate = pick(map, "대회일시") || "";
    const date = parseKoreanDate(rawDate);
    if (!date || date < FROM_DATE) return null;

    const timeMatch = rawDate.match(/출발시간\s*[:：]?\s*(.+)$/);
    const registration = parsePeriod(pick(map, "접수기간") || "");
    const name = pick(map, "대회명") || item.nameFromList || `대회 ${item.no}`;
    const homepage = findHomepage(doc);

    return {
      id: `roadrun-${item.no}-${date}-${slug(name)}`,
      roadrunNo: Number(item.no),
      name,
      date,
      time: timeMatch ? clean(timeMatch[1]) : null,
      representative: pick(map, "대표자명"),
      email: pick(map, "E-mail", "Email", "이메일"),
      phone: pick(map, "전화번호"),
      distances: splitDistances(pick(map, "대회종목") || ""),
      region: pick(map, "대회지역"),
      venue: pick(map, "대회장소"),
      organizer: pick(map, "주최단체"),
      registrationStart: registration.start,
      registrationEnd: registration.end,
      registrationPeriod: registration.text,
      officialUrl: homepage,
      entryUrl: homepage,
      detailUrl: item.detailUrl,
      description: findDescription(doc),
      source: {
        name: "마라톤온라인 대회 상세",
        url: item.detailUrl,
        checkedAt: new Date().toISOString().slice(0, 10)
      }
    };
  }

  const items = extractRows(listRoot);
  if (!items.length) {
    alert("대회 상세 링크를 찾지 못했습니다. 반드시 roadrun.co.kr/schedule/list.php 페이지에서 실행하세요.");
    return;
  }

  const races = [];
  const failures = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const race = await fetchDetail(items[i], i, items.length);
      if (race) races.push(race);
    } catch (error) {
      failures.push({ no: items[i].no, detailUrl: items[i].detailUrl, error: String(error.message || error) });
    }
    await new Promise(resolve => setTimeout(resolve, WAIT_MS));
  }

  races.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "ko"));

  const payload = {
    metadata: {
      updatedAt: new Date().toISOString().slice(0, 10),
      fromDate: FROM_DATE,
      scope: "마라톤온라인 등록 대회",
      count: races.length,
      source: location.href,
      failures: failures.length
    },
    races,
    failures
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "races.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  alert(`완료: ${races.length}개 대회 저장 / 실패 ${failures.length}개\n다운로드된 races.json을 RunningFit의 data 폴더에 넣으세요.`);
})();
