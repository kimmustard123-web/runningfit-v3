const today = new Date("2026-07-06");

function toDate(value) {
  return new Date(value + "T00:00:00");
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 불러오기 실패`);
  return await res.json();
}

function formatDate(dateString) {
  const d = toDate(dateString);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function renderTodayWeather() {
  const box = document.getElementById("todayWeather");
  if (!box) return;

  const weather = await loadJSON("data/weather.json");
  const todayWeather = weather[0];

  box.innerHTML = `
    ${todayWeather.temp}℃ / ${todayWeather.condition}<br>
    <span class="badge">${todayWeather.running}</span>
  `;
}

async function renderWeeklyWeather() {
  const box = document.getElementById("weeklyWeather");
  if (!box) return;

  const weather = await loadJSON("data/weather.json");

  box.innerHTML = weather.map(day => `
    <article class="weather-card">
      <h3>${day.day}</h3>
      <p><strong>${day.temp}℃</strong> / ${day.condition}</p>
      <p>강수확률 ${day.rain}%</p>
      <span class="badge">${day.running}</span>
    </article>
  `).join("");
}

async function getUpcomingRaces() {
  const races = await loadJSON("data/races.json");

  return races
    .filter(race => toDate(race.date) >= today)
    .sort((a, b) => toDate(a.date) - toDate(b.date));
}

function raceTemplate(race) {
  const status = race.applyOpen ? "접수 가능" : "접수 예정/확인 필요";

  return `
    <article class="race-item">
      <div>
        <h3>${race.name}</h3>
        <p>${formatDate(race.date)} · ${race.location} · ${race.distance}</p>
        <span class="badge">${status}</span>
      </div>
      <a href="${race.link}" target="_blank">
        <button>신청/확인</button>
      </a>
    </article>
  `;
}

async function renderHomeRaces() {
  const box = document.getElementById("homeRaces");
  if (!box) return;

  const races = await getUpcomingRaces();
  box.innerHTML = races.slice(0, 5).map(raceTemplate).join("");
}

async function renderAllRaces() {
  const box = document.getElementById("allRaces");
  if (!box) return;

  const races = await getUpcomingRaces();

  if (races.length === 0) {
    box.innerHTML = `<p>현재 등록된 예정 대회가 없습니다.</p>`;
    return;
  }

  box.innerHTML = races.map(raceTemplate).join("");
}

function courseTemplate(course) {
  return `
    <article class="course-card">
      <div class="course-photo">${course.photoText}</div>
      <h3>${course.name}</h3>
      <p>${course.region} · ${course.distance} · ${course.level}</p>
      <p>${course.description}</p>
      <div class="map-buttons">
        <a href="${course.naverMap}" target="_blank">네이버지도</a>
        <a href="${course.kakaoMap}" target="_blank">카카오맵</a>
      </div>
    </article>
  `;
}

async function renderHomeCourses() {
  const box = document.getElementById("homeCourses");
  if (!box) return;

  const courses = await loadJSON("data/courses.json");
  box.innerHTML = courses.slice(0, 5).map(courseTemplate).join("");
}

async function renderAllCourses() {
  const box = document.getElementById("allCourses");
  if (!box) return;

  const courses = await loadJSON("data/courses.json");
  box.innerHTML = courses.map(courseTemplate).join("");
}

function getSelected(id) {
  return document.getElementById(id)?.value || "";
}

async function recommendShoes() {
  const results = document.getElementById("shoeResults");
  if (!results) return;

  const shoes = await loadJSON("data/shoes.json");

  const user = {
    currentShoe: getSelected("currentShoe"),
    purpose: getSelected("purpose"),
    width: getSelected("width"),
    pain: getSelected("pain"),
    budget: getSelected("budget"),
    weeklyDistance: getSelected("weeklyDistance")
  };

  const scored = shoes.map(shoe => {
    let score = 50;
    const reasons = [];

    if (user.purpose && shoe.purpose.includes(user.purpose)) {
      score += 15;
      reasons.push("러닝 목적과 잘 맞습니다.");
    }

    if (user.width === "wide" && shoe.width === "wide") {
      score += 15;
      reasons.push("발볼이 넓은 사람에게 유리합니다.");
    }

    if (user.pain !== "none" && user.pain && shoe.painSupport.includes(user.pain)) {
      score += 15;
      reasons.push("선택한 통증 부위에 부담을 줄이는 성향입니다.");
    }

    if (user.budget && shoe.budget === user.budget) {
      score += 10;
      reasons.push("예산대가 맞습니다.");
    }

    if (user.weeklyDistance && shoe.weeklyDistance.includes(user.weeklyDistance)) {
      score += 10;
      reasons.push("주간 러닝 거리와 잘 맞습니다.");
    }

    if (user.currentShoe && user.currentShoe !== "running" && shoe.beginnerSafe) {
      score += 10;
      reasons.push("러닝화 없이 시작하는 입문자에게 안전한 선택입니다.");
    }

    return {
      ...shoe,
      score: Math.min(score, 100),
      reasons
    };
  }).sort((a, b) => b.score - a.score);

  results.innerHTML = scored.map(shoe => `
    <article class="shoe-card">
      <h3>${shoe.name}</h3>
      <p>${shoe.brand} · ${shoe.priceRange}</p>
      <div class="score"><span style="width:${shoe.score}%"></span></div>
      <strong>추천 점수 ${shoe.score}점</strong>
      <p class="reason">${shoe.reasons.length ? shoe.reasons.join(" ") : "기본 러닝화 후보로 볼 수 있습니다."}</p>
      <p>${shoe.description}</p>
      <button>상세 보기</button>
    </article>
  `).join("");
}

renderTodayWeather();
renderWeeklyWeather();
renderHomeRaces();
renderAllRaces();
renderHomeCourses();
renderAllCourses();