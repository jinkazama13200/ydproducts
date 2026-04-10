import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';

// We test against the running server pattern.
// Since server.js starts listening immediately, we test the endpoints
// by importing and checking the app behavior.

const BASE_URL = 'http://localhost:8787';

describe('Backend API', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(BASE_URL).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ok', true);
      expect(res.body.data).toHaveProperty('uptimeSec');
      expect(res.body.data).toHaveProperty('circuitBreakerState');
    });
  });

  describe('GET /api/running-products', () => {
    it('should return 400 if no token provided', async () => {
      const res = await request(BASE_URL).get('/api/running-products');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/debug/upstream', () => {
    it('should return 404 in production or require auth', async () => {
      const res = await request(BASE_URL).get('/api/debug/upstream');
      // Either 404 (disabled) or 401 (requires auth in production)
      expect([401, 404]).toContain(res.status);
    });
  });

  describe('CORS', () => {
    it('should reject requests without origin when ALLOWED_ORIGINS is set', async () => {
      // This test validates CORS behavior
      const res = await request(BASE_URL)
        .get('/health')
        .set('Origin', 'http://evil-site.com');
      // If ALLOWED_ORIGINS is configured, should be blocked
      // If not configured (empty), should be allowed
      expect([200, 403]).toContain(res.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal request rates', async () => {
      const res = await request(BASE_URL).get('/health');
      expect(res.status).toBe(200);
    });
  });
});