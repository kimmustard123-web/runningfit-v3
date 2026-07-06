const RF = {
  shoes: [],
  rankings: [
    ["daily","데일리 TOP10"],["stability","안정화 TOP10"],["training","훈련용 TOP10"],
    ["race","대회용 TOP10"],["beginner","입문자 TOP10"],["value","가성비 TOP10"],["popularity","인기 TOP10"]
  ],
  compare: JSON.parse(localStorage.getItem("rf_compare") || "[]"),
  favorites: JSON.parse(localStorage.getItem("rf_favorites") || "[]"),
};

document.addEventListener("DOMContentLoaded", init);

async function init(){
  await loadShoes();
  renderHome();
  renderShoesPage();
  renderSimpleDataPages();
  bindGlobalEvents();
}

async function loadShoes(){
  try{
    const res = await fetch("./data/shoes.json?rfv=4.3");
    RF.shoes = await res.json();
  }catch(e){
    console.error(e);
    RF.shoes = [];
  }
}

function bindGlobalEvents(){
  document.querySelectorAll("[data-open-recommender]").forEach(btn => btn.addEventListener("click", openRecommender));
  const clear = document.getElementById("clearStorage");
  if(clear) clear.addEventListener("click", () => {
    localStorage.removeItem("rf_compare"); localStorage.removeItem("rf_favorites");
    RF.compare = []; RF.favorites = []; renderCompareBar(); renderShoeGrid();
  });
}

function renderHome(){
  if(!document.getElementById("homeShoeCount")) return;
  document.getElementById("homeShoeCount").textContent = RF.shoes.length;
  document.getElementById("homeBrandCount").textContent = new Set(RF.shoes.map(s=>s.brand)).size;
  setupRanking("homeRankTabs","homeRankGrid","daily");
}

function renderShoesPage(){
  if(!document.getElementById("shoeGrid")) return;
  fillBrandFilter();
  setupRanking("shoeRankTabs","shoeRankGrid","daily");
  ["shoeSearch","brandFilter","purposeFilter","carbonFilter"].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", renderShoeGrid);
  });
  setupSearchSuggest();
  renderShoeGrid();
  renderCompareBar();
}

function fillBrandFilter(){
  const select = document.getElementById("brandFilter");
  if(!select) return;
  select.innerHTML = `<option value="">전체 브랜드</option>`;
  [...new Set(RF.shoes.map(s=>s.brand))].sort().forEach(brand => {
    const op = document.createElement("option"); op.value = brand; op.textContent = brand; select.appendChild(op);
  });
}

function setupRanking(tabId, gridId, activeKey){
  const tabs = document.getElementById(tabId), grid = document.getElementById(gridId);
  if(!tabs || !grid) return;
  tabs.innerHTML = RF.rankings.map(([key,label]) => `<button class="${key===activeKey?'active':''}" data-rank="${key}">${label}</button>`).join("");
  tabs.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderRanking(gridId, btn.dataset.rank);
    });
  });
  renderRanking(gridId, activeKey);
}

function renderRanking(gridId, key){
  const grid = document.getElementById(gridId);
  const top = [...RF.shoes]
    .filter(s => Number.isFinite(s.scores?.[key]))
    .sort((a,b)=>(b.scores[key]||0)-(a.scores[key]||0))
    .slice(0,10);
  grid.innerHTML = top.map((s,i)=>shoeCard(s,{rank:i+1,scoreKey:key})).join("");
  bindCardButtons(grid);
}

function renderShoeGrid(){
  const grid = document.getElementById("shoeGrid");
  if(!grid) return;
  const q = normalize(document.getElementById("shoeSearch")?.value || "");
  const qCho = getChosung(q);
  const brand = document.getElementById("brandFilter")?.value || "";
  const purpose = document.getElementById("purposeFilter")?.value || "";
  const carbon = document.getElementById("carbonFilter")?.value || "";

  const filtered = RF.shoes
    .map(s => ({ shoe:s, relevance: scoreSearchRelevance(s, q, qCho) }))
    .filter(item => {
      const s = item.shoe;
      const okQ = !q || item.relevance > 0;
      const okBrand = !brand || s.brand === brand;
      const okPurpose = !purpose || (s.purpose || []).includes(purpose);
      const okCarbon = !carbon || String(!!s.carbonPlate) === carbon;
      return okQ && okBrand && okPurpose && okCarbon;
    })
    .sort((a,b) => {
      if(q && b.relevance !== a.relevance) return b.relevance - a.relevance;
      return (b.shoe.scores?.popularity || b.shoe.scores?.overall || 0) - (a.shoe.scores?.popularity || a.shoe.scores?.overall || 0);
    })
    .map(item => item.shoe);

  document.getElementById("resultCount").textContent = filtered.length;
  grid.innerHTML = filtered.map(s=>shoeCard(s,{scoreKey:"daily"})).join("");
  bindCardButtons(grid);
}

function shoeCard(s,{rank=null,scoreKey="daily"}={}){
  const score = s.scores?.[scoreKey] ?? s.scores?.overall ?? 0;
  const stars = starText(score);
  return `<article class="shoe-card">
    ${rank ? `<span class="rank-badge">${rank}위</span>` : ""}
    <span class="verify">RF평가</span>
    <div class="shoe-img">${escapeHtml(s.brand)}<br>${escapeHtml(s.modelEn)}</div>
    <div class="shoe-brand">${escapeHtml(s.brand)}</div>
    <div class="shoe-name">${escapeHtml(s.modelEn)}</div>
    <div class="shoe-ko">${escapeHtml(s.modelKo || "")}</div>
    <p class="stars">${stars}</p>
    <p class="one-line">${escapeHtml(s.oneLine || s.summary || "RunningFit 자체 평가 기준 추천 후보입니다.")}</p>
    <div class="score-chips">
      <span>데일리 ${s.scores?.daily ?? "-"}</span>
      <span>훈련 ${s.scores?.training ?? "-"}</span>
      <span>입문 ${s.scores?.beginner ?? "-"}</span>
    </div>
    <div class="tags">
      <span class="tag">${escapeHtml(s.rfClassification?.primaryLabel || "러닝화")}</span>
      <span class="tag">${escapeHtml(s.fit?.width || "보통")}</span>
      <span class="tag">${escapeHtml(s.fit?.sizeAdvice || "정사이즈 우선")}</span>
    </div>
    <div class="score-row"><span>RunningFit</span><strong class="score">${score}</strong></div>
    <div class="card-actions">
      <button class="btn primary" data-detail="${s.id}">상세</button>
      <button class="btn ghost" data-compare="${s.id}">비교</button>
      <button class="btn ghost" data-fav="${s.id}">${RF.favorites.includes(s.id) ? "★" : "☆"}</button>
    </div>
  </article>`;
}

function bindCardButtons(scope=document){
  scope.querySelectorAll("[data-detail]").forEach(b=>b.addEventListener("click",()=>openDetail(b.dataset.detail)));
  scope.querySelectorAll("[data-compare]").forEach(b=>b.addEventListener("click",()=>toggleCompare(b.dataset.compare)));
  scope.querySelectorAll("[data-fav]").forEach(b=>b.addEventListener("click",()=>toggleFavorite(b.dataset.fav)));
}

function openDetail(id){
  const s = RF.shoes.find(x=>x.id===id);
  if(!s) return;
  localStorage.setItem("rf_recent", JSON.stringify([id, ...JSON.parse(localStorage.getItem("rf_recent")||"[]").filter(x=>x!==id)].slice(0,12)));

  const modal = document.getElementById("shoeModal");
  modal.innerHTML = `<div class="modal-panel">
    <div class="modal-head">
      <div>
        <p class="eyebrow">${escapeHtml(s.brand)}</p>
        <h2>${escapeHtml(s.modelEn)}</h2>
        <p>${escapeHtml(s.modelKo || "")}</p>
      </div>
      <button class="close" data-close>×</button>
    </div>

    <div class="detail-grid">
      <div>
        <div class="shoe-img">${escapeHtml(s.brand)}<br>${escapeHtml(s.modelEn)}</div>
        <p class="stars big">${starText(s.scores?.overall || 85)}</p>
        <h3>한줄평</h3>
        <p class="one-line">${escapeHtml(s.oneLine || s.summary)}</p>

        <h3>추천 대상</h3>
        <ul>${listItems(s.targetRunner)}</ul>

        <h3>장점</h3>
        <ul>${listItems(s.pros)}</ul>

        <h3>주의할 점</h3>
        <ul>${listItems(s.cons)}</ul>

        <h3>추천하지 않는 경우</h3>
        <ul>${listItems(s.notRecommendedFor)}</ul>
      </div>

      <div>
        <h3>목적별 점수</h3>
        <div class="score-table">
          ${scoreBar("데일리", s.scores?.daily)}
          ${scoreBar("안정화", s.scores?.stability)}
          ${scoreBar("훈련", s.scores?.training)}
          ${scoreBar("대회", s.scores?.race)}
          ${scoreBar("입문", s.scores?.beginner)}
          ${scoreBar("가성비", s.scores?.value)}
        </div>

        <h3>착화/성능</h3>
        <div class="spec-list">
          ${spec("사이즈", s.fit?.sizeAdvice)}
          ${spec("발볼", s.fit?.width)}
          ${spec("토박스", s.fit?.toeBox)}
          ${spec("발등", s.fit?.instep)}
          ${spec("쿠션", fmt10(s.performance?.cushion))}
          ${spec("안정성", fmt10(s.performance?.stability))}
          ${spec("반발력", fmt10(s.performance?.energyReturn))}
          ${spec("통기성", fmt10(s.performance?.breathability))}
          ${spec("내구성", fmt10(s.performance?.outsoleDurability))}
          ${spec("데이터 기준", s.referencePolicy || "RunRepeat 우선 참고 + RunningFit 자체 평가")}
        </div>
      </div>
    </div>
  </div>`;

  modal.setAttribute("aria-hidden","false");
  modal.querySelector("[data-close]").addEventListener("click",()=>modal.setAttribute("aria-hidden","true"));
  modal.addEventListener("click",(e)=>{ if(e.target===modal) modal.setAttribute("aria-hidden","true"); }, {once:true});
}

function scoreBar(label, value){
  const v = Number(value || 0);
  return `<div class="scorebar"><div><span>${label}</span><strong>${v}</strong></div><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div>`;
}

function spec(k,v){
  const value = (v === undefined || v === "" || v === null) ? "RunningFit 평가 준비중" : v;
  return `<div class="spec"><span>${escapeHtml(k)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}
function fmt10(v){ return Number.isFinite(Number(v)) ? `${v}/10` : "평가 준비중"; }
function listItems(arr){ return (arr && arr.length ? arr : ["RunningFit 평가 준비중"]).map(x=>`<li>${escapeHtml(String(x))}</li>`).join(""); }
function starText(score){ const n = Math.max(1, Math.min(5, Math.round((score || 80)/20))); return "★★★★★".slice(0,n) + "☆☆☆☆☆".slice(0,5-n); }

function toggleCompare(id){
  if(RF.compare.includes(id)) RF.compare = RF.compare.filter(x=>x!==id);
  else RF.compare = [id, ...RF.compare].slice(0,3);
  localStorage.setItem("rf_compare", JSON.stringify(RF.compare));
  renderCompareBar(); renderShoeGrid();
}

function toggleFavorite(id){
  if(RF.favorites.includes(id)) RF.favorites = RF.favorites.filter(x=>x!==id);
  else RF.favorites.push(id);
  localStorage.setItem("rf_favorites", JSON.stringify(RF.favorites));
  renderShoeGrid();
}

function renderCompareBar(){
  const bar = document.getElementById("compareBar");
  if(!bar) return;
  if(!RF.compare.length){ bar.classList.remove("show"); bar.innerHTML=""; return; }
  const names = RF.compare.map(id => RF.shoes.find(s=>s.id===id)).filter(Boolean).map(s=>`${s.brand} ${s.modelEn}`);
  bar.classList.add("show");
  bar.innerHTML = `<strong>비교 ${RF.compare.length}/3</strong><span>${names.join(" · ")}</span><button class="btn ghost" id="clearCompare">비우기</button>`;
  document.getElementById("clearCompare").onclick = () => { RF.compare=[]; localStorage.setItem("rf_compare","[]"); renderCompareBar(); };
}

function openRecommender(){
  const modal = document.getElementById("recommendModal");
  modal.innerHTML = `<div class="modal-panel">
    <div class="modal-head"><div><p class="eyebrow">Recommend</p><h2>간단 추천</h2></div><button class="close" data-close>×</button></div>
    <div class="filters">
      <select id="recPurpose"><option value="daily">데일리</option><option value="stability">안정화</option><option value="training">훈련</option><option value="race">대회</option><option value="beginner">입문</option><option value="value">가성비</option></select>
      <select id="recWidth"><option value="">발볼 전체</option><option value="보통">보통</option><option value="보통~넓음">보통~넓음</option><option value="보통~약간 좁음">보통~약간 좁음</option></select>
      <button class="btn primary" id="runRec">추천 보기</button>
    </div>
    <div class="shoe-grid" id="recResult" style="margin-top:18px"></div>
  </div>`;
  modal.setAttribute("aria-hidden","false");
  modal.querySelector("[data-close]").onclick=()=>modal.setAttribute("aria-hidden","true");
  modal.querySelector("#runRec").onclick=()=>{
    const p = modal.querySelector("#recPurpose").value;
    const w = modal.querySelector("#recWidth").value;
    const result = [...RF.shoes].filter(s=>!w || s.fit?.width===w).sort((a,b)=>(b.scores?.[p]||0)-(a.scores?.[p]||0)).slice(0,6);
    modal.querySelector("#recResult").innerHTML = result.map((s,i)=>shoeCard(s,{rank:i+1,scoreKey:p})).join("");
    bindCardButtons(modal);
  };
}

async function renderSimpleDataPages(){
  const pageMap = [
    ["weatherGrid","./data/weather.json", item => simpleCard(item.title, item.description, item.meta)],
    ["raceGrid","./data/races.json", item => simpleCard(item.name, `${item.date} · ${item.region}`, item.status)],
    ["courseGrid","./data/courses.json", item => simpleCard(item.name, `${item.region} · ${item.distance}`, item.description)]
  ];
  for(const [id,url,renderer] of pageMap){
    const el = document.getElementById(id);
    if(!el) continue;
    try{
      const data = await (await fetch(url)).json();
      el.innerHTML = data.map(renderer).join("");
    }catch(e){
      el.innerHTML = `<div class="notice">데이터를 불러오지 못했습니다.</div>`;
    }
  }
}
function simpleCard(title, desc, meta){
  return `<article class="card mini"><p class="eyebrow">${escapeHtml(meta||"")}</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(desc)}</p></article>`;
}


function setupSearchSuggest(){
  const input = document.getElementById("shoeSearch");
  if(!input) return;

  let box = document.getElementById("searchSuggestBox");
  if(!box){
    box = document.createElement("div");
    box.id = "searchSuggestBox";
    box.className = "suggest-box";
    input.closest(".search-row").appendChild(box);
  }

  input.addEventListener("input", () => {
    const q = normalize(input.value);
    if(!q){ box.classList.remove("show"); box.innerHTML = ""; return; }
    const qCho = getChosung(q);
    const matches = RF.shoes
      .map(s => ({ shoe:s, relevance: scoreSearchRelevance(s, q, qCho) }))
      .filter(x => x.relevance > 0)
      .sort((a,b) => b.relevance - a.relevance)
      .slice(0,8);

    if(!matches.length){ box.classList.remove("show"); box.innerHTML = ""; return; }

    box.innerHTML = matches.map(({shoe, relevance}) => `
      <button type="button" data-suggest="${shoe.id}">
        <strong>${escapeHtml(shoe.brand)} ${escapeHtml(shoe.modelEn)}</strong>
        <span>${escapeHtml(shoe.modelKo || "")}</span>
        <em>${escapeHtml(shoe.rfClassification?.primaryLabel || "추천")}</em>
      </button>
    `).join("");

    box.classList.add("show");

    box.querySelectorAll("[data-suggest]").forEach(btn => {
      btn.addEventListener("click", () => {
        const s = RF.shoes.find(x => x.id === btn.dataset.suggest);
        if(!s) return;
        input.value = s.modelKo || s.modelEn;
        box.classList.remove("show");
        renderShoeGrid();
        setTimeout(() => openDetail(s.id), 120);
      });
    });
  });

  input.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;
    const q = normalize(input.value);
    const qCho = getChosung(q);
    const first = RF.shoes
      .map(s => ({ shoe:s, relevance: scoreSearchRelevance(s, q, qCho) }))
      .filter(x => x.relevance > 0)
      .sort((a,b) => b.relevance - a.relevance)[0];
    renderShoeGrid();
    if(first) setTimeout(() => openDetail(first.shoe.id), 120);
  });

  document.addEventListener("click", (e) => {
    if(!box.contains(e.target) && e.target !== input) box.classList.remove("show");
  });
}

function scoreSearchRelevance(s, q, qCho){
  if(!q) return 1;

  const brand = normalize(s.brand);
  const modelEn = normalize(s.modelEn);
  const modelKo = normalize(s.modelKo || "");
  const koTerms = (s.search?.ko || []).map(normalize);
  const enTerms = (s.search?.en || []).map(normalize);
  const aliases = (s.search?.alias || []).map(normalize);
  const all = [brand, modelEn, modelKo, ...koTerms, ...enTerms, ...aliases].filter(Boolean);
  const cho = getChosung(all.join(" "));

  let score = 0;

  if(modelKo === q || modelEn === q) score += 1000;
  if(modelKo.startsWith(q) || modelEn.startsWith(q)) score += 700;
  if(koTerms.some(t => t === q) || enTerms.some(t => t === q) || aliases.some(t => t === q)) score += 650;
  if(koTerms.some(t => t.startsWith(q)) || enTerms.some(t => t.startsWith(q)) || aliases.some(t => t.startsWith(q))) score += 520;
  if(modelKo.includes(q) || modelEn.includes(q)) score += 420;
  if(all.some(t => t.includes(q))) score += 320;
  if(cho.includes(qCho)) score += 260;
  if(brand.includes(q)) score += 120;

  score += (s.scores?.popularity || s.scores?.overall || 0) / 10;
  return score;
}


function buildSearchText(s){
  return [s.brand, s.modelEn, s.modelKo, ...(s.search?.ko||[]), ...(s.search?.en||[]), ...(s.search?.alias||[])].join(" ");
}
function normalize(v){ return String(v).toLowerCase().replace(/\s+/g,"").trim(); }
function getChosung(str){
  const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  return String(str).split("").map(ch=>{
    const code = ch.charCodeAt(0) - 44032;
    if(code >= 0 && code <= 11171) return CHO[Math.floor(code/588)];
    return ch;
  }).join("");
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
