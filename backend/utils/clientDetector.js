/**
 * Detects whether the incoming request originated from the web frontend (website)
 * vs mobile app (Flutter).
 *
 * Web requests sent by browsers include 'origin' or 'referer' matching frontend URLs,
 * or custom platform headers (e.g., x-platform: web, x-client: web, ?platform=web).
 * Mobile app requests (from native Flutter Dio/Http) do not carry browser web origins.
 */
const isWebClient = (req) => {
  if (!req) return false;

  const origin = (req.get ? req.get("origin") : req.headers?.origin) || "";
  const referer = (req.get ? req.get("referer") : req.headers?.referer) || "";
  const platform =
    (req.get
      ? req.get("x-platform") || req.get("x-client")
      : req.headers?.["x-platform"] || req.headers?.["x-client"]) ||
    req.query?.platform ||
    req.query?.client ||
    "";

  // Explicit platform/client flag
  const platLower = String(platform).toLowerCase();
  if (platLower === "web" || platLower === "website") {
    return true;
  }
  if (platLower === "app" || platLower === "mobile" || platLower === "flutter") {
    return false;
  }

  // Check known website domains & local dev ports
  const webIndicators = [
    "mastiadda.in",
    "www.mastiadda.in",
    "localhost:3000",
    "127.0.0.1:3000",
    "netlify.app",
  ];

  const sourceUrl = `${origin} ${referer}`.toLowerCase();

  // If origin/referer is from admin panel, don't treat as public website
  if (sourceUrl.includes("admin.mastiadda.in") || sourceUrl.includes("localhost:5173")) {
    return false;
  }

  return webIndicators.some((domain) => sourceUrl.includes(domain));
};

module.exports = { isWebClient };

