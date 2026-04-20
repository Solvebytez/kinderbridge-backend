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
    case 's': return value * 1000; // seconds
    case 'm': return value * 60 * 1000; // minutes
    case 'h': return value * 60 * 60 * 1000; // hours
    case 'd': return value * 24 * 60 * 60 * 1000; // days
    default: return 15 * 60 * 1000; // Default 15 minutes
  }
};

/**
 * Set access token cookie
 * @param {Object} res - Express response object
 * @param {string} token - Access token
 */
const setAccessTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  const maxAge = parseExpiryToMs(expiresIn);
  
  console.log('🍪 [COOKIE_HELPER] Setting access token cookie:', {
    isProduction,
    expiresIn,
    maxAge,
    maxAgeMinutes: Math.round(maxAge / 60000),
    tokenLength: token.length
  });
  
  const cookieSameSite = (process.env.COOKIE_SAMESITE || (isProduction ? 'lax' : 'lax')).toLowerCase();
  const cookieSecure =
    typeof process.env.COOKIE_SECURE === 'string'
      ? process.env.COOKIE_SECURE.toLowerCase() === 'true'
      : isProduction;
  const cookieDomain =
    typeof process.env.COOKIE_DOMAIN === 'string'
      ? (process.env.COOKIE_DOMAIN.trim() || undefined)
      : (isProduction ? '.kinderbridge.ca' : undefined);

  const cookieOptions = {
    httpOnly: true,
    secure: cookieSecure, // NOTE: SameSite=None requires Secure
    sameSite: cookieSameSite, // 'none' for localhost -> prod API cookie auth
    maxAge: maxAge,
    path: '/',
    // Set to share cookies across subdomains, or leave undefined for host-only cookies.
    domain: cookieDomain,
  };
  
  console.log('🍪 [COOKIE_HELPER] Cookie options:', cookieOptions);
  
  res.cookie('accessToken', token, cookieOptions);
  
  console.log('✅ [COOKIE_HELPER] Access token cookie set successfully');
};

/**
 * Set refresh token cookie
 * @param {Object} res - Express response object
 * @param {string} token - Refresh token
 */
const setRefreshTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const maxAge = parseExpiryToMs(expiresIn);

  const cookieSameSite = (process.env.COOKIE_SAMESITE || (isProduction ? 'lax' : 'lax')).toLowerCase();
  const cookieSecure =
    typeof process.env.COOKIE_SECURE === 'string'
      ? process.env.COOKIE_SECURE.toLowerCase() === 'true'
      : isProduction;
  const cookieDomain =
    typeof process.env.COOKIE_DOMAIN === 'string'
      ? (process.env.COOKIE_DOMAIN.trim() || undefined)
      : (isProduction ? '.kinderbridge.ca' : undefined);

  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: maxAge,
    path: '/',
    domain: cookieDomain,
  });
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieSameSite = (process.env.COOKIE_SAMESITE || (isProduction ? 'lax' : 'lax')).toLowerCase();
  const cookieSecure =
    typeof process.env.COOKIE_SECURE === 'string'
      ? process.env.COOKIE_SECURE.toLowerCase() === 'true'
      : isProduction;
  const cookieDomain =
    typeof process.env.COOKIE_DOMAIN === 'string'
      ? (process.env.COOKIE_DOMAIN.trim() || undefined)
      : (isProduction ? '.kinderbridge.ca' : undefined);
  
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/',
    domain: cookieDomain,
  });
  
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/',
    domain: cookieDomain,
  });
};

module.exports = {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};

