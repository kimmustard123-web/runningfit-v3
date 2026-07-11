"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "rf_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function env(name) {
  return String(process.env[name] || "").trim();
}

function requiredAdminConfig() {
  const supabaseUrl = env("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = env("SUPABASE_SECRET_KEY");
  const adminPassword = env("ADMIN_PASSWORD");
  return { supabaseUrl, secretKey, adminPassword };
}

function signSession(adminPassword, expiresAt) {
  const payload = String(expiresAt);
  const signature = crypto.createHmac("sha256", adminPassword).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifySessionToken(token, adminPassword) {
  if (!token || !adminPassword) return false;
  const [expiresAtRaw, signature] = String(token).split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt || !signature) return false;
  const expected = crypto.createHmac("sha256", adminPassword).update(expiresAtRaw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const header = String(req.headers.cookie || "");
  const found = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

function isAdmin(req) {
  const { adminPassword } = requiredAdminConfig();
  return verifySessionToken(readCookie(req, COOKIE_NAME), adminPassword);
}

function setAdminCookie(res) {
  const { adminPassword } = requiredAdminConfig();
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = signSession(adminPassword, expiresAt);
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`);
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.status(401).json({ error: "관리자 로그인이 필요합니다." });
  return false;
}

function missingConfig() {
  const config = requiredAdminConfig();
  return [
    !config.supabaseUrl && "SUPABASE_URL",
    !config.secretKey && "SUPABASE_SECRET_KEY",
    !config.adminPassword && "ADMIN_PASSWORD"
  ].filter(Boolean);
}

async function supabaseRequest(path, options = {}) {
  const { supabaseUrl, secretKey } = requiredAdminConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = body?.message || body?.error || text || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

module.exports = {
  requiredAdminConfig,
  missingConfig,
  isAdmin,
  setAdminCookie,
  clearAdminCookie,
  requireAdmin,
  supabaseRequest
};
