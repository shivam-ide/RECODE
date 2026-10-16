const request = require('supertest');
const app = require('../src/app');

describe('GET /api/v1/health probe', () => {
  it('should return HTTP 200 with status "healthy", valid timestamp, and uptime', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});
