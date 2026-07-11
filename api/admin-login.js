"use strict";

const { requiredAdminConfig, missingConfig, setAdminCookie } = require("./_admin-auth");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const missing = missingConfig();
    res.status(200).json({ configured: missing.length === 0, missing });
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "지원하지 않는 요청입니다." });
    return;
  }
  const missing = missingConfig();
  if (missing.length) {
    res.status(503).json({ error: "관리자 서버 설정이 끝나지 않았습니다.", missing });
    return;
  }
  const password = String(req.body?.password || "");
  const { adminPassword } = requiredAdminConfig();
  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "관리자 비밀번호가 올바르지 않습니다." });
    return;
  }
  setAdminCookie(res);
  res.status(200).json({ ok: true });
};
