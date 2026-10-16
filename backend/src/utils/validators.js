const AppError = require('./AppError');
const { isPrivateIp } = require('../middleware/security');

/**
 * Supported programming languages for deterministic AST and AI reviews
 */
const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp'];

/**
 * Common language aliases to normalized standard identifiers
 */
const LANGUAGE_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  'c++': 'cpp',
  cplusplus: 'cpp',
};

/**
 * Exact GitHub repository URL pattern: https://github.com/owner/repo
 */
const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * SSRF and internal network blacklists
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^192\.168\./, // Class C private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^169\.254\./, // Link-local / AWS metadata (169.254.169.254)
  /^0\.0\.0\.0/,
  /^::1$/, // IPv6 loopback
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd00:/i, // IPv6 unique local
];

const FORBIDDEN_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  'instance-data',
];

/**
 * 1. Validate Direct Code Snippet Submission
 *
 * @param {string} content - Raw source code snippet
 * @param {string} language - Target programming language
 * @param {string} [projectName] - Optional project title
 * @returns {Object} Validated and sanitized submission metadata
 * @throws {AppError} If validation constraints fail
 */
function validateDirectSnippet(content, language, projectName) {
  // A. Content Validation
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new AppError('Code snippet content must be a non-empty string.', 400, {
      field: 'content',
      constraint: 'non-empty',
    });
  }

  const charCount = content.length;
  if (charCount > 50000) {
    throw new AppError(
      `Code snippet exceeds the maximum permitted size of 50,000 characters (received ${charCount.toLocaleString()}).`,
      400,
      {
        field: 'content',
        constraint: 'max_length',
        maxAllowed: 50000,
        received: charCount,
      }
    );
  }

  // B. Language Validation
  if (!language || typeof language !== 'string') {
    throw new AppError(
      `Language is required. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
      400,
      {
        field: 'language',
        supportedLanguages: SUPPORTED_LANGUAGES,
      }
    );
  }

  const rawLang = language.trim().toLowerCase();
  const normalizedLanguage = LANGUAGE_ALIASES[rawLang] || rawLang;

  if (!SUPPORTED_LANGUAGES.includes(normalizedLanguage)) {
    throw new AppError(
      `Unsupported programming language '${language}'. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
      400,
      {
        field: 'language',
        received: language,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }
    );
  }

  // C. Project Name Sanitization
  const cleanProjectName = (
    typeof projectName === 'string' && projectName.trim()
      ? projectName.trim()
      : `snippet-${normalizedLanguage}-${Date.now().toString().slice(-6)}`
  ).substring(0, 100);

  const linesCount = content.split(/\r\n|\r|\n/).length;

  return {
    isValid: true,
    sourceType: 'direct',
    language: normalizedLanguage,
    projectName: cleanProjectName,
    characterCount: charCount,
    linesCount,
    parserReady: true,
    content,
  };
}

/**
 * 2. Validate GitHub Repository URL with Strict SSRF Defense
 *
 * @param {string} url - GitHub repository URL
 * @returns {Object} Validated and sanitized repository metadata
 * @throws {AppError} If URL is malicious, invalid, or an SSRF attempt
 */
function validateGitHubUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new AppError('GitHub repository URL must be a non-empty string.', 400, {
      field: 'url',
      constraint: 'required',
    });
  }

  const trimmedUrl = url.trim();

  // A. Reject userinfo/credentials in URL before parsing (e.g. https://user:pass@github.com)
  if (trimmedUrl.includes('@')) {
    throw new AppError('Prohibited URL format: User credentials in URL are not allowed.', 400, {
      field: 'url',
      security: 'CREDENTIAL_EMBEDDING_ATTACK',
    });
  }

  // B. Parse URL
  let parsed;
  try {
    parsed = new URL(trimmedUrl);
  } catch (err) {
    throw new AppError('Malformed URL syntax provided.', 400, {
      field: 'url',
      detail: err.message,
    });
  }

  // C. Protocol Enforcement (Strictly HTTPS)
  if (parsed.protocol !== 'https:') {
    throw new AppError(
      `Insecure protocol '${parsed.protocol}'. Only secure 'https:' protocol is permitted.`,
      400,
      {
        field: 'url',
        security: 'INSECURE_PROTOCOL',
        expected: 'https:',
      }
    );
  }

  // D. Hostname Enforcement (Strictly github.com)
  const hostname = parsed.hostname.toLowerCase();

  // Reject Localhost and loopback
  if (FORBIDDEN_HOSTNAMES.includes(hostname)) {
    throw new AppError(`SSRF Protection: Access to '${hostname}' is strictly forbidden.`, 400, {
      field: 'url',
      security: 'SSRF_BLOCKED',
    });
  }

  // Reject Private/Internal IP addresses (including decimal/hex/IPv6 formats)
  if (isPrivateIp(hostname)) {
    throw new AppError(`SSRF Protection: Private and link-local IP resolution is forbidden.`, 400, {
      field: 'url',
      security: 'SSRF_PRIVATE_IP_BLOCKED',
    });
  }

  // Reject Private/Internal IP addresses
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new AppError(`SSRF Protection: Private and link-local IP resolution is forbidden.`, 400, {
        field: 'url',
        security: 'SSRF_PRIVATE_IP_BLOCKED',
      });
    }
  }

  // Reject internal / non-public domains
  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.intranet') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.arpa')
  ) {
    throw new AppError(`SSRF Protection: Internal domain resolution is forbidden.`, 400, {
      field: 'url',
      security: 'SSRF_INTERNAL_DNS_BLOCKED',
    });
  }

  // Must strictly be github.com (no subdomains like evil.github.com or attacker.github.com)
  if (hostname !== 'github.com') {
    throw new AppError(
      `Invalid repository host '${hostname}'. Only official 'https://github.com' repositories are supported.`,
      400,
      {
        field: 'url',
        security: 'INVALID_HOST',
        expected: 'github.com',
      }
    );
  }

  // E. Non-standard ports prohibited
  if (parsed.port && parsed.port !== '443') {
    throw new AppError(`Non-standard port '${parsed.port}' is forbidden for GitHub URLs.`, 400, {
      field: 'url',
      security: 'NON_STANDARD_PORT',
    });
  }

  // F. Prohibit query parameters or hash redirects (redirect injection / smuggling)
  if (parsed.search || parsed.hash) {
    throw new AppError('URL query parameters and URL fragments are not allowed on repository targets.', 400, {
      field: 'url',
      security: 'REDIRECT_SMUGGLING_ATTACK',
    });
  }

  // G. Strict Regex Pattern Matching: /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/
  // Normalize by stripping any trailing slash before regex test
  const normalizedUrl = trimmedUrl.replace(/\/+$/, '');

  if (!GITHUB_REPO_REGEX.test(normalizedUrl)) {
    throw new AppError(
      'Invalid GitHub repository URL format. Expected: https://github.com/owner/repository',
      400,
      {
        field: 'url',
        pattern: '^https://github.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$',
      }
    );
  }

  // H. Extract Owner and Repository Segments
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new AppError('GitHub URL must specify exactly owner and repository name.', 400, {
      field: 'url',
    });
  }

  const [owner, rawRepo] = segments;
  const repo = rawRepo.replace(/\.git$/, '');

  if (!owner || !repo) {
    throw new AppError('Repository owner or name is missing.', 400, { field: 'url' });
  }

  return {
    isValid: true,
    sourceType: 'github',
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    projectName: `${owner}/${repo}`,
    parserReady: true,
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  GITHUB_REPO_REGEX,
  validateDirectSnippet,
  validateGitHubUrl,
};
