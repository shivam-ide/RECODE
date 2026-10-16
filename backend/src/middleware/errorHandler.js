const AppError = require('../utils/AppError');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Redact sensitive patterns (tokens, secrets, private keys) from error messages/stacks
 * @param {string} text
 * @returns {string}
 */
function redactSecrets(text) {
  if (typeof text !== 'string') return text;
  return text
    // Supabase keys
    .replace(/sb_secret_[a-zA-Z0-9_\-]+/g, '[REDACTED_SUPABASE_SECRET]')
    .replace(/sb_publishable_[a-zA-Z0-9_\-]+/g, '[REDACTED_SUPABASE_ANON]')
    // Google Gemini API keys
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/AQ\.[0-9A-Za-z\-_]{40,}/g, '[REDACTED_GEMINI_KEY]')
    // GitHub PAT tokens
    .replace(/github_pat_[a-zA-Z0-9_\-]+/g, '[REDACTED_GITHUB_PAT]')
    .replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_PAT]')
    // Generic JWTs
    .replace(/eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, '[REDACTED_JWT]');
}

/**
 * 404 Route Not Found middleware
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Resource not found: Cannot ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  let message = err.message || 'An unexpected internal error occurred';
  let errors = err.errors || null;

  // 1. Handle SyntaxError (e.g. malformed JSON in request body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON syntax in request body';
    errors = { detail: err.message };
  }

  // 2. Handle Payload Too Large (413)
  if (err.type === 'entity.too.large' || err.status === 413 || statusCode === 413) {
    statusCode = 413;
    message = 'Payload Too Large: Request exceeds maximum permitted limit of 2MB';
    errors = {
      maxAllowedBytes: 2 * 1024 * 1024,
      detail: err.message || 'Request payload exceeds 2MB limit',
    };
  }

  // 2. Handle Supabase / PostgreSQL specific errors
  if (err.code && typeof err.code === 'string' && err.code.length === 5) {
    if (err.code === '23505') {
      statusCode = 409;
      message = 'Duplicate record constraint violation';
    } else if (err.code === '23503') {
      statusCode = 400;
      message = 'Foreign key reference violation';
    } else if (err.code.startsWith('22')) {
      statusCode = 400;
      message = 'Invalid data type or syntax provided';
    }
  }

  // 3. Environment Specific Error Sanitization
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // In production, mask unhandled/non-operational errors to prevent info leakage
    if (!err.isOperational && statusCode === 500) {
      message = 'Internal server error. Please try again later.';
      errors = null;
    } else if (errors) {
      errors = redactSecrets(typeof errors === 'string' ? errors : JSON.stringify(errors));
      try { errors = JSON.parse(errors); } catch (e) { /* keep string */ }
    }
  } else {
    // In development / test, include detailed info and sanitized stack trace
    if (!errors && err.stack) {
      errors = {
        stack: redactSecrets(err.stack).split('\n').map(line => line.trim()),
      };
    }
  }

  // Ensure secrets are never leaked even in development messages
  message = redactSecrets(message);

  return errorResponse(res, statusCode, message, errors);
}

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
};
