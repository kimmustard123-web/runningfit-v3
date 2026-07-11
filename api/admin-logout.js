"use strict";
const { clearAdminCookie } = require("./_admin-auth");
module.exports = async function handler(req, res) {
  clearAdminCookie(res);
  res.status(200).json({ ok: true });
};
