const net = require('net');
const dns = require('dns');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

/**
 * ============================================================================
 * 1. Content Security Policy & Security Headers via Helmet
 * ============================================================================
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: [
        "'self'",
        'https://*.supabase.co',
        'https://api.github.com',
        'http://localhost:5173',
        'http://localhost:5000',
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * ============================================================================
 * 2. Rate Limiting Middleware
 * Strict 60 requests per 15 minutes per IP address
 * ============================================================================
 */
const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 60, message = null } = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const retrySec = req.rateLimit?.resetTime
        ? Math.ceil((new Date(req.rateLimit.resetTime).getTime() - Date.now()) / 1000)
        : Math.ceil(windowMs / 1000);

      return errorResponse(
        res,
        429,
        message || 'Too many requests from this IP, please try again later.',
        {
          limit: max,
          windowMinutes: Math.round(windowMs / 60000),
          retryAfterSeconds: Math.max(1, retrySec),
        }
      );
    },
  });
};

const rateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});

/**
 * ============================================================================
 * 3. Strict CORS Middleware
 * Constrained to CLIENT_URL with specified headers and credentials allowed
 * ============================================================================
 */
const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [
  ...rawClientUrl.split(',').map((s) => s.trim()).filter(Boolean),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests without origin (cURL, mobile, internal probes)
    if (!origin) {
      return callback(null, true);
    }

    // Check exact whitelist match
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development or test, allow any local loopback origin on any port
    if (process.env.NODE_ENV !== 'production') {
      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalDevOrigin) {
        return callback(null, true);
      }
    }

    return callback(
      new AppError(
        `CORS policy violation: Access denied from unauthorized origin '${origin}'`,
        403
      )
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-guest-session-id',
    'x-is-guest',
    'x-user-id',
    'x-auth-token',
    'apikey',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

const corsMiddleware = cors(corsOptions);

/**
 * ============================================================================
 * 4. Comprehensive SSRF Shield & DNS Resolution Defense
 * Rejects private, loopback, link-local, and reserved IP ranges:
 * - 10.0.0.0/8
 * - 172.16.0.0/12
 * - 192.168.0.0/16
 * - 127.0.0.0/8
 * - 169.254.0.0/16
 * - 0.0.0.0/8
 * - 100.64.0.0/10
 * - IPv6 loopback (::1), unspecified (::), link-local (fe80::/10), unique-local (fc00::/7)
 * - IPv4-mapped IPv6 (::ffff:...) and numeric/hex/octal representations
 * ============================================================================
 */
const FORBIDDEN_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  '::1',
  'metadata.google.internal',
  'instance-data',
];

const FORBIDDEN_TLD_SUFFIXES = [
  '.local',
  '.internal',
  '.intranet',
  '.corp',
  '.home',
  '.arpa',
  '.lan',
];

/**
 * Parse numeric (decimal integer, hex, octal, dotted octal/hex) IPv4 representations
 * Example: 2130706433 -> 127.0.0.1, 0x7f000001 -> 127.0.0.1, 0177.0.0.1 -> 127.0.0.1
 * @param {string} str
 * @returns {string|null} Dotted decimal IPv4 string if parsed, or null
 */
function parseNumericIp(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();

  // Decimal 32-bit integer (e.g. 2130706433)
  if (/^\d+$/.test(s)) {
    const num = Number(s);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join('.');
    }
  }

  // Hexadecimal 32-bit integer (e.g. 0x7f000001)
  if (/^0x[0-9a-fA-F]+$/i.test(s)) {
    const num = parseInt(s, 16);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      return [
        (num >>> 24) & 255,
        (num >>> 16) & 255,
        (num >>> 8) & 255,
        num & 255,
      ].join('.');
    }
  }

  // Dotted notation with octal/hex segments (e.g. 0177.0.0.1 or 0x7f.0.0.1)
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length === 4) {
      const parsed = parts.map((p) => {
        if (/^0x[0-9a-fA-F]+$/i.test(p)) return parseInt(p, 16);
        if (/^0[0-7]+$/.test(p)) return parseInt(p, 8);
        if (/^\d+$/.test(p)) return parseInt(p, 10);
        return NaN;
      });

      if (!parsed.some((n) => isNaN(n) || n < 0 || n > 255)) {
        return parsed.join('.');
      }
    }
  }

  return null;
}

/**
 * Check if a validated dotted IPv4 address belongs to any RFC-restricted private ranges:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 * - 127.0.0.0/8 (127.0.0.0 - 127.255.255.255 Loopback)
 * - 169.254.0.0/16 (169.254.0.0 - 169.254.255.255 Link-Local / Cloud Metadata)
 * - 0.0.0.0/8 (0.0.0.0 - 0.255.255.255 Current network)
 * - 100.64.0.0/10 (100.64.0.0 - 100.127.255.255 Carrier-grade NAT)
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
  if (typeof ip !== 'string') return true;
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;

  // 10.0.0.0/8 (Class A Private)
  if (a === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-Local / AWS & Cloud Metadata)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Class B Private: 172.16.x.x - 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Class C Private)
  if (a === 192 && b === 168) return true;

  // 0.0.0.0/8 (Current network / Unspecified)
  if (a === 0) return true;

  // 100.64.0.0/10 (Carrier-Grade NAT / Shared Address Space)
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

/**
 * Comprehensive IP classification: IPv4, IPv6, IPv4-mapped, and numeric formats
 * @param {string} ipStr
 * @returns {boolean} True if the IP is private, internal, loopback, or reserved
 */
function isPrivateIp(ipStr) {
  if (typeof ipStr !== 'string' || !ipStr.trim()) return true;
  const clean = ipStr.trim().toLowerCase().replace(/^\[|\]$/g, '');

  // 1. IPv4-Mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
  if (clean.startsWith('::ffff:')) {
    const rest = clean.slice(7);
    if (net.isIPv4(rest)) return isPrivateIPv4(rest);
    const num = parseNumericIp(rest);
    if (num && net.isIPv4(num)) return isPrivateIPv4(num);
  }

  // 2. Standard IPv4
  if (net.isIPv4(clean)) {
    return isPrivateIPv4(clean);
  }

  // 3. Numeric IPv4 (decimal, hex, octal)
  const numericIpv4 = parseNumericIp(clean);
  if (numericIpv4 && net.isIPv4(numericIpv4)) {
    return isPrivateIPv4(numericIpv4);
  }

  // 4. Standard IPv6
  if (net.isIPv6(clean)) {
    // Loopback & Unspecified
    if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') {
      return true;
    }
    // Link-local (fe80::/10)
    if (/^fe[89ab]/i.test(clean)) return true;
    // Unique-local / private (fc00::/7 -> fc.. and fd..)
    if (/^f[cd]/i.test(clean)) return true;
    return false;
  }

  return false;
}

/**
 * Resolve DNS hostnames before requesting URLs and enforce strict SSRF rules
 * @param {string} hostname
 * @returns {Promise<Array<{address: string, family: number}>>} Resolved safe addresses
 * @throws {AppError} If hostname is forbidden, internal, or resolves to a private IP
 */
async function resolveDnsAndValidate(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    throw new AppError('SSRF Protection: Invalid hostname provided for DNS resolution.', 400, {
      field: 'url',
      security: 'SSRF_INVALID_HOSTNAME',
    });
  }

  const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

  // 1. Direct forbidden hostnames check
  if (FORBIDDEN_HOSTNAMES.includes(cleanHost)) {
    throw new AppError(`SSRF Protection: Access to '${cleanHost}' is strictly forbidden.`, 400, {
      field: 'url',
      security: 'SSRF_BLOCKED',
      hostname: cleanHost,
    });
  }

  // 2. Check if hostname itself is a private IP address
  if (isPrivateIp(cleanHost)) {
    throw new AppError(
      `SSRF Protection: Private and link-local IP resolution is forbidden for '${cleanHost}'.`,
      400,
      {
        field: 'url',
        security: 'SSRF_PRIVATE_IP_BLOCKED',
        hostname: cleanHost,
      }
    );
  }

  // 3. Check for internal domain suffixes
  for (const suffix of FORBIDDEN_TLD_SUFFIXES) {
    if (cleanHost.endsWith(suffix)) {
      throw new AppError(
        `SSRF Protection: Internal domain resolution is forbidden for '${cleanHost}'.`,
        400,
        {
          field: 'url',
          security: 'SSRF_INTERNAL_DNS_BLOCKED',
          hostname: cleanHost,
        }
      );
    }
  }

  // 4. Perform actual DNS resolution
  let addresses = [];
  try {
    addresses = await dns.promises.lookup(cleanHost, { all: true });
  } catch (err) {
    throw new AppError(
      `SSRF Protection: Failed to resolve hostname '${cleanHost}': ${err.message}`,
      400,
      {
        field: 'url',
        security: 'SSRF_DNS_RESOLUTION_FAILED',
        hostname: cleanHost,
      }
    );
  }

  if (!addresses || addresses.length === 0) {
    throw new AppError(
      `SSRF Protection: No DNS records returned for target host '${cleanHost}'.`,
      400,
      {
        field: 'url',
        security: 'SSRF_DNS_RESOLUTION_FAILED',
        hostname: cleanHost,
      }
    );
  }

  // 5. Inspect every resolved IP address for private/internal ranges (defense against DNS rebinding)
  for (const record of addresses) {
    const resolvedIp = record.address;
    if (isPrivateIp(resolvedIp)) {
      throw new AppError(
        `SSRF Protection: Hostname '${cleanHost}' resolved to forbidden private IP '${resolvedIp}'.`,
        400,
        {
          field: 'url',
          security: 'SSRF_PRIVATE_IP_BLOCKED',
          hostname: cleanHost,
          resolvedIp,
        }
      );
    }
  }

  return addresses;
}

/**
 * Validate URL string with full SSRF shield & DNS resolution
 * @param {string} url - Target URL to inspect
 * @param {Object} [options]
 * @param {boolean} [options.requireGitHub=false] - If true, requires hostname to strictly be github.com
 * @param {boolean} [options.requireHttps=true] - If true, requires https protocol
 * @returns {Promise<{safe: boolean, url: string, hostname: string, addresses: Array}>}
 */
async function validateSsrf(url, options = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new AppError('SSRF Protection: Target URL must be a non-empty string.', 400, {
      field: 'url',
      security: 'SSRF_INVALID_URL',
    });
  }

  const trimmedUrl = url.trim();

  // Reject embedded credentials
  if (trimmedUrl.includes('@')) {
    throw new AppError('Prohibited URL format: User credentials in URL are not allowed.', 400, {
      field: 'url',
      security: 'CREDENTIAL_EMBEDDING_ATTACK',
    });
  }

  let parsed;
  try {
    parsed = new URL(trimmedUrl);
  } catch (err) {
    throw new AppError(`Malformed URL syntax provided: ${err.message}`, 400, {
      field: 'url',
      security: 'MALFORMED_URL',
    });
  }

  // Protocol check
  if (options.requireHttps !== false && parsed.protocol !== 'https:') {
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

  const hostname = parsed.hostname;
  const addresses = await resolveDnsAndValidate(hostname);

  // Non-standard port check
  if (parsed.port && parsed.port !== '443' && parsed.port !== '80') {
    throw new AppError(`SSRF Protection: Non-standard port '${parsed.port}' is forbidden.`, 400, {
      field: 'url',
      security: 'NON_STANDARD_PORT',
    });
  }

  if (options.requireGitHub) {
    const cleanHost = hostname.toLowerCase();
    if (cleanHost !== 'github.com') {
      throw new AppError(
        `Invalid repository host '${cleanHost}'. Only official 'https://github.com' repositories are supported.`,
        400,
        {
          field: 'url',
          security: 'INVALID_HOST',
          expected: 'github.com',
        }
      );
    }
  }

  return {
    safe: true,
    url: parsed.href,
    hostname,
    addresses,
  };
}

/**
 * Express middleware to inspect incoming request bodies/queries for target URLs
 * and enforce the SSRF Shield before route handlers execute
 */
function ssrfShieldMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      const targetUrl =
        (req.body && (req.body.url || req.body.repo_url || req.body.repoUrl || req.body.targetUrl)) ||
        req.query?.url ||
        req.query?.repo_url ||
        req.query?.targetUrl;

      if (targetUrl && typeof targetUrl === 'string') {
        const isGithubSubmission =
          (req.body && (req.body.source_type === 'github' || req.body.sourceType === 'github')) ||
          options.requireGitHub;

        await validateSsrf(targetUrl, {
          requireGitHub: Boolean(isGithubSubmission),
          requireHttps: options.requireHttps !== false,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Allowed public hostnames for GitHub ingestion and raw content
 */
const ALLOWED_GITHUB_HOSTS = [
  'api.github.com',
  'github.com',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
];

/**
 * Perform fetch with strict SSRF & Redirect Safeguards:
 * - Prevents redirection to private IP ranges (127.0.0.1, 10.x, 192.168.x, 172.16-31.x, 169.254.x, etc.)
 * - Rejects non-https protocols and non-standard ports
 * - Resolves DNS before following redirects (DNS rebinding defense)
 * - Limits redirects strictly to approved public GitHub domains
 * - Caps maximum redirect hops to prevent loops
 *
 * @param {string} url - Target URL to request
 * @param {Object} [options={}] - Standard fetch options
 * @param {number} [redirectHops=0] - Current redirect recursion depth
 * @returns {Promise<Response>}
 */
async function safeFetchWithSsrfGuard(url, options = {}, redirectHops = 0) {
  const MAX_REDIRECT_HOPS = 3;
  if (redirectHops > MAX_REDIRECT_HOPS) {
    throw new AppError('SSRF Protection: Exceeded maximum allowed redirect hops.', 400, {
      security: 'SSRF_REDIRECT_LOOP',
    });
  }

  const parsedUrl = new URL(url);
  const hostname = parsedUrl.hostname.toLowerCase();

  // 1. Protocol check
  if (parsedUrl.protocol !== 'https:') {
    throw new AppError(
      `SSRF Protection: Insecure protocol '${parsedUrl.protocol}'. Only 'https:' is permitted.`,
      400,
      { security: 'INSECURE_PROTOCOL' }
    );
  }

  // 2. Port check
  if (parsedUrl.port && parsedUrl.port !== '443') {
    throw new AppError(
      `SSRF Protection: Non-standard port '${parsedUrl.port}' is forbidden.`,
      400,
      { security: 'NON_STANDARD_PORT' }
    );
  }

  // 3. DNS resolution & private IP rejection
  await resolveDnsAndValidate(hostname);

  // 4. Validate hostname belongs to allowed public GitHub infrastructure
  const isAllowedHost =
    ALLOWED_GITHUB_HOSTS.includes(hostname) ||
    hostname.endsWith('.github.com') ||
    hostname.endsWith('.githubusercontent.com');

  if (!isAllowedHost) {
    throw new AppError(
      `SSRF Protection: Redirection or request to untrusted host '${hostname}' is prohibited.`,
      400,
      { security: 'UNTRUSTED_REDIRECT_HOST', hostname }
    );
  }

  // 5. Execute fetch with manual redirect handling
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
  });

  // 6. Handle redirects manually and validate destination before following
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) {
      throw new AppError('SSRF Protection: Redirect missing Location header.', 400, {
        security: 'MALFORMED_REDIRECT',
      });
    }

    const redirectTarget = new URL(location, url).href;
    return safeFetchWithSsrfGuard(redirectTarget, options, redirectHops + 1);
  }

  return response;
}

/**
 * ============================================================================
 * 5. In-Memory Payload Size Clamps
 * Strictly rejects requests > 2MB with HTTP 413 Payload Too Large
 * ============================================================================
 */
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB (2,097,152 bytes)

/**
 * Factory for creating payload size clamp middleware
 * @param {Object} [options]
 * @param {number} [options.maxBytes=2097152] - Maximum permitted payload in bytes
 */
function payloadClamp({ maxBytes = MAX_PAYLOAD_BYTES } = {}) {
  return (req, res, next) => {
    // 1. Inspect Content-Length header before buffering
    const contentLength = req.headers['content-length'];
    if (contentLength) {
      const parsedLength = parseInt(contentLength, 10);
      if (!isNaN(parsedLength) && parsedLength > maxBytes) {
        return errorResponse(
          res,
          413,
          'Payload Too Large: Request exceeds maximum permitted limit of 2MB.',
          {
            maxLimitBytes: maxBytes,
            receivedBytes: parsedLength,
          }
        );
      }
    }

    // 2. In-memory inspection if body is already loaded / parsed
    if (req.body) {
      try {
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const byteLength = Buffer.byteLength(bodyStr, 'utf8');
        if (byteLength > maxBytes) {
          return errorResponse(
            res,
            413,
            'Payload Too Large: Request exceeds maximum permitted limit of 2MB.',
            {
              maxLimitBytes: maxBytes,
              receivedBytes: byteLength,
            }
          );
        }
      } catch {
        // Continue if cannot measure serialized body
      }
    }

    next();
  };
}

const payloadClampMiddleware = payloadClamp({ maxBytes: MAX_PAYLOAD_BYTES });

module.exports = {
  // Existing Security Core
  helmetMiddleware,
  rateLimiter,
  createRateLimiter,
  corsMiddleware,
  corsOptions,
  allowedOrigins,

  // Module 18 SSRF Shield
  FORBIDDEN_HOSTNAMES,
  FORBIDDEN_TLD_SUFFIXES,
  ALLOWED_GITHUB_HOSTS,
  parseNumericIp,
  isPrivateIPv4,
  isPrivateIp,
  resolveDnsAndValidate,
  validateSsrf,
  ssrfShieldMiddleware,
  safeFetchWithSsrfGuard,

  // Module 18 In-Memory Payload Clamps
  MAX_PAYLOAD_BYTES,
  payloadClamp,
  payloadClampMiddleware,
};
