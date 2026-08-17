/**
 * Cookie Helper Utilities
 * Provides functions to set and clear httpOnly cookies for authentication
 */

/**
 * Parse expiry string (e.g., "15m", "30d") to milliseconds
 * @param {string} expiry - Expiry string from environment variable
 * @returns {number} Milliseconds
 */
const parseExpiryToMs = (expiry) => {
  if (!expiry) return 15 * 60 * 1000; // Default 15 minutes

  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // Default 15 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000; // seconds
    case "m":
      return value * 60 * 1000; // minutes
    case "h":
      return value * 60 * 60 * 1000; // hours
    case "d":
      return value * 24 * 60 * 60 * 1000; // days
    default:
      return 15 * 60 * 1000; // Default 15 minutes
  }
};

/**
 * Cookie Domain must be `.kinderbridge.ca` in production so
 * `www.kinderbridge.ca` middleware can read tokens set by `api.kinderbridge.ca`.
 * Empty COOKIE_DOMAIN used to fall through to host-only cookies on the API host
 * and caused an infinite /login ↔ /parent-details redirect loop.
 *
 * Opt out of sharing: COOKIE_DOMAIN=host
 */
const resolveCookieDomain = (isProduction) => {
  const raw =
    typeof process.env.COOKIE_DOMAIN === "string"
      ? process.env.COOKIE_DOMAIN.trim()
      : "";

  if (["none", "host", "false", "off"].includes(raw.toLowerCase())) {
    return undefined;
  }
  if (raw) {
    return raw;
  }
  return isProduction ? ".kinderbridge.ca" : undefined;
};

const getCookieAuthOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieSameSite = (
    process.env.COOKIE_SAMESITE || (isProduction ? "none" : "lax")
  ).toLowerCase();
  const cookieSecure =
    typeof process.env.COOKIE_SECURE === "string"
      ? process.env.COOKIE_SECURE.toLowerCase() === "true"
      : isProduction || cookieSameSite === "none";

  const options = {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
    domain: resolveCookieDomain(isProduction),
  };

  if (typeof maxAge === "number") {
    options.maxAge = maxAge;
  }

  return options;
};

/**
 * Set access token cookie
 * @param {Object} res - Express response object
 * @param {string} token - Access token
 */
const setAccessTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  const maxAge = parseExpiryToMs(expiresIn);

  console.log("🍪 [COOKIE_HELPER] Setting access token cookie:", {
    isProduction,
    expiresIn,
    maxAge,
    maxAgeMinutes: Math.round(maxAge / 60000),
    tokenLength: token.length,
  });

  const cookieOptions = getCookieAuthOptions(maxAge);

  console.log("🍪 [COOKIE_HELPER] Cookie options:", cookieOptions);

  res.cookie("accessToken", token, cookieOptions);

  console.log("✅ [COOKIE_HELPER] Access token cookie set successfully");
};

/**
 * Set refresh token cookie
 * @param {Object} res - Express response object
 * @param {string} token - Refresh token
 */
const setRefreshTokenCookie = (res, token) => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
  const maxAge = parseExpiryToMs(expiresIn);
  res.cookie("refreshToken", token, getCookieAuthOptions(maxAge));
};

const clearCookiePair = (res, name, extra) => {
  res.clearCookie(name, extra);
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  const options = getCookieAuthOptions();
  const names = ["accessToken", "refreshToken"];

  names.forEach((name) => {
    clearCookiePair(res, name, options);
    // Also drop leftover host-only cookies from before Domain=.kinderbridge.ca
    if (options.domain) {
      const { domain, ...hostOnly } = options;
      clearCookiePair(res, name, hostOnly);
    }
  });
};

module.exports = {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};
