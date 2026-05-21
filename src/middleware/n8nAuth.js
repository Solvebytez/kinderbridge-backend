/**
 * Service token for n8n → API routes
 */
const authenticateN8nService = (req, res, next) => {
  const expected = process.env.N8N_API_KEY;
  if (!expected || !String(expected).trim()) {
    return res.status(503).json({
      success: false,
      error: "N8N_API_KEY is not configured on the server",
    });
  }

  const headerKey = req.headers["x-n8n-api-key"];
  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const provided = String(headerKey || bearer || "").trim();

  if (!provided || provided !== String(expected).trim()) {
    return res.status(401).json({
      success: false,
      error: "Invalid or missing n8n service credentials",
    });
  }

  next();
};

module.exports = { authenticateN8nService };
