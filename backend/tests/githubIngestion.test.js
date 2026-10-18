const nock = require('nock');
const {
  fetchRepoTree,
  filterCandidateFiles,
  fetchFileRawContent,
  MAX_REPO_FILES,
  MAX_TOTAL_SIZE_BYTES,
} = require('../src/services/github/githubService');
const { ingestRepository } = require('../src/services/github/ingestionManager');

describe('Module 6: GitHub Service & Repository Ingestion Pipeline', () => {
  const GITHUB_API = 'https://api.github.com';
  const owner = 'recode-test-org';
  const repo = 'ast-scanner-demo';
  const branch = 'main';
  const commitSha = 'c0ffee1234567890abcdef1234567890abcdef12';

  const origFetch = global.fetch;
  let mockEndpoints = {};

  // Clean and robust mock responder for Node 18+ native fetch
  function mockGitHubResponse(pathPattern, status, body, headers = {}) {
    mockEndpoints[pathPattern] = { status, body, headers };
  }

  beforeEach(() => {
    nock.cleanAll();
    mockEndpoints = {};

    global.fetch = jest.fn(async (url, options = {}) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      
      for (const [pattern, config] of Object.entries(mockEndpoints)) {
        if (urlStr.includes(pattern)) {
          const isJson = typeof config.body === 'object';
          const payload = isJson ? JSON.stringify(config.body) : config.body;

          return {
            ok: config.status >= 200 && config.status < 300,
            status: config.status,
            statusText: config.status === 200 ? 'OK' : 'Error',
            headers: new Headers({
              'content-type': isJson ? 'application/json' : 'text/plain; charset=utf-8',
              ...config.headers,
            }),
            json: async () => (isJson ? config.body : JSON.parse(config.body)),
            text: async () => payload,
          };
        }
      }

      // Default fallback 404
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Not Found' }),
        text: async () => JSON.stringify({ message: 'Not Found' }),
      };
    });
  });

  afterAll(() => {
    global.fetch = origFetch;
    nock.restore();
  });

  // ============================================================================
  // 1. Successful Repository Ingestion & File Normalization
  // ============================================================================
  describe('1. Full Ingestion & Normalization Flow', () => {
    it('should fetch tree, filter candidates, retrieve file contents, and normalize schema', async () => {
      // Setup Nock expectations
      nock(GITHUB_API)
        .get(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`)
        .reply(200);

      // Mock GitHub Tree API
      const mockTree = [
        { path: 'src/auth.js', type: 'blob', sha: 'sha_auth', size: 500 },
        { path: 'src/parser.ts', type: 'blob', sha: 'sha_parser', size: 1200 },
        { path: 'tests/scanner.py', type: 'blob', sha: 'sha_py', size: 800 },
        // Files that MUST be ignored
        { path: 'node_modules/express/index.js', type: 'blob', sha: 'sha_nm', size: 4000 },
        { path: 'dist/bundle.js', type: 'blob', sha: 'sha_dist', size: 8000 },
        { path: 'package-lock.json', type: 'blob', sha: 'sha_lock', size: 15000 },
        { path: '.github/workflows/ci.yml', type: 'blob', sha: 'sha_ci', size: 600 },
        { path: 'assets/logo.png', type: 'blob', sha: 'sha_png', size: 25000 },
        { path: 'README.md', type: 'blob', sha: 'sha_md', size: 2000 },
        { path: 'src', type: 'tree', sha: 'sha_tree' },
      ];

      mockGitHubResponse(`/repos/${owner}/${repo}/git/trees/${branch}`, 200, {
        sha: commitSha,
        truncated: false,
        tree: mockTree,
      });

      // Mock Raw File Contents
      const authJsContent = 'const jwt = require("jsonwebtoken");\nfunction login() { return true; }\nmodule.exports = login;\n';
      const parserTsContent = 'export interface ASTNode {\n  type: string;\n  start: number;\n}\n';
      const scannerPyContent = 'def scan():\n    return {"issues": 0}\n';

      mockGitHubResponse('src/auth.js', 200, authJsContent);
      mockGitHubResponse('src/parser.ts', 200, parserTsContent);
      mockGitHubResponse('tests/scanner.py', 200, scannerPyContent);

      const result = await ingestRepository({ owner, repo, branch });

      // Verify files normalization schema: [{ path, language, content, lines }]
      expect(result.files).toHaveLength(3);
      expect(result.files).toEqual([
        {
          path: 'src/auth.js',
          language: 'javascript',
          content: authJsContent,
          lines: 4,
        },
        {
          path: 'src/parser.ts',
          language: 'typescript',
          content: parserTsContent,
          lines: 5,
        },
        {
          path: 'tests/scanner.py',
          language: 'python',
          content: scannerPyContent,
          lines: 3,
        },
      ]);

      // Verify telemetry summary
      expect(result.summary).toEqual({
        projectName: `${owner}/${repo}`,
        owner,
        repo,
        branch,
        commitSha,
        totalFiles: 3,
        totalLines: 12,
        totalBytes: Buffer.byteLength(authJsContent + parserTsContent + scannerPyContent, 'utf8'),
        languages: ['javascript', 'typescript', 'python'],
        languageBreakdown: {
          javascript: 1,
          typescript: 1,
          python: 1,
        },
      });
    });
  });

  // ============================================================================
  // 2. Resource Limit Enforcements: File Count & Size Overflows
  // ============================================================================
  describe('2. Resource Limit Enforcements', () => {
    it('should reject repositories exceeding MAX_REPO_FILES (50 candidate files)', () => {
      // Create 51 matching files
      const overflowTree = [];
      for (let i = 1; i <= 51; i++) {
        overflowTree.push({
          path: `src/component_${i}.js`,
          type: 'blob',
          sha: `sha_${i}`,
          size: 100,
        });
      }

      expect(() => {
        filterCandidateFiles(overflowTree);
      }).toThrow(new RegExp(`Repository exceeds the maximum limit of ${MAX_REPO_FILES} files`, 'i'));
    });

    it('should accept repositories with exactly 50 candidate files', () => {
      const boundaryTree = [];
      for (let i = 1; i <= 50; i++) {
        boundaryTree.push({
          path: `src/mod_${i}.py`,
          type: 'blob',
          sha: `sha_${i}`,
          size: 100,
        });
      }

      const candidates = filterCandidateFiles(boundaryTree);
      expect(candidates).toHaveLength(50);
    });

    it('should reject repositories where total scan size exceeds 10MB limit', () => {
      const largeTree = [
        { path: 'src/big_data.js', type: 'blob', sha: 'sha_big1', size: 6 * 1024 * 1024 }, // 6MB
        { path: 'src/huge_logic.ts', type: 'blob', sha: 'sha_big2', size: 5 * 1024 * 1024 }, // 5MB -> 11MB Total
      ];

      expect(() => {
        filterCandidateFiles(largeTree);
      }).toThrow(/Total size of matching repository files exceeds the 10MB limit/i);
    });

    it('should accept repositories just under the 10MB limit', () => {
      const allowedTree = [
        { path: 'src/app.js', type: 'blob', sha: 'sha1', size: 9 * 1024 * 1024 }, // 9MB
      ];

      const candidates = filterCandidateFiles(allowedTree);
      expect(candidates).toHaveLength(1);
    });
  });

  // ============================================================================
  // 3. Empty Repositories & Non-matching Codebases
  // ============================================================================
  describe('3. Empty Repositories & Non-matching File Handling', () => {
    it('should reject repositories containing zero candidate code files', () => {
      const nonCodeTree = [
        { path: 'README.md', type: 'blob', sha: 'sha_rm' },
        { path: 'LICENSE', type: 'blob', sha: 'sha_lic' },
        { path: 'assets/hero.jpg', type: 'blob', sha: 'sha_jpg' },
        { path: 'package-lock.json', type: 'blob', sha: 'sha_pkg' },
      ];

      expect(() => {
        filterCandidateFiles(nonCodeTree);
      }).toThrow(/contains no eligible code files matching supported languages/i);
    });

    it('should reject when GitHub API reports repository is empty (HTTP 409)', async () => {
      mockGitHubResponse(`/repos/${owner}/empty-repo/git/trees/main`, 409, {
        message: 'Git Repository is empty.',
      });

      await expect(fetchRepoTree(owner, 'empty-repo', 'main')).rejects.toThrow(
        /empty or uninitialized/i
      );
    });

    it('should reject when GitHub API tree array is empty', async () => {
      mockGitHubResponse(`/repos/${owner}/zero-files/git/trees/main`, 200, {
        sha: 'sha_empty',
        tree: [],
      });

      await expect(fetchRepoTree(owner, 'zero-files', 'main')).rejects.toThrow(
        /contains no files/i
      );
    });
  });

  // ============================================================================
  // 4. GitHub API Error Handling: 404 & Rate Limiting
  // ============================================================================
  describe('4. GitHub API Error Responses', () => {
    it('should handle 404 Not Found for non-existent repositories or branches', async () => {
      mockGitHubResponse(`/repos/${owner}/non-existent/git/trees/main`, 404, {
        message: 'Not Found',
      });

      await expect(fetchRepoTree(owner, 'non-existent', 'main')).rejects.toThrow(
        /not found/i
      );
    });

    it('should handle GitHub API rate limits (HTTP 403 / 429)', async () => {
      mockGitHubResponse(`/repos/${owner}/${repo}/git/trees/main`, 403, {
        message: 'API rate limit exceeded for user',
      });

      await expect(fetchRepoTree(owner, repo, 'main')).rejects.toThrow(
        /rate limit exceeded/i
      );
    });
  });

  // ============================================================================
  // 5. In-Memory Content Decoding (Base64 vs Raw Text)
  // ============================================================================
  describe('5. In-Memory Content Retrieval & Decoding', () => {
    it('should correctly decode Base64 encoded JSON content payloads from GitHub', async () => {
      const originalCode = 'public class Main { public static void main(String[] args) {} }';
      const base64Code = Buffer.from(originalCode).toString('base64');

      mockGitHubResponse('Main.java', 200, {
        name: 'Main.java',
        path: 'Main.java',
        encoding: 'base64',
        content: base64Code,
      });

      const content = await fetchFileRawContent(owner, repo, 'Main.java', 'main');
      expect(content).toBe(originalCode);
    });

    it('should throw an AppError when fetching file content fails (HTTP 404)', async () => {
      mockGitHubResponse('missing.js', 404, { message: 'Not Found' });

      await expect(fetchFileRawContent(owner, repo, 'missing.js', 'main')).rejects.toThrow(
        /Failed to retrieve file content/i
      );
    });
  });

  // ============================================================================
  // 6. Deep Recursive Traversal, Depth Capping (10), and Folder Prioritization
  // ============================================================================
  describe('6. Deep Recursive Traversal & Application Folder Prioritization', () => {
    it('should crawl subfolders up to 10 levels deep and exclude beyond depth 10', () => {
      const tree = [
        { path: 'backend/src/api/v1/controllers/auth/user/login.js', type: 'blob', size: 100 }, // depth 7
        { path: 'a/b/c/d/e/f/g/h/i/j/k/too_deep.js', type: 'blob', size: 100 }, // depth 11
      ];

      const candidates = filterCandidateFiles(tree, { autoSlice: true });
      expect(candidates.map((c) => c.path)).toContain('backend/src/api/v1/controllers/auth/user/login.js');
      expect(candidates.map((c) => c.path)).not.toContain('a/b/c/d/e/f/g/h/i/j/k/too_deep.js');
    });

    it('should prioritize backend controllers, routes, models and frontend components', () => {
      const mixedTree = [
        { path: 'src/counter.js', type: 'blob', size: 100 },
        { path: 'src/main.js', type: 'blob', size: 100 },
        { path: 'backend/controllers/userController.js', type: 'blob', size: 100 },
        { path: 'backend/routes/authRoutes.js', type: 'blob', size: 100 },
        { path: 'backend/models/User.js', type: 'blob', size: 100 },
        { path: 'frontend/src/components/Navbar.jsx', type: 'blob', size: 100 },
        { path: 'frontend/src/pages/Home.jsx', type: 'blob', size: 100 },
      ];

      const candidates = filterCandidateFiles(mixedTree, { autoSlice: true });
      const paths = candidates.map((c) => c.path);

      expect(paths).toContain('backend/controllers/userController.js');
      expect(paths).toContain('backend/routes/authRoutes.js');
      expect(paths).toContain('backend/models/User.js');
      expect(paths).toContain('frontend/src/components/Navbar.jsx');
      expect(paths).toContain('frontend/src/pages/Home.jsx');
      expect(paths).toContain('src/counter.js');
      expect(paths).toContain('src/main.js');

      // Check that controllers and routes rank higher than starter counter.js
      const controllerIdx = paths.indexOf('backend/controllers/userController.js');
      const counterIdx = paths.indexOf('src/counter.js');
      expect(controllerIdx).toBeLessThan(counterIdx);
    });
  });
});
