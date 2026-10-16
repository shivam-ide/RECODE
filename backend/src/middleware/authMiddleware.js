const { supabaseAdmin } = require('../config/supabaseClient');

/**
 * Optional authentication middleware for Express.
 *
 * Checks incoming requests for:
 * 1. Bearer token in 'Authorization' header: verifies via Supabase auth or JWT decode
 * 2. Fallback 'x-user-id' header
 *
 * Populates `req.user` and `req.token` if authenticated.
 * Does NOT reject unauthenticated requests; instead allows guest processing.
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token && token.length > 10) {
        req.token = token;

        // 1. Verify via Supabase Auth Admin
        try {
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (data && data.user) {
            req.user = data.user;
          }
        } catch (supabaseErr) {
          // In offline development or sandbox, decode standard JWT payload
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(
                Buffer.from(parts[1], 'base64').toString('utf8')
              );
              if (payload && (payload.sub || payload.id)) {
                req.user = {
                  id: payload.sub || payload.id,
                  email: payload.email,
                  user_metadata: payload.user_metadata || {},
                  role: payload.role || 'authenticated',
                };
              }
            }
          } catch (jwtErr) {
            // Ignore JWT decode error
          }
        }
      }
    }

    // 2. Fallback to x-user-id if user is still not resolved
    if (!req.user && req.headers['x-user-id']) {
      req.user = {
        id: req.headers['x-user-id'],
        email: req.headers['x-user-email'] || 'user@example.com',
      };
    }
  } catch (err) {
    // Graceful fallback: do not crash request
    console.warn('[authMiddleware] Auth parsing notice:', err.message);
  }

  next();
}

module.exports = {
  optionalAuth,
};
