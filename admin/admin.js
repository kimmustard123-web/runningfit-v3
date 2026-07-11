"use strict";

const CONFIG = window.RUNNINGFIT_BACKEND || { provider: "local" };
const SESSION_KEY = "rf-admin-session";
const types = {
  shoes: {
    title: "러닝화 관리",
    path: "../data/shoes.json",
    name: x => `${x.brand || ""} ${x.modelKo || x.modelEn || "이름 없음"}`.trim(),
    sub: x => `${x.id || "ID 없음"} · ${x.runningFit?.primary || x.primaryUse || "용도 미정"}`,
    image: x => x.image?.src || "",
    fields: [
      ["id","ID/slug","text"],["brand","브랜드","text"],["modelKo","한글 모델명","text"],["modelEn","영문 모델명","text"],
      ["image.src","이미지 경로","text"],["runningFit.primary","주용도","select","daily|training|race|stability"],
      ["carbonPlate","카본 플레이트","checkbox"],["published","공개","checkbox"],["status","상태","select","active|draft|archived"]
    ]
  },
  races: {
    title: "대회 관리",
    path: "../data/races.json",
    name: x => x.name || "이름 없음",
    sub: x => `${x.date || "날짜 미정"} · ${x.region || "지역 미정"} · ${x.venue || x.location || "장소 미정"}`,
    fields: [
      ["id","ID","text"],["name","대회명","text"],["date","개최일","date"],["region","지역","text"],["venue","장소","text"],
      ["distances","종목(쉼표 구분)","text"],["officialUrl","공식 홈페이지","url"],["entryUrl","접수 링크","url"],["published","공개","checkbox"],["status","상태","select","active|draft|archived"]
    ]
  },
  courses: {
    title: "코스 관리",
    path: "../data/courses.json",
    name: x => x.name || x.title || "이름 없음",
    sub: x => `${x.region || "지역 미정"} · ${x.distanceText || (x.distanceKm ? x.distanceKm + "km" : "거리 미정")}`,
    fields: [
      ["id","ID","text"],["name","코스명","text"],["region","지역","text"],["locality","세부 지역","text"],["distanceKm","거리(km)","number"],
      ["difficulty","난이도","select","easy|normal|hard"],["mapKeyword","지도 검색어","text"],["description","설명","textarea"],["featured","추천 코스","checkbox"],["published","공개","checkbox"],["status","상태","select","active|draft|archived"]
    ]
  }
};

let currentType = "shoes";
let rows = [];
let editingIndex = null;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const get = (obj,path) => path.split(".").reduce((a,k)=>a?.[k],obj);
const set = (obj,path,value) => { const keys=path.split("."); let cur=obj; keys.slice(0,-1).forEach(k=>cur=cur[k]??={}); cur[keys.at(-1)]=value; };
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function setSession(mode){ localStorage.setItem(SESSION_KEY, JSON.stringify({mode, at:Date.now()})); openApp(mode); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); location.reload(); }
function openApp(mode){
  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  $("#modeBadge").textContent = mode === "supabase" ? "Supabase 연결" : "로컬 개발 모드";
  showView("dashboard");
}

async function supabaseLogin(){
  if(CONFIG.provider !== "supabase" || !CONFIG.url || !CONFIG.anonKey){
    $("#loginMessage").textContent = "backend-config.js에 Supabase URL과 anon key를 먼저 입력해야 합니다.";
    return;
  }
  const email=$("#adminEmail").value.trim(); const password=$("#adminPassword").value;
  if(!email || !password){ $("#loginMessage").textContent="이메일과 비밀번호를 입력하세요."; return; }
  try{
    const res=await fetch(`${CONFIG.url}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:CONFIG.anonKey,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const data=await res.json(); if(!res.ok) throw new Error(data.error_description||data.msg||"로그인 실패");
    localStorage.setItem("rf-supabase-token",data.access_token); setSession("supabase");
  }catch(err){ $("#loginMessage").textContent=err.message; }
}

async function loadType(type=currentType){
  currentType=type;
  rows=await RFContentStore.seed(type,types[type].path);
  renderList();
  renderDashboard();
}

function publishedOf(x){ return x.published !== false && x.status !== "archived" && x.status !== "deleted"; }

function renderDashboard(){
  Promise.all(Object.entries(types).map(async ([type,cfg])=>{
    const data=await RFContentStore.seed(type,cfg.path);
    return {type,title:cfg.title.replace(" 관리",""),total:data.length,published:data.filter(publishedOf).length};
  })).then(items=>{
    $("#summaryCards").innerHTML=items.map(x=>`<article class="summary-card"><span>${x.title}</span><b>${x.total.toLocaleString()}</b><small>공개 ${x.published.toLocaleString()}개</small></article>`).join("");
  });
}

function renderList(){
  const cfg=types[currentType]; const q=$("#search").value.trim().toLowerCase(); const filter=$("#statusFilter").value;
  const view=rows.map((row,index)=>({row,index})).filter(({row})=>{
    const match=!q || JSON.stringify(row).toLowerCase().includes(q);
    const pub=publishedOf(row); const status=filter==="all" || (filter==="published"&&pub) || (filter==="hidden"&&!pub);
    return match&&status;
  });
  $("#stats").innerHTML=`<span>전체 <b>${rows.length}</b></span><span>공개 <b>${rows.filter(publishedOf).length}</b></span><span>비공개 <b>${rows.filter(x=>!publishedOf(x)).length}</b></span>`;
  $("#list").innerHTML=view.map(({row,index})=>{
    const image=cfg.image?.(row); const imageHtml=image?`<img src="../${image.replace(/^\.\//,"")}" alt="" loading="lazy">`:`<div class="row-placeholder"></div>`;
    return `<article class="row">${imageHtml}<div><h3>${esc(cfg.name(row))}</h3><p>${esc(cfg.sub(row))}${publishedOf(row)?" · 공개":" · 비공개"}</p></div><div class="row-actions"><button data-action="edit" data-index="${index}">수정</button><button data-action="toggle" data-index="${index}">${publishedOf(row)?"숨김":"공개"}</button><button data-action="delete" data-index="${index}">삭제</button></div></article>`;
  }).join("") || `<div class="empty">검색 결과가 없습니다.</div>`;
}

function fieldHtml(row,field){
  const [key,label,kind,options]=field; const value=get(row,key);
  if(kind==="checkbox") return `<label class="checkbox-line"><input name="${key}" type="checkbox" ${value===true || (key==="published"&&value!==false)?"checked":""}><span>${label}</span></label>`;
  if(kind==="textarea") return `<label class="wide"><span>${label}</span><textarea name="${key}">${esc(value)}</textarea></label>`;
  if(kind==="select") return `<label><span>${label}</span><select name="${key}">${options.split("|").map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
  return `<label><span>${label}</span><input name="${key}" type="${kind}" value="${esc(Array.isArray(value)?value.join(", "):value)}"></label>`;
}

function openEditor(index=null){
  editingIndex=index;
  const row=index===null?{id:`${currentType.slice(0,-1)}-${Date.now()}`,published:true,status:"active"}:structuredClone(rows[index]);
  $("#editorTitle").textContent=index===null?`새 ${types[currentType].title.replace(" 관리","")}`:`${types[currentType].title.replace(" 관리","")} 수정`;
  $("#fields").innerHTML=types[currentType].fields.map(f=>fieldHtml(row,f)).join("");
  $("#editor").dataset.row=JSON.stringify(row);
  $("#editor").showModal();
}

function saveEditor(event){
  event.preventDefault(); const row=JSON.parse($("#editor").dataset.row);
  for(const [key,,kind] of types[currentType].fields){
    const el=event.currentTarget.elements[key]; let value=kind==="checkbox"?el.checked:el.value.trim();
    if(key==="distances") value=value?value.split(",").map(x=>x.trim()).filter(Boolean):[];
    if(kind==="number") value=value===""?null:Number(value);
    set(row,key,value);
  }
  row.updatedAt=new Date().toISOString();
  if(editingIndex===null) rows.unshift(row); else rows[editingIndex]=row;
  RFContentStore.write(currentType,rows); $("#editor").close(); renderList(); renderDashboard();
}

function showView(view){
  $$(".view").forEach(v=>v.classList.remove("active")); $$(`.sidebar nav button`).forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  const title={dashboard:"대시보드",shoes:"러닝화 관리",races:"대회 관리",courses:"코스 관리",media:"이미지 최적화",backup:"백업·복원"}[view];
  $("#pageTitle").textContent=title; $("#addNew").hidden=!["shoes","races","courses"].includes(view);
  if(["shoes","races","courses"].includes(view)){ $("#listView").classList.add("active"); loadType(view); }
  else $("#"+view+"View").classList.add("active");
}

async function optimizeImage(){
  const file=$("#mediaInput").files[0]; if(!file){ alert("이미지를 선택하세요."); return; }
  const slug=$("#mediaSlug").value.trim()||file.name.replace(/\.[^.]+$/,'').toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-");
  const maxWidth=Math.max(160,Number($("#mediaWidth").value)||640); const quality=Math.max(.4,Math.min(1,(Number($("#mediaQuality").value)||82)/100));
  const bitmap=await createImageBitmap(file); const scale=Math.min(1,maxWidth/bitmap.width); const canvas=document.createElement("canvas"); canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality)); const url=URL.createObjectURL(blob);
  const saved=Math.max(0,Math.round((1-blob.size/file.size)*100));
  $("#mediaResult").innerHTML=`<div><img src="${url}" alt=""><p>${canvas.width}×${canvas.height} · ${(blob.size/1024).toFixed(1)}KB · ${saved}% 절감</p><a id="downloadImage" class="primary" download="${slug}.webp" href="${url}">최적화 파일 다운로드</a><p class="muted">권장 경로: assets/images/shoes/${slug}.webp</p></div>`;
}

$("#localLogin").onclick=()=>setSession("local");
$("#serverLogin").onclick=supabaseLogin;
$("#logout").onclick=clearSession;
$$(".sidebar nav button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$("#search").oninput=renderList; $("#statusFilter").onchange=renderList; $("#addNew").onclick=()=>openEditor();
$("#closeEditor").onclick=$("#cancelEditor").onclick=()=>$("#editor").close(); $("#editorForm").onsubmit=saveEditor;
$("#list").onclick=e=>{ const b=e.target.closest("button[data-action]"); if(!b)return; const i=Number(b.dataset.index); if(b.dataset.action==="edit")openEditor(i); if(b.dataset.action==="toggle"){rows[i].published=!publishedOf(rows[i]);rows[i].status=rows[i].published?"active":"draft";RFContentStore.write(currentType,rows);renderList();renderDashboard();} if(b.dataset.action==="delete"&&confirm("삭제할까요?")){rows.splice(i,1);RFContentStore.write(currentType,rows);renderList();renderDashboard();} };
$("#optimizeImage").onclick=optimizeImage;
$("#exportAll").onclick=()=>{const blob=new Blob([JSON.stringify(RFContentStore.exportAll(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`runningfit-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);};
$("#importAll").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{RFContentStore.importAll(JSON.parse(await f.text()));renderDashboard();alert("복원 완료");}catch{alert("올바른 백업 JSON이 아닙니다.");}};
$("#resetAll").onclick=()=>{if(confirm("관리자 수정 내용을 모두 초기화할까요?")){["shoes","races","courses"].forEach(t=>RFContentStore.clear(t));renderDashboard();alert("초기화했습니다.");}};

const session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); if(session) openApp(session.mode); else $("#loginView").hidden=false;
