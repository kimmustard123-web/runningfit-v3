"use strict";
document.addEventListener("DOMContentLoaded",()=>{weather();races();courses();profile();myShoes();runLogs()});
async function weather(){const grid=document.querySelector("[data-weather-grid]");if(!grid)return;try{const d=await RF.loadJSON("./data/weather.json");grid.innerHTML=d.map(x=>`<article class="weather-card-item"><p class="eyebrow">${RF.esc(x.meta)}</p><h2>${RF.esc(x.title)}</h2><p>${RF.esc(x.description)}</p></article>`).join("");document.querySelector("[data-weather-page-status]").textContent=`${d.length}개 안내 카드` }catch(e){grid.textContent=e.message}}
async function races(){
  const list=document.querySelector("[data-race-list]");
  if(!list)return;

  try{
    const payload=await RF.loadJSON("./data/races.json");
    const data=(Array.isArray(payload)?payload:(payload.races||[]))
      .filter(x=>String(x.date||"").startsWith("2026-"))
      .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.name).localeCompare(String(b.name),"ko"));
    const count=document.querySelector("[data-race-count]");
    const summary=document.querySelector("[data-race-summary]");
    const modal=document.querySelector("[data-race-modal]");
    const modalTitle=document.querySelector("[data-race-modal-title]");
    const modalBody=document.querySelector("[data-race-modal-body]");
    const modalActions=document.querySelector("[data-race-modal-actions]");

    const formatDate=value=>{
      if(!value)return "확인 필요";
      const date=new Date(`${value}T00:00:00`);
      return new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"short"}).format(date);
    };
    const display=value=>value?RF.esc(String(value)):"확인 필요";
    const formatPeriod=x=>{
      if(x.registrationPeriod)return display(x.registrationPeriod);
      if(x.registrationStart&&x.registrationEnd)return `${display(x.registrationStart)} ~ ${display(x.registrationEnd)}`;
      if(x.registrationStart)return `${display(x.registrationStart)}부터`;
      if(x.registrationEnd)return `${display(x.registrationEnd)}까지`;
      return "확인 필요";
    };
    const details=x=>[
      ["대회명",display(x.name)],
      ["대회 일시",`${display(formatDate(x.date))}${x.time?` ${display(x.time)}`:""}`],
      ["전화번호",display(x.phone)],
      ["대회 종목",(x.distances||[]).length?(x.distances||[]).map(display).join(", "):"확인 필요"],
      ["대회 지역",display(x.region)],
      ["대회 장소",display(x.venue)],
      ["접수 기간",formatPeriod(x)],
      ["홈페이지",x.officialUrl?`<a href="${RF.esc(x.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 홈페이지 열기</a>`:"확인 필요"]
    ];
    const closeModal=()=>{
      if(!modal)return;
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden","true");
      document.body.classList.remove("race-modal-open");
    };
    const openModal=x=>{
      if(!modal||!modalTitle||!modalBody||!modalActions)return;
      modalTitle.textContent=x.name||"대회 상세";
      modalBody.innerHTML=details(x).map(([label,value])=>`<div><dt>${RF.esc(label)}</dt><dd>${value}</dd></div>`).join("");
      const sourceUrl=x.sourceUrl||x.source?.url||"";
      modalActions.innerHTML=`
        ${x.officialUrl?`<a class="btn primary" href="${RF.esc(x.officialUrl)}" target="_blank" rel="noopener noreferrer">공식 홈페이지</a>`:""}
        ${sourceUrl?`<a class="btn ghost" href="${RF.esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">출처에서 확인</a>`:""}
      `;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden","false");
      document.body.classList.add("race-modal-open");
      modal.querySelector(".race-modal-close")?.focus();
    };

    if(count)count.textContent=`${data.length}개`;
    if(summary){
      const months=new Set(data.map(x=>String(x.date).slice(5,7))).size;
      const regions=new Set(data.map(x=>x.region).filter(Boolean)).size;
      summary.innerHTML=`
        <div><strong>${data.length}</strong><span>2026 대회</span></div>
        <div><strong>${months}</strong><span>개최 월</span></div>
        <div><strong>${regions}</strong><span>지역</span></div>
        <div><strong>${RF.esc(payload.metadata?.updatedAt||"")}</strong><span>정보 확인일</span></div>
      `;
    }

    const grouped=new Map();
    data.forEach(x=>{
      const month=String(x.date||"").slice(5,7)||"00";
      if(!grouped.has(month))grouped.set(month,[]);
      grouped.get(month).push(x);
    });

    list.innerHTML=[...grouped.entries()].map(([month,items])=>`
      <section class="race-month-group">
        <header class="race-month-heading"><h2>${Number(month)}월</h2><span>${items.length}개 대회</span></header>
        <div class="race-month-list">
          ${items.map(x=>`
            <button class="race-item race-item-button" data-race-id="${RF.esc(String(x.id))}" type="button">
              <span class="race-date-box">
                <strong>${RF.esc(String(x.date||"").slice(8,10))}</strong>
                <span>${RF.esc(String(x.date||"").slice(5,7))}월</span>
              </span>
              <span class="race-content">
                <span class="race-card-head"><span class="race-region">${display(x.region)}</span></span>
                <strong class="race-title">${display(x.name)}</strong>
                <span class="race-date-text">${display(formatDate(x.date))}</span>
                <span class="race-venue">${display(x.venue)}</span>
                <span class="race-distances">${(x.distances||[]).map(d=>`<span>${display(d)}</span>`).join("")}</span>
              </span>
              <span class="race-detail-arrow" aria-hidden="true">상세보기 →</span>
            </button>
          `).join("")}
        </div>
      </section>
    `).join("")||'<div class="empty-state"><h3>등록된 2026년 대회가 없습니다.</h3></div>';

    const byId=new Map(data.map(x=>[String(x.id),x]));
    list.addEventListener("click",event=>{
      const item=event.target.closest("[data-race-id]");
      if(!item)return;
      const race=byId.get(item.dataset.raceId);
      if(race)openModal(race);
    });
    document.querySelectorAll("[data-race-close]").forEach(el=>el.addEventListener("click",closeModal));
    document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});
  }catch(error){
    console.error(error);
    list.innerHTML=`<div class="empty-state"><h3>대회 데이터를 불러오지 못했습니다.</h3><p>${RF.esc(error.message)}</p></div>`;
  }
}

async function courses(){
  const grid=document.querySelector("[data-course-grid]");
  if(!grid)return;
  try{
    const payload=await RF.loadJSON("./data/courses.json");
    const data=Array.isArray(payload)?payload:(payload.courses||[]);
    const q=document.querySelector("[data-course-search]");
    const region=document.querySelector("[data-course-region]");
    const distance=document.querySelector("[data-course-distance]");
    const level=document.querySelector("[data-course-level]");
    const count=document.querySelector("[data-course-count]");
    const summary=document.querySelector("[data-course-summary]");
    const modal=document.querySelector("[data-course-modal]");
    const modalRegion=document.querySelector("[data-course-modal-region]");
    const modalTitle=document.querySelector("[data-course-modal-title]");
    const modalBody=document.querySelector("[data-course-modal-body]");
    const modalActions=document.querySelector("[data-course-modal-actions]");
    const labels={easy:"쉬움",normal:"보통",hard:"어려움"};
    const show=v=>v===null||v===undefined||v===""?"미확인":RF.esc(String(v));
    const regions=[...new Set(data.map(x=>x.region).filter(Boolean))];
    region.innerHTML='<option value="">전국</option>'+regions.map(x=>`<option value="${RF.esc(x)}">${RF.esc(x)}</option>`).join("");
    const initialQuery=new URLSearchParams(location.search).get("q");if(initialQuery)q.value=initialQuery;
    if(summary)summary.innerHTML=`<div><strong>${data.length}</strong><span>등록 코스</span></div><div><strong>${regions.length}</strong><span>지역</span></div><div><strong>${data.filter(x=>x.featured).length}</strong><span>추천 코스</span></div>`;
    const close=()=>{modal?.classList.remove("is-open");modal?.setAttribute("aria-hidden","true");document.body.classList.remove("course-modal-open")};
    const open=x=>{
      modalRegion.textContent=x.region||"코스";modalTitle.textContent=x.name||"러닝코스";
      const rows=[["거리",x.distanceText],["난이도",x.difficulty?labels[x.difficulty]||x.difficulty:null],["노면",x.surface],["형태",x.routeType],["주차",x.parking],["화장실",x.toilet],["조명",x.lighting],["설명",x.description],["확인 안내",x.verificationNote]];
      modalBody.innerHTML=rows.map(([a,b])=>`<div><dt>${RF.esc(a)}</dt><dd>${show(b)}</dd></div>`).join("");
      const keyword=encodeURIComponent(x.mapKeyword||`${x.region||""} ${x.name||""}`);
      modalActions.innerHTML=`<a class="btn primary" href="https://map.kakao.com/link/search/${keyword}" target="_blank" rel="noopener noreferrer">카카오맵에서 보기</a><a class="btn ghost" href="https://map.kakao.com/?q=${keyword}" target="_blank" rel="noopener noreferrer">길찾기 준비</a>`;
      modal.classList.add("is-open");modal.setAttribute("aria-hidden","false");document.body.classList.add("course-modal-open");
    };
    const render=()=>{
      const term=(q.value||"").trim().toLowerCase();
      const selectedRegion=region.value;const selectedDistance=distance.value;const selectedLevel=level.value;
      const filtered=data.filter(x=>{
        const hay=[x.name,x.region,x.locality,x.mapKeyword,x.description].filter(Boolean).join(" ").toLowerCase();
        const d=x.distanceCategory||"unknown";const l=x.difficulty||"unknown";
        return(!term||hay.includes(term))&&(!selectedRegion||x.region===selectedRegion)&&(!selectedDistance||d===selectedDistance)&&(!selectedLevel||l===selectedLevel);
      });
      count.textContent=`${filtered.length}개`;
      grid.innerHTML=filtered.map(x=>`<button class="course-card-item course-card-button" data-course-id="${RF.esc(x.id)}" type="button"><span class="course-card-top"><span class="course-region-badge">${RF.esc(x.region||"지역 미확인")}</span>${x.featured?'<span class="course-featured">추천</span>':''}</span><strong>${RF.esc(x.name||"러닝코스")}</strong><span class="course-card-meta"><span>거리 ${show(x.distanceText)}</span><span>난이도 ${x.difficulty?RF.esc(labels[x.difficulty]||x.difficulty):"미확인"}</span></span><p>${RF.esc(x.description||"")}</p><span class="course-more">상세보기 →</span></button>`).join("")||'<div class="empty-state"><h3>검색 결과가 없습니다.</h3><p>필터를 초기화하고 다시 검색해 보세요.</p></div>';
    };
    [q,region,distance,level].forEach(el=>{el?.addEventListener(el===q?"input":"change",el===q?RF.debounce(render,120):render)});
    document.querySelector("[data-course-reset]")?.addEventListener("click",()=>{q.value="";region.value="";distance.value="";level.value="";render()});
    const byId=new Map(data.map(x=>[String(x.id),x]));
    grid.addEventListener("click",e=>{const b=e.target.closest("[data-course-id]");if(b&&byId.has(b.dataset.courseId))open(byId.get(b.dataset.courseId))});
    document.querySelectorAll("[data-course-close]").forEach(x=>x.addEventListener("click",close));
    document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
    render();
  }catch(error){console.error(error);grid.innerHTML=`<div class="empty-state"><h3>코스 데이터를 불러오지 못했습니다.</h3><p>${RF.esc(error.message)}</p></div>`}
}
async function profile(){
  const form=document.querySelector("[data-auth-form]");
  const status=document.querySelector("[data-auth-status]");
  const profileForm=document.querySelector("[data-profile-form]");
  if(!form)return;
  const update=async()=>{const u=await RFBackend.getUser();if(status)status.textContent=u?`${u.email||u.nickname||"사용자"} 로그인 중 · ${RFBackend.statusText()}`:`로그인 전 · ${RFBackend.statusText()}`};
  form.addEventListener("submit",async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));await RFBackend.signIn(o);await update()});
  document.querySelector("[data-logout]")?.addEventListener("click",async()=>{await RFBackend.signOut();await update()});
  if(profileForm){
    const saved=await RFBackend.getProfile();
    Object.entries(saved||{}).forEach(([k,v])=>{const el=profileForm.elements.namedItem(k);if(el&&el.type!=="file")el.value=v??""});
    profileForm.addEventListener("submit",async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget));delete payload.photo;await RFBackend.saveProfile(payload);alert("프로필을 저장했습니다.")});
  }
  await update();
}
async function myShoes(){
  const form=document.querySelector("[data-my-shoe-form]"),list=document.querySelector("[data-my-shoes-list]");if(!form||!list)return;
  const render=async()=>{const d=await RFBackend.listShoes();list.innerHTML=d.map((x,i)=>`<article class="card"><h3>${RF.esc(x.name||x.model||"내 러닝화")}</h3><p>${RF.esc(x.brand||"")} · ${RF.esc(x.distance||"0")}km</p><button class="btn ghost" data-del-shoe="${RF.esc(String(x.id??i))}">삭제</button></article>`).join("")||'<p class="muted">등록된 신발이 없습니다.</p>'};
  form.addEventListener("submit",async e=>{e.preventDefault();await RFBackend.addShoe(Object.fromEntries(new FormData(form)));form.reset();await render()});
  list.addEventListener("click",async e=>{const b=e.target.closest("[data-del-shoe]");if(!b)return;await RFBackend.deleteShoe(b.dataset.delShoe);await render()});
  await render();
}
async function runLogs(){
  const form=document.querySelector("[data-run-log-form]"),list=document.querySelector("[data-run-log-list]");if(!form||!list)return;
  const render=async()=>{const d=await RFBackend.listLogs();list.innerHTML=d.slice().reverse().map(x=>`<article class="run-item"><h3>${RF.esc(x.distance||"0")}km</h3><p>${RF.esc(x.date||"")} · ${RF.esc(x.pace||x.time||"")}</p></article>`).join("")||'<p class="muted">아직 러닝 기록이 없습니다.</p>'};
  form.addEventListener("submit",async e=>{e.preventDefault();await RFBackend.addLog(Object.fromEntries(new FormData(form)));form.reset();await render()});
  await render();
}

