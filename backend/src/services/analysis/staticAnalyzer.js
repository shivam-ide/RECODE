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

  // 1. UNUSED_VARIABLE
  if (rule.includes('UNUSED')) {
    return '// Removed unused variable';
  }

  // 2. HARDCODED_SECRET (CWE-798)
  if (rule.includes('SECRET') || rule.includes('CREDENTIAL') || rule.includes('KEY')) {
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

  // 3. CONSOLE_LOG_STMT / CONSOLE_LOG_STATEMENT
  if (rule.includes('CONSOLE') || rule.includes('LOG')) {
    return '// logger.info(...) or remove before production';
  }

  // 4. SQL_INJECTION (CWE-89)
  if (rule.includes('SQL')) {
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
        replaced = replaced.replace(new RegExp(`['"]?\\{${v}\\}['"]?`, 'g'), '%s');
        paramCount++;
      }
      if (paramCount === 0) {
        replaced = replaced.replace(/\+\s*[a-zA-Z0-9_$.]+/g, '%s');
      }
      const tupleVars = varNames.length === 1 ? `(${varNames[0]},)` : `(${varNames.join(', ')})`;
      return `${replaced}\n# cursor.execute(query, ${tupleVars})`;
    }

    if (language === 'java' || language === 'cpp') {
      let replaced = line;
      for (const v of varNames) {
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${v}\\s*\\+\\s*['"]`, 'g'), '?');
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${v}`, 'g'), '?"');
        replaced = replaced.replace(new RegExp(`\\+\\s*std::to_string\\(${v}\\)`, 'g'), '?"');
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
          inner = inner.replace(new RegExp(`'\\s*\\$\\{${v}\\}\\s*'`, 'g'), `$${paramIndex}`);
          inner = inner.replace(new RegExp(`\\$\\{${v}\\}`, 'g'), `$${paramIndex}`);
          paramIndex++;
        }
        return `"${inner};"`;
      });
    } else if (line.includes('+')) {
      for (const v of varNames) {
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${v}\\s*\\+\\s*['"]`, 'g'), `$${paramIndex}`);
        replaced = replaced.replace(new RegExp(`['"]\\s*\\+\\s*${v}`, 'g'), `$${paramIndex}"`);
        paramIndex++;
      }
      replaced = replaced.replace(/["']\s*;\s*$/, ';"');
    } else {
      replaced = `${line.replace(/;?$/, '')} /* parameterized */`;
    }

    const paramsList = varNames.length > 0 ? varNames.join(', ') : 'param1, param2';
    return `${replaced}\n// const rows = await db.query(query, [${paramsList}]);`;
  }

  // 5. EMPTY_CATCH_BLOCK
  if (rule.includes('CATCH')) {
    return '} catch (error) {\n  logger.error("Operation failed:", error);\n  throw error;\n}';
  }

  // 6. DOM_XSS (CWE-79) via innerHTML
  if (rule.includes('DOM_XSS') || rule.includes('INNERHTML')) {
    if (line.includes('.innerHTML')) {
      return line.replace(/\.innerHTML\s*=/, '.textContent =');
    }
    return '// Use element.textContent instead of innerHTML to prevent DOM XSS';
  }

  // 7. INSECURE_TARGET_BLANK
  if (rule.includes('TARGET_BLANK') || rule.includes('TABNABBING')) {
    if (/target\s*=\s*["']_blank["']/i.test(line)) {
      return line.replace(/(target\s*=\s*["']_blank["'])/i, '$1 rel="noopener noreferrer"');
    }
    return 'rel="noopener noreferrer"';
  }

  // 8. PARSER_ERROR
  if (rule.includes('PARSER') || rule.includes('SYNTAX')) {
    return line ? `${line} // Corrected syntax token` : '// Close block or statement';
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

    rawFindings.push({
      file: filePath || '<anonymous>',
      line,
      column,
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

    // Scan remaining code lines for critical security vulnerabilities (SQLi & Hardcoded Secrets)
    // ensuring security defects are caught even when code has syntax failures
    for (let i = 0; i < codeLines.length; i++) {
      const lineNum = i + 1;
      const line = codeLines[i];
      const trimmed = line.trim();

      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*')
      ) {
        continue;
      }

      // 1. Hardcoded Secrets (CWE-798)
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
          description: `Hardcoded credential assigned to '${varName}' (> 8 chars). Store sensitive credentials in environment variables.`,
          remediation: `Remove hardcoded credential '${varName}'. Retrieve this secret securely from environment variables.`,
        });
      }

      // 2. SQL Injection (CWE-89)
      if (
        (SQL_KEYWORD_REGEX.test(trimmed) && trimmed.includes('+')) ||
        (/\b(execute|query|rawQuery|queryRaw)\s*\(/i.test(trimmed) && trimmed.includes('+'))
      ) {
        if (SQL_KEYWORD_REGEX.test(trimmed)) {
          addFinding({
            line: lineNum,
            ruleId: RULES.SQL_INJECTION.ruleId,
            severity: RULES.SQL_INJECTION.severity,
            category: RULES.SQL_INJECTION.category,
            title: RULES.SQL_INJECTION.title,
            description: 'Direct string concatenation detected in SQL query statement (CWE-89).',
            remediation: 'Use parameterized queries or prepared statements ($1, $2 or ?) to prevent SQL injection vulnerabilities.',
          });
        }
      }
    }
  }

  if (ast) {
    try {
      traverse(ast, {
        // A. SQL Injection inside query execution calls & BinaryExpressions
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
      // DOM XSS: element.innerHTML = ...
      if (
        path.node.left.type === 'MemberExpression' &&
        path.node.left.property &&
        (path.node.left.property.name === 'innerHTML' || path.node.left.property.value === 'innerHTML')
      ) {
        addFinding({
          line: path.node.loc.start.line,
          ruleId: RULES.DOM_XSS.ruleId,
          severity: RULES.DOM_XSS.severity,
          category: RULES.DOM_XSS.category,
          title: RULES.DOM_XSS.title,
          description: 'Direct assignment to element.innerHTML creates a DOM-based Cross-Site Scripting (CWE-79) vulnerability. Use element.textContent or sanitize dynamic values.',
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
      trimmed.startsWith('*')
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

    // 2. SQL Injection: execute/query calls with string concatenation
    if (
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
  analyzeFile,
  analyzeFiles,
  generateStaticRemediationDiff,
};
