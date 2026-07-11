"use strict";
window.RFContentStore = (() => {
  const PREFIX = "rf-admin:";
  const mapPath = (path) => path.includes("shoes.json") ? "shoes" : path.includes("races.json") ? "races" : path.includes("courses.json") ? "courses" : null;
  const parse = (v,f) => { try { return JSON.parse(v) ?? f; } catch { return f; } };
  const read = (type) => parse(localStorage.getItem(PREFIX+type), null);
  const write = (type, rows) => localStorage.setItem(PREFIX+type, JSON.stringify(rows));
  const rowsOf = (base,type) => Array.isArray(base) ? base : Array.isArray(base?.[type]) ? base[type] : [];
  function merge(path, base){
    const type=mapPath(path); if(!type) return base;
    const local=read(type); if(!local) return base;
    const visible=local.filter(x=>x && x.status!=="deleted" && x.published!==false);
    if(Array.isArray(base)) return visible;
    return {...base,[type]:visible,metadata:{...(base.metadata||{}),source:"admin-local",updatedAt:new Date().toISOString()}};
  }
  async function seed(type,path){
    const existing=read(type); if(existing) return existing;
    const res=await fetch(path,{cache:"no-store"}); if(!res.ok) throw new Error("기본 데이터 로드 실패");
    const base=await res.json(); const rows=rowsOf(base,type); write(type,rows); return rows;
  }
  return {read,write,merge,seed,clear(type){localStorage.removeItem(PREFIX+type)},exportAll(){return {version:1,exportedAt:new Date().toISOString(),shoes:read("shoes"),races:read("races"),courses:read("courses")}},importAll(data){["shoes","races","courses"].forEach(t=>Array.isArray(data?.[t])&&write(t,data[t]));}};
})();