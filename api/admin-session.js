"use strict";
const { isAdmin, missingConfig } = require("./_admin-auth");
module.exports = async function handler(req, res) {
  const missing = missingConfig();
  res.status(200).json({ authenticated: isAdmin(req), configured: missing.length === 0, missing });
};
