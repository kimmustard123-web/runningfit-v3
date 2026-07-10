const DATA_PATHS = {
  shoes: './data/shoes.json',
  weather: './data/weather.json',
  races: './data/races.json',
  courses: './data/courses.json'
};

let SHOES = [];
let COMPARE = [];

document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initPace();
  SHOES = await fetchJson(DATA_PATHS.shoes, []);
  if (!Array.isArray(SHOES)) SHOES = SHOES.shoes || [];
  bindGlobalSearch();
  initHome();
  initShoesPage();
  initWeatherPage();
  initRacesPage();
  initCoursesPage();
});

async function fetchJson(path, fallback){
  try{
    const res = await fetch(path, {cache:'no-store'});
    if(!res.ok) throw new Error(path);
    return await res.json();
  }catch(e){
    console.warn('데이터 로드 실패:', path, e);
    return fallback;
  }
}

function initNav(){
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  toggle?.addEventListener('click', () => nav?.classList.toggle('open'));
}

function norm(v){return String(v ?? '').toLowerCase().replace(/\s+/g,'').trim();}
function arr(v){return Array.isArray(v) ? v : (v ? [v] : []);}
function nameOf(s){return s.modelKo || s.nameKo || s.koreanName || s.model || s.modelEn || s.name || '이름 없음';}
function enNameOf(s){return s.modelEn || s.nameEn || s.model || s.name || nameOf(s);}
function brandOf(s){return s.brand || '브랜드 없음';}
function purposesOf(s){return arr(s.purpose || s.use || s.category || s.type);}
function purposeText(s){return purposesOf(s).join(' · ') || (s.rfClassification?.primaryLabel || '러닝화');}

const BRAND_KO = {
  nike: ['나이키','나'],
  asics: ['아식스','아'],
  'new balance': ['뉴발란스','뉴발','뉴'],
  adidas: ['아디다스','아디'],
  saucony: ['써코니','서코니','소코니','써'],
  hoka: ['호카','호'],
  brooks: ['브룩스','브'],
  on: ['온러닝','온'],
  puma: ['푸마','푸'],
  altra: ['알트라','알'],
  mizuno: ['미즈노','미'],
  salomon: ['살로몬','살']
};

function getChosung(text){
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  return String(text || '').split('').map(ch => {
    const code = ch.charCodeAt(0) - 44032;
    if(code < 0 || code > 11171) return ch;
    return CHO[Math.floor(code / 588)];
  }).join('');
}

function brandAliases(s){
  const b = norm(brandOf(s));
  return BRAND_KO[b] || [];
}
function scoreOf(s, key='overall'){
  if (s.scores && typeof s.scores === 'object') return Number(s.scores[key] ?? s.scores.overall ?? s.scores.popularity ?? 0);
  return Number(s.score || s.rfScore || s.recommendScore || 0);
}
function searchText(s){
  const search = s.search || {};
  const koName = nameOf(s);
  const enName = enNameOf(s);
  const brand = brandOf(s);
  return norm([
    s.id,
    brand,
    brandAliases(s),
    s.modelEn,
    s.modelKo,
    s.name,
    s.nameKo,
    s.koreanName,
    koName,
    enName,
    getChosung(koName),
    getChosung(`${brand} ${koName}`),
    s.summary,
    s.oneLine,
    s.carbonLabel,
    s.rfClassification?.primaryLabel,
    purposesOf(s),
    search.ko,
    search.en,
    search.alias,
    s.alias,
    s.aliases,
    s.searchTerms,
    s.chosung,
    s.initial
  ].flat().join(' '));
}
function filterShoes(q){
  const keyword = norm(q);
  if(!keyword) return SHOES;
  return SHOES.filter(s => searchText(s).includes(keyword));
}
function topBy(key, limit=10){
  return [...SHOES].sort((a,b)=>scoreOf(b,key)-scoreOf(a,key)).slice(0,limit);
}
function escapeHTML(str){
  return String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

/* 검색: 상단 나이키식 간단 검색 + 추천목록 */
function bindGlobalSearch(){
  const form = document.querySelector('#globalSearchForm');
  const input = document.querySelector('#globalSearchInput');
  const box = document.querySelector('#globalSearchSuggestions');
  if(!input) return;

  const render = () => {
    if(!box) return;
    const q = input.value.trim();
    if(!q){ box.classList.remove('show'); box.innerHTML=''; return; }
    const items = filterShoes(q).slice(0,8);
    if(!items.length){
      box.classList.add('show');
      box.innerHTML = `<div class="suggest-empty">검색 결과가 없습니다.</div>`;
      return;
    }
    box.classList.add('show');
    box.innerHTML = items.map(s => `
      <button type="button" class="suggest-item" data-q="${escapeHTML(nameOf(s))}">
        <strong>${escapeHTML(nameOf(s))}</strong>
        <span>${escapeHTML(brandOf(s))} · ${escapeHTML(enNameOf(s))}</span>
      </button>
    `).join('');
  };

  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  document.addEventListener('click', e => {
    if(!e.target.closest('.global-search-wrap')) box?.classList.remove('show');
  });
  box?.addEventListener('click', e => {
    const btn = e.target.closest('[data-q]');
    if(!btn) return;
    location.href = `./shoes.html?q=${encodeURIComponent(btn.dataset.q)}`;
  });
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    location.href = `./shoes.html${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  });
}

/* HOME */
function initHome(){
  if(!document.querySelector('.home-layout')) return;
  renderStrip('#weeklyPopularShoes', topBy('popularity',5));
  renderStrip('#newReleaseShoes', [...SHOES].sort((a,b)=>(scoreOf(b,'overall')+scoreOf(b,'popularity'))-(scoreOf(a,'overall')+scoreOf(a,'popularity'))).slice(0,8));
  renderMiniRank('#beginnerTopShoes', topBy('beginner',10));
  renderMiniRank('#dailyTopShoes', topBy('daily',10));
  renderMiniRank('#trainingTopShoes', topBy('training',10));
  renderMiniRank('#raceTopShoes', topBy('race',10));
  const today = document.querySelector('#todayRecommendedShoe');
  if(today){
    const s = topBy('daily',1)[0];
    today.innerHTML = s ? `
      <div class="today-score">${scoreOf(s,'daily')}</div>
      <div><strong>${escapeHTML(nameOf(s))}</strong><p>${escapeHTML(s.oneLine || s.summary || '오늘의 추천 러닝화')}</p></div>
      <a href="./shoes.html?q=${encodeURIComponent(nameOf(s))}">자세히 보기</a>
    ` : '<p>신발 데이터가 없습니다.</p>';
  }
}
function renderStrip(selector, shoes){
  const el = document.querySelector(selector); if(!el) return;
  el.innerHTML = shoes.map((s,i)=>`
    <article class="strip-card">
      <div class="strip-rank">${i+1}</div>
      <strong>${escapeHTML(nameOf(s))}</strong>
      <span>${escapeHTML(brandOf(s))}</span>
      <p>${escapeHTML(s.oneLine || purposeText(s))}</p>
    </article>
  `).join('');
}
function renderMiniRank(selector, shoes){
  const el = document.querySelector(selector); if(!el) return;
  el.innerHTML = shoes.slice(0,5).map((s,i)=>`
    <a href="./shoes.html?q=${encodeURIComponent(nameOf(s))}">
      <b>${i+1}</b><span>${escapeHTML(nameOf(s))}</span>
    </a>
  `).join('');
}

/* SHOES */
function initShoesPage(){
  const grid = document.querySelector('[data-shoe-grid]');
  if(!grid) return;
  fillBrandOptions();
  initTabs();
  initForms();
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || params.get('search') || '';
  const filterForm = document.querySelector('[data-shoe-filter]');
  if(q && filterForm){
    filterForm.q.value = q;
    activateTab('browse');
    renderShoes(filterShoes(q), '검색 결과');
  }else{
    renderShoes(topBy('beginner',10), '입문 추천 TOP');
  }
}
function fillBrandOptions(){
  const select = document.querySelector('[data-shoe-filter] select[name="brand"]');
  if(!select) return;
  [...new Set(SHOES.map(brandOf).filter(Boolean))].sort().forEach(b=>{
    const opt = document.createElement('option'); opt.value=b; opt.textContent=b; select.appendChild(opt);
  });
}
function initTabs(){
  document.querySelectorAll('[data-reco-tab]').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.recoTab));
  });
}
function activateTab(name){
  document.querySelectorAll('[data-reco-tab]').forEach(b=>b.classList.toggle('active', b.dataset.recoTab===name));
  document.querySelectorAll('[data-reco-panel]').forEach(p=>p.classList.toggle('active', p.dataset.recoPanel===name));
}
function initForms(){
  const beginner = document.querySelector('[data-beginner-form]');
  beginner?.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(beginner);
    let list = topBy('beginner',20);
    const width = fd.get('width');
    if(width === 'wide') list = list.sort((a,b)=>Number((b.fit?.width||'').includes('넓'))-Number((a.fit?.width||'').includes('넓')) || scoreOf(b,'beginner')-scoreOf(a,'beginner'));
    renderShoes(list.slice(0,10),'입문 추천 TOP');
  });
  const advanced = document.querySelector('[data-advanced-form]');
  advanced?.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(advanced);
    const training = fd.get('training');
    const keyMap = {easy:'daily', recovery:'daily', lsd:'daily', tempo:'training', interval:'training', race:'race', trail:'overall'};
    const key = keyMap[training] || 'overall';
    renderShoes(topBy(key,10), '정밀 추천 TOP');
  });
  const filter = document.querySelector('[data-shoe-filter]');
  filter?.addEventListener('submit', e=>{e.preventDefault(); applyBrowseFilter(filter);});
  filter?.addEventListener('reset', ()=>setTimeout(()=>renderShoes(SHOES,'전체 러닝화'),0));
  filter?.addEventListener('input', ()=>applyBrowseFilter(filter));
  filter?.addEventListener('change', ()=>applyBrowseFilter(filter));
}
function applyBrowseFilter(form){
  const fd = new FormData(form);
  const q = fd.get('q');
  const brand = fd.get('brand');
  const use = fd.get('use');
  let list = filterShoes(q);
  if(brand) list = list.filter(s=>brandOf(s)===brand);
  if(use) list = list.filter(s=>purposesOf(s).includes(use) || searchText(s).includes(norm(use)));
  renderShoes(list,'전체 검색 결과');
}
function renderShoes(list, title='추천 결과'){
  const grid = document.querySelector('[data-shoe-grid]');
  const count = document.querySelector('[data-result-count]');
  const summary = document.querySelector('[data-recommend-summary]');
  if(!grid) return;
  if(count) count.textContent = `${list.length}개`;
  if(summary){ summary.hidden = false; summary.innerHTML = `<strong>${escapeHTML(title)}</strong><p>RunningFit 자체 점수 기준으로 정렬했습니다.</p>`; }
  if(!list.length){ grid.innerHTML = `<div class="empty-state"><h3>검색 결과가 없습니다.</h3><p>브랜드명, 한글명, 초성으로 다시 검색해보세요.</p></div>`; return; }
  grid.innerHTML = list.map((s,i)=>shoeCard(s,i)).join('');
}
function shoeCard(s,i){
  const badges = makeBadges(s);
  return `<article class="shoe-card">
    <div class="shoe-top"><div><div class="brand-label">${escapeHTML(brandOf(s))}</div><h3>${escapeHTML(nameOf(s))}</h3><p>${escapeHTML(enNameOf(s))}</p></div><div class="score-pill">${scoreOf(s,'overall')||'-'}</div></div>
    <div class="badge-row">${badges}</div>
    <p class="shoe-summary">${escapeHTML(s.oneLine || s.summary || purposeText(s))}</p>
    <div class="spec-list"><div><span>용도</span><strong>${escapeHTML(purposeText(s))}</strong></div><div><span>발볼</span><strong>${escapeHTML(s.fit?.width || '-')}</strong></div><div><span>분류</span><strong>${escapeHTML(s.rfClassification?.primaryLabel || s.carbonLabel || '-')}</strong></div></div>
  </article>`;
}
function makeBadges(s){
  const scores = s.scores || {};
  const data = [
    ['인기', scores.popularity], ['첫 러닝화', scores.beginner], ['매일 러닝', scores.daily], ['훈련용', scores.training], ['대회용', scores.race]
  ].filter(([,v])=>Number(v)>=75).slice(0,4);
  return data.map(([k,v])=>`<span class="rank-badge">${k} ${v}</span>`).join('');
}

async function initWeatherPage(){
  const grid = document.querySelector('[data-weather-grid]'); if(!grid) return;
  const data = await fetchJson(DATA_PATHS.weather, []);
  document.querySelector('[data-weather-page-status]')?.replaceChildren(document.createTextNode('더미 데이터 표시 중 · 실제 API 연결 전'));
  const list = Array.isArray(data) ? data : (data.days || data.forecast || []);
  grid.innerHTML = (list.length?list:[{date:'오늘',temp:'-',condition:'API 연결 전',runningScore:'확인 필요'}]).map(w=>`<article class="info-card"><p class="card-label">${escapeHTML(w.date||w.day||'날씨')}</p><h2>${escapeHTML(w.condition||w.status||'확인 필요')}</h2><p>기온 ${escapeHTML(w.temp||w.temperature||'-')} · 러닝 적합도 ${escapeHTML(w.runningScore||w.score||'-')}</p></article>`).join('');
}
async function initRacesPage(){
  const listEl = document.querySelector('[data-race-list]'); if(!listEl) return;
  const data = await fetchJson(DATA_PATHS.races, []); const races = Array.isArray(data)?data:(data.races||[]);
  const search = document.querySelector('[data-race-search]'); const status = document.querySelector('[data-race-status]');
  const render=()=>{let list=races; const q=norm(search?.value); const st=status?.value; if(q) list=list.filter(r=>norm(Object.values(r).join(' ')).includes(q)); if(st) list=list.filter(r=>(r.status||'')===st); listEl.innerHTML=list.map(r=>`<article class="race-card"><h3>${escapeHTML(r.name||r.title||'대회명 확인 필요')}</h3><p>${escapeHTML(r.date||'날짜 확인 필요')} · ${escapeHTML(r.location||r.region||'지역 확인 필요')} · ${escapeHTML(r.statusLabel||r.status||'상태 확인 필요')}</p>${r.url?`<a class="card-link" href="${escapeHTML(r.url)}" target="_blank" rel="noopener">공식 링크</a>`:''}</article>`).join('') || '<div class="empty-state">대회 정보가 없습니다.</div>';};
  search?.addEventListener('input',render); status?.addEventListener('change',render); render();
}
async function initCoursesPage(){
  const grid = document.querySelector('[data-course-grid]'); if(!grid) return;
  const data = await fetchJson(DATA_PATHS.courses, []); const courses = Array.isArray(data)?data:(data.courses||[]);
  const search = document.querySelector('[data-course-search]'); const level = document.querySelector('[data-course-level]');
  const render=()=>{let list=courses; const q=norm(search?.value); const lv=level?.value; if(q) list=list.filter(c=>norm(Object.values(c).join(' ')).includes(q)); if(lv) list=list.filter(c=>(c.level||c.difficulty||'')===lv); grid.innerHTML=list.map(c=>`<article class="course-card"><h3>${escapeHTML(c.name||c.title||'코스명 확인 필요')}</h3><p>${escapeHTML(c.location||c.region||'지역')} · ${escapeHTML(c.distance||c.distanceKm||'-')} · ${escapeHTML(c.levelLabel||c.level||c.difficulty||'난이도 확인')}</p><p>${escapeHTML(c.description||c.summary||'')}</p></article>`).join('') || '<div class="empty-state">코스 정보가 없습니다.</div>';};
  search?.addEventListener('input',render); level?.addEventListener('change',render); render();
}

function initPace(){
  const targetBtn=document.querySelector('#calcTargetPace');
  targetBtn?.addEventListener('click',()=>{
    const d=Number(document.querySelector('#targetDistance')?.value||0); const sec=parseTime(document.querySelector('#targetTime')?.value);
    const el=document.querySelector('#targetPaceResult'); if(!el) return; el.textContent = d&&sec ? `${formatTime(sec/d)}/km` : '-';
  });
  document.querySelector('#calcFinishTimes')?.addEventListener('click',()=>{
    const pace=parseTime(document.querySelector('#paceInput')?.value); const el=document.querySelector('#finishTimeResult'); if(!el||!pace) return;
    [[5,'5K'],[10,'10K'],[21.0975,'하프'],[42.195,'풀']].forEach(([km,label])=>{});
    el.innerHTML = [[5,'5K'],[10,'10K'],[21.0975,'하프'],[42.195,'풀']].map(([km,label])=>`<div class="pace-result-item"><span>${label}</span><strong>${formatTime(pace*km)}</strong></div>`).join('');
  });
  document.querySelector('#calcInterval')?.addEventListener('click',()=>{
    const pace=parseTime(document.querySelector('#intervalPace')?.value); const count=Number(document.querySelector('#intervalCount')?.value||1); const el=document.querySelector('#intervalResult'); if(!el||!pace) return;
    el.innerHTML = [100,200,400,800,1000].map(m=>`<div class="pace-result-item"><span>${m}m × ${count}</span><strong>${formatTime(pace*(m/1000))}</strong></div>`).join('');
  });
  document.querySelector('#calcRacePredict')?.addEventListener('click',()=>{
    const t=parseTime(document.querySelector('#avg400')?.value); const el=document.querySelector('#racePredictResult'); if(!el||!t) return; const pace=t/0.4;
    el.innerHTML = [[5,'5K'],[10,'10K'],[21.0975,'하프']].map(([km,label])=>`<div class="pace-result-item"><span>${label}</span><strong>${formatTime(pace*km)}</strong></div>`).join('');
  });
}
function parseTime(v){
  const parts=String(v||'').split(':').map(Number); if(parts.some(Number.isNaN)) return 0;
  if(parts.length===2) return parts[0]*60+parts[1];
  if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2];
  return Number(v)||0;
}
function formatTime(sec){
  sec=Math.round(sec); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
