"use strict";
document.addEventListener("DOMContentLoaded",()=>{weather();races();courses();profile();myShoes();runLogs()});
async function weather(){const grid=document.querySelector("[data-weather-grid]");if(!grid)return;try{const d=await RF.loadJSON("./data/weather.json");grid.innerHTML=d.map(x=>`<article class="weather-card-item"><p class="eyebrow">${RF.esc(x.meta)}</p><h2>${RF.esc(x.title)}</h2><p>${RF.esc(x.description)}</p></article>`).join("");document.querySelector("[data-weather-page-status]").textContent=`${d.length}개 안내 카드` }catch(e){grid.textContent=e.message}}
async function races(){
  const list=document.querySelector("[data-race-list]");
  if(!list)return;

  try{
    const payload=await RF.loadJSON("./data/races.json");
    const data=Array.isArray(payload)?payload:(payload.races||[]);
    const meta=payload.metadata||{};

    const q=document.querySelector("[data-race-search]");
    const region=document.querySelector("[data-race-region]");
    const distance=document.querySelector("[data-race-distance]");
    const month=document.querySelector("[data-race-month]");
    const status=document.querySelector("[data-race-status]");
    const count=document.querySelector("[data-race-count]");
    const summary=document.querySelector("[data-race-summary]");
    const reset=document.querySelector("[data-race-reset]");

    const regions=[...new Set(data.map(x=>x.region).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
    if(region){
      region.innerHTML='<option value="">전국</option>'+regions.map(x=>`<option value="${RF.esc(x)}">${RF.esc(x)}</option>`).join("");
    }

    const statusLabel=value=>({
      open:"접수중",
      pending:"접수예정·확인중",
      closed:"접수마감"
    }[value]||"확인 필요");

    const statusClass=value=>({
      open:"is-open",
      pending:"is-pending",
      closed:"is-closed"
    }[value]||"");

    const formatDate=value=>{
      const date=new Date(`${value}T00:00:00`);
      return new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"short"}).format(date);
    };

    const render=()=>{
      const keyword=(q?.value||"").trim().toLowerCase();
      const regionValue=region?.value||"";
      const distanceValue=distance?.value||"";
      const monthValue=month?.value||"";
      const statusValue=status?.value||"";

      const filtered=data.filter(x=>{
        const haystack=`${x.name} ${x.nameEn||""} ${x.region} ${x.venue}`.toLowerCase();
        const matchKeyword=!keyword||haystack.includes(keyword);
        const matchRegion=!regionValue||x.region===regionValue;
        const matchDistance=!distanceValue||(x.distances||[]).some(d=>String(d).includes(distanceValue));
        const matchMonth=!monthValue||String(x.date).slice(5,7)===monthValue;
        const matchStatus=!statusValue||x.status===statusValue;
        return matchKeyword&&matchRegion&&matchDistance&&matchMonth&&matchStatus;
      });

      if(count)count.textContent=`${filtered.length}개`;

      list.innerHTML=filtered.map(x=>`
        <article class="race-item">
          <div class="race-date-box">
            <strong>${RF.esc(String(x.date).slice(8,10))}</strong>
            <span>${RF.esc(String(x.date).slice(5,7))}월</span>
          </div>
          <div class="race-content">
            <div class="race-card-head">
              <span class="race-region">${RF.esc(x.region)}</span>
              <span class="race-status ${statusClass(x.status)}">${statusLabel(x.status)}</span>
            </div>
            <h2>${RF.esc(x.name)}</h2>
            <p class="race-date-text">${RF.esc(formatDate(x.date))}</p>
            <p class="race-venue">${RF.esc(x.venue||"장소 확인 필요")}</p>
            <div class="race-distances">${(x.distances||[]).map(d=>`<span>${RF.esc(d)}</span>`).join("")}</div>
          </div>
        </article>
      `).join("")||'<div class="empty-state"><h3>조건에 맞는 대회가 없습니다.</h3><p>필터를 초기화하거나 다른 조건으로 검색해보세요.</p></div>';
    };

    [q,region,distance,month,status].forEach(el=>{
      el?.addEventListener(el===q?"input":"change",render);
    });

    reset?.addEventListener("click",()=>{
      if(q)q.value="";
      if(region)region.value="";
      if(distance)distance.value="";
      if(month)month.value="";
      if(status)status.value="";
      render();
    });

    if(summary){
      const openCount=data.filter(x=>x.status==="open").length;
      const fullCount=data.filter(x=>(x.distances||[]).includes("풀")).length;
      summary.innerHTML=`
        <div><strong>${data.length}</strong><span>전체 대회</span></div>
        <div><strong>${openCount}</strong><span>접수중</span></div>
        <div><strong>${fullCount}</strong><span>풀코스 포함</span></div>
        <div><strong>${RF.esc(meta.updatedAt||"")}</strong><span>정보 확인일</span></div>
      `;
    }

    render();
  }catch(error){
    console.error(error);
    list.innerHTML=`<div class="empty-state"><h3>대회 데이터를 불러오지 못했습니다.</h3><p>${RF.esc(error.message)}</p></div>`;
  }
}
async function courses(){const grid=document.querySelector("[data-course-grid]");if(!grid)return;const d=await RF.loadJSON("./data/courses.json");const q=document.querySelector("[data-course-search]"),lv=document.querySelector("[data-course-level]");const render=()=>{const s=(q?.value||"").toLowerCase(),v=lv?.value||"";const f=d.filter(x=>(!s||JSON.stringify(x).toLowerCase().includes(s))&&(!v||x.level===v||x.difficulty===v));grid.innerHTML=f.map(x=>`<article class="course-card-item"><p class="eyebrow">${RF.esc(x.region||x.location||"코스")}</p><h2>${RF.esc(x.name||x.title)}</h2><p>${RF.esc(x.distance||"")} ${RF.esc(x.level||x.difficulty||"")}</p><p>${RF.esc(x.description||"")}</p></article>`).join("")||"검색 결과 없음"};q?.addEventListener("input",RF.debounce(render,140));lv?.addEventListener("change",render);render()}
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

