const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Ensure .env is loaded if invoked in standalone scripts, tests, or services
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  if (!process.env.SUPABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.warn('[SupabaseClient] Warning: SUPABASE_URL environment variable is missing.');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[SupabaseClient] Warning: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
}

if (!SUPABASE_ANON_KEY) {
  console.warn('[SupabaseClient] Warning: SUPABASE_ANON_KEY environment variable is missing.');
}

/**
 * 1. Admin Service Role Wrapper:
 * Bypasses Row Level Security (RLS). Used exclusively by backend background workers,
 * deterministic AST analyzers, and elevated administrative workflows.
 */
const supabaseAdmin = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Alias for admin service client
 */
const supabaseService = supabaseAdmin;

/**
 * 2. Anonymous Key Wrapper:
 * Subject to Row Level Security (RLS). Used for public queries and anonymous operations.
 */
const supabaseAnon = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * 3. Scoped Client Factory:
 * Creates a client scoped to an authenticated user's JWT or a guest session token.
 * This guarantees strict compliance with Module 3 RLS policies.
 *
 * @param {Object} options
 * @param {string} [options.accessToken] - JWT bearer token of authenticated user
 * @param {string} [options.guestSessionId] - Unique guest sandbox identifier (sets x-guest-session-id header)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createScopedClient({ accessToken, guestSessionId } = {}) {
  const headers = {};

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (guestSessionId) {
    headers['x-guest-session-id'] = guestSessionId;
  }

  const client = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  return client;
}

/**
 * Health check helper to test database connectivity
 */
async function testDatabaseConnection() {
  try {
    const { data, error } = await supabaseAdmin.from('reviews').select('id').limit(1);
    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  supabaseAdmin,
  supabaseService,
  supabaseAnon,
  createScopedClient,
  testDatabaseConnection,
  default: supabaseAdmin,
};
