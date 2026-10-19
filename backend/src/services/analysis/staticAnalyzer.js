const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');
const traverse = traverseModule.default || traverseModule;

/**
 * Supported AST Rule Registry
 */
const RULES = {
  PARSER_ERROR: {
    ruleId: 'PARSER_ERROR',
    severity: 'HIGH',
    category: 'SYNTAX',
    title: 'Syntax Error in Source Code',
    cwe: null,
  },
  SQL_INJECTION: {
    ruleId: 'SQL_INJECTION',
    severity: 'CRITICAL',
    category: 'SECURITY',
    title: 'SQL Injection Vulnerability (CWE-89)',
    cwe: 'CWE-89',
  },
  HARDCODED_SECRET: {
    ruleId: 'HARDCODED_SECRET',
    severity: 'CRITICAL',
    category: 'SECURITY',
    title: 'Hardcoded Credential / Secret (CWE-798)',
    cwe: 'CWE-798',
  },
  EMPTY_CATCH_BLOCK: {
    ruleId: 'EMPTY_CATCH_BLOCK',
    severity: 'MEDIUM',
    category: 'QUALITY',
    title: 'Empty Catch Block',
    cwe: 'CWE-390',
  },
  UNUSED_VARIABLE: {
    ruleId: 'UNUSED_VARIABLE',
    severity: 'LOW',
    category: 'QUALITY',
    title: 'Unused Variable Declaration',
    cwe: 'CWE-563',
  },
  DEAD_CODE: {
    ruleId: 'DEAD_CODE',
    severity: 'MEDIUM',
    category: 'QUALITY',
    title: 'Unreachable / Dead Code Detected (CWE-561)',
    cwe: 'CWE-561',
  },
  UNHANDLED_ASYNC_PROMISE: {
    ruleId: 'UNHANDLED_ASYNC_PROMISE',
    severity: 'MEDIUM',
    category: 'QUALITY',
    title: 'Unhandled Asynchronous Promise (CWE-391)',
    cwe: 'CWE-391',
  },
  CONSOLE_LOG_STMT: {
    ruleId: 'CONSOLE_LOG_STMT',
    severity: 'LOW',
    category: 'QUALITY',
    title: 'Console Log Left in Production Code',
    cwe: 'CWE-532',
  },
  DOM_XSS: {
    ruleId: 'DOM_XSS',
    severity: 'MEDIUM',
    category: 'SECURITY',
    title: 'DOM-based Cross-Site Scripting (CWE-79)',
    cwe: 'CWE-79',
  },
  INSECURE_TARGET_BLANK: {
    ruleId: 'INSECURE_TARGET_BLANK',
    severity: 'LOW',
    category: 'SECURITY',
    title: 'Reverse Tabnabbing via target="_blank" (CWE-1022)',
    cwe: 'CWE-1022',
  },
  SQL_LEADING_WILDCARD: {
    ruleId: 'SQL_LEADING_WILDCARD',
    severity: 'LOW',
    category: 'OPTIMIZATION',
    title: 'Full Table Scan via Leading Wildcard in LIKE Clause',
    cwe: null,
  },
  UNCONSTRAINED_MUTATION: {
    ruleId: 'UNCONSTRAINED_MUTATION',
    severity: 'HIGH',
    category: 'SECURITY',
    title: 'Unrestricted Mutation Statement (Missing WHERE Clause)',
    cwe: 'CWE-89',
  },
  UNRESTRICTED_MUTATION: {
    ruleId: 'UNRESTRICTED_MUTATION',
    severity: 'HIGH',
    category: 'SECURITY',
    title: 'Unrestricted Mutation Statement (Missing WHERE Clause)',
    cwe: 'CWE-89',
  },
  IMPLICIT_CARTESIAN_JOIN: {
    ruleId: 'IMPLICIT_CARTESIAN_JOIN',
    severity: 'HIGH',
    category: 'OPTIMIZATION',
    title: 'Unintended Cartesian Product via Implicit Comma Join',
    cwe: null,
  },
};

/**
 * Regex patterns
 */
const SECRET_ID_REGEX = /token|secret|jwt|api_?key/i;
const SQL_KEYWORD_REGEX = /\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|FROM|WHERE|JOIN)\b/i;
const QUERY_METHOD_REGEX = /^(query|execute|rawQuery|queryRaw|executeRaw|executeRawUnsafe|execSql|raw|runSql)$/i;
const QUERY_OBJECT_REGEX = /^(db|pool|client|connection|conn|sql|sequelize|prisma|knex|session|trx|database)$/i;

/**
 * Format raw compiler syntax error message into human-readable, actionable guidance
 *
 * @param {Error|Object} err - Compiler / parser error instance
 * @param {number} line - Line number of error
 * @param {string} [evidence=''] - Raw code line content
 * @returns {string} Actionable remediation advice
 */
function formatParserErrorRemediation(err, line, evidence = '') {
  const msg = (err && err.message ? err.message : '').toLowerCase();
  const rawMsg = err && err.message ? err.message : '';
  const trimmedEvidence = (evidence || '').trim();

  // Pattern 1: Missing closing parenthesis ')' in condition or argument
  // e.g. "Unexpected token, expected ')' (63:6)"
  if (
    msg.includes("expected ')'") ||
    msg.includes('expected ")"') ||
    msg.includes('expected )') ||
    (/if\s*\(/.test(trimmedEvidence) && !trimmedEvidence.includes(')')) ||
    (/while\s*\(/.test(trimmedEvidence) && !trimmedEvidence.includes(')')) ||
    (/for\s*\(/.test(trimmedEvidence) && !trimmedEvidence.includes(')'))
  ) {
    return `Syntax Error: Line ${line} has an unclosed condition or parenthesis. Close the condition with ')' before opening the code block.`;
  }

  // Pattern 2: Missing closing brace '}'
  if (msg.includes("expected '}'") || msg.includes('expected "}"') || msg.includes('missing closing brace')) {
    return `Syntax Error: Line ${line} has an unclosed code block. Add a closing brace '}' to properly terminate the block.`;
  }

  // Pattern 3: Missing closing bracket ']'
  if (msg.includes("expected ']'") || msg.includes('expected "]"')) {
    return `Syntax Error: Line ${line} has an unclosed bracket. Close the array or index expression with ']'.`;
  }

  // Pattern 4: Missing semicolon ';'
  if (msg.includes("expected ';'") || msg.includes('expected ";"')) {
    return `Syntax Error: Line ${line} is missing a statement separator. Add ';' to terminate the statement.`;
  }

  // Pattern 5: Missing opening brace '{'
  if (msg.includes("expected '{'") || msg.includes('expected "{"')) {
    return `Syntax Error: Line ${line} is missing an opening brace '{'. Add '{' to start the code block.`;
  }

  // Pattern 6: Unterminated string or template literal
  if (msg.includes('unterminated string') || msg.includes('unterminated template')) {
    return `Syntax Error: Line ${line} contains an unclosed string or template literal. Close the string with the matching quote.`;
  }

  // Pattern 7: General unexpected token
  if (msg.includes('unexpected token')) {
    if (trimmedEvidence) {
      return `Syntax Error: Line ${line} has an unexpected token near '${trimmedEvidence}'. Verify that all parentheses, braces, and operators on line ${line} are properly closed.`;
    }
    return `Syntax Error: Line ${line} has an unexpected token. Verify that all parentheses, brackets, and syntax operators on line ${line} are properly closed.`;
  }

  const clean = rawMsg.split('(')[0].trim();
  return `Syntax Error: Line ${line} has a syntax failure (${clean || 'Parser Error'}). Correct the syntax around line ${line}.`;
}

/**
 * Truncate long code snippet lines exceeding maxLen to first truncLen characters + '...'
 * Prevents minified files and bundler outputs from overwhelming audit reports
 *
 * @param {string} str - Raw line or multi-line code snippet
 * @param {number} [maxLen=150] - Threshold length
 * @param {number} [truncLen=120] - Truncated length
 * @returns {string} Truncated string
 */
function truncateSnippetLine(str, maxLen = 150, truncLen = 120) {
  if (!str || typeof str !== 'string') return '';
  return str
    .split('\n')
    .map((line) => (line.length > maxLen ? line.slice(0, truncLen) + '...' : line))
    .join('\n');
}

/**
 * Educational step-by-step remediation guide for static findings
 *
 * @param {string} ruleId - Target rule identifier
 * @returns {string} Step-by-step remediation guide
 */
function getRuleStepByStepRemediation(ruleId) {
  const rule = String(ruleId || '').toUpperCase();
  if (rule.includes('UNUSED')) {
    return 'Step 1: If this variable is unnecessary, delete line declaration.\nStep 2: If you intended to use it later in the file, reference it in your logic or export it.';
  }
  if (rule.includes('SECRET') || rule.includes('CREDENTIAL') || rule.includes('KEY') || rule.includes('CWE-798')) {
    return 'Step 1: Install dotenv (`npm install dotenv`).\nStep 2: Create a root `.env` file and define `JWT_SECRET=your_secure_random_key`.\nStep 3: Replace the hardcoded string with `process.env.JWT_SECRET`.';
  }
  if (rule.includes('SQL')) {
    return 'Step 1: Never concatenate user inputs (`req.query.id`) directly into SQL query strings.\nStep 2: Use parameterized queries with placeholders (`$1, $2`).\nStep 3: Pass inputs safely via the query parameters array: `db.query(sqlQuery, [studentId, minGpa])`.';
  }
  if (rule.includes('CONSOLE') || rule.includes('LOG')) {
    return 'Step 1: Remove debug statements before merging into production.\nStep 2: Use an enterprise logger (such as Winston or Pino) if runtime logging is required.';
  }
  if (rule.includes('CATCH')) {
    return 'Step 1: Log the caught error with `logger.error(err.message)`.\nStep 2: Either handle the failure gracefully or re-throw the exception.';
  }
  if (rule.includes('DEAD') || rule.includes('UNREACHABLE')) {
    return 'Step 1: Inspect statements located directly after return, throw, break, or continue.\nStep 2: Remove the unreachable dead code or move it before the terminating statement.';
  }
  if (rule.includes('PROMISE') || rule.includes('ASYNC')) {
    return 'Step 1: Attach a .catch(err => ...) handler to the Promise chain.\nStep 2: Alternatively, refactor to async/await enclosed within a try/catch block.';
  }
  if (rule.includes('MUTATION') || rule.includes('UNRESTRICTED') || rule.includes('UNCONSTRAINED')) {
    return 'Step 1: Always include a selective WHERE clause on UPDATE and DELETE operations (e.g., WHERE id = :target_id).\nStep 2: Ensure transaction safeguards or soft-deletion patterns are used to prevent accidental full-table data loss.';
  }
  if (rule.includes('CARTESIAN') || rule.includes('JOIN')) {
    return 'Step 1: Replace legacy comma-separated table joins with explicit ANSI INNER JOIN syntax.\nStep 2: Define explicit ON predicates matching foreign keys (e.g., orders.customer_id = customers.id) to prevent unbounded Cartesian products.';
  }
  if (rule.includes('XSS') || rule.includes('INNERHTML')) {
    return 'Step 1: Replace raw HTML sinks like innerHTML or outerHTML with safe property element.textContent.\nStep 2: If dynamic HTML formatting is required, sanitize inputs using DOMPurify.';
  }
  return 'Step 1: Review the affected code logic against secure development best practices.\nStep 2: Apply the recommended remediation diff patch below.';
}

/**
 * Contextual diff remediation generator for static AST findings
 *
 * @param {string} ruleId - Target rule identifier
 * @param {string} evidence - Exact line from submitted source file
 * @param {string} [language='javascript'] - Programming language
 * @returns {string} Remediated safe line(s)
 */
function generateStaticRemediationDiff(ruleId, evidence = '', language = 'javascript') {
  const line = (evidence || '').trim();
  const rule = (ruleId || '').toUpperCase();
  const isSql = language === 'sql';

  // 1. UNRESTRICTED_MUTATION / UNCONSTRAINED_MUTATION (Missing WHERE clause)
  if (rule.includes('MUTATION') || rule.includes('UNRESTRICTED') || rule.includes('UNCONSTRAINED')) {
    const clean = line.replace(/;?\s*$/, '');
    if (/^UPDATE\b/i.test(clean)) {
      if (/\bSET\b/i.test(clean)) {
        return `${clean} WHERE id = :target_id;`;
      }
      return `${clean} SET ... WHERE id = :target_id;`;
    }
    if (/^DELETE\s+FROM\b/i.test(clean)) {
      return `${clean} WHERE id = :target_id;`;
    }
    if (/^DELETE\b/i.test(clean)) {
      const tablePart = clean.replace(/^DELETE\s+/i, '');
      return `DELETE FROM ${tablePart} WHERE id = :target_id;`;
    }
    return `${clean} WHERE id = :target_id;`;
  }

  // 2. IMPLICIT_CARTESIAN_JOIN / CARTESIAN_PRODUCT
  if (rule.includes('CARTESIAN') || (isSql && rule.includes('JOIN'))) {
    if (/\bFROM\b/i.test(line)) {
      if (/^FROM\b/i.test(line)) {
        return `-- Replace implicit comma join with explicit ANSI INNER JOIN and ON conditions\nFROM orders o INNER JOIN customers c ON o.customer_id = c.id INNER JOIN products p ON o.product_id = p.id;`;
      }
      return `-- Replace implicit comma join with explicit ANSI INNER JOIN and ON conditions\nSELECT * FROM orders o INNER JOIN customers c ON o.customer_id = c.id INNER JOIN products p ON o.product_id = p.id;`;
    }
    return `-- Use explicit ANSI JOIN ... ON ... instead of Cartesian product\n${line}`;
  }

  // 3. SQL_LEADING_WILDCARD
  if (rule.includes('WILDCARD') || rule.includes('LEADING')) {
    const fixedLike = line.replace(/LIKE\s+['"]%([^'%"]+)['"]/i, "LIKE '$1%'");
    return `-- Use trailing wildcard or full-text index to prevent full table scans\n${fixedLike}`;
  }

  // 4. UNUSED_VARIABLE
  if (rule.includes('UNUSED')) {
    return isSql ? '-- Removed unused column or alias' : '// Removed unused variable';
  }

  // 5. HARDCODED_SECRET (CWE-798)
  if (rule.includes('SECRET') || rule.includes('CREDENTIAL') || rule.includes('KEY')) {
    if (isSql) {
      return '-- Store credentials securely in vault or environment variables\n-- e.g. using vault secret provider or pg_crypto';
    }
    const varMatch = line.match(/(?:const|let|var|String|final\s+String)?\s*([a-zA-Z0-9_$]+)\s*[:=]/);
    const varName = varMatch ? varMatch[1] : 'JWT_SECRET';
    const envVar = varName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

    if (language === 'python') {
      return `import os\n${varName} = os.environ.get("${envVar}") or (_ for _ in ()).throw(RuntimeError("${envVar} missing in .env"))`;
    }
    if (language === 'java') {
      return `String ${varName} = Optional.ofNullable(System.getenv("${envVar}")).orElseThrow(() -> new IllegalStateException("${envVar} missing in .env"));`;
    }
    if (language === 'cpp') {
      return `const char* ${varName} = std::getenv("${envVar}");\nif (!${varName}) throw std::runtime_error("${envVar} missing in .env");`;
    }
    return `const ${varName} = process.env.${envVar} || (() => { throw new Error("${envVar} missing in .env"); })();`;
  }

  // 6. CONSOLE_LOG_STMT / CONSOLE_LOG_STATEMENT
  if (rule.includes('CONSOLE') || rule.includes('LOG') || rule.includes('PRINT')) {
    return isSql ? '-- Removed debug print statement' : '// logger.info(...) or remove before production';
  }

  // 7. SQL_INJECTION (CWE-89)
  if (rule.includes('SQL')) {
    if (isSql) {
      if (line.includes('||')) {
        return `-- Use parameterized EXECUTE ... USING\nEXECUTE 'SELECT * FROM students WHERE campus_id = $1 AND gpa >= $2' USING p_campus_id, p_min_gpa;`;
      }
      if (line.includes('+') || line.includes('@') || line.includes(':')) {
        let parameterized = line
          .replace(/['"][^'"]*['"]\s*\+\s*(@[a-zA-Z0-9_]+)/g, ':target_param')
          .replace(/(@[a-zA-Z0-9_]+)\s*\+\s*['"][^'"]*['"]/g, ':target_param')
          .replace(/['"][^'"]*['"]\s*\+\s*(:[a-zA-Z0-9_]+)/g, ':target_param')
          .replace(/(:[a-zA-Z0-9_]+)\s*\+\s*['"][^'"]*['"]/g, ':target_param');
        if (parameterized === line) {
          parameterized = `${line.replace(/;?\s*$/, '')} -- Use parameterized input (:target_param);`;
        }
        return `-- Parameterize query inputs instead of dynamic string concatenation\n${parameterized}`;
      }
      return `-- Parameterized statement\n-- EXECUTE format('SELECT * FROM %I WHERE id = %L', table_name, user_id);`;
    }

    const varNames = [];
    const templateMatches = [...line.matchAll(/\$\{([a-zA-Z0-9_$.]+)\}/g)];
    for (const m of templateMatches) {
      if (m[1]) varNames.push(m[1].trim());
    }
    if (varNames.length === 0) {
      const fMatches = [...line.matchAll(/\{([a-zA-Z0-9_]+)\}/g)];
      for (const m of fMatches) {
        if (m[1]) varNames.push(m[1].trim());
      }
    }
    if (varNames.length === 0) {
      const concatMatches = [...line.matchAll(/\+\s*([a-zA-Z0-9_$.]+)/g)];
      for (const m of concatMatches) {
        const name = m[1].trim();
        if (!/^(true|false|null|undefined|\d+|std)$/i.test(name)) {
          varNames.push(name.replace(/^std::to_string\((.+)\)$/, '$1'));
        }
      }
    }

    if (language === 'python') {
      let replaced = line;
      let paramCount = 0;
      for (const v of varNames) {
        const safeV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        replaced = replaced.replace(new RegExp(`['"]?\\{${safeV}\\}['"]?`, 'g'), () => '%s');
        paramCount++;
      }
      if (paramCount === 0) {
        replaced = replaced.replace(/\+\s*[a-zA-Z0-9_$.]+/g, () => '%s');
      }
      const tupleVars = varNames.length === 1 ? `(${varNames[0]},)` : `(${varNames.join(', ')})`;
      return `${replaced}\n# cursor.execute(query, ${tupleVars})`;
    }

    if (language === 'java' || language === 'cpp') {
      let replaced = line;
      for (const v of varNames) {
        const safeV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${safeV}\\s*\\+\\s*['"]`, 'g'), () => '?');
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${safeV}`, 'g'), () => '?"');
        replaced = replaced.replace(new RegExp(`\\+\\s*std::to_string\\(${safeV}\\)`, 'g'), () => '?"');
      }
      const paramsList = varNames.length > 0 ? varNames.join(', ') : 'param1, param2';
      return `${replaced}\n// Parameterized prepared statement bindings: [${paramsList}]`;
    }

    // JavaScript / TypeScript ($1, $2 placeholders)
    let paramIndex = 1;
    let replaced = line;

    if (templateMatches.length > 0) {
      replaced = line.replace(/`([^`]*)`/, (match, sqlContent) => {
        let inner = sqlContent;
        for (const v of varNames) {
          const idx = paramIndex;
          const safeV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          inner = inner.replace(new RegExp(`'\\s*\\$\\{${safeV}\\}\\s*'`, 'g'), () => `$${idx}`);
          inner = inner.replace(new RegExp(`\\$\\{${safeV}\\}`, 'g'), () => `$${idx}`);
          paramIndex++;
        }
        return `"${inner};"`;
      });
    } else if (line.includes('+')) {
      for (const v of varNames) {
        const idx = paramIndex;
        const safeV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${safeV}\\s*\\+\\s*['"]`, 'g'), () => `$${idx}`);
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${safeV}`, 'g'), () => `$${idx}"`);
        paramIndex++;
      }
      replaced = replaced.replace(/["']\s*;\s*$/, ';"');
    } else {
      replaced = `${line.replace(/;?$/, '')} /* parameterized */`;
    }

    const paramsList = varNames.length > 0 ? varNames.join(', ') : 'param1, param2';
    return `${replaced}\n// const rows = await db.query(query, [${paramsList}]);`;
  }

  // 8. EMPTY_CATCH_BLOCK
  if (rule.includes('CATCH')) {
    return isSql
      ? '-- Exception handling block'
      : '} catch (error) {\n  logger.error("Operation failed:", error);\n  throw error;\n}';
  }

  // 9. DOM_XSS (CWE-79) via innerHTML
  if (rule.includes('DOM_XSS') || rule.includes('INNERHTML')) {
    if (line.includes('.innerHTML')) {
      return line.replace(/\.innerHTML\s*=/, '.textContent =');
    }
    return '// Use element.textContent instead of innerHTML to prevent DOM XSS';
  }

  // 10. INSECURE_TARGET_BLANK
  if (rule.includes('TARGET_BLANK') || rule.includes('TABNABBING')) {
    if (/target\s*=\s*["']_blank["']/i.test(line)) {
      return line.replace(/(target\s*=\s*["']_blank["'])/i, '$1 rel="noopener noreferrer"');
    }
    return 'rel="noopener noreferrer"';
  }

  // 11. DEAD_CODE
  if (rule.includes('DEAD') || rule.includes('UNREACHABLE')) {
    return isSql ? '-- Removed unreachable statement' : '// Removed unreachable dead code';
  }

  // 12. UNHANDLED_ASYNC_PROMISE
  if (rule.includes('PROMISE') || rule.includes('ASYNC')) {
    if (line.includes('.then(')) {
      return line.replace(/(\.then\([^)]+\))/, '$1.catch(err => { logger.error("Async operation failed:", err); })');
    }
    return `${line}.catch(err => logger.error(err));`;
  }

  // 13. PARSER_ERROR
  if (rule.includes('PARSER') || rule.includes('SYNTAX')) {
    if (isSql) {
      return line ? `${line} -- Corrected SQL syntax token` : '-- Complete statement with valid SQL clause';
    }
    return line ? `${line} // Corrected syntax token` : '// Close block or statement';
  }

  if (isSql) {
    return line ? `${line.replace(/;?\s*$/, '')} -- Safe SQL query;` : '-- Refactored safe SQL query';
  }

  return '// Refactored safe code block';
}


/**
 * Resolve target programming language
 *
 * @param {string} filePath
 * @param {string} [explicitLanguage]
 * @returns {string} Normalized language identifier
 */
function resolveLanguage(filePath = '', explicitLanguage = '') {
  if (explicitLanguage && typeof explicitLanguage === 'string') {
    const raw = explicitLanguage.trim().toLowerCase();
    if (raw === 'js') return 'javascript';
    if (raw === 'ts') return 'typescript';
    if (raw === 'py') return 'python';
    if (raw === 'c++' || raw === 'cplusplus') return 'cpp';
    if (raw === 'sql') return 'sql';
    return raw;
  }

  const cleanPath = (filePath || '').toLowerCase();
  const ext = cleanPath.slice(cleanPath.lastIndexOf('.'));

  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.py':
      return 'python';
    case '.java':
      return 'java';
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.c':
    case '.h':
    case '.hpp':
      return 'cpp';
    case '.sql':
      return 'sql';
    case '.html':
    case '.htm':
      return 'html';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
    default:
      return 'javascript';
  }
}

/**
 * Helper to extract declared identifiers from variable declarations
 */
function getDeclaredIdentifiers(node) {
  const ids = [];
  function extract(n) {
    if (!n) return;
    if (n.type === 'Identifier') {
      ids.push(n);
    } else if (n.type === 'ObjectPattern') {
      for (const prop of n.properties) {
        if (prop.type === 'ObjectProperty') {
          extract(prop.value);
        } else if (prop.type === 'RestElement') {
          extract(prop.argument);
        }
      }
    } else if (n.type === 'ArrayPattern') {
      for (const elem of n.elements) {
        if (elem) {
          if (elem.type === 'RestElement') {
            extract(elem.argument);
          } else {
            extract(elem);
          }
        }
      }
    } else if (n.type === 'AssignmentPattern') {
      extract(n.left);
    }
  }
  extract(node);
  return ids;
}

/**
 * Helper to recursively inspect BinaryExpression trees for string + dynamic concatenation
 */
function inspectConcatNode(node) {
  let hasString = false;
  let hasDynamic = false;
  let hasSqlKeyword = false;

  function walk(n) {
    if (!n) return;
    if (n.type === 'StringLiteral' || (n.type === 'Literal' && typeof n.value === 'string')) {
      hasString = true;
      if (SQL_KEYWORD_REGEX.test(n.value)) {
        hasSqlKeyword = true;
      }
    } else if (n.type === 'TemplateLiteral') {
      hasString = true;
      const rawText = n.quasis.map((q) => q.value.raw).join(' ');
      if (SQL_KEYWORD_REGEX.test(rawText)) {
        hasSqlKeyword = true;
      }
      if (n.expressions && n.expressions.length > 0) {
        hasDynamic = true;
      }
    } else if (
      n.type === 'Identifier' ||
      n.type === 'MemberExpression' ||
      n.type === 'CallExpression'
    ) {
      hasDynamic = true;
    } else if (n.type === 'BinaryExpression' && n.operator === '+') {
      walk(n.left);
      walk(n.right);
    }
  }

  walk(node);
  return { hasString, hasDynamic, hasSqlKeyword };
}

/**
 * Check if a CallExpression targets a database query execution routine
 */
function isQueryCall(callee) {
  if (!callee) return false;

  // Direct function call: query(...), execute(...), rawQuery(...)
  if (callee.type === 'Identifier') {
    return QUERY_METHOD_REGEX.test(callee.name);
  }

  // Member call: db.query(...), pool.execute(...), sequelize.query(...)
  if (callee.type === 'MemberExpression') {
    const propName = callee.property && callee.property.type === 'Identifier' ? callee.property.name : '';
    const objName = callee.object && callee.object.type === 'Identifier' ? callee.object.name : '';

    if (QUERY_METHOD_REGEX.test(propName)) {
      return true;
    }

    if (QUERY_OBJECT_REGEX.test(objName) && /^(query|execute|raw|run|all|get)$/i.test(propName)) {
      return true;
    }
  }

  return false;
}

/**
 * Run JavaScript / TypeScript AST analysis via @babel/parser and @babel/traverse
 */
function analyzeJavaScriptAst(filePath, codeContent, language) {
  const codeLines = codeContent.split(/\r\n|\r|\n/);
  const isTypeScript = language === 'typescript' || filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  const plugins = [
    'jsx',
    'asyncDoExpressions',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'decorators-legacy',
    'doExpressions',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'functionBind',
    'functionSent',
    'importMeta',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    'topLevelAwait',
  ];

  if (isTypeScript) {
    plugins.push('typescript');
  }

  const rawFindings = [];
  const seenIssues = new Set();

  function addFinding({ line, column = 1, ruleId, severity, category, title, description, remediation, diff_before, diff_after }) {
    const dedupeKey = `${ruleId}:${line}`;
    if (seenIssues.has(dedupeKey)) return;
    seenIssues.add(dedupeKey);

    const rawEvidence = (codeLines[line - 1] || '').trim();
    const evidence = truncateSnippetLine(rawEvidence);
    const rawDiffBefore = diff_before || rawEvidence;
    const effectiveDiffBefore = truncateSnippetLine(rawDiffBefore);
    const rawDiffAfter = diff_after !== undefined ? diff_after : generateStaticRemediationDiff(ruleId, rawDiffBefore, language);
    const effectiveDiffAfter = truncateSnippetLine(rawDiffAfter);
    const effectiveRemediation =
      remediation && remediation !== description
        ? remediation
        : getRuleStepByStepRemediation(ruleId);

    const ruleDef = RULES[ruleId] || {};
    const cweId = ruleDef.cwe || ruleDef.cweId || null;

    rawFindings.push({
      file: filePath || '<anonymous>',
      line,
      column,
      lineNumber: line,
      severity,
      category,
      ruleId,
      cwe: cweId,
      cweId,
      title,
      description,
      remediation: effectiveRemediation,
      how: effectiveRemediation,
      how_to_fix: effectiveRemediation,
      evidence,
      diff_before: effectiveDiffBefore,
      diff_after: effectiveDiffAfter,
      source: 'STATIC',
    });
  }

  // 1. Run in-memory parser with errorRecovery enabled
  let ast = null;
  try {
    ast = parser.parse(codeContent, {
      sourceType: 'unambiguous',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      errorRecovery: true,
      plugins,
    });

    if (ast && Array.isArray(ast.errors) && ast.errors.length > 0) {
      for (const parseErr of ast.errors) {
        const errorLine = (parseErr.loc && parseErr.loc.line) || 1;
        const errorCol = (parseErr.loc && parseErr.loc.column) || 0;
        const evidence = (codeLines[errorLine - 1] || '').trim();
        addFinding({
          line: errorLine,
          column: errorCol,
          ruleId: RULES.PARSER_ERROR.ruleId,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          title: RULES.PARSER_ERROR.title,
          description: parseErr.message,
          remediation: formatParserErrorRemediation(parseErr, errorLine, evidence),
        });
      }
      // Stage 1 Guard: Halt further false vulnerability alerts on broken syntax
      return rawFindings.sort((a, b) => a.line - b.line);
    }
  } catch (err) {
    const errorLine = (err.loc && err.loc.line) || 1;
    const errorCol = (err.loc && err.loc.column) || 0;
    const evidence = (codeLines[errorLine - 1] || '').trim();

    addFinding({
      line: errorLine,
      column: errorCol,
      ruleId: RULES.PARSER_ERROR.ruleId,
      severity: RULES.PARSER_ERROR.severity,
      category: RULES.PARSER_ERROR.category,
      title: RULES.PARSER_ERROR.title,
      description: err.message,
      remediation: formatParserErrorRemediation(err, errorLine, evidence),
    });

    // Stage 1 Guard: Halt further false vulnerability alerts on fatal parser failure
    return rawFindings.sort((a, b) => a.line - b.line);
  }

  if (ast) {
    try {
      traverse(ast, {
        // Dead Code Detection (CWE-561) in BlockStatement
        BlockStatement(path) {
          const body = path.node.body;
          if (!Array.isArray(body)) return;
          for (let i = 0; i < body.length - 1; i++) {
            const stmt = body[i];
            if (
              stmt.type === 'ReturnStatement' ||
              stmt.type === 'ThrowStatement' ||
              stmt.type === 'BreakStatement' ||
              stmt.type === 'ContinueStatement'
            ) {
              const deadStmt = body[i + 1];
              if (deadStmt && deadStmt.loc) {
                addFinding({
                  line: deadStmt.loc.start.line,
                  ruleId: RULES.DEAD_CODE.ruleId,
                  severity: RULES.DEAD_CODE.severity,
                  category: RULES.DEAD_CODE.category,
                  title: RULES.DEAD_CODE.title,
                  description: `Unreachable code detected on line ${deadStmt.loc.start.line} following a '${stmt.type.replace('Statement', '').toLowerCase()}'. This statement will never execute (CWE-561).`,
                  remediation: 'Remove the unreachable dead code or restructure control flow before the return/throw statement.',
                  diff_before: (codeLines[deadStmt.loc.start.line - 1] || '').trim(),
                  diff_after: '// Removed unreachable dead code',
                });
                break;
              }
            }
          }
        },

        // A. SQL Injection, DOM XSS, Unhandled Promises, & Console Statements inside CallExpressions
        CallExpression(path) {
          if (isQueryCall(path.node.callee)) {
            for (const arg of path.node.arguments) {
              if (arg.type === 'BinaryExpression' && arg.operator === '+') {
                const { hasString, hasDynamic } = inspectConcatNode(arg);
                if (hasString && hasDynamic) {
                  addFinding({
                    line: (arg.loc && arg.loc.start.line) || path.node.loc.start.line,
                    ruleId: RULES.SQL_INJECTION.ruleId,
                    severity: RULES.SQL_INJECTION.severity,
                    category: RULES.SQL_INJECTION.category,
                    title: RULES.SQL_INJECTION.title,
                    description:
                      'Direct string concatenation with identifier detected inside SQL query execution call. Use parameterized queries or prepared statements.',
                  });
                }
              } else if (arg.type === 'TemplateLiteral' && arg.expressions && arg.expressions.length > 0) {
                addFinding({
                  line: (arg.loc && arg.loc.start.line) || path.node.loc.start.line,
                  ruleId: RULES.SQL_INJECTION.ruleId,
                  severity: RULES.SQL_INJECTION.severity,
                  category: RULES.SQL_INJECTION.category,
                  title: RULES.SQL_INJECTION.title,
                  description:
                    'Untagged template literal interpolation detected inside SQL query execution call. Use parameterized queries or prepared statements.',
                });
              }
            }
          }

          // Console.log detection
          const callee = path.node.callee;
          if (
            callee.type === 'MemberExpression' &&
            callee.object &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'console' &&
            callee.property &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'log'
          ) {
            addFinding({
              line: path.node.loc.start.line,
              ruleId: RULES.CONSOLE_LOG_STMT.ruleId,
              severity: RULES.CONSOLE_LOG_STMT.severity,
              category: RULES.CONSOLE_LOG_STMT.category,
              title: RULES.CONSOLE_LOG_STMT.title,
              description:
                'Direct console.log statement found in production code path. Use a structured logger instead.',
            });
          }

          // DOM XSS: document.write(...)
          if (
            callee.type === 'MemberExpression' &&
            callee.object &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'document' &&
            callee.property &&
            callee.property.type === 'Identifier' &&
            (callee.property.name === 'write' || callee.property.name === 'writeln')
          ) {
            addFinding({
              line: path.node.loc.start.line,
              ruleId: RULES.DOM_XSS.ruleId,
              severity: RULES.DOM_XSS.severity,
              category: RULES.DOM_XSS.category,
              title: 'DOM XSS via document.write() (CWE-79)',
              description:
                'Use of document.write() creates severe DOM-based Cross-Site Scripting (CWE-79) vulnerabilities. Use modern DOM manipulation methods like textContent or createElement.',
              diff_before: (codeLines[path.node.loc.start.line - 1] || '').trim(),
              diff_after: '// Use element.textContent or createElement',
            });
          }

          // Unhandled Promise Rejection (.then() without .catch())
          if (
            callee.type === 'MemberExpression' &&
            callee.property &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'then'
          ) {
            const parent = path.parent;
            const isChainedCatch =
              parent &&
              parent.type === 'MemberExpression' &&
              parent.property &&
              (parent.property.name === 'catch' || parent.property.name === 'finally' || parent.property.name === 'then');
            const isReturned = parent && (parent.type === 'ReturnStatement' || parent.type === 'ArrowFunctionExpression');
            const isAwaited = parent && parent.type === 'AwaitExpression';

            if (!isChainedCatch && !isReturned && !isAwaited) {
              if (path.node.arguments.length < 2) {
                addFinding({
                  line: path.node.loc.start.line,
                  ruleId: RULES.UNHANDLED_ASYNC_PROMISE.ruleId,
                  severity: RULES.UNHANDLED_ASYNC_PROMISE.severity,
                  category: RULES.UNHANDLED_ASYNC_PROMISE.category,
                  title: RULES.UNHANDLED_ASYNC_PROMISE.title,
                  description:
                    'Promise chain with .then() missing .catch() rejection handler. Unhandled promise rejections can cause silent failures or process crashes (CWE-391).',
                  remediation:
                    'Attach a .catch(err => ...) handler to the Promise chain or use async/await with a try/catch block.',
                });
              }
            }
          }
        },

    // B. Standalone SQL string concatenation (CWE-89)
    BinaryExpression(path) {
      if (path.node.operator === '+') {
        const { hasString, hasDynamic, hasSqlKeyword } = inspectConcatNode(path.node);
        if (hasString && hasDynamic && hasSqlKeyword) {
          addFinding({
            line: path.node.loc.start.line,
            ruleId: RULES.SQL_INJECTION.ruleId,
            severity: RULES.SQL_INJECTION.severity,
            category: RULES.SQL_INJECTION.category,
            title: RULES.SQL_INJECTION.title,
            description:
              'Dynamic SQL statement concatenation detected with variable/identifier. Use parameterized queries.',
          });
        }
      }
    },

    // C. Hardcoded Secrets (CWE-798) & Unused Variables (CWE-563)
    VariableDeclarator(path) {
      // 1. Hardcoded Secrets in variable declarations
      if (path.node.id && path.node.id.type === 'Identifier') {
        const varName = path.node.id.name;
        if (SECRET_ID_REGEX.test(varName) && path.node.init) {
          const init = path.node.init;
          let staticVal = null;

          if (init.type === 'StringLiteral' || (init.type === 'Literal' && typeof init.value === 'string')) {
            staticVal = init.value;
          } else if (init.type === 'TemplateLiteral' && init.expressions.length === 0 && init.quasis.length > 0) {
            staticVal = init.quasis[0].value.raw;
          }

          if (typeof staticVal === 'string' && staticVal.length > 8) {
            addFinding({
              line: path.node.loc.start.line,
              ruleId: RULES.HARDCODED_SECRET.ruleId,
              severity: RULES.HARDCODED_SECRET.severity,
              category: RULES.HARDCODED_SECRET.category,
              title: RULES.HARDCODED_SECRET.title,
              description: `Assignment to identifier '${varName}' matching /token|secret|jwt|api_key/i with static string literal (> 8 chars). Store sensitive credentials in environment variables.`,
            });
          }
        }
      }

      // 2. Unused Variable Detection
      const declaredIds = getDeclaredIdentifiers(path.node.id);
      for (const idNode of declaredIds) {
        const varName = idNode.name;
        // Ignore convention-based intentional unused variables (_req, _next)
        if (varName.startsWith('_')) continue;

        // Skip exported variables
        const parentDecl = path.parentPath;
        const grandParent = parentDecl && parentDecl.parentPath;
        if (grandParent && (grandParent.isExportNamedDeclaration() || grandParent.isExportDefaultDeclaration())) {
          continue;
        }

        const binding = path.scope.getBinding(varName);
        if (binding && binding.referenced === false) {
          addFinding({
            line: idNode.loc.start.line,
            ruleId: RULES.UNUSED_VARIABLE.ruleId,
            severity: RULES.UNUSED_VARIABLE.severity,
            category: RULES.UNUSED_VARIABLE.category,
            title: RULES.UNUSED_VARIABLE.title,
            description: `Variable '${varName}' is declared but never read or referenced.`,
          });
        }
      }
    },

    // Hardcoded Secrets & DOM XSS in AssignmentExpressions
    AssignmentExpression(path) {
      // DOM XSS: element.innerHTML or element.outerHTML
      if (
        path.node.left.type === 'MemberExpression' &&
        path.node.left.property &&
        (path.node.left.property.name === 'innerHTML' ||
          path.node.left.property.value === 'innerHTML' ||
          path.node.left.property.name === 'outerHTML' ||
          path.node.left.property.value === 'outerHTML')
      ) {
        addFinding({
          line: path.node.loc.start.line,
          ruleId: RULES.DOM_XSS.ruleId,
          severity: RULES.DOM_XSS.severity,
          category: RULES.DOM_XSS.category,
          title: RULES.DOM_XSS.title,
          description: `Direct assignment to element.${path.node.left.property.name || 'innerHTML'} creates a DOM-based Cross-Site Scripting (CWE-79) vulnerability. Use element.textContent or sanitize dynamic values.`,
        });
      }

      let identifierName = '';
      if (path.node.left.type === 'Identifier') {
        identifierName = path.node.left.name;
      } else if (
        path.node.left.type === 'MemberExpression' &&
        path.node.left.property &&
        path.node.left.property.type === 'Identifier'
      ) {
        identifierName = path.node.left.property.name;
      }

      if (identifierName && SECRET_ID_REGEX.test(identifierName) && path.node.right) {
        const right = path.node.right;
        let staticVal = null;
        if (right.type === 'StringLiteral' || (right.type === 'Literal' && typeof right.value === 'string')) {
          staticVal = right.value;
        } else if (right.type === 'TemplateLiteral' && right.expressions.length === 0 && right.quasis.length > 0) {
          staticVal = right.quasis[0].value.raw;
        }

        if (typeof staticVal === 'string' && staticVal.length > 8) {
          addFinding({
            line: path.node.loc.start.line,
            ruleId: RULES.HARDCODED_SECRET.ruleId,
            severity: RULES.HARDCODED_SECRET.severity,
            category: RULES.HARDCODED_SECRET.category,
            title: RULES.HARDCODED_SECRET.title,
            description: `Assignment to identifier '${identifierName}' matching /token|secret|jwt|api_key/i with static string literal (> 8 chars).`,
          });
        }
      }
    },

    // Hardcoded Secrets in Object Properties ({ apiKey: "..." })
    ObjectProperty(path) {
      let propName = '';
      if (path.node.key.type === 'Identifier') {
        propName = path.node.key.name;
      } else if (path.node.key.type === 'StringLiteral') {
        propName = path.node.key.value;
      }

      if (propName && SECRET_ID_REGEX.test(propName) && path.node.value) {
        const val = path.node.value;
        let staticVal = null;
        if (val.type === 'StringLiteral' || (val.type === 'Literal' && typeof val.value === 'string')) {
          staticVal = val.value;
        } else if (val.type === 'TemplateLiteral' && val.expressions.length === 0 && val.quasis.length > 0) {
          staticVal = val.quasis[0].value.raw;
        }

        if (typeof staticVal === 'string' && staticVal.length > 8) {
          addFinding({
            line: path.node.loc.start.line,
            ruleId: RULES.HARDCODED_SECRET.ruleId,
            severity: RULES.HARDCODED_SECRET.severity,
            category: RULES.HARDCODED_SECRET.category,
            title: RULES.HARDCODED_SECRET.title,
            description: `Hardcoded credential assigned to property '${propName}' (> 8 chars).`,
          });
        }
      }
    },

    // D. Empty Catch Blocks (CWE-390)
    CatchClause(path) {
      if (
        path.node.body &&
        path.node.body.type === 'BlockStatement' &&
        Array.isArray(path.node.body.body) &&
        path.node.body.body.length === 0
      ) {
        addFinding({
          line: path.node.loc.start.line,
          ruleId: RULES.EMPTY_CATCH_BLOCK.ruleId,
          severity: RULES.EMPTY_CATCH_BLOCK.severity,
          category: RULES.EMPTY_CATCH_BLOCK.category,
          title: RULES.EMPTY_CATCH_BLOCK.title,
          description: 'Empty catch block detected. Unhandled exceptions should be logged, handled, or rethrown.',
        });
      }
    },

    // E. JSX XSS: dangerouslySetInnerHTML
    JSXAttribute(path) {
      if (path.node.name && path.node.name.name === 'dangerouslySetInnerHTML') {
        addFinding({
          line: path.node.loc.start.line,
          ruleId: RULES.DOM_XSS.ruleId,
          severity: RULES.DOM_XSS.severity,
          category: RULES.DOM_XSS.category,
          title: 'DOM XSS via dangerouslySetInnerHTML (CWE-79)',
          description:
            'Direct use of dangerouslySetInnerHTML bypasses React XSS protections. Ensure dynamic HTML is sanitized with DOMPurify before insertion.',
          remediation:
            'Sanitize dynamic HTML content using DOMPurify.sanitize(...) before passing to dangerouslySetInnerHTML.',
        });
      }
    },

    // F. High-Entropy Cloud Credentials & Private Keys
    StringLiteral(path) {
      const val = path.node.value;
      if (typeof val === 'string' && val.length >= 16) {
        if (/\b(AKIA[0-9A-Z]{16})\b/.test(val)) {
          addFinding({
            line: path.node.loc.start.line,
            ruleId: RULES.HARDCODED_SECRET.ruleId,
            severity: RULES.HARDCODED_SECRET.severity,
            category: RULES.HARDCODED_SECRET.category,
            title: 'Hardcoded AWS Access Key ID (CWE-798)',
            description:
              'Hardcoded AWS Access Key ID detected. Store cloud credentials in secure environment variables or IAM roles.',
          });
        } else if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(val)) {
          addFinding({
            line: path.node.loc.start.line,
            ruleId: RULES.HARDCODED_SECRET.ruleId,
            severity: RULES.HARDCODED_SECRET.severity,
            category: RULES.HARDCODED_SECRET.category,
            title: 'Hardcoded Private Cryptographic Key (CWE-798)',
            description:
              'Private cryptographic key embedded directly in source code. Load private keys securely from environment variables or a key vault.',
          });
        }
      }
    },
  });
} catch {
  // Ignore AST traversal errors on partially broken syntax
}
}

  return rawFindings.sort((a, b) => a.line - b.line);
}

/**
 * Fallback static scanner for Python, Java, and C++ source code
 */
function analyzeNonJsSource(filePath, codeContent, language) {
  const codeLines = codeContent.split(/\r\n|\r|\n/);
  const findings = [];
  const seenIssues = new Set();

  function addFinding({ line, ruleId, severity, category, title, description, remediation, diff_before, diff_after }) {
    const dedupeKey = `${ruleId}:${line}`;
    if (seenIssues.has(dedupeKey)) return;
    seenIssues.add(dedupeKey);

    const rawEvidence = (codeLines[line - 1] || '').trim();
    const evidence = truncateSnippetLine(rawEvidence);
    const rawDiffBefore = diff_before || rawEvidence;
    const effectiveDiffBefore = truncateSnippetLine(rawDiffBefore);
    const rawDiffAfter = diff_after !== undefined ? diff_after : generateStaticRemediationDiff(ruleId, rawDiffBefore, language);
    const effectiveDiffAfter = truncateSnippetLine(rawDiffAfter);
    const effectiveRemediation =
      remediation && remediation !== description
        ? remediation
        : getRuleStepByStepRemediation(ruleId);

    findings.push({
      file: filePath || '<anonymous>',
      line,
      column: 1,
      lineNumber: line,
      severity,
      category,
      ruleId,
      title,
      description,
      remediation: effectiveRemediation,
      how: effectiveRemediation,
      how_to_fix: effectiveRemediation,
      evidence,
      diff_before: effectiveDiffBefore,
      diff_after: effectiveDiffAfter,
      source: 'STATIC',
    });
  }

  // Syntax tracking variables for incomplete code edge cases
  let openBraces = 0;
  let closeBraces = 0;
  let firstUnclosedBraceLine = 0;
  let openParens = 0;
  let closeParens = 0;
  let firstUnclosedParenLine = 0;
  let inPythonTripleQuote = false;
  let tripleQuoteStartLine = 0;

  for (let i = 0; i < codeLines.length; i++) {
    const lineNum = i + 1;
    const line = codeLines[i];
    const trimmed = line.trim();

    // Track Python triple quotes multiline strings
    if (language === 'python') {
      const doubleTripleCount = (line.match(/"""/g) || []).length;
      const singleTripleCount = (line.match(/'''/g) || []).length;
      if ((doubleTripleCount % 2 !== 0) || (singleTripleCount % 2 !== 0)) {
        if (!inPythonTripleQuote) {
          inPythonTripleQuote = true;
          tripleQuoteStartLine = lineNum;
        } else {
          inPythonTripleQuote = false;
        }
      }
    }

    // Ignore comment lines for security rules
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('--')
    ) {
      continue;
    }

    // Syntax check for Java & C++: Count braces
    if (language === 'java' || language === 'cpp') {
      for (const char of line) {
        if (char === '{') {
          openBraces++;
          if (firstUnclosedBraceLine === 0) firstUnclosedBraceLine = lineNum;
        } else if (char === '}') {
          closeBraces++;
          if (closeBraces > openBraces && findings.length === 0) {
            addFinding({
              line: lineNum,
              ruleId: RULES.PARSER_ERROR.ruleId,
              severity: RULES.PARSER_ERROR.severity,
              category: RULES.PARSER_ERROR.category,
              title: RULES.PARSER_ERROR.title,
              description: "Syntax error: Unexpected closing brace '}' without matching opening brace.",
            });
          }
        } else if (char === '(') {
          openParens++;
          if (firstUnclosedParenLine === 0) firstUnclosedParenLine = lineNum;
        } else if (char === ')') {
          closeParens++;
        }
      }
    }

    // Syntax check for SQL: Count parentheses
    if (language === 'sql') {
      for (const char of line) {
        if (char === '(') {
          openParens++;
          if (firstUnclosedParenLine === 0) firstUnclosedParenLine = lineNum;
        } else if (char === ')') {
          closeParens++;
        }
      }
    }

    // Syntax check for Python: Unclosed if/def/for/while/class at EOF or without indented body
    if (language === 'python' && !inPythonTripleQuote) {
      if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b.*:\s*$/.test(trimmed)) {
        // Find next non-empty line
        let nextIdx = i + 1;
        while (nextIdx < codeLines.length && codeLines[nextIdx].trim() === '') {
          nextIdx++;
        }
        if (nextIdx >= codeLines.length) {
          addFinding({
            line: lineNum,
            ruleId: RULES.PARSER_ERROR.ruleId,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            title: RULES.PARSER_ERROR.title,
            description: `Syntax error: Incomplete '${trimmed.split(' ')[0]}' statement at end of file (unexpected EOF).`,
          });
        } else {
          const currentIndent = line.search(/\S|$/);
          const nextIndent = codeLines[nextIdx].search(/\S|$/);
          if (nextIndent <= currentIndent) {
            addFinding({
              line: lineNum,
              ruleId: RULES.PARSER_ERROR.ruleId,
              severity: RULES.PARSER_ERROR.severity,
              category: RULES.PARSER_ERROR.category,
              title: RULES.PARSER_ERROR.title,
              description: `Syntax error: Expected an indented block after '${trimmed}' statement.`,
            });
          }
        }
      }
    }

    // 1. Hardcoded Secrets: identifier matching /token|secret|jwt|api_?key/i = "..." (> 8 chars)
    const secretMatch = trimmed.match(
      /\b([a-zA-Z0-9_]*(?:token|secret|jwt|api_?key)[a-zA-Z0-9_]*)\s*[:=]\s*["']([^"']{9,})["']/i
    );
    if (secretMatch) {
      const varName = secretMatch[1];
      addFinding({
        line: lineNum,
        ruleId: RULES.HARDCODED_SECRET.ruleId,
        severity: RULES.HARDCODED_SECRET.severity,
        category: RULES.HARDCODED_SECRET.category,
        title: RULES.HARDCODED_SECRET.title,
        description: `Hardcoded credential assigned to '${varName}' (> 8 chars).`,
      });
    }

    // 2. SQL Injection: execute/query calls with string concatenation or dynamic parameter concatenation
    if (language === 'sql') {
      const hasDynamicConcat =
        ((/\bEXECUTE\b/i.test(trimmed) || /\bEXEC\b/i.test(trimmed)) && (trimmed.includes('||') || trimmed.includes('+'))) ||
        /(?:['"][^'"]*['"]\s*(?:\+|\|\|)\s*@[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+\s*(?:\+|\|\|)\s*['"][^'"]*['"])/i.test(trimmed) ||
        /(?:['"][^'"]*['"]\s*(?:\+|\|\|)\s*:[a-zA-Z0-9_]+|:[a-zA-Z0-9_]+\s*(?:\+|\|\|)\s*['"][^'"]*['"])/i.test(trimmed) ||
        (/\b(WHERE|SELECT|SET|HAVING|VALUES)\b/i.test(trimmed) && /['"][^'"]*['"]\s*(?:\+|\|\|)\s*[@:a-zA-Z0-9_]+/i.test(trimmed));

      if (hasDynamicConcat) {
        addFinding({
          line: lineNum,
          ruleId: RULES.SQL_INJECTION.ruleId,
          severity: 'HIGH',
          category: 'SECURITY',
          title: 'Dynamic SQL String Concatenation Vulnerability (CWE-89)',
          description: 'Dynamic string concatenation detected in SQL query (e.g., concatenating with @dynamicInput). Concatenating parameters into SQL statements introduces severe SQL injection vulnerabilities (CWE-89). Suggest using parameterized inputs instead.',
        });
      }
    } else if (
      /\b(execute|query|rawQuery|executeQuery|executeUpdate)\s*\(/i.test(trimmed) &&
      SQL_KEYWORD_REGEX.test(trimmed) &&
      trimmed.includes('+')
    ) {
      addFinding({
        line: lineNum,
        ruleId: RULES.SQL_INJECTION.ruleId,
        severity: RULES.SQL_INJECTION.severity,
        category: RULES.SQL_INJECTION.category,
        title: RULES.SQL_INJECTION.title,
        description: 'Direct string concatenation detected inside SQL query execution call.',
      });
    }

    // 2b. SQL Performance & Mutation Hazards (SQL-specific)
    if (language === 'sql') {
      // Unindexed leading wildcard check
      if (/\bLIKE\s+['"]%[^'"]+['"]/i.test(trimmed)) {
        addFinding({
          line: lineNum,
          ruleId: 'SQL_LEADING_WILDCARD',
          severity: 'LOW',
          category: 'OPTIMIZATION',
          title: 'Full Table Scan via Leading Wildcard in LIKE Clause',
          description: 'LIKE search pattern starts with a wildcard (e.g., "%Smith%"). Standard B-Tree indexes cannot index leading wildcards, resulting in expensive full table scans. Consider trigram indexing (pg_trgm) or full-text search.',
        });
      }

      // Unrestricted DELETE / UPDATE (missing WHERE clause)
      if (/^(UPDATE|DELETE\s+FROM|DELETE)\b/i.test(trimmed)) {
        let statement = trimmed;
        let hasWhere = /\bWHERE\b/i.test(trimmed);
        let k = i + 1;
        while (!hasWhere && !statement.includes(';') && k < codeLines.length) {
          const nextLine = codeLines[k].trim();
          if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(nextLine)) break;
          statement += ' ' + nextLine;
          if (/\bWHERE\b/i.test(nextLine)) {
            hasWhere = true;
            break;
          }
          if (nextLine.includes(';')) break;
          k++;
        }
        if (!hasWhere) {
          addFinding({
            line: lineNum,
            ruleId: 'UNRESTRICTED_MUTATION',
            severity: 'HIGH',
            category: 'SECURITY',
            title: 'Unrestricted Mutation Statement (Missing WHERE Clause)',
            description: 'UPDATE or DELETE statement executed without a WHERE clause will modify or delete every row in the target table. Always provide a selective WHERE clause (e.g. WHERE id = :target_id).',
          });
        }
      }

      // Implicit comma joins without join conditions (Cartesian product check)
      const fromMatch = trimmed.match(/\bFROM\s+([^;]+?)(?:\s+\bWHERE\b|\s+\bGROUP\b|\s+\bORDER\b|\s+\bLIMIT\b|\s+\bHAVING\b|;|$)/i);
      if (fromMatch) {
        const fromClause = fromMatch[1].trim();
        // Check if fromClause contains comma-separated tables (excluding functions/subqueries)
        if (!fromClause.includes('(')) {
          const tables = fromClause.split(',').map((s) => s.trim()).filter(Boolean);
          if (tables.length > 1) {
            // Check if entire statement or line has join equality conditions (e.g. o.customer_id = c.id)
            let fullStmt = trimmed;
            let m = i + 1;
            while (!fullStmt.includes(';') && m < codeLines.length) {
              const nextLine = codeLines[m].trim();
              if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(nextLine)) break;
              fullStmt += ' ' + nextLine;
              if (nextLine.includes(';')) break;
              m++;
            }
            const joinMatches =
              fullStmt.match(/[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\s*=\s*[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/gi) || [];
            if (joinMatches.length < tables.length - 1) {
              addFinding({
                line: lineNum,
                ruleId: 'IMPLICIT_CARTESIAN_JOIN',
                severity: 'HIGH',
                category: 'OPTIMIZATION',
                title: 'Unintended Cartesian Product via Implicit Comma Join',
                description: 'Implicit comma join detected in FROM clause without join conditions (e.g., FROM orders o, customers c, products p). This produces an unintended Cartesian product (cross-multiplication of all rows), causing severe database memory exhaustion and exponential query degradation. Use explicit ANSI INNER JOIN ... ON syntax.',
              });
            }
          }
        }
      }
    }

    // 3. Empty catch / except blocks
    if (
      /^except(\s+[^:]*)?:\s*pass$/i.test(trimmed) ||
      /^catch\s*\([^)]*\)\s*\{\s*\}$/i.test(trimmed)
    ) {
      addFinding({
        line: lineNum,
        ruleId: RULES.EMPTY_CATCH_BLOCK.ruleId,
        severity: RULES.EMPTY_CATCH_BLOCK.severity,
        category: RULES.EMPTY_CATCH_BLOCK.category,
        title: RULES.EMPTY_CATCH_BLOCK.title,
        description: 'Empty exception handler detected. Exceptions should be handled, logged, or rethrown.',
      });
    } else if (/^except(\s+[^:]*)?:/i.test(trimmed)) {
      // Check next non-empty line for 'pass' or '...'
      let j = i + 1;
      while (j < codeLines.length && codeLines[j].trim() === '') j++;
      if (j < codeLines.length && /^(pass|\.\.\.)\b/i.test(codeLines[j].trim())) {
        addFinding({
          line: lineNum,
          ruleId: RULES.EMPTY_CATCH_BLOCK.ruleId,
          severity: RULES.EMPTY_CATCH_BLOCK.severity,
          category: RULES.EMPTY_CATCH_BLOCK.category,
          title: RULES.EMPTY_CATCH_BLOCK.title,
          description: 'Empty exception handler detected. Exceptions should be handled, logged, or rethrown.',
        });
      }
    }

    // 4. Console log / print left in code
    if (language === 'python' && /^print\s*\(/.test(trimmed)) {
      addFinding({
        line: lineNum,
        ruleId: RULES.CONSOLE_LOG_STMT.ruleId,
        severity: RULES.CONSOLE_LOG_STMT.severity,
        category: RULES.CONSOLE_LOG_STMT.category,
        title: 'Print Statement Left in Code',
        description: 'Direct print() statement found in source code. Use standard logging module.',
      });
    } else if (
      (language === 'java' && /System\.out\.print/i.test(trimmed)) ||
      (language === 'cpp' && /std::cout/i.test(trimmed))
    ) {
      addFinding({
        line: lineNum,
        ruleId: RULES.CONSOLE_LOG_STMT.ruleId,
        severity: RULES.CONSOLE_LOG_STMT.severity,
        category: RULES.CONSOLE_LOG_STMT.category,
        title: RULES.CONSOLE_LOG_STMT.title,
        description: 'Standard output logging statement left in source code.',
      });
    }
  }

  // Final EOF syntax validations
  if ((language === 'java' || language === 'cpp') && openBraces > closeBraces) {
    addFinding({
      line: firstUnclosedBraceLine || codeLines.length,
      ruleId: RULES.PARSER_ERROR.ruleId,
      severity: RULES.PARSER_ERROR.severity,
      category: RULES.PARSER_ERROR.category,
      title: RULES.PARSER_ERROR.title,
      description: `Syntax error: Missing closing brace '}' (${openBraces - closeBraces} unclosed block(s) at unexpected EOF).`,
    });
  }

  if (language === 'python' && inPythonTripleQuote) {
    addFinding({
      line: tripleQuoteStartLine || codeLines.length,
      ruleId: RULES.PARSER_ERROR.ruleId,
      severity: RULES.PARSER_ERROR.severity,
      category: RULES.PARSER_ERROR.category,
      title: RULES.PARSER_ERROR.title,
      description: 'Syntax error: Unclosed multiline string literal (unexpected EOF).',
    });
  }

  if (language === 'sql' && openParens > closeParens) {
    addFinding({
      line: firstUnclosedParenLine || codeLines.length,
      ruleId: RULES.PARSER_ERROR.ruleId,
      severity: RULES.PARSER_ERROR.severity,
      category: RULES.PARSER_ERROR.category,
      title: RULES.PARSER_ERROR.title,
      description: `Syntax error: Missing closing parenthesis ')' (${openParens - closeParens} unclosed parenthesis at unexpected EOF).`,
    });
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Analyze HTML files for script vulnerabilities, reverse tabnabbing, and insecure markup
 */
function analyzeHtmlSource(filePath, codeContent) {
  const codeLines = (codeContent || '').split(/\r\n|\r|\n/);
  const findings = [];

  const addFinding = (item) => {
    const rule = RULES[item.ruleId] || {};
    findings.push({
      file: filePath,
      line: item.line || 1,
      severity: item.severity || rule.severity || 'MEDIUM',
      category: item.category || rule.category || 'SECURITY',
      ruleId: item.ruleId || 'HTML_SECURITY',
      title: item.title || rule.title || 'HTML Security Flaw',
      description: item.description,
      evidence: codeLines[item.line - 1] || '',
      source: 'STATIC',
    });
  };

  // 1. Line-by-line checks for insecure markup
  for (let i = 0; i < codeLines.length; i++) {
    const line = codeLines[i];
    const lineNum = i + 1;

    // Check target="_blank" without rel="noopener"
    if (/target\s*=\s*["']_blank["']/i.test(line) && !/rel\s*=\s*["'][^"']*(noopener|noreferrer)[^"']*["']/i.test(line)) {
      addFinding({
        line: lineNum,
        ruleId: RULES.INSECURE_TARGET_BLANK.ruleId,
        severity: RULES.INSECURE_TARGET_BLANK.severity,
        category: RULES.INSECURE_TARGET_BLANK.category,
        title: RULES.INSECURE_TARGET_BLANK.title,
        description: 'External link opens in new tab (target="_blank") without rel="noopener noreferrer". This exposes the page to reverse tabnabbing and window.opener hijacking.',
      });
    }
  }

  // 2. Extract and analyze embedded <script> tags
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(codeContent)) !== null) {
    const scriptBody = match[1];
    if (scriptBody && scriptBody.trim().length > 0) {
      const precedingText = codeContent.substring(0, match.index);
      const startLine = precedingText.split(/\r\n|\r|\n/).length;

      try {
        const scriptFindings = analyzeJavaScriptAst(filePath, scriptBody, 'javascript');
        for (const sf of scriptFindings) {
          findings.push({
            ...sf,
            line: (startLine + sf.line - 1),
            evidence: codeLines[(startLine + sf.line - 2)] || sf.evidence,
          });
        }
      } catch {
        // Ignore syntax issues in partial inline templates
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line);
}

/**
 * Stage 1 (Syntax & Parsing Guard):
 * Validates syntax against the designated language before running deep scans.
 * If syntax fails (e.g. pure SQL submitted under a JavaScript file or broken syntax),
 * outputs precise syntax diagnostics (line number, column, token error) and halts further false vulnerability alerts.
 *
 * @param {string} filePath - Target filename or path
 * @param {string} codeContent - Raw source code
 * @param {string} [language] - Declared language
 * @returns {{ isValid: boolean, syntaxFindings: Array<Object> }}
 */
function _validateSyntaxGuardCore(filePath = '', codeContent = '', language = '') {
  if (typeof codeContent !== 'string' || codeContent.trim().length === 0) {
    return { isValid: true, syntaxFindings: [] };
  }

  const resolvedLang = resolveLanguage(filePath, language);
  const codeLines = codeContent.split(/\r\n|\r|\n/);

  // 1. JavaScript & TypeScript Syntax & Language Guard via @babel/parser
  if (resolvedLang === 'javascript' || resolvedLang === 'typescript') {
    const isTypeScript = resolvedLang === 'typescript' || filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const plugins = [
      'jsx',
      'asyncDoExpressions',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'decorators-legacy',
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      'topLevelAwait',
    ];
    if (isTypeScript) plugins.push('typescript');

    try {
      const ast = parser.parse(codeContent, {
        sourceType: 'unambiguous',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        allowSuperOutsideMethod: true,
        allowUndeclaredExports: true,
        errorRecovery: true,
        plugins,
      });

      if (ast && Array.isArray(ast.errors) && ast.errors.length > 0) {
        const parseErr = ast.errors[0];
        const errorLine = (parseErr.loc && parseErr.loc.line) || 1;
        const errorCol = (parseErr.loc && parseErr.loc.column) || 0;
        const rawEvidence = (codeLines[errorLine - 1] || '').trim();
        const evidence = truncateSnippetLine(rawEvidence);

        let desc = parseErr.message;
        let remediation = formatParserErrorRemediation(parseErr, errorLine, rawEvidence);

        if (
          SQL_KEYWORD_REGEX.test(rawEvidence) ||
          /^(SELECT|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(codeLines[0].trim())
        ) {
          desc = `${parseErr.message} (Language mismatch: Raw SQL statements submitted under JavaScript/TypeScript file).`;
          remediation = `Language Mismatch: The submitted code appears to be SQL rather than ${resolvedLang}. Please select 'SQL (.sql)' in the language selector before scanning.`;
        } else if (/^\s*(def|class|import|from|elif)\b/.test(rawEvidence)) {
          desc = `${parseErr.message} (Language mismatch: Python statements submitted under JavaScript/TypeScript file).`;
          remediation = `Language Mismatch: The submitted code appears to be Python rather than ${resolvedLang}. Please select 'Python (.py)' in the language selector before scanning.`;
        }

        return {
          isValid: false,
          syntaxFindings: [{
            file: filePath || '<anonymous>',
            line: errorLine,
            column: errorCol,
            lineNumber: errorLine,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            ruleId: RULES.PARSER_ERROR.ruleId,
            title: RULES.PARSER_ERROR.title,
            description: desc,
            remediation,
            how: remediation,
            how_to_fix: remediation,
            evidence,
            diff_before: evidence,
            diff_after: evidence ? `${evidence} // Correct syntax token` : '// Close block or statement',
            source: 'STATIC',
            engine_source: 'STATIC',
            engine: 'Static AST',
          }],
        };
      }
    } catch (err) {
      const errorLine = (err.loc && err.loc.line) || 1;
      const errorCol = (err.loc && err.loc.column) || 0;
      const rawEvidence = (codeLines[errorLine - 1] || '').trim();
      const evidence = truncateSnippetLine(rawEvidence);

      let desc = err.message;
      let remediation = formatParserErrorRemediation(err, errorLine, rawEvidence);

      if (
        SQL_KEYWORD_REGEX.test(rawEvidence) ||
        /^(SELECT|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(codeLines[0].trim())
      ) {
        desc = `${err.message} (Language mismatch: Raw SQL statements submitted under JavaScript/TypeScript file).`;
        remediation = `Language Mismatch: The submitted code appears to be SQL rather than ${resolvedLang}. Please select 'SQL (.sql)' in the language selector before scanning.`;
      } else if (/^\s*(def|class|import|from|elif)\b/.test(rawEvidence)) {
        desc = `${err.message} (Language mismatch: Python statements submitted under JavaScript/TypeScript file).`;
        remediation = `Language Mismatch: The submitted code appears to be Python rather than ${resolvedLang}. Please select 'Python (.py)' in the language selector before scanning.`;
      }

      return {
        isValid: false,
        syntaxFindings: [{
          file: filePath || '<anonymous>',
          line: errorLine,
          column: errorCol,
          lineNumber: errorLine,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          ruleId: RULES.PARSER_ERROR.ruleId,
          title: RULES.PARSER_ERROR.title,
          description: desc,
          remediation,
          how: remediation,
          how_to_fix: remediation,
          evidence,
          diff_before: evidence,
          diff_after: evidence ? `${evidence} // Correct syntax token` : '// Close block or statement',
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        }],
      };
    }

    return { isValid: true, syntaxFindings: [] };
  }

  // 2. Python Syntax & Language Guard
  if (resolvedLang === 'python') {
    for (let i = 0; i < Math.min(10, codeLines.length); i++) {
      const trimmed = codeLines[i].trim();
      if (/^(function\s+[a-zA-Z0-9_$]+|const\s+[a-zA-Z0-9_$]+|let\s+[a-zA-Z0-9_$]+|var\s+[a-zA-Z0-9_$]+|console\.log)\b/.test(trimmed)) {
        return {
          isValid: false,
          syntaxFindings: [{
            file: filePath || '<anonymous>',
            line: i + 1,
            column: 1,
            lineNumber: i + 1,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            ruleId: RULES.PARSER_ERROR.ruleId,
            title: RULES.PARSER_ERROR.title,
            description: `Syntax error: Unexpected token '${trimmed.split(' ')[0]}' on line ${i + 1}. JavaScript code detected in a Python file.`,
            remediation: "Language Mismatch: The submitted code appears to be JavaScript rather than Python. Please select 'JavaScript' in the language selector.",
            how: "Language Mismatch: The submitted code appears to be JavaScript rather than Python. Please select 'JavaScript' in the language selector.",
            how_to_fix: "Language Mismatch: The submitted code appears to be JavaScript rather than Python. Please select 'JavaScript' in the language selector.",
            evidence: trimmed,
            diff_before: trimmed,
            diff_after: '# Select JavaScript in language dropdown',
            source: 'STATIC',
            engine_source: 'STATIC',
            engine: 'Static AST',
          }],
        };
      }
      if (/^(SELECT|CREATE TABLE|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(trimmed)) {
        return {
          isValid: false,
          syntaxFindings: [{
            file: filePath || '<anonymous>',
            line: i + 1,
            column: 1,
            lineNumber: i + 1,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            ruleId: RULES.PARSER_ERROR.ruleId,
            title: RULES.PARSER_ERROR.title,
            description: `Syntax error: Unexpected token '${trimmed.split(' ')[0]}' on line ${i + 1}. SQL code detected in a Python file.`,
            remediation: "Language Mismatch: The submitted code appears to be SQL rather than Python. Please select 'SQL (.sql)' in the language selector.",
            how: "Language Mismatch: The submitted code appears to be SQL rather than Python. Please select 'SQL (.sql)' in the language selector.",
            how_to_fix: "Language Mismatch: The submitted code appears to be SQL rather than Python. Please select 'SQL (.sql)' in the language selector.",
            evidence: trimmed,
            diff_before: trimmed,
            diff_after: '# Select SQL in language dropdown',
            source: 'STATIC',
            engine_source: 'STATIC',
            engine: 'Static AST',
          }],
        };
      }
    }

    let inTripleQuote = false;
    let tripleQuoteLine = 1;
    let openParens = 0;
    let firstUnclosedParen = 0;

    for (let i = 0; i < codeLines.length; i++) {
      const lineNum = i + 1;
      const line = codeLines[i];
      const trimmed = line.trim();

      const doubleTripleCount = (line.match(/"""/g) || []).length;
      const singleTripleCount = (line.match(/'''/g) || []).length;
      if ((doubleTripleCount % 2 !== 0) || (singleTripleCount % 2 !== 0)) {
        if (!inTripleQuote) {
          inTripleQuote = true;
          tripleQuoteLine = lineNum;
        } else {
          inTripleQuote = false;
        }
      }

      if (!inTripleQuote) {
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '(') {
            openParens++;
            if (firstUnclosedParen === 0) firstUnclosedParen = lineNum;
          } else if (char === ')') {
            openParens--;
            if (openParens < 0) {
              return {
                isValid: false,
                syntaxFindings: [{
                  file: filePath || '<anonymous>',
                  line: lineNum,
                  column: c + 1,
                  lineNumber: lineNum,
                  severity: RULES.PARSER_ERROR.severity,
                  category: RULES.PARSER_ERROR.category,
                  ruleId: RULES.PARSER_ERROR.ruleId,
                  title: RULES.PARSER_ERROR.title,
                  description: "Syntax error: Unexpected closing parenthesis ')' without matching opening parenthesis.",
                  remediation: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis. Remove the extra ')' or ensure opening '(' is present.`,
                  how: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis.`,
                  how_to_fix: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis.`,
                  evidence: trimmed,
                  diff_before: trimmed,
                  diff_after: trimmed.replace(/\)/, ''),
                  source: 'STATIC',
                  engine_source: 'STATIC',
                  engine: 'Static AST',
                }],
              };
            }
          }
        }

        if (/^(if|elif|else|for|while|def|class|try|except|finally|with)\b.*:\s*$/.test(trimmed)) {
          let nextIdx = i + 1;
          while (nextIdx < codeLines.length && codeLines[nextIdx].trim() === '') nextIdx++;
          if (nextIdx >= codeLines.length) {
            return {
              isValid: false,
              syntaxFindings: [{
                file: filePath || '<anonymous>',
                line: lineNum,
                column: 1,
                lineNumber: lineNum,
                severity: RULES.PARSER_ERROR.severity,
                category: RULES.PARSER_ERROR.category,
                ruleId: RULES.PARSER_ERROR.ruleId,
                title: RULES.PARSER_ERROR.title,
                description: `Syntax error: Incomplete '${trimmed.split(' ')[0]}' statement at end of file (unexpected EOF).`,
                remediation: `Syntax Error: Line ${lineNum} requires an indented body. Add implementation code or 'pass'.`,
                how: `Syntax Error: Line ${lineNum} requires an indented body.`,
                how_to_fix: `Syntax Error: Line ${lineNum} requires an indented body.`,
                evidence: trimmed,
                diff_before: trimmed,
                diff_after: `${trimmed}\n    pass`,
                source: 'STATIC',
                engine_source: 'STATIC',
                engine: 'Static AST',
              }],
            };
          } else {
            const currentIndent = line.search(/\S|$/);
            const nextIndent = codeLines[nextIdx].search(/\S|$/);
            if (nextIndent <= currentIndent) {
              return {
                isValid: false,
                syntaxFindings: [{
                  file: filePath || '<anonymous>',
                  line: lineNum,
                  column: 1,
                  lineNumber: lineNum,
                  severity: RULES.PARSER_ERROR.severity,
                  category: RULES.PARSER_ERROR.category,
                  ruleId: RULES.PARSER_ERROR.ruleId,
                  title: RULES.PARSER_ERROR.title,
                  description: `Syntax error: Expected an indented block after '${trimmed}' statement.`,
                  remediation: `Syntax Error: Indent the block following line ${lineNum} by 4 spaces.`,
                  how: `Syntax Error: Indent the block following line ${lineNum}.`,
                  how_to_fix: `Syntax Error: Indent the block following line ${lineNum}.`,
                  evidence: trimmed,
                  diff_before: trimmed,
                  diff_after: `${trimmed}\n    # body`,
                  source: 'STATIC',
                  engine_source: 'STATIC',
                  engine: 'Static AST',
                }],
              };
            }
          }
        }
      }
    }

    if (inTripleQuote) {
      return {
        isValid: false,
        syntaxFindings: [{
          file: filePath || '<anonymous>',
          line: tripleQuoteLine,
          column: 1,
          lineNumber: tripleQuoteLine,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          ruleId: RULES.PARSER_ERROR.ruleId,
          title: RULES.PARSER_ERROR.title,
          description: 'Syntax error: Unclosed multiline string literal (unexpected EOF).',
          remediation: `Syntax Error: Line ${tripleQuoteLine} starts a multiline string that is never closed. Add matching triple quotes before EOF.`,
          how: `Syntax Error: Close multiline string started at line ${tripleQuoteLine}.`,
          how_to_fix: `Syntax Error: Close multiline string started at line ${tripleQuoteLine}.`,
          evidence: (codeLines[tripleQuoteLine - 1] || '').trim(),
          diff_before: (codeLines[tripleQuoteLine - 1] || '').trim(),
          diff_after: '""" """',
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        }],
      };
    }

    if (openParens > 0) {
      return {
        isValid: false,
        syntaxFindings: [{
          file: filePath || '<anonymous>',
          line: firstUnclosedParen,
          column: 1,
          lineNumber: firstUnclosedParen,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          ruleId: RULES.PARSER_ERROR.ruleId,
          title: RULES.PARSER_ERROR.title,
          description: `Syntax error: Missing closing parenthesis ')' (${openParens} unclosed parenthesis at unexpected EOF).`,
          remediation: `Syntax Error: Line ${firstUnclosedParen} has an unclosed parenthesis. Add matching ')' to close expression.`,
          how: `Syntax Error: Close parenthesis from line ${firstUnclosedParen}.`,
          how_to_fix: `Syntax Error: Close parenthesis from line ${firstUnclosedParen}.`,
          evidence: (codeLines[firstUnclosedParen - 1] || '').trim(),
          diff_before: (codeLines[firstUnclosedParen - 1] || '').trim(),
          diff_after: `${(codeLines[firstUnclosedParen - 1] || '').trim()})`,
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        }],
      };
    }

    return { isValid: true, syntaxFindings: [] };
  }

  // 3. SQL Syntax & Language Guard
  if (resolvedLang === 'sql') {
    for (let i = 0; i < Math.min(10, codeLines.length); i++) {
      const trimmed = codeLines[i].trim();
      if (/^(function\s+[a-zA-Z0-9_$]+|const\s+[a-zA-Z0-9_$]+|let\s+[a-zA-Z0-9_$]+|var\s+[a-zA-Z0-9_$]+|console\.log)\b/.test(trimmed)) {
        return {
          isValid: false,
          syntaxFindings: [{
            file: filePath || '<anonymous>',
            line: i + 1,
            column: 1,
            lineNumber: i + 1,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            ruleId: RULES.PARSER_ERROR.ruleId,
            title: RULES.PARSER_ERROR.title,
            description: `Syntax error: Unexpected token '${trimmed.split(' ')[0]}' on line ${i + 1}. JavaScript code detected in a SQL file.`,
            remediation: "Language Mismatch: The submitted code appears to be JavaScript rather than SQL. Please select 'JavaScript' in the language selector.",
            how: "Language Mismatch: The submitted code appears to be JavaScript rather than SQL. Please select 'JavaScript' in the language selector.",
            how_to_fix: "Language Mismatch: The submitted code appears to be JavaScript rather than SQL. Please select 'JavaScript' in the language selector.",
            evidence: trimmed,
            diff_before: trimmed,
            diff_after: '-- Select JavaScript in language dropdown',
            source: 'STATIC',
            engine_source: 'STATIC',
            engine: 'Static AST',
          }],
        };
      }
      if (/^(def\s+[a-zA-Z0-9_$]+|import\s+[a-zA-Z0-9_$]+|from\s+[a-zA-Z0-9_$]+\s+import)\b/.test(trimmed)) {
        return {
          isValid: false,
          syntaxFindings: [{
            file: filePath || '<anonymous>',
            line: i + 1,
            column: 1,
            lineNumber: i + 1,
            severity: RULES.PARSER_ERROR.severity,
            category: RULES.PARSER_ERROR.category,
            ruleId: RULES.PARSER_ERROR.ruleId,
            title: RULES.PARSER_ERROR.title,
            description: `Syntax error: Unexpected token '${trimmed.split(' ')[0]}' on line ${i + 1}. Python code detected in a SQL file.`,
            remediation: "Language Mismatch: The submitted code appears to be Python rather than SQL. Please select 'Python (.py)' in the language selector.",
            how: "Language Mismatch: The submitted code appears to be Python rather than SQL. Please select 'Python (.py)' in the language selector.",
            how_to_fix: "Language Mismatch: The submitted code appears to be Python rather than SQL. Please select 'Python (.py)' in the language selector.",
            evidence: trimmed,
            diff_before: trimmed,
            diff_after: '-- Select Python in language dropdown',
            source: 'STATIC',
            engine_source: 'STATIC',
            engine: 'Static AST',
          }],
        };
      }
    }

    let openParens = 0;
    let firstUnclosedParen = 0;
    for (let i = 0; i < codeLines.length; i++) {
      const lineNum = i + 1;
      const line = codeLines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '(') {
          openParens++;
          if (firstUnclosedParen === 0) firstUnclosedParen = lineNum;
        } else if (char === ')') {
          openParens--;
          if (openParens < 0) {
            return {
              isValid: false,
              syntaxFindings: [{
                file: filePath || '<anonymous>',
                line: lineNum,
                column: c + 1,
                lineNumber: lineNum,
                severity: RULES.PARSER_ERROR.severity,
                category: RULES.PARSER_ERROR.category,
                ruleId: RULES.PARSER_ERROR.ruleId,
                title: RULES.PARSER_ERROR.title,
                description: "Syntax error: Unexpected closing parenthesis ')' without matching opening parenthesis.",
                remediation: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis. Remove the extra ')' or ensure opening '(' is present.`,
                how: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis.`,
                how_to_fix: `Syntax Error: Line ${lineNum} has an unmatched closing parenthesis.`,
                evidence: trimmed,
                diff_before: trimmed,
                diff_after: trimmed.replace(/\)/, ''),
                source: 'STATIC',
                engine_source: 'STATIC',
                engine: 'Static AST',
              }],
            };
          }
        }
      }
    }

    if (openParens > 0) {
      return {
        isValid: false,
        syntaxFindings: [{
          file: filePath || '<anonymous>',
          line: firstUnclosedParen,
          column: 1,
          lineNumber: firstUnclosedParen,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          ruleId: RULES.PARSER_ERROR.ruleId,
          title: RULES.PARSER_ERROR.title,
          description: `Syntax error: Missing closing parenthesis ')' (${openParens} unclosed parenthesis at unexpected EOF).`,
          remediation: `Syntax Error: Line ${firstUnclosedParen} has an unclosed parenthesis. Add matching ')' to close expression.`,
          how: `Syntax Error: Close parenthesis from line ${firstUnclosedParen}.`,
          how_to_fix: `Syntax Error: Close parenthesis from line ${firstUnclosedParen}.`,
          evidence: (codeLines[firstUnclosedParen - 1] || '').trim(),
          diff_before: (codeLines[firstUnclosedParen - 1] || '').trim(),
          diff_after: `${(codeLines[firstUnclosedParen - 1] || '').trim()});`,
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        }],
      };
    }

    return { isValid: true, syntaxFindings: [] };
  }

  // 4. Java & C++ Syntax & Language Guard
  if (resolvedLang === 'java' || resolvedLang === 'cpp') {
    let openBraces = 0;
    let firstUnclosedBrace = 0;
    let openParens = 0;

    for (let i = 0; i < codeLines.length; i++) {
      const lineNum = i + 1;
      const line = codeLines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '{') {
          openBraces++;
          if (firstUnclosedBrace === 0) firstUnclosedBrace = lineNum;
        } else if (char === '}') {
          openBraces--;
          if (openBraces < 0) {
            return {
              isValid: false,
              syntaxFindings: [{
                file: filePath || '<anonymous>',
                line: lineNum,
                column: c + 1,
                lineNumber: lineNum,
                severity: RULES.PARSER_ERROR.severity,
                category: RULES.PARSER_ERROR.category,
                ruleId: RULES.PARSER_ERROR.ruleId,
                title: RULES.PARSER_ERROR.title,
                description: "Syntax error: Unexpected closing brace '}' without matching opening brace.",
                remediation: `Syntax Error: Line ${lineNum} has an unmatched closing brace '}'. Remove the extra '}' or ensure opening '{' is present.`,
                how: `Syntax Error: Line ${lineNum} has an unmatched closing brace.`,
                how_to_fix: `Syntax Error: Line ${lineNum} has an unmatched closing brace.`,
                evidence: trimmed,
                diff_before: trimmed,
                diff_after: trimmed.replace(/\}/, ''),
                source: 'STATIC',
                engine_source: 'STATIC',
                engine: 'Static AST',
              }],
            };
          }
        } else if (char === '(') {
          openParens++;
        } else if (char === ')') {
          openParens--;
        }
      }
    }

    if (openBraces > 0) {
      return {
        isValid: false,
        syntaxFindings: [{
          file: filePath || '<anonymous>',
          line: firstUnclosedBrace || codeLines.length,
          column: 1,
          lineNumber: firstUnclosedBrace || codeLines.length,
          severity: RULES.PARSER_ERROR.severity,
          category: RULES.PARSER_ERROR.category,
          ruleId: RULES.PARSER_ERROR.ruleId,
          title: RULES.PARSER_ERROR.title,
          description: `Syntax error: Missing closing brace '}' (${openBraces} unclosed block(s) at unexpected EOF).`,
          remediation: `Syntax Error: Code block starting near line ${firstUnclosedBrace} was not closed. Add '}' before end of file.`,
          how: `Syntax Error: Add closing brace '}' before EOF.`,
          how_to_fix: `Syntax Error: Add closing brace '}' before EOF.`,
          evidence: (codeLines[firstUnclosedBrace - 1] || '').trim(),
          diff_before: (codeLines[firstUnclosedBrace - 1] || '').trim(),
          diff_after: `${(codeLines[firstUnclosedBrace - 1] || '').trim()}\n}`,
          source: 'STATIC',
          engine_source: 'STATIC',
          engine: 'Static AST',
        }],
      };
    }

    return { isValid: true, syntaxFindings: [] };
  }

  return { isValid: true, syntaxFindings: [] };
}

/**
 * Validate syntax guard wrapper ensuring backwards-compatible properties
 * (isValid, hasError, syntaxFindings, diagnostic)
 */
function validateSyntaxGuard(filePath = '', codeContent = '', language = '') {
  const result = _validateSyntaxGuardCore(filePath, codeContent, language);
  const syntaxFindings = result.syntaxFindings || [];
  return {
    ...result,
    isValid: result.isValid,
    hasError: !result.isValid,
    syntaxFindings,
    diagnostic: syntaxFindings.length > 0 ? syntaxFindings[0] : null,
  };
}

/**
 * Main Static AST Code Analyzer
 *
 * @param {string} filePath - Path or filename of target source file
 * @param {string} codeContent - Raw source code content
 * @param {string} [language] - Optional explicit language identifier
 * @returns {Array<{ file: string, line: number, severity: string, category: string, ruleId: string, title: string, description: string, evidence: string, source: 'STATIC' }>}
 */
function analyzeFile(filePath, codeContent, language) {
  if (typeof codeContent !== 'string') {
    return [];
  }

  if (codeContent.trim().length === 0) {
    return [];
  }

  // STAGE 1: Syntax & Parsing Guard
  const syntaxCheck = validateSyntaxGuard(filePath, codeContent, language);
  if (!syntaxCheck.isValid) {
    // Stage 1 Guard: Halt further false vulnerability alerts on broken syntax
    return syntaxCheck.syntaxFindings;
  }

  // STAGE 2: Static Deterministic Rules (AST & regex analysis)
  const resolvedLang = resolveLanguage(filePath, language);

  if (resolvedLang === 'javascript' || resolvedLang === 'typescript') {
    return analyzeJavaScriptAst(filePath, codeContent, resolvedLang);
  }

  if (resolvedLang === 'html') {
    return analyzeHtmlSource(filePath, codeContent);
  }

  return analyzeNonJsSource(filePath, codeContent, resolvedLang);
}

/**
 * Batch analysis helper for multiple files
 *
 * @param {Array<{ path: string, content: string, language?: string }>} fileList
 * @returns {Array<Object>} Combined flat findings array
 */
function analyzeFiles(fileList) {
  if (!Array.isArray(fileList)) return [];

  const allFindings = [];
  for (const file of fileList) {
    const findings = analyzeFile(file.path || file.filePath, file.content, file.language);
    allFindings.push(...findings);
  }
  return allFindings;
}

module.exports = {
  RULES,
  resolveLanguage,
  validateSyntaxGuard,
  analyzeFile,
  analyzeFiles,
  analyzeJavaScriptAst,
  generateStaticRemediationDiff,
};
