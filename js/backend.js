"use strict";

window.RFBackend = (() => {
  const KEYS = {
    user: "rf-user",
    profile: "rf-profile",
    shoes: "rf-my-shoes",
    logs: "rf-run-logs"
  };

  const safeParse = (value, fallback) => {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  };

  const local = {
    async getUser(){ return safeParse(localStorage.getItem(KEYS.user), null); },
    async signIn(payload){ localStorage.setItem(KEYS.user, JSON.stringify(payload)); return payload; },
    async signOut(){ localStorage.removeItem(KEYS.user); },
    async getProfile(){ return safeParse(localStorage.getItem(KEYS.profile), {}); },
    async saveProfile(payload){ localStorage.setItem(KEYS.profile, JSON.stringify(payload)); return payload; },
    async listShoes(){ return safeParse(localStorage.getItem(KEYS.shoes), []); },
    async addShoe(payload){ const rows=await local.listShoes(); rows.push({...payload,id:crypto.randomUUID?.()||String(Date.now())}); localStorage.setItem(KEYS.shoes,JSON.stringify(rows)); return rows; },
    async deleteShoe(id){ const rows=(await local.listShoes()).filter((x,i)=>String(x.id??i)!==String(id)); localStorage.setItem(KEYS.shoes,JSON.stringify(rows)); return rows; },
    async listLogs(){ return safeParse(localStorage.getItem(KEYS.logs), []); },
    async addLog(payload){ const rows=await local.listLogs(); rows.push({...payload,id:crypto.randomUUID?.()||String(Date.now())}); localStorage.setItem(KEYS.logs,JSON.stringify(rows)); return rows; }
  };

  const config = window.RUNNINGFIT_BACKEND || {};
  const mode = config.provider === "supabase" && config.url && config.anonKey ? "supabase-ready" : "local";

  return {
    mode,
    ...local,
    statusText(){ return mode === "local" ? "이 기기에만 저장 중" : "서버 연결 준비됨"; }
  };
})();
