const AppError = require('../../utils/AppError');
const { resolveDnsAndValidate } = require('../../middleware/security');

/**
 * Resource and Security Limits for GitHub Repository Scanning
 */
const MAX_REPO_FILES = 50;
const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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
};

const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_LANGUAGE_MAP);

/**
 * Directories excluded from AST code analysis
 */
const IGNORED_DIRECTORY_PATTERNS = [
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)build(\/|$)/i,
  /(^|\/)out(\/|$)/i,
  /(^|\/)target(\/|$)/i,
  /(^|\/)bin(\/|$)/i,
  /(^|\/)obj(\/|$)/i,
  /(^|\/)vendor(\/|$)/i,
  /(^|\/)third_party(\/|$)/i,
  /(^|\/)deps(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)\.github(\/|$)/i,
  /(^|\/)\.vscode(\/|$)/i,
  /(^|\/)\.idea(\/|$)/i,
  /(^|\/)__pycache__(\/|$)/i,
  /(^|\/)\.pytest_cache(\/|$)/i,
  /(^|\/)\.venv(\/|$)/i,
  /(^|\/)env(\/|$)/i,
];

/**
 * Files excluded from analysis (lockfiles, minified bundles, maps, hidden files)
 */
const IGNORED_FILE_NAMES = [
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
    'User-Agent': 'ReCode-AST-Scanner/1.0',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * 1. Fetch Repository Git Tree recursively via GitHub API
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

  const cleanBranch = branch.trim() || 'main';
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${cleanBranch}?recursive=1`;

  // SSRF Shield: Verify DNS resolution before requesting GitHub API
  await resolveDnsAndValidate('api.github.com');

  let response;
  try {
    response = await fetch(url, { headers: getGitHubHeaders() });
  } catch (err) {
    throw new AppError(`Network failure communicating with GitHub API: ${err.message}`, 502);
  }

  if (response.status === 404) {
    throw new AppError(
      `GitHub repository '${owner}/${repo}' or branch '${cleanBranch}' not found. Please verify the URL is public and the branch exists.`,
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
    } catch (e) { /* keep statusText */ }

    throw new AppError(`GitHub API error (${response.status}): ${detail}`, response.status);
  }

  const data = await response.json();

  if (!Array.isArray(data.tree) || data.tree.length === 0) {
    throw new AppError(`GitHub repository '${owner}/${repo}' contains no files in branch '${cleanBranch}'.`, 400);
  }

  return {
    tree: data.tree,
    sha: data.sha,
    truncated: !!data.truncated,
    branch: cleanBranch,
  };
}

/**
 * 2. Filter Candidate Files and Enforce Resource Limits
 *
 * @param {Array<Object>} treeNodes - Array of Git tree items from GitHub API
 * @returns {Array<{ path: string, sha: string, size: number, language: string, extension: string }>}
 * @throws {AppError} If limits exceeded or zero files found
 */
function filterCandidateFiles(treeNodes) {
  if (!Array.isArray(treeNodes)) {
    throw new AppError('Invalid tree structure received from GitHub API.', 500);
  }

  const candidates = [];
  let totalSizeBytes = 0;

  for (const node of treeNodes) {
    // Only analyze files (blobs), ignore subtrees and submodules
    if (node.type !== 'blob') {
      continue;
    }

    const filePath = node.path;
    const lowerPath = filePath.toLowerCase();
    const fileName = lowerPath.split('/').pop();

    // Ignore hidden files and directories (e.g. .github/, .git/, .env)
    if (filePath.startsWith('.') || filePath.includes('/.') || fileName.startsWith('.')) {
      continue;
    }

    // Ignore blacklisted directories
    const isIgnoredDir = IGNORED_DIRECTORY_PATTERNS.some((pattern) => pattern.test(filePath));
    if (isIgnoredDir) {
      continue;
    }

    // Ignore lockfiles and OS files
    if (IGNORED_FILE_NAMES.includes(fileName)) {
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
    totalSizeBytes += fileSize;

    candidates.push({
      path: filePath,
      sha: node.sha,
      size: fileSize,
      language,
      extension: ext,
    });
  }

  // Enforce Resource Limit 1: Zero matching files
  if (candidates.length === 0) {
    throw new AppError(
      'Repository contains no eligible code files matching supported languages (JavaScript, TypeScript, Python, Java, C++).',
      400,
      { supportedExtensions: ALLOWED_EXTENSIONS }
    );
  }

  // Enforce Resource Limit 2: Maximum repository files limit (50)
  if (candidates.length > MAX_REPO_FILES) {
    throw new AppError(
      `Repository exceeds the maximum limit of ${MAX_REPO_FILES} files for static AST analysis (found ${candidates.length} candidate files).`,
      400,
      {
        maxAllowed: MAX_REPO_FILES,
        found: candidates.length,
      }
    );
  }

  // Enforce Resource Limit 3: Total repository scan size (10MB)
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

  return candidates;
}

/**
 * 3. Safely Retrieve Raw Text Content in-memory
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} filePath - Path to file within repository
 * @param {string} [commitSha='main'] - Commit SHA or branch ref
 * @returns {Promise<string>} UTF-8 decoded file text content
 */
async function fetchFileRawContent(owner, repo, filePath, commitSha = 'main', blobSha = null) {
  // SSRF Shield: Verify DNS resolution before requesting GitHub API
  await resolveDnsAndValidate('api.github.com');

  const headers = {
    ...getGitHubHeaders(),
    Accept: 'application/vnd.github.v3.raw, application/vnd.github.v3+json',
  };

  // 1. If blob SHA is available (or passed as 40-char commitSha), fetch directly from immutable git/blobs
  const effectiveBlobSha = blobSha || (/^[a-f0-9]{40}$/i.test(commitSha) ? commitSha : null);
  if (effectiveBlobSha) {
    try {
      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${effectiveBlobSha}`;
      const blobRes = await fetch(blobUrl, { headers });
      if (blobRes.ok) {
        return await blobRes.text();
      }
    } catch {
      // Fallback to contents endpoint below
    }
  }

  // 2. Fetch via contents endpoint using branch ref
  const ref = /^[a-f0-9]{40}$/i.test(commitSha) ? 'main' : commitSha;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;

  let response;
  try {
    response = await fetch(url, { headers });
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

module.exports = {
  MAX_REPO_FILES,
  MAX_TOTAL_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  EXTENSION_LANGUAGE_MAP,
  fetchRepoTree,
  filterCandidateFiles,
  fetchFileRawContent,
};
