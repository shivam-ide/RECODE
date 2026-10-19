const AppError = require('../../utils/AppError');
const { resolveDnsAndValidate, safeFetchWithSsrfGuard } = require('../../middleware/security');

/**
 * Resource and Security Limits for GitHub Repository Scanning
 */
const MAX_REPO_FILES = 50;
const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DEPTH_LEVELS = 10;
const MAX_SINGLE_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per file limit

/**
 * Mapping of file extensions to supported AST parser languages
 */
const EXTENSION_LANGUAGE_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.sql': 'sql',
};

const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_LANGUAGE_MAP);

/**
 * Strictly excluded build, dependency, report, and artifact directories
 */
const EXCLUDED_DIRECTORY_PATTERNS = [
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)build(\/|$)/i,
  /(^|\/)out(\/|$)/i,
  /(^|\/)coverage(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.next(\/|$)/i,
  /(^|\/)\.nuxt(\/|$)/i,
  /(^|\/)target(\/|$)/i,
  /(^|\/)bin(\/|$)/i,
  /(^|\/)obj(\/|$)/i,
  /(^|\/)vendor(\/|$)/i,
  /(^|\/)third_party(\/|$)/i,
  /(^|\/)\.cache(\/|$)/i,
  /(^|\/)\.vscode(\/|$)/i,
  /(^|\/)\.idea(\/|$)/i,
  /(^|\/)__pycache__(\/|$)/i,
  /(^|\/)\.pytest_cache(\/|$)/i,
  /(^|\/)\.venv(\/|$)/i,
  /(^|\/)scorecard(\/|$)/i,
  /(^|\/)docs(\/|$)/i,
  /(^|\/)documentation(\/|$)/i,
  /(^|\/)test-results(\/|$)/i,
];

/**
 * Excluded lockfiles and non-code asset names
 */
const EXCLUDED_FILE_NAMES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'pipfile.lock',
  'poetry.lock',
  'cargo.lock',
  'composer.lock',
  '.ds_store',
  'thumbs.db',
];

/**
 * Helper to construct standard GitHub API request headers
 */
function getGitHubHeaders() {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ReCode-DeepCrawler/2.0',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Calculate structural path depth (1-based folder nesting depth)
 * e.g., 'src/main.js' -> 1
 *       'backend/src/controllers/auth.js' -> 3
 */
function getPathDepth(filePath) {
  if (!filePath || typeof filePath !== 'string') return 0;
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return Math.max(0, parts.length - 1);
}

/**
 * Categorize and score file paths to prioritize high-value application source code
 *
 * Priorities:
 * 1. Backend Core: backend/, server/, api/, routes/, controllers/, models/, services/, config/
 * 2. Frontend Core: frontend/src/, src/components/, src/pages/, src/views/
 * 3. App Root Entries: app.js, server.js, index.js, main.py
 * 4. General application source files
 */
function scoreFilePath(filePath) {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  const fileName = norm.split('/').pop() || '';
  let score = 10;
  let domain = 'other'; // 'backend' | 'frontend' | 'other'

  // A. Backend Application Folders
  const isBackend =
    norm.includes('backend/') ||
    norm.includes('server/') ||
    norm.includes('api/') ||
    norm.includes('routes/') ||
    norm.includes('controllers/') ||
    norm.includes('models/') ||
    norm.includes('services/') ||
    norm.includes('config/') ||
    norm.includes('handlers/') ||
    norm.includes('middlewares/') ||
    norm.includes('middleware/');

  if (isBackend) {
    domain = 'backend';
    score += 100;

    if (norm.includes('controllers/') || norm.includes('controller')) score += 40;
    if (norm.includes('routes/') || norm.includes('router')) score += 35;
    if (norm.includes('models/') || norm.includes('model') || norm.includes('schema')) score += 30;
    if (norm.includes('services/') || norm.includes('service') || norm.includes('auth')) score += 30;
    if (norm.includes('config/') || norm.includes('db') || norm.includes('database')) score += 25;
    if (norm.includes('api/')) score += 20;
  }

  // B. Frontend Application Folders
  const isFrontend =
    norm.includes('frontend/') ||
    norm.includes('src/components/') ||
    norm.includes('components/') ||
    norm.includes('src/pages/') ||
    norm.includes('pages/') ||
    norm.includes('src/views/') ||
    norm.includes('views/') ||
    norm.includes('src/hooks/') ||
    norm.includes('src/context/') ||
    norm.includes('src/store/');

  if (isFrontend) {
    domain = domain === 'backend' ? 'backend' : 'frontend';
    score += 80;

    if (norm.includes('pages/') || norm.includes('views/')) score += 25;
    if (norm.includes('components/')) score += 20;
    if (norm.includes('hooks/') || norm.includes('store/') || norm.includes('context/')) score += 20;
    if (norm.includes('services/') || norm.includes('api/')) score += 20;
  }

  // C. Root Entrypoints
  const isRootEntry = [
    'server.js',
    'app.js',
    'index.js',
    'main.js',
    'server.ts',
    'app.ts',
    'index.ts',
    'main.py',
    'app.py',
    'wsgi.py',
  ].includes(fileName);

  if (isRootEntry) {
    score += 60;
  }

  // D. General Source Folders
  if (norm.startsWith('src/') || norm.includes('/src/')) {
    score += 30;
    if (domain === 'other') domain = 'frontend';
  }

  // E. Priority Executable Code (.java, .js, .ts, .py) in src/, lib/, main packages
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.substring(dotIdx) : '';
  if (['.java', '.js', '.ts', '.py', '.jsx', '.tsx', '.sql'].includes(ext)) {
    score += 40;
  }
  if (norm.includes('src/') || norm.includes('lib/') || norm.includes('main/') || norm.includes('packages/')) {
    score += 35;
  }

  // Penalize test files or dummy fixtures slightly so business logic is evaluated first
  if (norm.includes('test') || norm.includes('spec') || norm.includes('mock') || norm.includes('fixture')) {
    score -= 40;
  }

  return { score, domain };
}

/**
 * 1. Fetch Repository Git Tree recursively via GitHub API with fallback & branch detection
 *
 * @param {string} owner - GitHub username/org
 * @param {string} repo - Repository name
 * @param {string} [branch='main'] - Git branch or commit ref
 * @returns {Promise<{ tree: Array, sha: string, truncated: boolean, branch: string }>}
 */
async function fetchRepoTree(owner, repo, branch = 'main') {
  if (!owner || !repo) {
    throw new AppError('GitHub repository owner and name are required.', 400);
  }

  // SSRF Shield: Verify DNS resolution before requesting GitHub API
  await resolveDnsAndValidate('api.github.com');

  const headers = getGitHubHeaders();
  const requestedBranch = (branch || 'main').trim();

  // Helper to fetch git tree for a specific ref
  async function queryTree(ref) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    return safeFetchWithSsrfGuard(url, { headers });
  }

  let response = await queryTree(requestedBranch);

  // If requested branch returns 404, query repository info to detect default branch (e.g. master)
  if (response.status === 404) {
    try {
      const repoInfoRes = await safeFetchWithSsrfGuard(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (repoInfoRes.ok) {
        const repoInfo = await repoInfoRes.json();
        const defaultBranch = repoInfo.default_branch || 'master';
        if (defaultBranch !== requestedBranch) {
          response = await queryTree(defaultBranch);
        }
      }
    } catch {
      // Fall through to error handlers below
    }

    // Try HEAD if still 404
    if (response.status === 404) {
      try {
        const headRes = await queryTree('HEAD');
        if (headRes.ok) {
          response = headRes;
        }
      } catch {
        // Fall through
      }
    }
  }

  if (response.status === 404) {
    throw new AppError(
      `GitHub repository '${owner}/${repo}' or branch '${requestedBranch}' not found. Please verify the URL is public and the branch exists.`,
      404
    );
  }

  if (response.status === 403 || response.status === 429) {
    throw new AppError(
      'GitHub API rate limit exceeded or access denied. Please try again later or provide a configured GITHUB_TOKEN.',
      429
    );
  }

  if (response.status === 409) {
    throw new AppError(`GitHub repository '${owner}/${repo}' is empty or uninitialized.`, 400);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = response.statusText;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.message || detail;
    } catch {
      /* keep statusText */
    }

    throw new AppError(`GitHub API error (${response.status}): ${detail}`, response.status);
  }

  const data = await response.json();

  if (!Array.isArray(data.tree) || data.tree.length === 0) {
    throw new AppError(`GitHub repository '${owner}/${repo}' contains no files in branch '${requestedBranch}'.`, 400);
  }

  return {
    tree: data.tree,
    sha: data.sha || 'HEAD',
    truncated: !!data.truncated,
    branch: requestedBranch,
  };
}

/**
 * 2. Filter Candidate Files, Enforce Max Depth (10 levels), and Select Representative Set (<= 50 files)
 *
 * @param {Array<Object>} treeNodes - Array of Git tree items from GitHub API
 * @param {Object} [options={}]
 * @param {boolean} [options.autoSlice=false] - If true, select top prioritized representative files up to limit instead of throwing
 * @param {number} [options.limit=MAX_REPO_FILES] - Maximum files to retain
 * @param {number} [options.maxDepth=MAX_DEPTH_LEVELS] - Maximum folder depth (10)
 * @returns {Array<{ path: string, sha: string, size: number, language: string, extension: string, domain?: string }>}
 */
function filterCandidateFiles(treeNodes, options = {}) {
  if (!Array.isArray(treeNodes)) {
    throw new AppError('Invalid tree structure received from GitHub API.', 500);
  }

  const autoSlice = options.autoSlice ?? options.prioritize ?? false;
  const maxLimit = options.limit || MAX_REPO_FILES;
  const maxDepth = options.maxDepth || MAX_DEPTH_LEVELS;

  const validCandidates = [];
  let totalSizeBytes = 0;

  for (const node of treeNodes) {
    // Only analyze files (blobs), ignore subtrees and submodules
    if (node.type !== 'blob') {
      continue;
    }

    const filePath = (node.path || '').replace(/\\/g, '/');
    const lowerPath = filePath.toLowerCase();
    const fileName = lowerPath.split('/').pop();

    // Enforce Max Depth (10 levels of subfolders)
    const depth = getPathDepth(filePath);
    if (depth > maxDepth) {
      continue;
    }

    // Ignore hidden files and directories (e.g. .github/, .git/, .env)
    if (filePath.startsWith('.') || filePath.includes('/.') || fileName.startsWith('.')) {
      continue;
    }

    // Exclude scorecards, docs, test-results, and HTML files
    if (
      lowerPath.includes('scorecard/') ||
      lowerPath.includes('docs/') ||
      lowerPath.includes('test-results/') ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.htm')
    ) {
      continue;
    }

    // Exclude build, cache, and dependency folders
    const isExcludedDir = EXCLUDED_DIRECTORY_PATTERNS.some((pattern) => pattern.test(filePath));
    if (isExcludedDir) {
      continue;
    }

    // Exclude lockfiles and OS files
    if (EXCLUDED_FILE_NAMES.includes(fileName)) {
      continue;
    }

    // Ignore minified bundles and sourcemaps
    if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css') || fileName.endsWith('.map')) {
      continue;
    }

    // Extract extension
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) {
      continue;
    }
    const ext = fileName.substring(dotIndex);

    // Match against supported extensions
    const language = EXTENSION_LANGUAGE_MAP[ext];
    if (!language) {
      continue;
    }

    const fileSize = typeof node.size === 'number' ? node.size : 0;
    // Skip single oversized files exceeding 1MB (likely compiled/vendored assets)
    if (fileSize > MAX_SINGLE_FILE_SIZE_BYTES && autoSlice) {
      continue;
    }

    const { score, domain } = scoreFilePath(filePath);

    validCandidates.push({
      path: filePath,
      sha: node.sha,
      size: fileSize,
      language,
      extension: ext,
      score,
      domain,
    });
  }

  // Enforce Resource Limit 1: Zero matching files
  if (validCandidates.length === 0) {
    throw new AppError(
      'Repository contains no eligible code files matching supported languages (JavaScript, TypeScript, Python, Java, C++, SQL).',
      400,
      { supportedExtensions: ALLOWED_EXTENSIONS }
    );
  }

  // When autoSlice is disabled (e.g. strict unit testing mode), throw if overflowing limit
  if (!autoSlice && validCandidates.length > maxLimit) {
    throw new AppError(
      `Repository exceeds the maximum limit of ${maxLimit} files for static AST analysis (found ${validCandidates.length} candidate files).`,
      400,
      {
        maxAllowed: maxLimit,
        found: validCandidates.length,
      }
    );
  }

  // Sort candidates by priority score descending
  validCandidates.sort((a, b) => b.score - a.score);

  // Sort and select representative files balancing BOTH frontend and backend
  let selected = validCandidates;

  if (validCandidates.length > maxLimit) {
    const backendCandidates = validCandidates
      .filter((c) => c.domain === 'backend')
      .sort((a, b) => b.score - a.score);

    const frontendCandidates = validCandidates
      .filter((c) => c.domain === 'frontend')
      .sort((a, b) => b.score - a.score);

    const otherCandidates = validCandidates
      .filter((c) => c.domain === 'other')
      .sort((a, b) => b.score - a.score);

    const chosen = [];
    const chosenPaths = new Set();

    const addFile = (file) => {
      if (file && !chosenPaths.has(file.path) && chosen.length < maxLimit) {
        chosen.push(file);
        chosenPaths.add(file.path);
      }
    };

    // If both frontend and backend exist, allocate balanced representative slots
    if (backendCandidates.length > 0 && frontendCandidates.length > 0) {
      // Pick up to 25 backend files (controllers, routes, services, models)
      for (let i = 0; i < 25 && i < backendCandidates.length; i++) {
        addFile(backendCandidates[i]);
      }

      // Pick up to 20 frontend files (pages, components, hooks)
      for (let i = 0; i < 20 && i < frontendCandidates.length; i++) {
        addFile(frontendCandidates[i]);
      }
    }

    // Fill remaining slots with the highest remaining priority files across all groups
    const remaining = [...backendCandidates, ...frontendCandidates, ...otherCandidates]
      .filter((c) => !chosenPaths.has(c.path))
      .sort((a, b) => b.score - a.score);

    for (const rem of remaining) {
      addFile(rem);
      if (chosen.length >= maxLimit) break;
    }

    selected = chosen;
  }

  // Check cumulative total size
  for (const item of selected) {
    totalSizeBytes += item.size;
  }

  if (totalSizeBytes > MAX_TOTAL_SIZE_BYTES) {
    const totalMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
    throw new AppError(
      `Total size of matching repository files exceeds the 10MB limit (cumulative size: ${totalMb}MB).`,
      400,
      {
        maxAllowedBytes: MAX_TOTAL_SIZE_BYTES,
        foundBytes: totalSizeBytes,
      }
    );
  }

  return selected;
}

/**
 * 3. Safely Retrieve Raw Text Content in-memory
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} filePath - Path to file within repository
 * @param {string} [commitSha='main'] - Commit SHA or branch ref
 * @param {string} [blobSha=null] - Git blob SHA
 * @returns {Promise<string>} UTF-8 decoded file text content
 */
async function fetchFileRawContent(owner, repo, filePath, commitSha = 'main', blobSha = null) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const ref = /^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : (commitSha || 'main');

  // Strategy 1: Attempt direct raw fetch via raw.githubusercontent.com
  // Fast, returns pure source text, and bypasses GitHub REST API rate limits
  try {
    const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`;
    const rawRes = await safeFetchWithSsrfGuard(rawUrl, {
      headers: {
        'User-Agent': 'ReCode-DeepCrawler/2.0',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
    });

    if (rawRes.ok) {
      const contentType = (rawRes.headers.get('content-type') || '').toLowerCase();
      const rawText = await rawRes.text();

      // Handle Base64 if a JSON envelope was returned (e.g. from mock/proxy)
      if (contentType.includes('json') && !contentType.includes('raw')) {
        try {
          const body = JSON.parse(rawText);
          if (body && body.content && body.encoding === 'base64') {
            return Buffer.from(body.content, 'base64').toString('utf8');
          }
        } catch {
          // not json
        }
      }
      return rawText;
    }
  } catch {
    // Fallback to official GitHub REST API endpoints
  }

  // Strategy 2: Fetch directly from immutable git/blobs if blob SHA is provided
  const headers = {
    ...getGitHubHeaders(),
    Accept: 'application/vnd.github.v3.raw, application/vnd.github.v3+json',
  };

  const effectiveBlobSha = blobSha || (/^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null);
  if (effectiveBlobSha) {
    try {
      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${effectiveBlobSha}`;
      const blobRes = await safeFetchWithSsrfGuard(blobUrl, { headers });
      if (blobRes.ok) {
        return await blobRes.text();
      }
    } catch {
      // Fallback to contents endpoint below
    }
  }

  // Strategy 3: Contents endpoint fallback
  const contentsRef = /^[a-f0-9]{40}$/i.test(commitSha) ? 'main' : commitSha;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(contentsRef)}`;

  let response;
  try {
    response = await safeFetchWithSsrfGuard(url, { headers });
  } catch (err) {
    throw new AppError(`Network failure fetching file '${filePath}': ${err.message}`, 502);
  }

  if (!response.ok) {
    throw new AppError(
      `Failed to retrieve file content for '${filePath}' (${response.status}): ${response.statusText}`,
      response.status
    );
  }

  const rawText = await response.text();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // If response is a JSON envelope with base64 content
  if (contentType.includes('json') && !contentType.includes('raw')) {
    try {
      const body = JSON.parse(rawText);
      if (body && body.content && body.encoding === 'base64') {
        return Buffer.from(body.content, 'base64').toString('utf8');
      }
      if (typeof body === 'string') {
        return body;
      }
    } catch {
      // Fall through to returning raw text
    }
  }

  return rawText;
}

/**
 * 4. Deep Ingestion Manager: Fetches, recursively crawls, prioritizes, and normalizes repository files
 *
 * @param {Object} options
 * @param {string} options.owner - GitHub repository owner
 * @param {string} options.repo - GitHub repository name
 * @param {string} [options.branch='main'] - Git branch or commit ref
 * @param {number} [options.concurrency=5] - Maximum parallel file content fetches
 * @param {number} [options.limit=50] - Maximum candidate files (50)
 * @param {number} [options.maxDepth=10] - Maximum subfolder depth (10)
 * @returns {Promise<{ files: Array<{ path: string, language: string, content: string, lines: number }>, summary: Object }>}
 */
async function ingestRepository({
  owner,
  repo,
  branch = 'main',
  concurrency = 5,
  limit = MAX_REPO_FILES,
  maxDepth = MAX_DEPTH_LEVELS,
} = {}) {
  if (!owner || !repo) {
    throw new AppError('Repository owner and name are required for ingestion.', 400);
  }

  // 1. Fetch Git tree recursively
  const treeData = await fetchRepoTree(owner, repo, branch);

  // 2. Filter candidates, enforce max depth 10, and prioritize representative files (<= 50 files)
  const candidateFiles = filterCandidateFiles(treeData.tree, {
    autoSlice: true,
    prioritize: true,
    limit,
    maxDepth,
  });

  // 3. Concurrently fetch raw file contents in controlled batches
  const normalizedFiles = [];
  const batchSize = Math.max(1, concurrency);

  for (let i = 0; i < candidateFiles.length; i += batchSize) {
    const batch = candidateFiles.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const rawContent = await fetchFileRawContent(
            owner,
            repo,
            file.path,
            treeData.branch || branch || 'main',
            file.sha
          );

          const lines = rawContent.split(/\r\n|\r|\n/).length;

          return {
            path: file.path,
            language: file.language,
            content: rawContent,
            lines,
          };
        } catch (fetchErr) {
          console.warn(`[Re:Code Ingestion] Failed to fetch content for '${file.path}': ${fetchErr.message}`);
          return null;
        }
      })
    );

    normalizedFiles.push(...batchResults.filter(Boolean));
  }

  if (normalizedFiles.length === 0) {
    throw new AppError('Unable to retrieve source content for any candidate code files in repository.', 500);
  }

  // 4. Compute telemetry and summary metrics
  const languageBreakdown = {};
  let totalLines = 0;
  let totalBytes = 0;

  for (const file of normalizedFiles) {
    languageBreakdown[file.language] = (languageBreakdown[file.language] || 0) + 1;
    totalLines += file.lines;
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  // Strict enforcement: Ensure total downloaded content does not exceed 10MB
  if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
    throw new AppError(
      `Total size of downloaded repository files exceeds the 10MB limit (cumulative size: ${totalMb}MB).`,
      400,
      {
        maxAllowedBytes: MAX_TOTAL_SIZE_BYTES,
        foundBytes: totalBytes,
      }
    );
  }

  return {
    files: normalizedFiles,
    summary: {
      projectName: `${owner}/${repo}`,
      owner,
      repo,
      branch: treeData.branch,
      commitSha: treeData.sha,
      totalFiles: normalizedFiles.length,
      totalLines,
      totalBytes,
      languages: Object.keys(languageBreakdown),
      languageBreakdown,
    },
  };
}

module.exports = {
  MAX_REPO_FILES,
  MAX_TOTAL_SIZE_BYTES,
  MAX_DEPTH_LEVELS,
  ALLOWED_EXTENSIONS,
  EXTENSION_LANGUAGE_MAP,
  fetchRepoTree,
  filterCandidateFiles,
  fetchFileRawContent,
  ingestRepository,
  getPathDepth,
  scoreFilePath,
  safeFetchWithSsrfGuard,
};
