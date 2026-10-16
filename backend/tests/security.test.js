const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const { createRateLimiter } = require('../src/middleware/security');
const { errorHandler, notFoundHandler, AppError } = require('../src/middleware/errorHandler');

describe('Module 4: Security & Error Handling Integration Tests', () => {

  describe('1. 404 Not Found Handler', () => {
    it('should return standardized 404 response on unknown routes', async () => {
      const res = await request(app)
        .get('/api/v1/non-existent-endpoint-404')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/Resource not found/i);
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return 404 for unknown POST requests', async () => {
      const res = await request(app)
        .post('/unrecognized/path')
        .send({ foo: 'bar' })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(404);
    });
  });

  describe('2. CORS Origin Control & Headers', () => {
    it('should reject requests with unauthorized Origin header with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-attacker-domain.org')
        .expect(403);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 403);
      expect(res.body.message).toMatch(/CORS policy violation/i);
    });

    it('should allow requests from authorized CLIENT_URL origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests from secondary development origin http://localhost:5174', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5174')
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow non-browser requests without Origin header', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
    });
  });

  describe('3. Rate Limiting Middleware', () => {
    it('should return HTTP 429 when rate limit threshold is exceeded', async () => {
      // Build a sandboxed mini-app with tight rate limit (max 3 requests)
      const testApp = express();
      const testLimiter = createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        message: 'Rate limit test threshold exceeded',
      });

      testApp.use(testLimiter);
      testApp.get('/test-limit', (req, res) => res.status(200).json({ ok: true }));
      testApp.use(errorHandler);

      // Requests 1, 2, 3 should succeed
      await request(testApp).get('/test-limit').expect(200);
      await request(testApp).get('/test-limit').expect(200);
      await request(testApp).get('/test-limit').expect(200);

      // Request 4 should be throttled
      const throttledRes = await request(testApp)
        .get('/test-limit')
        .expect(429);

      expect(throttledRes.body).toHaveProperty('success', false);
      expect(throttledRes.body).toHaveProperty('statusCode', 429);
      expect(throttledRes.body.message).toMatch(/Rate limit test threshold exceeded/i);
      expect(throttledRes.body.errors).toHaveProperty('limit', 3);
    });
  });

  describe('4. Error Handling & Secret Redaction', () => {
    it('should handle malformed JSON body and return HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/health')
        .set('Content-Type', 'application/json')
        .send('{"bad-json-syntax":')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Malformed JSON/i);
    });

    it('should sanitize sensitive secrets in error outputs in production', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodApp = express();
      const mockSecret = ['sb', 'secret', 'dummy_mock_test_key_sample_token'].join('_');
      prodApp.get('/test-secret-leak', (req, res, next) => {
        // Simulated error exposing a secret
        const err = new Error('Database connection failed with key ' + mockSecret);
        next(err);
      });
      prodApp.use(errorHandler);

      const res = await request(prodApp)
        .get('/test-secret-leak')
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(500);
      // Secret must NOT be in the response
      expect(JSON.stringify(res.body)).not.toContain(mockSecret);
      expect(res.body.message).toBe('Internal server error. Please try again later.');

      process.env.NODE_ENV = origEnv;
    });

    it('should support operational custom AppError with specified status codes', async () => {
      const errorApp = express();
      errorApp.get('/test-app-error', (req, res, next) => {
        next(new AppError('Invalid code payload for AST parser', 422, { field: 'code', reason: 'empty' }));
      });
      errorApp.use(errorHandler);

      const res = await request(errorApp)
        .get('/test-app-error')
        .expect(422);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(422);
      expect(res.body.message).toBe('Invalid code payload for AST parser');
      expect(res.body.errors).toEqual({ field: 'code', reason: 'empty' });
    });
  });

  describe('5. Security Headers (Helmet CSP)', () => {
    it('should set Content-Security-Policy and standard security headers', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    });
  });
});
