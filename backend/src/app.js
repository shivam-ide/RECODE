const express = require('express');
const morgan = require('morgan');
const {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  payloadClampMiddleware,
  ssrfShieldMiddleware,
} = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { successResponse } = require('./utils/apiResponse');
const submissionRoutes = require('./routes/submissionRoutes');
const reviewRoutes = require('./routes/reviewRoutes');

const app = express();

// 1. Security Headers (Helmet with Custom CSP)
app.use(helmetMiddleware);

// 2. Cross-Origin Resource Sharing (CORS)
app.use(corsMiddleware);

// 3. Global API Rate Limiting (60 requests / 15 mins per IP)
// Skip rate limiting in automated unit test runner unless explicitly testing it
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', rateLimiter);
}

// 4. In-Memory Payload Size Clamps (Strict 2MB limit: 413 Payload Too Large)
app.use(payloadClampMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 5. Comprehensive SSRF Shield for Incoming Target Payloads
app.use(ssrfShieldMiddleware());

// 5. Request Logging (disabled in test runs)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 6. Health Check Endpoints (Preserves Module 1 contract)
app.get(['/health', '/api/v1/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/v1/health/standardized', (req, res) => {
  return successResponse(
    res,
    200,
    {
      status: 'healthy',
      uptime: process.uptime(),
    },
    'Re:Code API services operational'
  );
});

// 7. Core Feature Routes
app.use(['/api/v1/submissions', '/api/submissions', '/api/submission'], submissionRoutes);
app.use(['/api/v1/reviews', '/api/reviews', '/api/review'], reviewRoutes);

// 8. Route Not Found (404) Handler
app.use(notFoundHandler);

// 9. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
