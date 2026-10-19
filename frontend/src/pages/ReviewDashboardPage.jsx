import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Sparkles,
  ArrowLeft,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  Copy,
  Zap,
  Download,
  FileText,
  Code2,
  User,
  Clock,
  X,
} from 'lucide-react';
import Footer from '../components/common/Footer';
import BrandLogo from '../components/common/BrandLogo';
import { DiffViewer, UserSessionPill } from '../components/common';
import { GUEST_SESSION_STORAGE_KEY } from '../services/supabaseAuth';
import { useAuth } from '../services/useAuth';

import { API_BASE_URL } from '../config/api';
import { formatIstTimestamp } from '../utils/dateFormatter';

/**
 * Format raw compiler messages into human-readable remediation text for syntax error cards
 */
function formatSyntaxRemediationText(raw, lineNum) {
  if (!raw) {
    return `Line ${lineNum} has an unclosed condition or parenthesis. Close the condition with ')' before opening the code block.`;
  }
  if (/expected\s*['"]?\)/i.test(raw) || /unexpected token.*expected\s*\)/i.test(raw)) {
    return `Line ${lineNum} has an unclosed condition or parenthesis. Close the condition with ')' before opening the code block.`;
  }
  if (/expected\s*['"]?\}/i.test(raw) || /missing.*closing brace/i.test(raw)) {
    return `Line ${lineNum} has an unclosed code block. Add a closing brace '}' to properly terminate the block.`;
  }
  return raw;
}

/**
 * Robust client-side contextual diff generator
 * Ensures no issue EVER displays an irrelevant SQL query
 */
function getIssueDiff(issue, activeFile) {
  const truncateLine = (l) => (l && l.length > 150 ? l.slice(0, 120) + '...' : l);
  const cleanSnippet = (str) => (str ? str.split('\n').map(truncateLine).join('\n') : '');
  const wrap = (res) => ({ diffBefore: cleanSnippet(res.diffBefore), diffAfter: cleanSnippet(res.diffAfter) });

  const lineNum = issue.line_number || issue.line || 1;
  const ruleId = (issue.rule_id || issue.ruleId || '').toUpperCase();
  const title = (issue.title || '').toLowerCase();
  const desc = (issue.description || '').toLowerCase();

  const isSql = ruleId.includes('SQL') || title.includes('sql') || desc.includes('sql') || (issue.cwe || '').includes('89');
  const hasGenericSqlDiff = (issue.diff_after || '').includes('SELECT * FROM students WHERE campus = $1');

  // If issue has valid diff_before and diff_after and it's not the generic SQL query on non-SQL issue
  if (issue.diff_before && issue.diff_after && (!hasGenericSqlDiff || isSql)) {
    return wrap({
      diffBefore: issue.diff_before,
      diffAfter: issue.diff_after,
    });
  }

  // Find line content from activeFile if available
  let sourceLine = issue.diff_before || issue.evidence || '';
  if (!sourceLine && activeFile?.content) {
    const lines = activeFile.content.split('\n');
    if (lines[lineNum - 1]) {
      sourceLine = lines[lineNum - 1].trim();
    }
  }

  // 1. UNUSED_VARIABLE
  if (ruleId.includes('UNUSED') || title.includes('unused') || desc.includes('unused')) {
    const varMatch = (sourceLine || '').match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)/);
    const varName = varMatch ? varMatch[1] : (issue.evidence || 'unusedVar');
    return wrap({
      diffBefore: sourceLine || `const ${varName} = require('some-module');`,
      diffAfter: `// Removed unused variable '${varName}'`,
    });
  }

  // 2. HARDCODED_SECRET (CWE-798)
  if (
    ruleId.includes('SECRET') ||
    ruleId.includes('PASSWORD') ||
    ruleId.includes('CWE-798') ||
    title.includes('secret') ||
    title.includes('token') ||
    desc.includes('secret') ||
    desc.includes('jwt') ||
    title.includes('jwt')
  ) {
    const varMatch = (sourceLine || '').match(/(?:const|let|var)\s+([A-Za-z0-9_$]+)/);
    const varName = varMatch ? varMatch[1] : 'JWT_SECRET';
    return wrap({
      diffBefore: sourceLine || `const ${varName} = "shhh_jwt_secret_dev_key";`,
      diffAfter: `const ${varName} = process.env.${varName} || (() => { throw new Error("${varName} missing in .env"); })();`,
    });
  }

  // 3. CONSOLE_LOG_STATEMENT
  if (ruleId.includes('CONSOLE') || ruleId.includes('LOG') || title.includes('console.log') || desc.includes('console.log')) {
    return wrap({
      diffBefore: sourceLine || `console.log("Debug payload:", req.body);`,
      diffAfter: `// logger.info("Debug payload:", req.body) or remove before production`,
    });
  }

  // 4. SQL_INJECTION (CWE-89)
  if (isSql) {
    if (sourceLine && (sourceLine.includes('||') || sourceLine.includes('EXECUTE') || sourceLine.toLowerCase().includes('select'))) {
      return wrap({
        diffBefore: sourceLine,
        diffAfter: `-- Use parameterized queries or bind variables instead of dynamic concatenation:\n-- e.g. EXECUTE 'SELECT ... WHERE id = $1' USING p_param;`,
      });
    }
    const varMatches = (sourceLine || '').match(/[A-Za-z0-9_]+(?=\s*\+)|req\.(?:query|body|params)\.[A-Za-z0-9_]+/g) || ['campusId', 'gradeThreshold'];
    const placeholders = varMatches.map((_, i) => `$${i + 1}`).join(' AND ');
    const params = varMatches.join(', ');
    return wrap({
      diffBefore: sourceLine || `const query = "SELECT * FROM students WHERE campus = '" + campusId + "' AND gpa >= " + gradeThreshold;`,
      diffAfter: `const query = "SELECT * FROM students WHERE campus = $1 AND gpa >= $2;";\nconst rows = await pool.query(query, [${params}]);`,
    });
  }

  // 4b. SQL_LEADING_WILDCARD / Table Scan Bottleneck
  if (ruleId.includes('WILDCARD') || title.includes('wildcard') || desc.includes('wildcard')) {
    return wrap({
      diffBefore: sourceLine || `WHERE name LIKE '%term%';`,
      diffAfter: `-- Remove leading wildcard to enable index usage, or utilize full-text search indexes:\nWHERE name LIKE 'term%';`,
    });
  }

  // 4c. UNCONSTRAINED_MUTATION (DELETE/UPDATE without WHERE)
  if (ruleId.includes('UNCONSTRAINED') || ruleId.includes('MUTATION') || title.includes('unconstrained') || desc.includes('unconstrained')) {
    return wrap({
      diffBefore: sourceLine || `DELETE FROM audit_logs;`,
      diffAfter: `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';`,
    });
  }

  // 5. EMPTY_CATCH_BLOCK
  if (ruleId.includes('EMPTY_CATCH') || title.includes('empty catch') || desc.includes('empty catch')) {
    return wrap({
      diffBefore: sourceLine || `} catch (err) {}`,
      diffAfter: `} catch (err) {\n  logger.error("Operation failed", { error: err.message });\n  throw err;\n}`,
    });
  }

  // 5b. DEAD_CODE (CWE-561)
  if (ruleId.includes('DEAD') || title.includes('dead') || desc.includes('dead') || title.includes('unreachable') || desc.includes('unreachable')) {
    return wrap({
      diffBefore: sourceLine || `  const deadStatement = true;`,
      diffAfter: `// Removed unreachable dead code`,
    });
  }

  // 5c. UNHANDLED_ASYNC_PROMISE (CWE-391)
  if (ruleId.includes('PROMISE') || ruleId.includes('ASYNC') || title.includes('promise') || desc.includes('promise')) {
    return wrap({
      diffBefore: sourceLine || `fetchData().then(res => res.json());`,
      diffAfter: sourceLine
        ? `${sourceLine.replace(/;?\s*$/, '')}.catch(err => console.error("Unhandled promise error:", err));`
        : `fetchData().then(res => res.json()).catch(err => console.error("Unhandled promise error:", err));`,
    });
  }

  // 5d. DOM_XSS (CWE-79)
  if (ruleId.includes('DOM_XSS') || title.includes('xss') || desc.includes('xss') || title.includes('innerhtml') || desc.includes('innerhtml')) {
    const textFix = sourceLine ? sourceLine.replace(/innerHTML/g, 'textContent').replace(/outerHTML/g, 'textContent') : `element.textContent = safeUserInput;`;
    return wrap({
      diffBefore: sourceLine || `element.innerHTML = userInput;`,
      diffAfter: textFix,
    });
  }

  // 6. PARSER_ERROR / SYNTAX
  if (ruleId.includes('PARSER') || ruleId.includes('SYNTAX') || title.includes('syntax') || desc.includes('syntax')) {
    return wrap({
      diffBefore: sourceLine || `// Incomplete code block at line ${lineNum}`,
      diffAfter: sourceLine ? `${sourceLine} // Fix syntax or add closing delimiter` : `// Resolved syntax error at line ${lineNum}`,
    });
  }

  // 7. General fallback
  return wrap({
    diffBefore: sourceLine || issue.diff_before || `// Code issue at line ${lineNum}`,
    diffAfter: issue.remediation ? `// Fix: ${issue.remediation}` : `// Remediation applied for ${issue.title || 'finding'}`,
  });
}

export default function ReviewDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser, token: authToken, isGuest, guestSessionId } = useAuth();

  // Data fetching state: initialize with navigation state for instant rendering
  const [review, setReview] = useState(() => location.state?.review || null);
  const [loading, setLoading] = useState(() => !location.state?.review);
  const [fetchError, setFetchError] = useState(null);

  // Active filters and selection
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'critical' | 'high' | 'medium' | 'low'
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [issueSearchQuery, setIssueSearchQuery] = useState('');

  // Interactive UI state
  const [appliedPatches, setAppliedPatches] = useState({}); // { [issueId]: true }
  const [allSafeFixesApplied, setAllSafeFixesApplied] = useState(false);
  const [healthScoreBonus, setHealthScoreBonus] = useState(0);
  const [copiedIssueId, setCopiedIssueId] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [showRawCodeModal, setShowRawCodeModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // In-memory file content tracking: { [filePath]: string }
  const [fileContents, setFileContents] = useState(() => {
    const map = {};
    const files = location.state?.review?.files || [];
    for (const f of files) {
      const p = f.file_path || f.path;
      if (p && f.content) map[p] = f.content;
    }
    return map;
  });

  useEffect(() => {
    if (review?.files) {
      setFileContents((prev) => {
        const next = { ...prev };
        for (const f of review.files) {
          const p = f.file_path || f.path;
          if (p && f.content && !next[p]) {
            next[p] = f.content;
          }
        }
        return next;
      });
    }
  }, [review]);

  // Fetch Review Data
  useEffect(() => {
    let isMounted = true;
    async function loadReview() {
      try {
        if (!location.state?.review) {
          setLoading(true);
        }
        setFetchError(null);

        const headers = {};
        if (isGuest || !currentUser) {
          headers['x-is-guest'] = 'true';
          if (guestSessionId) {
            headers['x-guest-session-id'] = guestSessionId;
          }
        } else {
          headers['x-user-id'] = currentUser.id;
          const token = authToken || localStorage.getItem('recode_access_token');
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const res = await fetch(`${API_BASE_URL}/api/v1/reviews/${id}`, { headers });

        const json = await res.json();

        if (isMounted) {
          if (!res.ok || json.status === 'error' || !json.data) {
            // Only show fetchError if we do not already have the review in state
            if (!location.state?.review) {
              setFetchError(json.message || 'Review not found or access denied.');
            }
          } else {
            setReview(json.data);
            // Default active file selection
            const files = json.data.files || [];
            if (files.length > 0) {
              const fileWithIssues = files.find((f) => (f.issues_count || 0) > 0);
              setSelectedFileId(fileWithIssues ? (fileWithIssues.id || fileWithIssues.file_path) : (files[0].id || files[0].file_path));
            }
          }
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          if (!location.state?.review) {
            setFetchError(`Network error loading review: ${err.message}`);
          }
          setLoading(false);
        }
      }
    }

    if (id) {
      loadReview();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Derived metrics and properties
  const baseHealthScore = review?.healthScore ?? review?.health_score ?? 84;
  const healthScore = Math.min(100, baseHealthScore + healthScoreBonus);
  const grade = review?.grade && healthScoreBonus === 0 ? review.grade : (healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B+' : healthScore >= 70 ? 'B' : 'C');
  const projectName = review?.projectName || review?.project_name || 'Code Review';
  const allFiles = useMemo(
    () => review?.files || review?.review_files || [],
    [review?.files, review?.review_files]
  );
  const allIssues = useMemo(() => {
    const raw = review?.issues || review?.review_issues || [];
    return raw.map((issue, index) => ({
      ...issue,
      _key: issue.id || issue._id || `${issue.file || 'f'}_${issue.line || issue.line_number || 1}_${issue.rule_id || issue.ruleId || 'rule'}_${index}`,
    }));
  }, [review?.issues, review?.review_issues]);

  const reviewedDate = useMemo(() => {
    const ts = review?.createdAt || review?.created_at || new Date();
    return formatIstTimestamp(ts);
  }, [review?.createdAt, review?.created_at]);

  // Severity counts
  const critCount = allIssues.filter((i) => i.severity === 'CRITICAL').length;
  const highCount = allIssues.filter((i) => i.severity === 'HIGH').length;
  const medCount = allIssues.filter((i) => i.severity === 'MEDIUM').length;
  const lowCount = allIssues.filter((i) => i.severity === 'LOW').length;
  const infoCount = allIssues.filter((i) => i.severity === 'INFO').length;

  // Category health bars with division by zero & undefined guards
  const bugsHealth =
    review?.categoryScores?.bugsHealth ??
    review?.categoryScores?.bugs_health ??
    (highCount > 0 ? Math.max(0, 100 - highCount * 10) : 100);
  const securityHealth =
    review?.categoryScores?.securityHealth ??
    review?.categoryScores?.security_health ??
    (critCount > 0 ? Math.max(0, 100 - critCount * 20) : 100);
  const qualityHealth =
    review?.categoryScores?.qualityHealth ??
    review?.categoryScores?.quality_health ??
    (medCount > 0 ? Math.max(0, 100 - medCount * 5) : 100);

  // Has syntax errors or incomplete code (strictly rendered only when syntax errors or parser warnings exist)
  const hasSyntaxError = allIssues.some(
    (item) =>
      (item.category || '').toUpperCase() === 'SYNTAX' ||
      item.rule_id === 'PARSER_ERROR' ||
      item.ruleId === 'PARSER_ERROR'
  );

  // Currently selected file object
  const activeFile = useMemo(() => {
    if (!allFiles.length) {
      return {
        id: 'default',
        file_path: 'student_management_system.js',
        lines_count: 26,
        language: 'javascript',
      };
    }
    return (
      allFiles.find((f) => f.id === selectedFileId || f.file_path === selectedFileId) ||
      allFiles[0]
    );
  }, [allFiles, selectedFileId]);

  // Issues belonging to active file
  const activeFileIssues = useMemo(() => {
    if (!allIssues.length) return [];
    const activePath = activeFile.file_path || activeFile.path || '';
    const activeId = activeFile.id;

    const matched = allIssues.filter((issue) => {
      if (activeId && issue.file_id === activeId) return true;
      if (activePath && (issue.file === activePath || issue.filePath === activePath)) return true;
      // If only 1 file in submission, assign all issues to it
      if (allFiles.length === 1) return true;
      return false;
    });

    return matched.length ? matched : allIssues;
  }, [allIssues, activeFile, allFiles.length]);

  // Filtered issues based on severity tab and search query
  const filteredIssues = useMemo(() => {
    return activeFileIssues.filter((issue) => {
      const matchSeverity =
        severityFilter === 'all' ||
        issue.severity?.toLowerCase() === severityFilter.toLowerCase();

      const query = issueSearchQuery.toLowerCase().trim();
      const matchQuery =
        !query ||
        issue.title?.toLowerCase().includes(query) ||
        issue.description?.toLowerCase().includes(query) ||
        issue.rule_id?.toLowerCase().includes(query) ||
        issue.ruleId?.toLowerCase().includes(query);

      return matchSeverity && matchQuery;
    });
  }, [activeFileIssues, severityFilter, issueSearchQuery]);

  // Filtered files in left sidebar
  const filteredFiles = useMemo(() => {
    return allFiles.filter((file) => {
      const path = file.file_path || file.path || '';
      const matchSearch = !fileSearchQuery || path.toLowerCase().includes(fileSearchQuery.toLowerCase());
      const hasIssues = (file.issues_count || 0) > 0 || allIssues.some((i) => i.file_id === file.id || i.file === path);
      if (issuesOnly && !hasIssues) return false;
      return matchSearch;
    });
  }, [allFiles, fileSearchQuery, issuesOnly, allIssues]);

  // Radial score gauge calculations (radius 30 -> circumference ~188.49)
  const circleRadius = 30;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeOffset = circumference * (1 - Math.min(100, Math.max(0, healthScore)) / 100);

  // Active file content with in-memory patches applied
  const activeFilePath = activeFile?.file_path || activeFile?.path || '';
  const activeFileContent =
    fileContents[activeFilePath] ??
    activeFile?.content ??
    '';

  // Interactive: Apply Patch (toggles button and in-memory replaces code line)
  const handleApplyPatch = (issueKey, issue) => {
    // 1. Mark patch applied (turns button green with checkmark)
    setAppliedPatches((prev) => ({
      ...prev,
      [issueKey]: true,
    }));

    // Dynamic health score boost (+2 per applied patch, up to 15 max)
    setHealthScoreBonus((prev) => Math.min(15, prev + 2));

    // 2. In-memory replace the vulnerable code line with the remediated line
    const targetFilePath =
      activeFile?.file_path || activeFile?.path || issue?.file || issue?.filePath || 'source.js';

    const { diffBefore, diffAfter } = getIssueDiff(issue, activeFile);

    setFileContents((prev) => {
      const currentCode = prev[targetFilePath] ?? activeFile?.content ?? '';
      if (!currentCode) return prev;

      let updatedCode = currentCode;
      if (diffBefore && currentCode.includes(diffBefore)) {
        updatedCode = currentCode.replace(diffBefore, diffAfter);
      } else {
        const lineNum = issue?.line_number || issue?.line;
        if (lineNum) {
          const lines = currentCode.split('\n');
          if (lines[lineNum - 1] !== undefined) {
            lines[lineNum - 1] = diffAfter;
            updatedCode = lines.join('\n');
          }
        }
      }

      return {
        ...prev,
        [targetFilePath]: updatedCode,
      };
    });

    // Also update review.files in state
    setReview((prev) => {
      if (!prev) return prev;
      const files = prev.files || prev.review_files || [];
      const updatedFiles = files.map((f) => {
        const fPath = f.file_path || f.path;
        if (fPath === targetFilePath) {
          const prevContent = f.content || '';
          let newContent = prevContent;
          if (diffBefore && prevContent.includes(diffBefore)) {
            newContent = prevContent.replace(diffBefore, diffAfter);
          } else {
            const lineNum = issue?.line_number || issue?.line;
            if (lineNum) {
              const lines = prevContent.split('\n');
              if (lines[lineNum - 1] !== undefined) {
                lines[lineNum - 1] = diffAfter;
                newContent = lines.join('\n');
              }
            }
          }
          return { ...f, content: newContent };
        }
        return f;
      });
      return { ...prev, files: updatedFiles };
    });
  };

  // Interactive: Apply All Safe Fixes (unused variables, console logs, non-critical / low / info issues)
  const handleApplyAllSafeFixes = () => {
    const safeIssues = allIssues.filter((i) => {
      const sev = (i.severity || '').toUpperCase();
      const rule = (i.rule_id || i.ruleId || '').toUpperCase();
      return (
        sev === 'LOW' ||
        sev === 'INFO' ||
        rule.includes('UNUSED') ||
        rule.includes('CONSOLE') ||
        rule.includes('LOG')
      );
    });

    const newPatches = { ...appliedPatches };
    for (const issue of safeIssues) {
      if (issue._key) newPatches[issue._key] = true;
      if (issue.id) newPatches[issue.id] = true;
      if (issue._id) newPatches[issue._id] = true;
    }

    // Group safe issues by target file
    const issuesByFile = {};
    for (const issue of safeIssues) {
      const filePath = issue.file || issue.filePath || activeFile?.file_path || activeFile?.path || 'source.js';
      if (!issuesByFile[filePath]) {
        issuesByFile[filePath] = [];
      }
      issuesByFile[filePath].push(issue);
    }

    const updatedContents = { ...fileContents };

    for (const [filePath, fileIssues] of Object.entries(issuesByFile)) {
      let code =
        updatedContents[filePath] ??
        activeFile?.content ??
        review?.files?.find((f) => (f.file_path || f.path) === filePath)?.content ??
        '';
      if (!code) continue;

      // Sort descending by line number (bottom to top) to prevent line offset shifts
      const sortedIssues = [...fileIssues].sort((a, b) => {
        const lineA = Number(a.line_number || a.line || 0);
        const lineB = Number(b.line_number || b.line || 0);
        return lineB - lineA;
      });

      for (const issue of sortedIssues) {
        const { diffBefore, diffAfter } = getIssueDiff(issue, activeFile);
        if (diffBefore && code.includes(diffBefore)) {
          code = code.replace(diffBefore, diffAfter);
        } else {
          const lineNum = issue?.line_number || issue?.line;
          if (lineNum) {
            const lines = code.split('\n');
            if (lines[lineNum - 1] !== undefined) {
              lines[lineNum - 1] = diffAfter;
              code = lines.join('\n');
            }
          }
        }
      }
      updatedContents[filePath] = code;
    }

    setAppliedPatches(newPatches);
    setFileContents(updatedContents);
    setAllSafeFixesApplied(true);
    setHealthScoreBonus((prev) => Math.min(15, prev + Math.max(5, Math.min(10, safeIssues.length * 3))));

    setReview((prev) => {
      if (!prev) return prev;
      const files = prev.files || prev.review_files || [];
      const updatedFiles = files.map((f) => {
        const fPath = f.file_path || f.path;
        if (updatedContents[fPath]) {
          return { ...f, content: updatedContents[fPath] };
        }
        return f;
      });
      return { ...prev, files: updatedFiles };
    });

    setExportNotice(`Applied safe remediation patches for ${safeIssues.length} issues in-memory.`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  // Interactive: Copy Fix
  const handleCopyFix = (issue, e) => {
    e.stopPropagation();
    const { diffAfter } = getIssueDiff(issue, activeFile);
    const fixContent = diffAfter || issue.diff_after || issue.remediation || issue.description || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fixContent);
      setCopiedIssueId(issue.id || issue.title);
      setTimeout(() => {
        setCopiedIssueId(null);
      }, 2000);
    }
  };

  // Interactive: Export README Notice
  const handleExportReadme = async () => {
    try {
      setExportNotice('Generating architecture README markdown...');
      const headers = {};
      if (isGuest || !currentUser) {
        headers['x-is-guest'] = 'true';
        if (guestSessionId) {
          headers['x-guest-session-id'] = guestSessionId;
        }
      } else {
        headers['x-user-id'] = currentUser.id;
        const token = authToken || localStorage.getItem('recode_access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/reviews/${id}/readme`, { headers });
      let markdownText = '';
      if (res.ok) {
        markdownText = await res.text();
      } else {
        throw new Error(`README endpoint returned HTTP ${res.status}`);
      }

      const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `README_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setExportNotice('README markdown generated and downloaded successfully.');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err) {
      console.warn('Backend README generation fallback:', err.message);
      const fallbackContent = `# ${projectName} - Code Review Diagnostics\n\n**Health Score**: ${healthScore}/100 (${grade})\n**Issues Found**: ${allIssues.length}\n\n## Action Items\n` +
        allIssues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.title}: ${i.description}`).join('\n');
      const blob = new Blob([fallbackContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `README_${projectName.replace(/\s+/g, '_')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Interactive: Download PDF report
  const handleDownloadPdf = async () => {
    try {
      setExportNotice('Generating formal PDF audit report...');
      const headers = {};
      if (isGuest || !currentUser) {
        headers['x-is-guest'] = 'true';
        if (guestSessionId) {
          headers['x-guest-session-id'] = guestSessionId;
        }
      } else {
        headers['x-user-id'] = currentUser.id;
        const token = authToken || localStorage.getItem('recode_access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/reviews/${id}/pdf`, { headers });
      if (!res.ok) {
        throw new Error(`PDF endpoint returned HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `recode_audit_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${(id || '').slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setExportNotice('PDF audit report downloaded successfully.');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err) {
      console.warn('PDF download fallback triggered:', err.message);
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#181818] border border-[#303030] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#02C8F0] animate-spin" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-semibold text-[#F1F1F1]">Loading Review Diagnostics</h2>
            <p className="text-xs text-[#717171] mt-1 font-mono">
              Retrieving deterministic AST &amp; Gemini AI findings...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col items-center justify-center font-sans px-4">
        <div className="max-w-md w-full bg-[#181818] border border-[#303030] rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 flex items-center justify-center mx-auto mb-4 text-[#FF4D4D]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#F1F1F1]">Review Not Accessible</h2>
          <p className="text-xs text-[#AAAAAA] mt-2 leading-relaxed">{fetchError}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => navigate('/submit')}
              className="px-4 py-2 bg-[#212121] hover:bg-[#272727] border border-[#303030] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Back to Submission
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#F1F1F1] text-[#0F0F0F] hover:bg-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col font-sans selection:bg-[#02C8F0] selection:text-[#0F0F0F] antialiased">
      
      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#0F0F0F] border-b border-[#303030] z-50 px-4 sm:px-6">
        <div className="h-full w-full max-w-[1600px] mx-auto flex items-center justify-between">
          
          {/* Left Brand Identity: Official Logo | Subtitle */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="flex items-center cursor-pointer select-none group focus:outline-none"
              title="Re:Code — Read. Review. Refine."
            >
              <BrandLogo
                src="/Logo.svg"
                className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </a>

            <span className="text-[#303030] text-sm select-none">|</span>

            <span className="text-xs text-[#717171] font-mono tracking-wide hidden sm:inline select-none">
              Read. Review. Refine.
            </span>
          </div>

          {/* Right Action Group */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/submit')}
              className="flex items-center gap-1.5 h-8 px-3 bg-[#212121] border border-[#303030] rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] transition-colors text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Back to Editor</span>
            </button>

            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-1.5 h-8 px-3 bg-[#212121] border border-[#303030] rounded-lg text-[#AAAAAA] hover:text-[#02C8F0] hover:bg-[#272727] transition-colors text-xs font-medium cursor-pointer"
              title="Audit History"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-[#181818] border border-[#303030] rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] transition-colors text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Download PDF</span>
            </button>

            <button
              onClick={handleExportReadme}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-[#181818] border border-[#303030] rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] transition-colors text-xs font-medium cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#02C8F0]" />
              <span className="hidden xl:inline">Export README</span>
            </button>

            <button
              onClick={() => navigate('/submit')}
              className="flex items-center h-8 px-3.5 bg-[#F1F1F1] text-[#0F0F0F] text-xs font-semibold rounded-lg hover:bg-white transition-colors cursor-pointer"
            >
              New Review
            </button>

            <UserSessionPill onClick={() => navigate('/')} />
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full pt-14 bg-[#0F0F0F]">
        <div className="flex flex-col w-full p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
          
          {/* Notification Alert (if any) */}
          {exportNotice && (
            <div
              role="status"
              className="p-3 rounded-lg bg-[#27C93F]/10 border border-[#27C93F]/30 text-[#27C93F] text-xs flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}

          {/* Top Project Health Summary Banner */}
          <section className="audit-page-section bg-[#181818] border border-[#303030] rounded-xl p-5 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Left Column: Context & Metadata */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF0033] animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-wider text-[#717171]">
                    Automated Diagnostics Audit
                  </span>
                </div>
                
                <h1 className="text-xl sm:text-2xl font-bold text-[#F1F1F1] mt-1 tracking-tight">
                  Review for {projectName}
                </h1>
                
                <p className="text-xs text-[#AAAAAA] mt-1 leading-relaxed">
                  Reviewed on {reviewedDate} • {allFiles.length || 1} {allFiles.length === 1 ? 'file' : 'files'} scanned • {(activeFile.lines_count || 26).toLocaleString()} lines evaluated • AST + Gemini Diagnostics
                </p>

                {/* Syntax Error Notice Banner */}
                {hasSyntaxError && (
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#FFA116]/35 bg-[#FFA116]/12 text-[#FFA116] w-fit">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-mono text-xs font-medium">
                      Syntax Notice • Incomplete syntax or parser warnings evaluated during traversal
                    </span>
                  </div>
                )}
              </div>

              {/* Center Column: Visual Radial Health Score */}
              <div className="lg:col-span-3 flex items-center justify-start lg:justify-center border-t lg:border-t-0 lg:border-l lg:border-r border-[#303030] pt-4 lg:pt-0 lg:px-6">
                <div className="flex items-center gap-4">
                  {/* Circular Radial Gauge */}
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                      <circle
                        cx="36"
                        cy="36"
                        r={circleRadius}
                        fill="transparent"
                        stroke="#212121"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r={circleRadius}
                        fill="transparent"
                        stroke={healthScore >= 90 ? '#27C93F' : healthScore >= 75 ? '#02C8F0' : '#FFA116'}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        strokeWidth="6"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                      <span className="text-[#F1F1F1] text-[20px] font-bold leading-none">
                        {healthScore}
                      </span>
                      <span className="text-[#717171] text-[10px] leading-tight">/ 100</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#27C93F]/30 bg-[#27C93F]/15 text-[#27C93F] font-mono text-xs font-bold w-fit">
                      Grade {grade}
                    </span>
                    <span className="text-xs text-[#F1F1F1] font-medium mt-1">
                      AST &amp; AI Health Index
                    </span>
                    <span className="text-xs text-[#717171]">
                      {healthScore}% conformance
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Breakdown & Severity Strip */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-[#717171] uppercase tracking-wider font-semibold">
                      Findings Severity
                    </span>
                    <span className="font-mono text-xs text-[#AAAAAA]">
                      {allIssues.length} Total
                    </span>
                  </div>
                  
                  {/* 5-Column Severity Count Strip */}
                  <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
                    <div className="metric-block flex flex-col items-center justify-center py-1.5 rounded bg-[#FF4D4D]/12 border border-[#FF4D4D]/30 text-[#FF4D4D]">
                      <span className="font-bold">{critCount}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">Crit</span>
                    </div>
                    <div className="metric-block flex flex-col items-center justify-center py-1.5 rounded bg-[#FFA116]/12 border border-[#FFA116]/30 text-[#FFA116]">
                      <span className="font-bold">{highCount}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">High</span>
                    </div>
                    <div className="metric-block flex flex-col items-center justify-center py-1.5 rounded bg-[#FFD600]/12 border border-[#FFD600]/30 text-[#FFD600]">
                      <span className="font-bold">{medCount}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">Med</span>
                    </div>
                    <div className="metric-block flex flex-col items-center justify-center py-1.5 rounded bg-[#78DFFF]/12 border border-[#78DFFF]/30 text-[#78DFFF]">
                      <span className="font-bold">{lowCount}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">Low</span>
                    </div>
                    <div className="metric-block flex flex-col items-center justify-center py-1.5 rounded bg-[#AAAAAA]/12 border border-[#AAAAAA]/30 text-[#AAAAAA]">
                      <span className="font-bold">{infoCount}</span>
                      <span className="text-[9px] uppercase tracking-wider opacity-80">Info</span>
                    </div>
                  </div>
                </div>

                {/* Category Progress Bars */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#AAAAAA]">Bugs</span>
                    <span className="text-[#F1F1F1] font-mono">{bugsHealth}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#212121] rounded-full overflow-hidden">
                    <div className="bg-[#FFA116] h-full" style={{ width: `${bugsHealth}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-xs pt-0.5">
                    <span className="text-[#AAAAAA]">Security</span>
                    <span className="text-[#F1F1F1] font-mono">{securityHealth}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#212121] rounded-full overflow-hidden">
                    <div className="bg-[#27C93F] h-full" style={{ width: `${securityHealth}%` }} />
                  </div>

                  <div className="flex justify-between items-center text-xs pt-0.5">
                    <span className="text-[#AAAAAA]">Quality &amp; Optimization</span>
                    <span className="text-[#F1F1F1] font-mono">{qualityHealth}%</span>
                  </div>
                  <div className="w-full h-1 bg-[#212121] rounded-full overflow-hidden">
                    <div className="bg-[#02C8F0] h-full" style={{ width: `${qualityHealth}%` }} />
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* Workspace 2-Column Layout */}
          <div className="audit-page-section flex flex-col lg:flex-row gap-6 items-start w-full">
            
            {/* Left Column: Project Files Sidebar */}
            <aside className="w-full lg:w-80 flex-shrink-0 bg-[#181818] border border-[#303030] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-wider text-[#717171] uppercase font-semibold">
                  PROJECT FILES
                </span>
                <span className="bg-[#212121] border border-[#303030] text-[#AAAAAA] font-mono text-xs px-2 py-0.5 rounded">
                  {allFiles.length || 1} analyzed
                </span>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 text-[#717171] w-4 h-4" />
                <input
                  id="fileSearchInput"
                  type="text"
                  placeholder="Filter files..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="w-full bg-[#212121] border border-[#303030] rounded-lg py-1.5 pl-8 pr-3 text-xs font-mono text-[#F1F1F1] placeholder:text-[#717171] focus:outline-none focus:border-[#3F3F3F] transition-colors"
                />
              </div>

              {/* Issues Only Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="issuesOnlyToggle"
                  type="checkbox"
                  checked={issuesOnly}
                  onChange={(e) => setIssuesOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-[#212121] border border-[#303030] accent-[#FF0033] cursor-pointer"
                />
                <span className="text-xs text-[#AAAAAA]">
                  Show files with issues only ({allFiles.filter((f) => (f.issues_count || 0) > 0).length || (allIssues.length ? 1 : 0)})
                </span>
              </label>

              {/* Directory Tree */}
              <div className="space-y-1.5 font-mono text-xs pt-1" id="fileTreeContainer">
                {filteredFiles.map((file) => {
                  const filePath = file.file_path || file.path || 'snippet.js';
                  const isSelected = activeFile.file_path === filePath || activeFile.id === file.id;
                  const fileIssues = allIssues.filter((i) => i.file_id === file.id || i.file === filePath);
                  const fileCrit = fileIssues.filter((i) => i.severity === 'CRITICAL').length;
                  const fileHigh = fileIssues.filter((i) => i.severity === 'HIGH').length;

                  return (
                    <button
                      key={file.id || filePath}
                      type="button"
                      onClick={() => setSelectedFileId(file.id || filePath)}
                      className={`file-tree-item w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#212121] border border-[#02C8F0] text-[#F1F1F1]'
                          : 'text-[#AAAAAA] hover:bg-[#212121] hover:text-[#F1F1F1]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileCode className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#02C8F0]' : 'text-[#717171]'}`} />
                        <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>{filePath}</span>
                      </span>

                      {fileCrit > 0 ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF4D4D]/15 text-[#FF4D4D] border border-[#FF4D4D]/30">
                          {fileCrit} Crit
                        </span>
                      ) : fileHigh > 0 ? (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFA116]/15 text-[#FFA116] border border-[#FFA116]/30">
                          {fileHigh} High
                        </span>
                      ) : fileIssues.length > 0 ? (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#78DFFF]/15 text-[#78DFFF] border border-[#78DFFF]/30">
                          {fileIssues.length} Issues
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-[#27C93F] font-bold">Pass</span>
                      )}
                    </button>
                  );
                })}

                {filteredFiles.length === 0 && (
                  <div className="py-4 text-center text-xs text-[#717171]">
                    No files match filter criteria
                  </div>
                )}
              </div>

              {/* Bottom Status Note */}
              <div className="pt-3 border-t border-[#303030] mt-1 flex items-center justify-between font-mono text-xs text-[#717171]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
                  {Math.max(0, (allFiles.length || 1) - (allIssues.length ? 1 : 0))} of {allFiles.length || 1} files passed with 0 warnings
                </span>
              </div>
            </aside>

            {/* Right Column: Active File Findings Canvas */}
            <section className="flex-1 w-full flex flex-col min-w-0">
              
              {/* Active File Header Bar */}
              <div className="bg-[#181818] border border-[#303030] rounded-xl p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#212121] border border-[#303030] flex items-center justify-center text-[#02C8F0]">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-mono text-sm font-bold text-[#F1F1F1] truncate">
                        {activeFile.file_path || activeFile.path || 'student_management_system.js'}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#212121] border border-[#303030] text-[#02C8F0] font-mono">
                        Active Scope
                      </span>
                    </div>
                    <div className="text-xs text-[#AAAAAA] mt-0.5">
                      {activeFile.language || 'javascript'} • {activeFile.lines_count || 26} lines •{' '}
                      <span className="text-[#FF4D4D] font-semibold">{critCount} Critical</span> •{' '}
                      <span className="text-[#FFA116]">{highCount} High</span> •{' '}
                      <span className="text-[#78DFFF]">{lowCount} Low</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRawCodeModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#212121] border border-[#303030] rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] transition-colors text-xs font-medium cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#02C8F0]" />
                    <span>Raw Code</span>
                  </button>
                </div>
              </div>

              {/* Filter Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                
                {/* Severity Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0" id="issueFilterTabs">
                  <button
                    type="button"
                    data-filter="all"
                    onClick={() => setSeverityFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      severityFilter === 'all'
                        ? 'bg-[#F1F1F1] text-[#0F0F0F]'
                        : 'bg-[#212121] text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727]'
                    }`}
                  >
                    All ({activeFileIssues.length})
                  </button>
                  <button
                    type="button"
                    data-filter="critical"
                    onClick={() => setSeverityFilter('critical')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      severityFilter === 'critical'
                        ? 'bg-[#FF4D4D] text-[#0F0F0F]'
                        : 'bg-[#212121] text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727]'
                    }`}
                  >
                    Critical ({critCount})
                  </button>
                  <button
                    type="button"
                    data-filter="high"
                    onClick={() => setSeverityFilter('high')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      severityFilter === 'high'
                        ? 'bg-[#FFA116] text-[#0F0F0F]'
                        : 'bg-[#212121] text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727]'
                    }`}
                  >
                    High ({highCount})
                  </button>
                  <button
                    type="button"
                    data-filter="low"
                    onClick={() => setSeverityFilter('low')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                      severityFilter === 'low'
                        ? 'bg-[#78DFFF] text-[#0F0F0F]'
                        : 'bg-[#212121] text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727]'
                    }`}
                  >
                    Low ({lowCount})
                  </button>
                </div>

                {/* Issue Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 text-[#717171] w-3.5 h-3.5" />
                  <input
                    type="text"
                    placeholder="Search issues, rules..."
                    value={issueSearchQuery}
                    onChange={(e) => setIssueSearchQuery(e.target.value)}
                    className="w-full bg-[#212121] border border-[#303030] rounded-lg py-1 pl-8 pr-3 text-xs text-[#F1F1F1] placeholder:text-[#717171] focus:outline-none focus:border-[#3F3F3F]"
                  />
                </div>

              </div>

              {/* Findings Stack */}
              <div className="space-y-4">
                
                {filteredIssues.map((issue, idx) => {
                  const issueKey = issue._key || issue.id || issue._id || `issue-${idx}`;
                  const isSafeIssue =
                    issue.severity === 'LOW' ||
                    issue.severity === 'INFO' ||
                    (issue.rule_id || issue.ruleId || '').toUpperCase().includes('UNUSED') ||
                    (issue.rule_id || issue.ruleId || '').toUpperCase().includes('CONSOLE') ||
                    (issue.rule_id || issue.ruleId || '').toUpperCase().includes('LOG');
                  const isApplied = !!appliedPatches[issueKey] || (allSafeFixesApplied && isSafeIssue);
                  const isCopied = copiedIssueId === issueKey || copiedIssueId === issue.title;
                  const isSyntax =
                    issue.rule_id === 'PARSER_ERROR' ||
                    issue.ruleId === 'PARSER_ERROR' ||
                    issue.category === 'SYNTAX';
                  const isCritical = issue.severity === 'CRITICAL';
                  const isHigh = issue.severity === 'HIGH' || isSyntax;
                  const lineNum = issue.line_number || issue.line || 1;
                  const fileName = activeFile?.file_path || issue.file || issue.filePath || 'source.js';
                  const scopeText = issue.scope || `Line ${lineNum} in ${fileName}`;

                  // Contextual rule & standard category
                  const categoryOrStandard =
                    issue.owasp ||
                    issue.cwe ||
                    (issue.rule_id === 'UNUSED_VARIABLE'
                      ? 'Code Smell / Dead Code'
                      : issue.rule_id === 'HARDCODED_SECRET'
                      ? 'CWE-798: Hard-coded Credentials'
                      : issue.rule_id === 'SQL_INJECTION'
                      ? 'CWE-89 / OWASP A03:2021'
                      : issue.rule_id === 'CONSOLE_LOG_STMT' ||
                        issue.rule_id === 'CONSOLE_LOG_STATEMENT'
                      ? 'Code Quality / Info Exposure'
                      : issue.rule_id === 'PARSER_ERROR'
                      ? 'AST Syntax / Parser Engine'
                      : issue.category || 'Security & Quality');

                  // Generate rule-specific and line-specific diff (eliminates generic SQL queries)
                  const { diffBefore, diffAfter } = getIssueDiff(issue, activeFile);

                  // Contextual engine label: HYBRID (AST + AI) when corroborated
                  const rawEngine = String(issue.engine || issue.source || issue.engine_source || '').toUpperCase();
                  const engineLabel =
                    rawEngine.includes('HYBRID')
                      ? 'HYBRID (AST + AI)'
                      : rawEngine.includes('GEMINI') || rawEngine.includes('AI')
                      ? 'Gemini AI'
                      : 'Static AST';

                  // Clear Plain-Language Explanation fields
                  const whatText =
                    issue.what_is_wrong ||
                    issue.what ||
                    issue.explanation ||
                    issue.description ||
                    issue.title ||
                    'Code defect detected by static & AI analysis.';

                  const whyText =
                    issue.why_dangerous ||
                    issue.why ||
                    (isCritical
                      ? 'Directly introduces an exploitable security vulnerability, credential exposure, or unauthorized access risk.'
                      : isHigh
                      ? 'Prevents code compilation, syntax traversal, or reliable execution in production.'
                      : 'Degrades code maintainability, leaks runtime telemetry, or introduces dead code bloat.');

                  const howText =
                    issue.how_to_fix ||
                    issue.how ||
                    issue.remediation ||
                    (isSyntax
                      ? formatSyntaxRemediationText(issue.remediation, lineNum)
                      : 'Step 1: Review the affected code logic against secure development best practices.\nStep 2: Apply the recommended remediation diff patch below.');

                  return (
                    <article
                      key={issueKey}
                      data-severity={issue.severity?.toLowerCase() || (isHigh ? 'high' : 'critical')}
                      className={`finding-card bg-[#181818] rounded-xl p-5 relative border ${
                        isCritical
                          ? 'border-[#FF4D4D]/40'
                          : isHigh
                          ? 'border-[#FFA116]/40'
                          : 'border-[#27C93F]/40'
                      }`}
                    >
                      {/* Tags Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            isCritical
                              ? 'bg-[#FF4D4D]/15 text-[#FF4D4D] border border-[#FF4D4D]/30'
                              : isHigh
                              ? 'bg-[#FFA116]/15 text-[#FFA116] border border-[#FFA116]/30'
                              : 'bg-[#27C93F]/15 text-[#27C93F] border border-[#27C93F]/30'
                          }`}
                        >
                          {issue.severity || (isHigh ? 'HIGH' : 'CRITICAL')}
                        </span>

                        <span className="px-2 py-0.5 rounded bg-[#212121] text-[#AAAAAA] border border-[#303030]">
                          {issue.rule_id || issue.ruleId || 'CODE_DEFECT'}
                        </span>

                        {(issue.cweId || issue.cwe) && (
                          <span className="px-2 py-0.5 rounded bg-[#9D4EDD]/15 text-[#C77DFF] border border-[#9D4EDD]/35 font-mono">
                            {issue.cweId || issue.cwe}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded bg-[#212121] text-[#AAAAAA] border border-[#303030]">
                          {categoryOrStandard}
                        </span>

                        {/* Clean Engine Badge (Single engine source badge) */}
                        <span
                          className={`px-2 py-0.5 rounded border font-medium ${
                            engineLabel.toUpperCase().includes('HYBRID')
                              ? 'bg-[#02C8F0]/15 text-[#02C8F0] border-[#02C8F0]/40'
                              : engineLabel.toUpperCase().includes('GEMINI')
                              ? 'bg-[#FFA116]/15 text-[#FFA116] border-[#FFA116]/40'
                              : 'bg-[#212121] text-[#AAAAAA] border-[#303030]'
                          }`}
                        >
                          {engineLabel}
                        </span>

                        {/* Line Number & Exact File Scope */}
                        <span className="px-2 py-0.5 rounded bg-[#212121] text-[#F1F1F1] border border-[#303030] font-medium">
                          {scopeText}
                        </span>

                        <span className="px-2 py-0.5 rounded bg-[#02C8F0]/12 text-[#02C8F0] border border-[#02C8F0]/30 font-medium">
                          1-Click Patch Ready
                        </span>
                      </div>

                      {/* Issue Title */}
                      <h3 className="text-base font-semibold text-[#F1F1F1]">
                        {issue.title || (issue.rule_id ? issue.rule_id.replace(/_/g, ' ') : 'Code Defect')}
                      </h3>

                      {/* Clear Plain-Language Explanation Format */}
                      <div className="mt-3 space-y-2.5 text-xs">
                        {/* 1. What the error is */}
                        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 leading-relaxed">
                          <span className="font-semibold text-[#02C8F0] block mb-1">
                            What the error is:
                          </span>
                          <p className="text-[#F1F1F1]">{whatText}</p>
                        </div>

                        {/* 2. Why it is dangerous or bad practice */}
                        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 leading-relaxed">
                          <span className="font-semibold text-[#FFA116] block mb-1">
                            Why it is dangerous / bad practice:
                          </span>
                          <p className="text-[#AAAAAA]">{whyText}</p>
                        </div>

                        {/* 3. How to fix it step-by-step */}
                        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 leading-relaxed">
                          <span className="font-semibold text-[#27C93F] block mb-1">
                            How to fix step-by-step:
                          </span>
                          <p className="text-[#AAAAAA] whitespace-pre-line leading-relaxed">{howText}</p>
                        </div>
                      </div>

                      {/* Relevant Code Diff (Red = Line to remove, Green = Line to add) */}
                      <DiffViewer
                        diffBefore={diffBefore}
                        diffAfter={diffAfter}
                        filePath={fileName}
                        lineNumber={lineNum}
                        ruleId={issue.rule_id || issue.ruleId}
                        isApplied={isApplied}
                        className="mt-3"
                      />

                      {/* Issue Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-[#303030] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyPatch(issueKey, issue)}
                            disabled={isApplied}
                            className={`patch-apply-btn flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg font-mono text-xs transition-colors ${
                              isApplied
                                ? 'bg-[#27C93F] text-[#0F0F0F] cursor-default'
                                : 'bg-[#02C8F0] hover:bg-[#38D4F4] text-[#0F0F0F] cursor-pointer'
                            }`}
                          >
                            {isApplied ? (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>✓ Patch Applied</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 fill-current" />
                                <span>Apply Patch</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleCopyFix(issue, e)}
                            className="copy-fix-btn flex items-center gap-1.5 px-3 py-1.5 bg-[#212121] border border-[#303030] hover:bg-[#272727] text-[#F1F1F1] rounded-lg font-mono text-xs transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-4 h-4 text-[#02C8F0]" />
                                <span className="text-[#02C8F0]">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy Fix</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs text-[#717171]">
                            Rule: {issue.cwe || issue.rule_id || issue.ruleId || 'AST-STATIC'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {filteredIssues.length === 0 && (
                  <div className="bg-[#181818] border border-[#303030] rounded-xl p-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-[#27C93F] mx-auto mb-2" />
                    <h3 className="text-sm font-semibold text-[#F1F1F1]">No Issues in Current View</h3>
                    <p className="text-xs text-[#717171] mt-1">
                      No findings match the selected severity filter "{severityFilter}".
                    </p>
                  </div>
                )}

              </div>

            </section>

          </div>

          {/* Sticky Bottom Action Dock */}
          <aside className="sticky bottom-4 z-40 bg-[#141414] border border-[#303030] rounded-xl py-3 px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF0033] animate-pulse" />
              <div className="font-mono text-xs text-[#AAAAAA]">
                <span className="text-[#F1F1F1] font-semibold">
                  Project Health: {healthScore}/100 (Grade {grade})
                </span>{' '}
                •{' '}
                <span className="text-[#FF4D4D] font-medium">
                  {critCount} Critical Issues
                </span>{' '}
                require remediation before production deploy
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/submit')}
                className="px-3 py-1.5 rounded-lg bg-[#212121] border border-[#303030] text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Submission
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-3 py-1.5 rounded-lg bg-[#212121] border border-[#303030] text-[#F1F1F1] hover:bg-[#272727] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportReadme}
                className="px-3 py-1.5 rounded-lg bg-[#212121] border border-[#303030] text-[#F1F1F1] hover:bg-[#272727] text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#02C8F0]" />
                <span>Export README</span>
              </button>

              <button
                type="button"
                onClick={handleApplyAllSafeFixes}
                disabled={allSafeFixesApplied}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg ${
                  allSafeFixesApplied
                    ? 'bg-[#27C93F]/20 text-[#27C93F] border border-[#27C93F]/40 cursor-default'
                    : 'bg-[#27C93F] text-[#0F0F0F] hover:bg-[#30E04B] cursor-pointer'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{allSafeFixesApplied ? '✓ All Safe Fixes Applied' : 'Apply All Safe Fixes'}</span>
              </button>
            </div>
          </aside>

        </div>
      </main>

      {/* Raw Code Live In-Memory Modal */}
      {showRawCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#303030] rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#02C8F0]" />
                <h3 className="font-mono text-sm font-bold text-[#F1F1F1]">
                  {activeFile.file_path || activeFile.path || 'source.js'}
                </h3>
                <span className="px-2 py-0.5 rounded bg-[#27C93F]/15 text-[#27C93F] text-xs font-mono font-medium border border-[#27C93F]/30">
                  Live In-Memory Patched Code
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(activeFileContent);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#212121] border border-[#303030] rounded-lg text-xs font-mono text-[#F1F1F1] hover:bg-[#272727] cursor-pointer transition-colors"
                >
                  {codeCopied ? <Check className="w-3.5 h-3.5 text-[#27C93F]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{codeCopied ? 'Copied!' : 'Copy File'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawCodeModal(false)}
                  className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#212121] cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-[#F1F1F1] bg-[#0F0F0F] leading-relaxed select-text flex-1">
              {activeFileContent ? (
                <pre className="m-0 whitespace-pre">
                  <code>
                    {activeFileContent.split('\n').map((l, i) => (
                      <div key={i} className="flex hover:bg-[#181818]/60 px-2 py-0.5 rounded">
                        <span className="w-10 text-right pr-4 text-[#717171] select-none shrink-0 font-mono">
                          {i + 1}
                        </span>
                        <span className="flex-1 font-mono">{l}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              ) : (
                <div className="text-center py-8 text-[#717171]">No code content available for this file.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Docked Footer */}
      <Footer className="mt-auto" />
    </div>
  );
}
