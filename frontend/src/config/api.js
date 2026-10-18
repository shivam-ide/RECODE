/**
 * Resolves the API Base URL cleanly.
 * - Strips any accidental trailing /api/v1, /api, or slashes.
 * - In local dev (browser on localhost/127.0.0.1), returns '' so requests
 *   use the Vite dev server proxy seamlessly (avoiding CORS and port issues).
 * - In production or custom domains, returns the clean host URL.
 */
export function getApiBaseUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (!envUrl) {
    return '';
  }
  // Remove trailing slashes and /api or /api/v1
  const clean = envUrl.replace(/\/+$/, '').replace(/\/api(?:\/v1)?$/, '');

  // If in browser and pointing to local Express server on port 5000,
  // return empty string so Vite proxy forwards it seamlessly without CORS preflight failures
  if (typeof window !== 'undefined') {
    const isLocalhostEnv = /^https?:\/\/(?:localhost|127\.0\.0\.1):5000\/?$/.test(clean);
    const isLocalhostOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(window.location.origin);
    if (isLocalhostEnv && isLocalhostOrigin) {
      return '';
    }
  }

  return clean;
}

export const API_BASE_URL = getApiBaseUrl();
