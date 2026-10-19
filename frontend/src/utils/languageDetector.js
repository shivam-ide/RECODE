/**
 * Re:Code — Automatic Programming Language Detection Heuristic
 *
 * Evaluates syntax signatures and weighted language markers for:
 * - SQL (.sql)
 * - Python (.py)
 * - C++ (.cpp)
 * - Java (.java)
 * - TypeScript (.ts)
 * - JavaScript (.js)
 *
 * @param {string} source - Raw code string
 * @returns {string} Detected language id ('sql' | 'python' | 'cpp' | 'java' | 'typescript' | 'javascript')
 */
export function detectCodeLanguage(source) {
  if (!source || typeof source !== 'string' || !source.trim()) {
    return 'javascript';
  }

  const clean = source.trim();

  const scores = {
    sql: 0,
    python: 0,
    cpp: 0,
    java: 0,
    typescript: 0,
    javascript: 0,
  };

  // 1. SQL HEURISTICS
  if (/--(?:[^\r\n]*)/.test(clean)) scores.sql += 4;
  if (/\b(select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from)\b/i.test(clean)) scores.sql += 10;
  if (/\b(create\s+table|alter\s+table|drop\s+table|create\s+(?:or\s+replace\s+)?procedure|create\s+view)\b/i.test(clean)) scores.sql += 10;
  if (/\b(where|group\s+by|order\s+by|having|inner\s+join|left\s+join|right\s+join|outer\s+join|cross\s+join)\b/i.test(clean)) scores.sql += 5;
  if (/\b(varchar|varchar2|plpgsql|refcursor|numeric|serial|primary\s+key|foreign\s+key)\b/i.test(clean)) scores.sql += 6;
  if (/\b(begin\s+.*\s+end;|execute\s+v_|raise\s+notice)\b/i.test(clean)) scores.sql += 6;
  if (/\bselect\b/i.test(clean) && /\bfrom\b/i.test(clean)) scores.sql += 5;
  if (/;\s*$/.test(clean) && !/[{}]/.test(clean) && /\b(from|where|into)\b/i.test(clean)) scores.sql += 4;

  // 2. PYTHON HEURISTICS
  if (/(?:^|\n)\s*def\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*:/m.test(clean)) scores.python += 12;
  if (/(?:^|\n)\s*class\s+[a-zA-Z0-9_]+(?:\([^)]*\))?\s*:/m.test(clean)) scores.python += 8;
  if (/(?:^|\n)\s*elif\s+/m.test(clean)) scores.python += 8;
  if (/(?:^|\n)\s*import\s+[a-zA-Z0-9_.]+|from\s+[a-zA-Z0-9_.]+\s+import/m.test(clean)) scores.python += 6;
  if (/\bprint\s*\(/i.test(clean) && !clean.includes('System.out') && !clean.includes('console.')) scores.python += 4;
  if (/\bself\.[a-zA-Z0-9_]+/i.test(clean)) scores.python += 6;
  if (/\b__init__\b|\b__name__\s*==\s*['"]__main__['"]/.test(clean)) scores.python += 10;
  if (/#(?!\s*include)[^\r\n]*/.test(clean) && !clean.includes('#include')) scores.python += 4;
  if (!clean.includes('{') && !clean.includes('}') && /(?:def|class|if|for|while)\s+.*:/m.test(clean)) scores.python += 6;

  // 3. C++ HEURISTICS
  if (/#include\s*<[a-zA-Z0-9_.]+>|#include\s*"[a-zA-Z0-9_.]+"/.test(clean)) scores.cpp += 15;
  if (/\bstd::(?:cout|cin|endl|vector|string|map|set|unique_ptr|shared_ptr|make_unique)\b/.test(clean)) scores.cpp += 12;
  if (/\busing\s+namespace\s+std\s*;/.test(clean)) scores.cpp += 12;
  if (/\bcout\s*<<|\bcin\s*>>/.test(clean)) scores.cpp += 10;
  if (/\btemplate\s*<\s*typename\b|\btemplate\s*<\s*class\b/.test(clean)) scores.cpp += 10;
  if (/\bint\s+main\s*\([^)]*\)\s*\{/.test(clean) && !clean.includes('System.out')) scores.cpp += 8;
  if (/\bnullptr\b/.test(clean)) scores.cpp += 4;

  // 4. JAVA HEURISTICS
  if (/\bpublic\s+(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\b/.test(clean)) scores.java += 10;
  if (/\bSystem\.(?:out|err)\.print(?:ln)?\s*\(/.test(clean)) scores.java += 14;
  if (/\bpublic\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*[a-zA-Z0-9_]+\s*\)/.test(clean)) scores.java += 14;
  if (/\bpackage\s+[a-zA-Z0-9_.]+\s*;/.test(clean)) scores.java += 8;
  if (/\bimport\s+java\.[a-zA-Z0-9_.*]+\s*;|\bimport\s+javax\.[a-zA-Z0-9_.*]+\s*;/.test(clean)) scores.java += 10;
  if (/@(?:Override|Autowired|Service|Component|Controller|Entity|Table)\b/.test(clean)) scores.java += 8;
  if (/\bthrows\s+[A-Z][a-zA-Z0-9]+Exception\b|\bthrows\s+SQLException\b/.test(clean)) scores.java += 8;
  if (/\b(?:String|Integer|Double|Boolean|List<|Map<|Set<|ArrayList<)\b/.test(clean) && !clean.includes('std::')) scores.java += 4;

  // 5. TYPESCRIPT HEURISTICS
  if (/\binterface\s+[A-Z][a-zA-Z0-9_]*\s*(?:extends\s+[A-Za-z0-9_,\s]+)?\{/.test(clean)) scores.typescript += 12;
  if (/\btype\s+[A-Z][a-zA-Z0-9_]*\s*=\s*/.test(clean)) scores.typescript += 10;
  if (/(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*:\s*(?:string|number|boolean|any|void|unknown|never|Record<|Array<|[A-Z][a-zA-Z0-9_]*)/.test(clean)) scores.typescript += 10;
  if (/\)\s*:\s*(?:string|number|boolean|void|any|Promise<[A-Za-z0-9_]+>|[A-Z][a-zA-Z0-9_]*)\s*(?:=>|\{)/.test(clean)) scores.typescript += 10;
  if (/\bas\s+(?:const|string|number|any|unknown)\b/.test(clean)) scores.typescript += 6;
  if (/\b(?:enum|namespace)\s+[A-Z][a-zA-Z0-9_]*/.test(clean)) scores.typescript += 6;
  if (/<[A-Z][a-zA-Z0-9_]*>\s*\(/.test(clean)) scores.typescript += 4;

  // 6. JAVASCRIPT HEURISTICS
  if (/\bconst\s+[a-zA-Z0-9_$]+\s*=\s*require\s*\(/.test(clean)) scores.javascript += 8;
  if (/\bmodule\.exports\s*=|\bexports\.[a-zA-Z0-9_$]+\s*=/.test(clean)) scores.javascript += 8;
  if (/\bconsole\.(?:log|error|warn|info|debug)\s*\(/.test(clean)) scores.javascript += 4;
  if (/\bdocument\.(?:getElementById|querySelector|createElement)\b/.test(clean)) scores.javascript += 6;
  if (/\bwindow\.[a-zA-Z0-9_$]+/.test(clean)) scores.javascript += 4;
  if (/\b(?:const|let|var)\s+[a-zA-Z0-9_$]+\s*=/.test(clean)) scores.javascript += 2;
  if (/\bfunction\s+[a-zA-Z0-9_$]*\s*\(/.test(clean)) scores.javascript += 2;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sorted[0];

  if (topScore >= 4) {
    return topLang;
  }

  if (scores.typescript > scores.javascript && scores.typescript > 0) {
    return 'typescript';
  }

  return 'javascript';
}
