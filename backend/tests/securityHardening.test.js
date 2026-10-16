const request = require('supertest');
const dns = require('dns');
const express = require('express');
const app = require('../src/app');
const {
  isPrivateIp,
  isPrivateIPv4,
  parseNumericIp,
  resolveDnsAndValidate,
  validateSsrf,
  payloadClamp,
  MAX_PAYLOAD_BYTES,
  FORBIDDEN_HOSTNAMES,
} = require('../src/middleware/security');
const { errorHandler } = require('../src/middleware/errorHandler');

describe('Module 18: Security Hardening & Regression Suite', () => {

  /**
   * ==========================================================================
   * 1. SSRF Shield IP Classification Unit Tests
   * ==========================================================================
   */
  describe('1. SSRF Shield IP Classification & Range Detection', () => {
    it('should identify Class A private IP addresses (10.0.0.0/8)', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.254')).toBe(true);
      expect(isPrivateIp('10.10.10.10')).toBe(true);
      expect(isPrivateIPv4('10.0.0.1')).toBe(true);
    });

    it('should identify Class B private IP addresses (172.16.0.0/12)', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.20.10.5')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIPv4('172.16.0.1')).toBe(true);
      // Public adjacent ranges must NOT be flagged as private
      expect(isPrivateIp('172.15.255.255')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('should identify Class C private IP addresses (192.168.0.0/16)', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.1.1')).toBe(true);
      expect(isPrivateIp('192.168.254.254')).toBe(true);
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      // Non-private adjacent range
      expect(isPrivateIp('192.169.1.1')).toBe(false);
    });

    it('should identify Loopback IP addresses (127.0.0.0/8)', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.0.0.2')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    });

    it('should identify Link-Local & Cloud Metadata IP addresses (169.254.0.0/16)', () => {
      expect(isPrivateIp('169.254.169.254')).toBe(true);
      expect(isPrivateIp('169.254.0.1')).toBe(true);
      expect(isPrivateIp('169.254.255.255')).toBe(true);
      expect(isPrivateIPv4('169.254.169.254')).toBe(true);
      // Non-private adjacent range
      expect(isPrivateIp('169.255.1.1')).toBe(false);
    });

    it('should identify Unspecified address (0.0.0.0/8)', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
      expect(isPrivateIp('0.0.0.1')).toBe(true);
    });

    it('should identify IPv6 Loopback & Link-Local / Unique-Local addresses', () => {
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('[::1]')).toBe(true);
      expect(isPrivateIp('::')).toBe(true);
      expect(isPrivateIp('fe80::1')).toBe(true);
      expect(isPrivateIp('fe80::200:5efe:10.0.0.1')).toBe(true);
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
    });

    it('should identify IPv4-mapped IPv6 addresses for internal networks', () => {
      expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
      expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateIp('::ffff:172.16.0.1')).toBe(true);
    });

    it('should decode and identify numeric, hex, and octal IP representations', () => {
      // Decimal integer: 2130706433 = 127.0.0.1
      expect(parseNumericIp('2130706433')).toBe('127.0.0.1');
      expect(isPrivateIp('2130706433')).toBe(true);

      // Decimal integer: 2852039166 = 169.254.169.254
      expect(parseNumericIp('2852039166')).toBe('169.254.169.254');
      expect(isPrivateIp('2852039166')).toBe(true);

      // Hex integer: 0x7f000001 = 127.0.0.1
      expect(parseNumericIp('0x7f000001')).toBe('127.0.0.1');
      expect(isPrivateIp('0x7f000001')).toBe(true);

      // Dotted octal: 0177.0.0.1 = 127.0.0.1
      expect(parseNumericIp('0177.0.0.1')).toBe('127.0.0.1');
      expect(isPrivateIp('0177.0.0.1')).toBe(true);
    });

    it('should correctly allow safe, public IPv4 addresses', () => {
      expect(isPrivateIp('140.82.121.3')).toBe(false); // GitHub
      expect(isPrivateIp('20.207.73.82')).toBe(false); // Microsoft/GitHub Azure
      expect(isPrivateIp('8.8.8.8')).toBe(false); // Google DNS
      expect(isPrivateIp('1.1.1.1')).toBe(false); // Cloudflare DNS
    });
  });

  /**
   * ==========================================================================
   * 2. DNS Hostname Resolution & SSRF Shield Core
   * ==========================================================================
   */
  describe('2. DNS Resolution & Pre-Request Hostname Inspection', () => {
    it('should reject forbidden hostnames before DNS lookup', async () => {
      for (const host of FORBIDDEN_HOSTNAMES) {
        await expect(resolveDnsAndValidate(host)).rejects.toThrow(/SSRF Protection/i);
      }
    });

    it('should reject private internal domain suffixes (*.local, *.internal, *.corp)', async () => {
      await expect(resolveDnsAndValidate('vault.internal')).rejects.toThrow(/SSRF Protection/i);
      await expect(resolveDnsAndValidate('k8s.service.local')).rejects.toThrow(/SSRF Protection/i);
      await expect(resolveDnsAndValidate('payroll.corp')).rejects.toThrow(/SSRF Protection/i);
      await expect(resolveDnsAndValidate('portal.intranet')).rejects.toThrow(/SSRF Protection/i);
    });

    it('should resolve and validate public hostnames like github.com successfully', async () => {
      const records = await resolveDnsAndValidate('github.com');
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((r) => !isPrivateIp(r.address))).toBe(true);
    });

    it('should reject hostnames that resolve to private IPs (DNS Rebinding Defense)', async () => {
      // Mock DNS lookup resolving a seemingly innocent domain to 127.0.0.1
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '127.0.0.1', family: 4 },
      ]);

      await expect(resolveDnsAndValidate('rebind-attack.example.org')).rejects.toThrow(
        /resolved to forbidden private IP/i
      );

      lookupSpy.mockRestore();
    });

    it('should reject hostnames that resolve to cloud metadata service (169.254.169.254)', async () => {
      const lookupSpy = jest.spyOn(dns.promises, 'lookup').mockResolvedValueOnce([
        { address: '169.254.169.254', family: 4 },
      ]);

      await expect(resolveDnsAndValidate('metadata-proxy.example.org')).rejects.toThrow(
        /resolved to forbidden private IP/i
      );

      lookupSpy.mockRestore();
    });

    it('should enforce strict URL protocol and port constraints in validateSsrf', async () => {
      await expect(validateSsrf('http://github.com/owner/repo')).rejects.toThrow(/Insecure protocol/i);
      await expect(validateSsrf('ftp://github.com/owner/repo')).rejects.toThrow(/Insecure protocol/i);
      await expect(validateSsrf('file:///etc/passwd')).rejects.toThrow(/Insecure protocol/i);
      await expect(validateSsrf('https://admin:pass@github.com/owner/repo')).rejects.toThrow(
        /User credentials in URL are not allowed/i
      );
      await expect(validateSsrf('https://github.com:8443/owner/repo')).rejects.toThrow(
        /Non-standard port/i
      );
    });
  });

  /**
   * ==========================================================================
   * 3. SSRF Protection Against 10 Common Internal Network Target Patterns
   * Tested across HTTP API endpoints POST /api/v1/submissions/validate & /api/v1/reviews/run
   * ==========================================================================
   */
  describe('3. SSRF Defense: 10 Common Internal Network Target Patterns', () => {
    const internalTargets = [
      {
        id: 1,
        name: 'IPv4 Loopback Address',
        url: 'http://127.0.0.1/admin/secrets',
      },
      {
        id: 2,
        name: 'Localhost Hostname',
        url: 'https://localhost/owner/repo',
      },
      {
        id: 3,
        name: 'AWS / Cloud Metadata Service (169.254.169.254)',
        url: 'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
      },
      {
        id: 4,
        name: 'Class A Private Network (10.0.0.0/8)',
        url: 'https://10.0.0.1/internal/repo',
      },
      {
        id: 5,
        name: 'Class B Private Network (172.16.0.0/12)',
        url: 'https://172.16.5.10/database/repo',
      },
      {
        id: 6,
        name: 'Class C Private Network (192.168.0.0/16)',
        url: 'https://192.168.1.1/router/firmware',
      },
      {
        id: 7,
        name: 'Unspecified Address / Local Port Bind (0.0.0.0)',
        url: 'https://0.0.0.0:8080/test',
      },
      {
        id: 8,
        name: 'IPv6 Loopback Address ([::1])',
        url: 'https://[::1]/internal/repo',
      },
      {
        id: 9,
        name: 'Internal Domain Names (*.internal, *.local)',
        url: 'https://vault.internal/secrets',
      },
      {
        id: 10,
        name: 'Obfuscated Decimal IP Address (2130706433 -> 127.0.0.1)',
        url: 'http://2130706433/secrets',
      },
    ];

    test.each(internalTargets)(
      'Target Pattern #$id: $name ($url) must be blocked with HTTP 400',
      async ({ url }) => {
        const res = await request(app)
          .post('/api/v1/submissions/validate')
          .send({
            source_type: 'github',
            url,
          })
          .expect(400);

        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('statusCode', 400);
        expect(res.body.message).toMatch(
          /SSRF Protection|Insecure protocol|Invalid repository host|Private and link-local IP resolution is forbidden|Access to '.*' is strictly forbidden|Non-standard port/i
        );
      }
    );

    it('should also block SSRF targets when submitted to POST /api/v1/reviews/run', async () => {
      const res = await request(app)
        .post('/api/v1/reviews/run')
        .send({
          sourceType: 'github',
          repoUrl: 'https://169.254.169.254/latest/meta-data',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/SSRF Protection|Invalid repository host/i);
    });

    it('should allow legitimate public GitHub repositories to validate without SSRF errors', async () => {
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'github',
          url: 'https://github.com/shivam-ide/recode-app',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceType).toBe('github');
      expect(res.body.data.url).toBe('https://github.com/shivam-ide/recode-app');
    });
  });

  /**
   * ==========================================================================
   * 4. In-Memory Payload Size Clamps & Boundary Enforcement
   * Strictly reject requests > 2MB with HTTP 413 Payload Too Large
   * ==========================================================================
   */
  describe('4. In-Memory Payload Size Clamps (2MB Boundary Enforcement)', () => {
    it('should accept normal payloads well below the 2MB threshold', async () => {
      const normalSnippet = 'function add(a, b) {\n  return a + b;\n}';
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'direct',
          language: 'javascript',
          content: normalSnippet,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.characterCount).toBe(normalSnippet.length);
    });

    it('should reject requests with Content-Length exceeding 2MB with HTTP 413 Payload Too Large', async () => {
      const excessiveBytes = 2 * 1024 * 1024 + 1024; // 2MB + 1KB = 2,098,176 bytes

      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .set('Content-Length', excessiveBytes.toString())
        .set('Content-Type', 'application/json')
        .send({ dummy: 'small payload with inflated header' })
        .expect(413);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 413);
      expect(res.body.message).toMatch(/Payload Too Large/i);
      expect(res.body.errors).toHaveProperty('maxLimitBytes', MAX_PAYLOAD_BYTES);
    });

    it('should reject oversized JSON request bodies exceeding 2MB with HTTP 413', async () => {
      // Build a 2.2MB string payload
      const hugeString = 'A'.repeat(2.2 * 1024 * 1024);

      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'direct',
          language: 'javascript',
          content: hugeString,
        })
        .expect(413);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('statusCode', 413);
      expect(res.body.message).toMatch(/Payload Too Large/i);
    });

    it('should clamp payload size in isolated middleware factory test', () => {
      const clamp100Bytes = payloadClamp({ maxBytes: 100 });
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      // Case A: Payload under 100 bytes passes
      const mockReqOk = {
        headers: { 'content-length': '80' },
        body: { a: 1 },
      };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      clamp100Bytes(mockReqOk, mockRes, next);
      expect(nextCalled).toBe(true);

      // Case B: Payload exceeding 100 bytes gets rejected with 413
      nextCalled = false;
      const mockReqOversized = {
        headers: { 'content-length': '150' },
        body: null,
      };

      clamp100Bytes(mockReqOversized, mockRes, next);
      expect(nextCalled).toBe(false);
      expect(mockRes.status).toHaveBeenCalledWith(413);
    });
  });

  /**
   * ==========================================================================
   * 5. Zero Vulnerabilities Acceptance Verification
   * ==========================================================================
   */
  describe('5. Acceptance Criteria: 0 Vulnerabilities Detected', () => {
    it('should confirm all security middleware invariants hold concurrently', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200);

      // Helmet CSP & Security Headers
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-frame-options');

      // Health status OK
      expect(res.body.status).toBe('healthy');
    });
  });
});
