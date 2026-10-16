const request = require('supertest');
const app = require('../src/app');
const {
  validateDirectSnippet,
  validateGitHubUrl,
  SUPPORTED_LANGUAGES,
} = require('../src/utils/validators');

describe('Module 5: Submission Validators & SSRF Security Defense', () => {

  // ============================================================================
  // 1. Direct Code Snippet Validator Unit Tests
  // ============================================================================
  describe('1. validateDirectSnippet Unit Tests', () => {

    it('should successfully validate valid code snippets in supported languages', () => {
      const jsCode = 'function calculateSum(a, b) { return a + b; }';
      const res = validateDirectSnippet(jsCode, 'javascript', 'MathUtility');

      expect(res.isValid).toBe(true);
      expect(res.sourceType).toBe('direct');
      expect(res.language).toBe('javascript');
      expect(res.projectName).toBe('MathUtility');
      expect(res.characterCount).toBe(jsCode.length);
      expect(res.linesCount).toBe(1);
      expect(res.parserReady).toBe(true);
    });

    it('should accept all supported languages: javascript, typescript, python, java, cpp', () => {
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const res = validateDirectSnippet('// sample code\nconst x = 1;', lang);
        expect(res.isValid).toBe(true);
        expect(res.language).toBe(lang);
      });
    });

    it('should normalize language aliases (js, ts, py, c++)', () => {
      expect(validateDirectSnippet('console.log(1)', 'js').language).toBe('javascript');
      expect(validateDirectSnippet('let x: number = 1;', 'ts').language).toBe('typescript');
      expect(validateDirectSnippet('def run(): pass', 'py').language).toBe('python');
      expect(validateDirectSnippet('#include <iostream>', 'c++').language).toBe('cpp');
    });

    it('should reject unsupported programming languages with HTTP 400', () => {
      expect(() => {
        validateDirectSnippet('puts "hello"', 'ruby');
      }).toThrow(/Unsupported programming language 'ruby'/i);

      expect(() => {
        validateDirectSnippet('<?php echo "hello"; ?>', 'php');
      }).toThrow(/Unsupported programming language 'php'/i);
    });

    it('should reject empty or whitespace-only code bodies', () => {
      expect(() => validateDirectSnippet('', 'javascript')).toThrow(/non-empty string/i);
      expect(() => validateDirectSnippet('   \n\t  ', 'javascript')).toThrow(/non-empty string/i);
      expect(() => validateDirectSnippet(null, 'javascript')).toThrow(/non-empty string/i);
    });

    it('should reject oversized code bodies exceeding 50,000 characters', () => {
      const oversizedSnippet = 'a'.repeat(50001);
      expect(() => {
        validateDirectSnippet(oversizedSnippet, 'javascript');
      }).toThrow(/exceeds the maximum permitted size of 50,000 characters/i);
    });

    it('should accept code bodies with exactly 50,000 characters', () => {
      const borderSnippet = 'x'.repeat(50000);
      const res = validateDirectSnippet(borderSnippet, 'python');
      expect(res.isValid).toBe(true);
      expect(res.characterCount).toBe(50000);
    });
  });

  // ============================================================================
  // 2. GitHub URL Validator & SSRF Security Defense Unit Tests
  // ============================================================================
  describe('2. validateGitHubUrl & SSRF Security Defense Unit Tests', () => {

    it('should successfully validate standard public GitHub repository URLs', () => {
      const res = validateGitHubUrl('https://github.com/shivam-ide/recode-app');
      expect(res.isValid).toBe(true);
      expect(res.sourceType).toBe('github');
      expect(res.owner).toBe('shivam-ide');
      expect(res.repo).toBe('recode-app');
      expect(res.projectName).toBe('shivam-ide/recode-app');
      expect(res.parserReady).toBe(true);
    });

    it('should accept valid URLs with .git extension and sanitize repo name', () => {
      const res = validateGitHubUrl('https://github.com/facebook/react.git');
      expect(res.repo).toBe('react');
      expect(res.url).toBe('https://github.com/facebook/react');
    });

    // --- SSRF INJECTION STRINGS ---
    it('should block local loopback SSRF attempts (127.0.0.1, localhost, [::1])', () => {
      expect(() => validateGitHubUrl('http://localhost:5000')).toThrow(/Insecure protocol|SSRF Protection/i);
      expect(() => validateGitHubUrl('https://127.0.0.1/admin/secrets')).toThrow(/SSRF Protection/i);
      expect(() => validateGitHubUrl('https://localhost/owner/repo')).toThrow(/SSRF Protection/i);
      expect(() => validateGitHubUrl('http://127.0.0.1:8080')).toThrow(/Insecure protocol|SSRF Protection/i);
      expect(() => validateGitHubUrl('https://0.0.0.0/test')).toThrow(/SSRF Protection/i);
    });

    it('should block AWS / Cloud Metadata SSRF (169.254.169.254)', () => {
      expect(() => {
        validateGitHubUrl('https://169.254.169.254/latest/meta-data/iam/security-credentials/');
      }).toThrow(/SSRF Protection/i);

      expect(() => {
        validateGitHubUrl('http://169.254.169.254/');
      }).toThrow(/Insecure protocol|SSRF Protection/i);
    });

    it('should block Private RFC-1918 Class A, B, and C IP addresses', () => {
      // 10.0.0.0/8
      expect(() => validateGitHubUrl('https://10.0.0.1/internal/repo')).toThrow(/SSRF Protection/i);
      // 172.16.0.0/12
      expect(() => validateGitHubUrl('https://172.16.5.10/database/repo')).toThrow(/SSRF Protection/i);
      // 192.168.0.0/16
      expect(() => validateGitHubUrl('https://192.168.1.1/router/repo')).toThrow(/SSRF Protection/i);
    });

    it('should block internal corporate and non-public DNS domains', () => {
      expect(() => validateGitHubUrl('https://service.local/repo')).toThrow(/SSRF Protection/i);
      expect(() => validateGitHubUrl('https://vault.internal/owner/repo')).toThrow(/SSRF Protection/i);
      expect(() => validateGitHubUrl('https://dev.intranet/owner/repo')).toThrow(/SSRF Protection/i);
      expect(() => validateGitHubUrl('https://database.corp/owner/repo')).toThrow(/SSRF Protection/i);
    });

    // --- MALICIOUS URL FORMATS & EVASION ATTEMPTS ---
    it('should block subdomain spoofing and domain masquerading', () => {
      // Attacker domain masquerading as github.com
      expect(() => validateGitHubUrl('https://github.com.attacker.com/owner/repo')).toThrow(/Invalid repository host/i);
      expect(() => validateGitHubUrl('https://evil-github.com/owner/repo')).toThrow(/Invalid repository host/i);
      expect(() => validateGitHubUrl('https://fakegithub.com/owner/repo')).toThrow(/Invalid repository host/i);
      // Subdomain under github.com
      expect(() => validateGitHubUrl('https://gist.github.com/owner/12345')).toThrow(/Invalid repository host/i);
      expect(() => validateGitHubUrl('https://raw.githubusercontent.com/owner/repo')).toThrow(/Invalid repository host/i);
    });

    it('should block credentials embedded in URL (user:pass@host)', () => {
      expect(() => {
        validateGitHubUrl('https://admin:password123@github.com/owner/repo');
      }).toThrow(/User credentials in URL are not allowed/i);
    });

    it('should block non-standard ports', () => {
      expect(() => validateGitHubUrl('https://github.com:8443/owner/repo')).toThrow(/Non-standard port/i);
      expect(() => validateGitHubUrl('https://github.com:22/owner/repo')).toThrow(/Non-standard port/i);
    });

    it('should block URL query parameters and fragment smuggling', () => {
      expect(() => {
        validateGitHubUrl('https://github.com/owner/repo?redirect=http://attacker.com');
      }).toThrow(/URL query parameters/i);

      expect(() => {
        validateGitHubUrl('https://github.com/owner/repo#malicious-anchor');
      }).toThrow(/URL query parameters/i);
    });

    it('should reject URLs with insufficient or excess path segments', () => {
      expect(() => validateGitHubUrl('https://github.com/owneronly')).toThrow(/Expected: https:\/\/github\.com\/owner\/repository/i);
      expect(() => validateGitHubUrl('https://github.com/owner/repo/pull/42')).toThrow(/Expected: https:\/\/github\.com\/owner\/repository/i);
      expect(() => validateGitHubUrl('https://github.com/')).toThrow(/Expected: https:\/\/github\.com\/owner\/repository/i);
    });

    it('should reject non-HTTPS protocols (http, ftp, git, file, ssh)', () => {
      expect(() => validateGitHubUrl('http://github.com/owner/repo')).toThrow(/Only secure 'https:' protocol/i);
      expect(() => validateGitHubUrl('ftp://github.com/owner/repo')).toThrow(/Only secure 'https:' protocol/i);
      expect(() => validateGitHubUrl('git://github.com/owner/repo')).toThrow(/Only secure 'https:' protocol/i);
      expect(() => validateGitHubUrl('file:///etc/passwd')).toThrow(/Only secure 'https:' protocol/i);
    });
  });

  // ============================================================================
  // 3. Controller & Route Integration Tests (POST /api/v1/submissions/validate)
  // ============================================================================
  describe('3. POST /api/v1/submissions/validate Endpoint Integration Tests', () => {

    it('should return 200 with sanitized metadata for valid direct snippet payload', async () => {
      const payload = {
        source_type: 'direct',
        language: 'typescript',
        project_name: 'AuthService',
        content: 'interface User { id: string; email: string; }',
      };

      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.sourceType).toBe('direct');
      expect(res.body.data.language).toBe('typescript');
      expect(res.body.data.projectName).toBe('AuthService');
      expect(res.body.data.characterCount).toBe(payload.content.length);
      expect(res.body.data.parserReady).toBe(true);
    });

    it('should return 200 with sanitized metadata for valid GitHub repository payload', async () => {
      const payload = {
        source_type: 'github',
        url: 'https://github.com/expressjs/express',
      };

      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.sourceType).toBe('github');
      expect(res.body.data.owner).toBe('expressjs');
      expect(res.body.data.repo).toBe('express');
      expect(res.body.data.projectName).toBe('expressjs/express');
      expect(res.body.data.parserReady).toBe(true);
    });

    it('should return 400 when missing source_type field', async () => {
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({ content: 'console.log(1)' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Missing required 'source_type' field/i);
    });

    it('should return 400 when code snippet exceeds 50,000 characters via endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'direct',
          language: 'python',
          content: 'print(1)\n' + 'x = 1\n'.repeat(10000), // > 50k chars
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/exceeds the maximum permitted size of 50,000 characters/i);
    });

    it('should return 400 and block SSRF attempt via endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'github',
          url: 'https://169.254.169.254/latest/meta-data',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/SSRF Protection/i);
    });

    it('should return 400 for invalid source_type value', async () => {
      const res = await request(app)
        .post('/api/v1/submissions/validate')
        .send({
          source_type: 'svn_repository',
          url: 'https://svn.apache.org/repo',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.statusCode).toBe(400);
      expect(res.body.message).toMatch(/Invalid source_type/i);
    });
  });
});
