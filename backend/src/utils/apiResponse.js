/**
 * Re:Code — Standardized API Response Formatters
 * Read. Review. Refine.
 */

/**
 * Send a standardized success JSON response
 * @param {import('express').Response} res - Express response object
 * @param {number} [statusCode=200] - HTTP status code
 * @param {any} [data=null] - Payload data
 * @param {string} [message='Success'] - Context message
 */
function successResponse(res, statusCode = 200, data = null, message = 'Success') {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a standardized error JSON response
 * @param {import('express').Response} res - Express response object
 * @param {number} [statusCode=500] - HTTP status code
 * @param {string} [message='An error occurred'] - Human-readable error message
 * @param {any} [errors=null] - Specific validation errors, details, or stack trace (if non-production)
 */
function errorResponse(res, statusCode = 500, message = 'An error occurred', errors = null) {
  const response = {
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors !== null && errors !== undefined) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  successResponse,
  errorResponse,
};
