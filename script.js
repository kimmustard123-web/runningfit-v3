const page = document.body.dataset.page;

const races = [
  {
    name: "거제 해양 마라톤",
    region: "경남 거제",
    date: "2026-03-22",
    distance: "5K / 10K / Half",
    status: "open",
    link: "#"
  },
  {
    name: "부산 바다 러닝 페스티벌",
    region: "부산",
    date: "2026-04-12",
    distance: "5K / 10K",
    status: "soon",
    link: "#"
  },
  {
    name: "통영 이순신 마라톤",
    region: "경남 통영",
    date: "2026-05-03",
    distance: "10K / Half",
    status: "open",
    link: "#"
  },
  {
    name: "서울 러너스 데이",
    region: "서울",
    date: "2026-06-14",
    distance: "5K / 10K / Full",
    status: "closed",
    link: "#"
  },
  {
    name: "창원 시민 마라톤",
    region: "경남 창원",
    date: "2026-09-20",
    distance: "5K / 10K",
    status: "soon",
    link: "#"
  },
  {
    name: "대구 하프 마라톤",
    region: "대구",
    date: "2026-10-11",
    distance: "Half / Full",
    status: "soon",
    link: "#"
  }
];

const courses = [
  {
    name: "거제 장승포 해안 코스",
    region: "경남 거제",
    distance: 5.2,
    level: "입문",
    desc: "바다를 보면서 뛰기 좋은 평지 위주의 코스"
  },
  {
    name: "옥포 수변공원 코스",
    region: "경남 거제",
    distance: 3.8,
    level: "초보",
    desc: "퇴근 후 가볍게 뛰기 좋은 짧은 코스"
  },
  {
    name: "부산 광안리 해변 코스",
    region: "부산",
    distance: 7.5,
    level: "중급",
    desc: "야경 러닝에 좋은 해변 코스"
  },
  {
    name: "서울 한강 여의도 코스",
    region: "서울",
    distance: 10.1,
    level: "중급",
    desc: "러너들이 많이 찾는 대표 한강 코스"
  }
];

const weatherDummy = [
  { day: "월", temp: "23℃", rain: "없음", score: "좋음" },
  { day: "화", temp: "24℃", rain: "없음", score: "좋음" },
  { day: "수", temp: "26℃", rain: "약간", score: "보통" },
  { day: "목", temp: "22℃", rain: "없음", score: "좋음" },
  { day: "금", temp: "28℃", rain: "없음", score: "더움" },
  { day: "토", temp: "25℃", rain: "비", score: "주의" },
  { day: "일", temp: "24℃", rain: "없음", score: "좋음" }
];

let shoes = [];
let compare = JSON.parse(localStorage.getItem("runningfit_compare")) || [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadShoes();
  renderCompare();

  if (page === "home") renderHome();
  if (page === "shoes") renderShoesPage();
  if (page === "weather") renderWeatherPage();
  if (page === "races") renderRacesPage();
  if (page === "courses") renderCoursesPage();
});

async function loadShoes() {
  try {
    const res = await fetch("data/shoes.json");
    shoes = await res.json();
  } catch (error) {
    console.error("shoes.json 로딩 실패:", error);
    shoes = [];
  }
}

function renderHome() {
  const raceBox = document.getElementById("homeRaceList");
  const shoeBox = document.getElementById("homeShoeList");

  if (raceBox) {
    raceBox.innerHTML = races.slice(0, 5).map(raceCardSmall).join("");
  }

  if (shoeBox) {
    shoeBox.innerHTML = shoes.slice(0, 3).map(shoeCard).join("");
  }
}

function renderShoesPage() {
  const brandFilter = document.getElementById("brandFilter");
  const search = document.getElementById("shoeSearch");
  const price = document.getElementById("priceFilter");
  const width = document.getElementById("widthFilter");

  const brands = [...new Set(shoes.map(s => s.brand))];
  brandFilter.innerHTML += brands.map(b => `<option value="${b}">${b}</option>`).join("");

  [search, brandFilter, price, width].forEach(el => {
    el.addEventListener("input", renderFilteredShoes);
  });

  renderFilteredShoes();
}

function renderFilteredShoes() {
  const q = document.getElementById("shoeSearch").value.toLowerCase();
  const brand = document.getElementById("brandFilter").value;
  const price = document.getElementById("priceFilter").value;
  const width = document.getElementById("widthFilter").value;

  const filtered = shoes.filter(shoe => {
    const matchSearch = `${shoe.brand} ${shoe.name}`.toLowerCase().includes(q);
    const matchBrand = !brand || shoe.brand === brand;
    const matchWidth = !width || shoe.width === width;

    let matchPrice = true;
    if (price === "low") matchPrice = shoe.price <= 100000;
    if (price === "mid") matchPrice = shoe.price > 100000 && shoe.price <= 200000;
    if (price === "high") matchPrice = shoe.price > 200000;

    return matchSearch && matchBrand && matchWidth && matchPrice;
  });

  document.getElementById("shoeList").innerHTML = filtered.map(shoeCard).join("");
}

function renderWeatherPage() {
  const result = document.getElementById("weatherResult");
  const weekly = document.getElementById("weeklyWeather");
  const locationBtn = document.getElementById("locationBtn");
  const cityInput = document.getElementById("cityInput");
  const citySearchBtn = document.getElementById("citySearchBtn");

  result.innerHTML = weatherMainCard("거제");

  weekly.innerHTML = weatherDummy.map(day => `
    <div class="card">
      <span class="tag">${day.day}요일</span>
      <h3>${day.temp}</h3>
      <p>비: ${day.rain}</p>
      <strong>러닝 적합도: ${day.score}</strong>
    </div>
  `).join("");

  locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 기능을 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        result.innerHTML = weatherMainCard("현재 위치");
      },
      () => {
        alert("위치 권한이 거부되었습니다. 지역 검색을 이용하세요.");
      }
    );
  });

  citySearchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim() || "거제";
    result.innerHTML = weatherMainCard(city);
  });
}

function renderRacesPage() {
  const search = document.getElementById("raceSearch");
  const status = document.getElementById("raceStatusFilter");

  search.addEventListener("input", renderFilteredRaces);
  status.addEventListener("input", renderFilteredRaces);

  renderFilteredRaces();
}

function renderFilteredRaces() {
  const q = document.getElementById("raceSearch").value.toLowerCase();
  const status = document.getElementById("raceStatusFilter").value;

  const filtered = races.filter(race => {
    const matchSearch = `${race.name} ${race.region}`.toLowerCase().includes(q);
    const matchStatus = !status || race.status === status;
    return matchSearch && matchStatus;
  });

  document.getElementById("raceList").innerHTML = filtered.map(raceCardLarge).join("");
}

function renderCoursesPage() {
  const search = document.getElementById("courseSearch");
  const distance = document.getElementById("distanceFilter");

  search.addEventListener("input", renderFilteredCourses);
  distance.addEventListener("input", renderFilteredCourses);

  renderFilteredCourses();
}

function renderFilteredCourses() {
  const q = document.getElementById("courseSearch").value.toLowerCase();
  const distance = document.getElementById("distanceFilter").value;

  const filtered = courses.filter(course => {
    const matchSearch = `${course.name} ${course.region}`.toLowerCase().includes(q);

    let matchDistance = true;
    if (distance === "short") matchDistance = course.distance <= 5;
    if (distance === "middle") matchDistance = course.distance > 5 && course.distance <= 10;
    if (distance === "long") matchDistance = course.distance > 10;

    return matchSearch && matchDistance;
  });

  document.getElementById("courseList").innerHTML = filtered.map(courseCard).join("");
}

function shoeCard(shoe) {
  return `
    <div class="card">
      <span class="tag">${shoe.brand}</span>
      <h3>${shoe.name}</h3>
      <p>${shoe.desc}</p>
      <div class="shoe-meta">
        <span class="pill">${shoe.price.toLocaleString()}원대</span>
        <span class="pill">${shoe.width === "wide" ? "발볼 넓음" : "보통 발볼"}</span>
        <span class="pill">${shoe.type}</span>
      </div>
      <div class="score-bar">
        <div class="score-fill" style="width:${shoe.score}%"></div>
      </div>
      <p>추천점수 ${shoe.score}점</p>
      <button onclick="addCompare('${shoe.id}')">비교함 담기</button>
    </div>
  `;
}

function raceCardSmall(race) {
  return `
    <a href="races.html" class="card">
      <span class="tag">${race.region}</span>
      <h3>${race.name}</h3>
      <p>${race.date}</p>
      <p>${race.distance}</p>
      <strong class="status ${race.status}">${statusText(race.status)}</strong>
    </a>
  `;
}

function raceCardLarge(race) {
  return `
    <div class="race-card">
      <div>
        <span class="tag">${race.region}</span>
        <h3>${race.name}</h3>
        <div class="race-meta">
          <span class="pill">${race.date}</span>
          <span class="pill">${race.distance}</span>
          <span class="status ${race.status}">${statusText(race.status)}</span>
        </div>
        <p>${raceNotice(race.status)}</p>
      </div>
      <a class="button-link" href="${race.link}">신청 링크</a>
    </div>
  `;
}

function courseCard(course) {
  return `
    <div class="course-card">
      <div class="map-preview"></div>
      <span class="tag">${course.region}</span>
      <h3>${course.name}</h3>
      <p>${course.desc}</p>
      <div class="course-meta">
        <span class="pill">${course.distance}km</span>
        <span class="pill">${course.level}</span>
      </div>
      <button>지도 자세히 보기</button>
    </div>
  `;
}

function weatherMainCard(city) {
  return `
    <h2>${city} 러닝 날씨</h2>
    <p>현재 23℃ · 비 없음 · 바람 약함</p>
    <h3>러닝 적합도: 좋음</h3>
    <p>실제 서비스에서는 기상청 API 또는 OpenWeather API 연결 예정.</p>
  `;
}

function addCompare(id) {
  const shoe = shoes.find(s => s.id === id);
  if (!shoe) return;

  if (compare.find(item => item.id === id)) {
    alert("이미 비교함에 담겨 있습니다.");
    return;
  }

  if (compare.length >= 3) {
    alert("비교함은 최대 3개까지 가능합니다.");
    return;
  }

  compare.push(shoe);
  localStorage.setItem("runningfit_compare", JSON.stringify(compare));
  renderCompare();
}

function renderCompare() {
  const box = document.getElementById("compareItems");
  if (!box) return;

  if (compare.length === 0) {
    box.innerHTML = `<p>비교할 신발을 담아보세요.</p>`;
    return;
  }

  box.innerHTML = compare.map(item => `
    <div class="compare-item">
      <strong>${item.name}</strong>
      <p>${item.brand}</p>
    </div>
  `).join("");
}

function statusText(status) {
  if (status === "open") return "신청 가능";
  if (status === "soon") return "신청 예정";
  if (status === "closed") return "마감";
  return "";
}

function raceNotice(status) {
  if (status === "open") return "현재 신청 가능한 대회입니다.";
  if (status === "soon") return "아직 신청 시작 전입니다.";
  if (status === "closed") return "신청이 마감된 대회입니다.";
  return "";
}