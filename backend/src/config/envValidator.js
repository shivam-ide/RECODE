const path = require('path');
const dotenv = require('dotenv');

/**
 * Re:Code — Central Environment Validator
 *
 * Validates critical environment bindings on startup:
 * - PORT: Valid numeric port (default: 5000)
 * - SUPABASE_URL: Valid URL format
 * - SUPABASE_ANON_KEY: Client publishable key
 * - SUPABASE_SERVICE_ROLE_KEY: Admin service key
 * - GEMINI_API_KEY: Google Gemini API key
 *
 * Graceful Degradation:
 * If GEMINI_API_KEY is missing or invalid, Re:Code logs diagnostic details
 * and enters "Partial Analysis Mode" without crashing with an unhandled rejection.
 */

// Load environment variables without silent failure
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const backendEnvPath = path.resolve(__dirname, '../../.env');

let envLoaded = false;
const envLoadResults = [];

const backendResult = dotenv.config({ path: backendEnvPath });
if (!backendResult.error) {
  envLoaded = true;
  envLoadResults.push({ path: backendEnvPath, success: true });
}

const rootResult = dotenv.config({ path: rootEnvPath });
if (!rootResult.error) {
  envLoaded = true;
  envLoadResults.push({ path: rootEnvPath, success: true });
}

// Fallback to default dotenv location
if (!envLoaded) {
  const defaultResult = dotenv.config();
  if (!defaultResult.error) {
    envLoaded = true;
    envLoadResults.push({ path: '.env', success: true });
  }
}

/**
 * Validate URL string
 * @param {string} urlStr
 * @returns {boolean}
 */
function isValidUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Perform comprehensive startup environment audit
 *
 * @param {Object} [options]
 * @param {boolean} [options.throwOnMissingRequired=false] - Whether to throw on missing database bindings
 * @returns {{
 *   isValid: boolean,
 *   partialMode: boolean,
 *   missingVars: string[],
 *   warnings: string[],
 *   config: Object
 * }}
 */
function validateEnvironment(options = {}) {
  const { throwOnMissingRequired = false } = options;

  const missingVars = [];
  const warnings = [];
  let partialMode = false;

  // 1. Audit PORT
  const rawPort = process.env.PORT;
  let effectivePort = 5000;
  if (rawPort) {
    const parsed = parseInt(rawPort, 10);
    if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
      warnings.push(`Invalid PORT '${rawPort}'. Defaulting to 5000.`);
    } else {
      effectivePort = parsed;
    }
  }

  // 2. Audit Supabase Bindings
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    missingVars.push('SUPABASE_URL');
  } else if (!isValidUrl(supabaseUrl)) {
    warnings.push(`SUPABASE_URL '${supabaseUrl}' is not a valid HTTP/HTTPS URL.`);
  }

  if (!supabaseAnonKey) {
    missingVars.push('SUPABASE_ANON_KEY');
  }

  if (!supabaseServiceKey) {
    missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  // 3. Audit Gemini API Key (Graceful Partial Mode Fallback)
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey.trim().length === 0 || geminiApiKey.includes('placeholder')) {
    partialMode = true;
    warnings.push(
      'GEMINI_API_KEY is not configured or placeholder detected. Re:Code is operating in Partial Analysis Mode (Deterministic AST only).'
    );
  }

  const isValid = missingVars.length === 0;

  if (!isValid && throwOnMissingRequired) {
    throw new Error(
      `[Re:Code Environment Integrity Failure] Missing critical environment variables: ${missingVars.join(
        ', '
      )}`
    );
  }

  return {
    isValid,
    partialMode,
    missingVars,
    warnings,
    envLoaded,
    config: {
      port: effectivePort,
      supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceKey),
      geminiConfigured: !partialMode,
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      nodeEnv: process.env.NODE_ENV || 'development',
    },
  };
}

module.exports = {
  validateEnvironment,
  isValidUrl,
};
