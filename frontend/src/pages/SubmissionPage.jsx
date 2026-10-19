import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  ArrowLeft,
  Clock,
  Shield,
  Play,
  Loader2,
  Sparkles,
  Trash2,
  FileCode,
  Check,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import Footer from '../components/common/Footer';
import BrandLogo from '../components/common/BrandLogo';
import UserSessionPill from '../components/common/UserSessionPill';
import { useAuth } from '../services/useAuth';
import { API_BASE_URL } from '../config/api';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-sql';
import { detectCodeLanguage } from '../utils/languageDetector';

// Supported Language Configuration matching backend validators
const LANGUAGES = [
  {
    id: 'javascript',
    label: 'JavaScript (.js)',
    file: 'student_management_system.js',
    coverage: 'AST + Lint + AI Review',
    activeBadge: 'AST + Lint Active',
    sample: `/**
 * Re:Code Static Analysis Mock
 * Student Management Dispatcher
 */
class StudentRecordController {
  constructor(databasePool) {
    this.pool = databasePool;
  }

  async fetchRecords(req, res) {
    const { gradeThreshold, campusId } = req.query;

    if (!campusId) {
      return res.status(400).json({ error: "campusId query required" });
    }

    try {
      // Insecure raw query construction for review evaluation (CWE-89)
      const query = "SELECT * FROM students WHERE campus = '" + campusId + "' AND gpa >= " + gradeThreshold;
      const rows = await this.pool.execute(query);
      return res.status(200).json({ status: "success", data: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}`,
  },
  {
    id: 'typescript',
    label: 'TypeScript (.ts)',
    file: 'student_management_system.ts',
    coverage: 'Type AST + Security Scanner',
    activeBadge: 'Type AST Active',
    sample: `/**
 * Student Record Service - TypeScript
 */
interface StudentRecord {
  id: string;
  name: string;
  gpa: number;
}

export class StudentService {
  private db: any;

  async getStudentsByCampus(campusId: string, minGpa: number): Promise<StudentRecord[]> {
    // Insecure SQL string concatenation (CWE-89)
    const query = \`SELECT * FROM students WHERE campus = '\${campusId}' AND gpa >= \${minGpa}\`;
    return this.db.query(query);
  }
}`,
  },
  {
    id: 'python',
    label: 'Python (.py)',
    file: 'student_manager.py',
    coverage: 'Static Analysis + AI Review',
    activeBadge: 'Static Scanner Active',
    sample: `import sqlite3

def get_student_records(campus_id: str, min_gpa: float):
    conn = sqlite3.connect('students.db')
    cursor = conn.cursor()
    # SQL injection vulnerability via raw string formatting (CWE-89)
    query = f"SELECT * FROM students WHERE campus = '{campus_id}' AND gpa >= {min_gpa}"
    cursor.execute(query)
    return cursor.fetchall()`,
  },
  {
    id: 'java',
    label: 'Java (.java)',
    file: 'StudentDao.java',
    coverage: 'Static Analysis + AI Review',
    activeBadge: 'Static Scanner Active',
    sample: `import java.sql.*;

public class StudentDao {
    private Connection conn;

    public ResultSet findStudents(String campusId, double minGpa) throws SQLException {
        Statement stmt = conn.createStatement();
        // Insecure raw query construction (CWE-89)
        String query = "SELECT * FROM students WHERE campus = '" + campusId + "' AND gpa >= " + minGpa;
        return stmt.executeQuery(query);
    }
}`,
  },
  {
    id: 'cpp',
    label: 'C++ (.cpp)',
    file: 'student_query.cpp',
    coverage: 'Static Analysis + AI Review',
    activeBadge: 'Static Scanner Active',
    sample: `#include <iostream>
#include <string>

void executeStudentQuery(const std::string& campusId, double minGpa) {
    // Insecure query formatting (CWE-89)
    std::string query = "SELECT * FROM students WHERE campus = '" + campusId + "' AND gpa >= " + std::to_string(minGpa);
    std::cout << "Executing query: " << query << std::endl;
}`,
  },
  {
    id: 'sql',
    label: 'SQL (.sql)',
    file: 'query.sql',
    coverage: 'Dialect-Agnostic Query Scanner',
    activeBadge: 'SQL Scanner Active',
    sample: `-- Student & Department Query Procedure
-- Demonstrates dynamic query concatenation, unindexed wildcard search, and unconstrained mutation

CREATE OR REPLACE PROCEDURE find_enrolled_students(
    IN p_department_name VARCHAR(100),
    IN p_min_gpa NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_sql TEXT;
    v_cursor REFCURSOR;
BEGIN
    -- VULNERABILITY: Insecure dynamic query string concatenation allows SQL Injection (CWE-89)
    v_sql := 'SELECT s.student_id, s.full_name, s.gpa, d.dept_name ' ||
             'FROM students s ' ||
             'JOIN departments d ON s.dept_id = d.dept_id ' ||
             'WHERE d.dept_name LIKE ''%' || p_department_name || '%'' ' ||
             'AND s.gpa >= ' || p_min_gpa;

    -- BOTTLENECK: Leading wildcard in LIKE ('%...') forces a full table scan and prevents index utilization
    OPEN v_cursor FOR EXECUTE v_sql;

    -- ANTI-PATTERN: Unconstrained DELETE statement without WHERE clause purges entire audit table
    DELETE FROM audit_logs;
END;
$$;`,
  },
];

// File extension mapping for dynamic filename auto-generation
const LANGUAGE_EXTENSIONS = {
  javascript: '.js',
  typescript: '.ts',
  python: '.py',
  java: '.java',
  cpp: '.cpp',
  sql: '.sql',
};

const MAX_CHARS = 50000;

export default function SubmissionPage() {
  const navigate = useNavigate();

  // Mode & State
  const [sourceType, setSourceType] = useState('direct'); // 'direct' | 'github'
  const [projectName, setProjectName] = useState('');
  
  // Language Selection: Auto Detect active by default with manual override capability
  const [isAutoDetect, setIsAutoDetect] = useState(true);
  const [manualLang, setManualLang] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [code, setCode] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorNonce, setErrorNonce] = useState(0);
  const errorBannerRef = useRef(null);
  const pendingFocusTargetRef = useRef(null);
  const { user: currentUser, token: authToken, isGuest, guestSessionId } = useAuth();
  const autoDetectedRepoNameRef = useRef('');

  // Automatically detect language based on current code snippet in real time
  const autoDetectedLangId = useMemo(() => {
    if (!code || typeof code !== 'string' || !code.trim()) return 'javascript';
    try {
      return detectCodeLanguage(code);
    } catch (err) {
      console.warn('[Re:Code] Language detection fallback:', err);
      return 'javascript';
    }
  }, [code]);

  const autoDetectedLang = useMemo(() => {
    return LANGUAGES.find((l) => l.id === autoDetectedLangId) || LANGUAGES[0];
  }, [autoDetectedLangId]);

  // Effective language resolved from manual override or auto-detection (guaranteed non-null)
  const effectiveLang = useMemo(() => {
    if (!isAutoDetect && manualLang) {
      return manualLang;
    }
    return autoDetectedLang || LANGUAGES[0];
  }, [isAutoDetect, manualLang, autoDetectedLang]);

  // Refs for editor, line numbers gutter, and syntax highlighting synchronization
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const highlightRef = useRef(null);
  const dropdownRef = useRef(null);

  // Trigger validation error: updates message and queues smooth scroll and element focus
  const triggerValidationError = (message, focusTarget = null) => {
    pendingFocusTargetRef.current = focusTarget;
    setErrorMsg(message);
    setErrorNonce((prev) => prev + 1);
  };

  // Smoothly scroll to error banner and focus invalid input on validation failure or API error
  useEffect(() => {
    if (!errorMsg) return;

    const timer = setTimeout(() => {
      const banner = errorBannerRef.current || document.getElementById('errorBanner');
      if (banner) {
        // Sticky header height: h-14 = 56px. Add 24px breathing space so banner is never obscured
        const headerHeight = 56;
        const breathingRoom = 24;
        const bannerRect = banner.getBoundingClientRect();
        const targetScrollY = window.scrollY + bannerRect.top - (headerHeight + breathingRoom);

        window.scrollTo({
          top: Math.max(0, targetScrollY),
          behavior: 'smooth',
        });
      }

      // Automatically place focus on the invalid input field if applicable
      const target = pendingFocusTargetRef.current;
      if (target) {
        let el = null;
        if (typeof target === 'string') {
          el = document.getElementById(target);
        } else if (target?.current) {
          el = target.current;
        } else if (target?.focus) {
          el = target;
        }

        if (el && typeof el.focus === 'function') {
          // preventScroll: true ensures keyboard focus is acquired without jarring the smooth scroll
          el.focus({ preventScroll: true });
        }
        pendingFocusTargetRef.current = null;
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [errorMsg, errorNonce]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchronize textarea, gutter, and syntax highlight underlay scrolling
  const handleScroll = () => {
    if (textareaRef.current) {
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  };

  // Metrics computation: handles empty string, tabs, and large pastes (up to 50,000 characters)
  const charCount = typeof code === 'string' ? code.length : 0;
  const lineCount = useMemo(() => {
    if (!code) return 1;
    let count = 1;
    for (let i = 0; i < code.length; i++) {
      if (code.charCodeAt(i) === 10) count++;
    }
    return count;
  }, [code]);
  const usagePercent = Math.min(100, Math.round((charCount / MAX_CHARS) * 100));

  // Gutter line elements (capped to max lines to ensure DOM remains buttery smooth on large pastes)
  const maxRenderedLines = Math.min(lineCount, 5000);
  const linesArray = useMemo(() => {
    return Array.from({ length: Math.max(1, maxRenderedLines) }, (_, i) => i + 1);
  }, [maxRenderedLines]);

  // Tab key indentation support for developer ergonomics
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const updated = val.substring(0, start) + '  ' + val.substring(end);
      setCode(updated);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  // Dynamic filename auto-generated from Project Name and selected Language
  const dynamicFilename = useMemo(() => {
    let raw = (projectName || '').trim();

    // Strip existing file extension if user typed one (e.g. "af.js" or "af.py" -> "af")
    const lastDot = raw.lastIndexOf('.');
    if (lastDot > 0 && lastDot < raw.length - 1) {
      const possibleExt = raw.slice(lastDot).toLowerCase();
      const knownExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.cc', '.c', '.h', '.sql', '.html', '.txt'];
      if (knownExts.includes(possibleExt)) {
        raw = raw.slice(0, lastDot);
      }
    }

    const sanitized = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const baseName = sanitized || 'source_code';
    const ext = effectiveLang ? (LANGUAGE_EXTENSIONS[effectiveLang.id] || `.${effectiveLang.id}`) : '.js';
    return `${baseName}${ext}`;
  }, [projectName, effectiveLang]);

  // Prism syntax highlighting dynamically bound to selected language grammar
  const highlightedCode = useMemo(() => {
    if (!code) return '';
    const langId = effectiveLang?.id || 'javascript';
    let grammar = Prism.languages[langId];
    if (!grammar) {
      if (langId === 'sql') grammar = Prism.languages.sql;
      else if (langId === 'cpp') grammar = Prism.languages.cpp || Prism.languages.c;
      else if (langId === 'typescript' || langId === 'ts') grammar = Prism.languages.typescript || Prism.languages.javascript;
      else if (langId === 'python' || langId === 'py') grammar = Prism.languages.python;
      else if (langId === 'java') grammar = Prism.languages.java;
      else grammar = Prism.languages.javascript;
    }
    // Prevent trailing newline from collapsing in HTML <pre>
    const safeCode = code.endsWith('\n') ? `${code} ` : code;
    try {
      return Prism.highlight(safeCode, grammar || Prism.languages.javascript, langId);
    } catch {
      return safeCode.replace(/[&<>'"]/g, (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }
  }, [code, effectiveLang]);

  // Load sample code for currently selected language
  const handleLoadSample = () => {
    setErrorMsg('');
    const targetLang = !isAutoDetect && manualLang ? manualLang : (autoDetectedLang || LANGUAGES[0]);
    setCode(targetLang.sample);
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.focus();
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = 0;
      highlightRef.current.scrollLeft = 0;
    }
  };

  // Clear editor content
  const handleClearEditor = () => {
    setErrorMsg('');
    setCode('');
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.focus();
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = 0;
      highlightRef.current.scrollLeft = 0;
    }
  };

  // Select Auto Detect mode (enables dynamic heuristic switching)
  const handleSelectAutoDetect = () => {
    setIsAutoDetect(true);
    setManualLang(null);
    setDropdownOpen(false);
    setErrorMsg('');
  };

  // Select manual language override (locks choice and disables auto switching)
  const handleSelectLanguage = (lang) => {
    setIsAutoDetect(false);
    setManualLang(lang);
    setDropdownOpen(false);
    setErrorMsg('');
  };

  // GitHub URL change handler with auto-detection of repo name
  const handleGithubUrlChange = (val) => {
    setGithubUrl(val);
    setErrorMsg('');

    // If project name is empty or matches previous auto-detection, populate with repo name
    const cleaned = val.trim().replace(/\/+$/, '').replace(/\.git$/, '');
    const match = cleaned.match(/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/([a-zA-Z0-9_.-]+)$/);
    if (match && match[1]) {
      const repoName = match[1];
      if (!projectName.trim() || projectName === autoDetectedRepoNameRef.current) {
        setProjectName(repoName);
        autoDetectedRepoNameRef.current = repoName;
      }
    }
  };

  // Trigger Review Submission
  const handleSubmitReview = async () => {
    setErrorMsg('');

    // 1. Project Name Validation
    let effectiveProjectName = projectName.trim();
    if (sourceType === 'github' && !effectiveProjectName) {
      // Auto-detect from GitHub URL if available
      const cleaned = githubUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '');
      const match = cleaned.match(/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/([a-zA-Z0-9_.-]+)$/);
      if (match && match[1]) {
        effectiveProjectName = match[1];
      }
    }

    if (sourceType === 'direct' && !effectiveProjectName) {
      triggerValidationError('Please enter a project name.', 'projectNameInput');
      return;
    }

    // 2. Programming Language Validation (Required only for direct code paste)
    if (sourceType === 'direct' && !effectiveLang) {
      setDropdownOpen(true);
      triggerValidationError('Please select a programming language.', 'langDropdownTrigger');
      return;
    }

    // 3. Source Payload Validation
    let normalizedGithubUrl = '';
    if (sourceType === 'direct') {
      if (!code.trim()) {
        triggerValidationError('Please input or paste your code snippet before running review.', textareaRef);
        return;
      }
      if (code.length > MAX_CHARS) {
        triggerValidationError(`Code snippet exceeds maximum limit of ${MAX_CHARS.toLocaleString()} characters.`, textareaRef);
        return;
      }
    } else {
      // GitHub URL Validation
      const githubPattern = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
      normalizedGithubUrl = githubUrl.trim().replace(/\/+$/, '');
      if (!normalizedGithubUrl) {
        triggerValidationError('Please enter a public GitHub repository URL.', 'githubUrlInput');
        return;
      }
      if (!githubPattern.test(normalizedGithubUrl)) {
        triggerValidationError('Invalid GitHub URL. Must strictly match: https://github.com/owner/repository', 'githubUrlInput');
        return;
      }
    }

    setLoading(true);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      const payload = {
        sourceType,
        projectName: effectiveProjectName || 'github_repo',
      };

      if (isGuest || !currentUser) {
        payload.guestSessionId = guestSessionId;
        headers['x-guest-session-id'] = guestSessionId;
        headers['x-is-guest'] = 'true';
      } else {
        payload.userId = currentUser.id;
        headers['x-user-id'] = currentUser.id;
        const token = authToken || localStorage.getItem('recode_access_token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      if (sourceType === 'direct') {
        payload.language = effectiveLang.id;
        payload.content = code;
        payload.code = code;
        payload.filePath = dynamicFilename;
      } else {
        payload.url = normalizedGithubUrl;
        payload.branch = githubBranch.trim() || 'main';
      }

      let res;
      const targetUrl = API_BASE_URL ? `${API_BASE_URL}/api/v1/reviews/run` : '/api/v1/reviews/run';
      try {
        res = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        // Fallback retry using relative proxy path if absolute URL fetch failed (e.g. CORS/network)
        if (API_BASE_URL) {
          try {
            res = await fetch('/api/v1/reviews/run', {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            });
          } catch (proxyErr) {
            throw fetchErr;
          }
        } else {
          throw fetchErr;
        }
      }

      let responseData = {};
      try {
        responseData = await res.json();
      } catch (jsonErr) {
        responseData = {};
      }

      if (!res.ok || responseData.status === 'error') {
        if (res.status === 404) {
          triggerValidationError('Endpoint not found: POST /api/v1/reviews/run. Please verify the Express server is running on port 5000.');
        } else {
          const message = responseData.message || responseData.error || `Review pipeline execution failed (HTTP ${res.status}).`;
          triggerValidationError(message);
        }
        setLoading(false);
        return;
      }

      // Review succeeded, navigate to /review/:id with state payload
      const reviewId = responseData.data?.id || responseData.id;
      if (reviewId) {
        navigate(`/review/${reviewId}`, { state: { review: responseData.data || responseData } });
      } else {
        triggerValidationError('Pipeline executed, but review UUID was not returned.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Review execution error:', err);
      const isOffline =
        err.name === 'TypeError' ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('Network request failed');

      if (isOffline) {
        triggerValidationError('Backend server is unreachable. Please verify the Express server is running on port 5000.');
      } else {
        triggerValidationError(`Failed to connect to review pipeline: ${err.message}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-[#F1F1F1] min-h-screen flex flex-col font-sans antialiased selection:bg-[#02C8F0] selection:text-[#0F0F0F]">
      
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 w-full h-14 bg-[#0F0F0F] border-b border-[#303030] z-50">
        <div className="w-full h-full px-4 sm:px-6 flex items-center justify-between">
          
          {/* Left Brand Identity */}
          <div className="flex items-center">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="flex items-center focus:outline-none group select-none cursor-pointer"
            >
              <BrandLogo
                className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
              />
            </a>
          </div>

          {/* Right Header Navigation & Session */}
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 sm:gap-2">
              <button
                id="headerBackLink"
                onClick={() => navigate('/')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#272727] text-xs font-medium text-[#F1F1F1] transition-colors cursor-pointer"
                title="Return to landing page"
              >
                <ArrowLeft className="w-4 h-4 text-[#AAAAAA]" />
                <span className="hidden md:inline">Back</span>
              </button>

              <button
                id="headerHistoryLink"
                onClick={() => navigate('/history')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#AAAAAA] hover:text-[#F1F1F1] hover:bg-[#272727] transition-colors cursor-pointer"
                title="View review history & audit reports"
              >
                <Clock className="w-4 h-4 text-[#AAAAAA]" />
                <span className="hidden md:inline">History</span>
              </button>
            </nav>

            {/* Connected Single-Unit Profile & Session Badge */}
            <UserSessionPill onClick={() => { if (isGuest) navigate('/'); }} />
          </div>

        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="w-full pt-14 flex-1 bg-[#0F0F0F]">
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          
          {/* Header & Step Indicator */}
          <div className="flex flex-col items-start gap-1">
            <div className="inline-flex items-center gap-2 bg-[#181818] border border-[#303030] rounded-full px-3 py-1 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#02C8F0]" />
              <span className="font-mono text-xs text-[#AAAAAA] tracking-tight">
                Step 1: Choose Source &amp; Add Code
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F1F1F1] tracking-tight mt-2">
              Choose how to add your code
            </h1>
            <p className="text-sm text-[#AAAAAA] max-w-2xl leading-relaxed">
              Select an input source to evaluate code quality, security vulnerabilities, and get plain-language recommendations.
            </p>
          </div>

          {/* Source Selection Toggle Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card A: Paste Code Directly */}
            <div
              id="sourceCardDirect"
              onClick={() => {
                setSourceType('direct');
                setErrorMsg('');
              }}
              className={`rounded-xl p-5 cursor-pointer relative transition-all ${
                sourceType === 'direct'
                  ? 'bg-[#181818] border-2 border-[#02C8F0]'
                  : 'bg-[#181818] border border-[#303030] hover:border-[#3F3F3F] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-sm text-[#02C8F0]">&lt; / &gt;</span>
                  <span className="text-sm font-semibold text-[#F1F1F1]">Paste Code Directly</span>
                  {sourceType === 'direct' && (
                    <span className="bg-[#02C8F0]/15 text-[#02C8F0] font-mono text-[11px] px-2 py-0.5 rounded border border-[#02C8F0]/30 select-none">
                      Active
                    </span>
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    sourceType === 'direct' ? 'border-[#02C8F0]' : 'border-[#303030]'
                  }`}
                >
                  {sourceType === 'direct' && <div className="w-2.5 h-2.5 rounded-full bg-[#02C8F0]" />}
                </div>
              </div>
              <p className="text-xs text-[#AAAAAA] mt-2 pr-6 leading-relaxed">
                Paste code snippets or single-file modules for immediate static and AI analysis.
              </p>
            </div>

            {/* Card B: Public GitHub Repository */}
            <div
              id="sourceCardGithub"
              onClick={() => {
                setSourceType('github');
                setErrorMsg('');
              }}
              className={`rounded-xl p-5 cursor-pointer relative transition-all ${
                sourceType === 'github'
                  ? 'bg-[#181818] border-2 border-[#02C8F0]'
                  : 'bg-[#181818] border border-[#303030] hover:border-[#3F3F3F] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <GitBranch className="w-4 h-4 text-[#AAAAAA]" />
                  <span className="text-sm font-semibold text-[#F1F1F1]">Public GitHub Repository</span>
                  {sourceType === 'github' && (
                    <span className="bg-[#02C8F0]/15 text-[#02C8F0] font-mono text-[11px] px-2 py-0.5 rounded border border-[#02C8F0]/30 select-none">
                      Active
                    </span>
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    sourceType === 'github' ? 'border-[#02C8F0]' : 'border-[#303030]'
                  }`}
                >
                  {sourceType === 'github' && <div className="w-2.5 h-2.5 rounded-full bg-[#02C8F0]" />}
                </div>
              </div>
              <p className="text-xs text-[#AAAAAA] mt-2 pr-6 leading-relaxed">
                Import files directly from any public GitHub repository for automated analysis with SSRF safeguards.
              </p>
            </div>

          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              id="errorBanner"
              ref={errorBannerRef}
              role="alert"
              className="scroll-mt-24 p-3.5 rounded-lg bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 text-[#FF4D4D] text-xs flex items-start gap-2.5 transition-all"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Main Configuration & Editor Area */}
          <div className="bg-[#181818] border border-[#303030] rounded-xl p-6 flex flex-col gap-5">
            
            {/* Top Configuration Row: Conditional for Direct vs GitHub */}
            {sourceType === 'direct' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Project Name (Direct Mode) */}
                <div className="flex flex-col">
                  <label
                    htmlFor="projectNameInput"
                    className="font-mono text-xs text-[#717171] uppercase tracking-wider mb-1.5 select-none"
                  >
                    PROJECT NAME
                  </label>
                  <input
                    id="projectNameInput"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Student Management System"
                    autoComplete="off"
                    className="scroll-mt-24 bg-[#212121] text-[#F1F1F1] border border-[#303030] focus:border-[#02C8F0] focus:outline-none rounded-lg px-3.5 py-2.5 font-body-md text-sm w-full transition-colors placeholder:text-[#717171] [&:-webkit-autofill]:bg-[#212121] [&:-webkit-autofill]:text-[#F1F1F1] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#212121_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#F1F1F1]"
                  />
                </div>

                {/* Programming Language Dropdown (Direct Mode Only) */}
                <div className="flex flex-col relative" ref={dropdownRef}>
                  <div className="flex items-center justify-between mb-1.5 select-none">
                    <label className="font-mono text-xs text-[#717171] uppercase tracking-wider">
                      PROGRAMMING LANGUAGE
                    </label>
                    {isAutoDetect && (code || '').trim() && (
                      <span
                        id="autoDetectedBadge"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-[#02C8F0] bg-[#02C8F0]/10 border border-[#02C8F0]/25 transition-all"
                      >
                        <Sparkles className="w-3 h-3 text-[#02C8F0]" />
                        Auto-detected ({(effectiveLang?.label || 'Code').split(' ')[0]})
                      </span>
                    )}
                  </div>
                  
                  <div
                    id="langDropdownTrigger"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDropdownOpen((prev) => !prev);
                      }
                    }}
                    className="scroll-mt-24 bg-[#212121] border border-[#303030] text-[#F1F1F1] px-3.5 py-2.5 rounded-lg text-sm w-full flex items-center justify-between cursor-pointer select-none hover:border-[#3F3F3F] focus:border-[#02C8F0] focus:outline-none transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${effectiveLang ? 'bg-[#02C8F0]' : 'bg-[#717171]'}`} />
                      <span
                        id="selectedLanguageLabel"
                        className="text-[#F1F1F1] flex items-center gap-1.5"
                      >
                        {isAutoDetect ? (
                          <>
                            <span>Auto Detect</span>
                            {(code || '').trim() ? (
                              <span className="text-[#02C8F0] font-mono text-xs">
                                ({(effectiveLang?.label || 'Code').split(' ')[0]})
                              </span>
                            ) : (
                              <span className="text-[#717171] font-mono text-xs">(default)</span>
                            )}
                          </>
                        ) : (
                          manualLang?.label || 'Select Language...'
                        )}
                      </span>
                    </div>
                    <ChevronDown
                      id="langDropdownChevron"
                      className={`w-4 h-4 text-[#AAAAAA] transition-transform duration-150 ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>

                  {/* Dropdown Menu */}
                  {dropdownOpen && (
                    <div
                      id="langDropdownList"
                      className="absolute top-full left-0 right-0 mt-1.5 bg-[#212121] border border-[#3F3F3F] rounded-lg shadow-xl z-30 py-1 overflow-hidden"
                    >
                      {/* Auto Detect Option (Default) */}
                      <div
                        id="langOptionAutoDetect"
                        onClick={handleSelectAutoDetect}
                        className={`px-3.5 py-2.5 text-xs text-[#F1F1F1] hover:bg-[#272727] cursor-pointer flex items-center justify-between border-b border-[#303030]/60 ${
                          isAutoDetect ? 'bg-[#272727]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#02C8F0]" />
                          <span className="font-medium">Auto Detect</span>
                          {isAutoDetect && (code || '').trim() && (
                            <span className="text-[11px] font-mono text-[#02C8F0]/90">
                              ({(effectiveLang?.label || 'Code').split(' ')[0]})
                            </span>
                          )}
                        </div>
                        {isAutoDetect && (
                          <span className="font-mono text-[11px] text-[#02C8F0] flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>

                      {/* Manual Language Options */}
                      {LANGUAGES.map((lang) => (
                        <div
                          key={lang.id}
                          id={`langOption-${lang.id}`}
                          onClick={() => handleSelectLanguage(lang)}
                          className={`px-3.5 py-2.5 text-xs text-[#F1F1F1] hover:bg-[#272727] cursor-pointer flex items-center justify-between ${
                            !isAutoDetect && manualLang?.id === lang.id ? 'bg-[#272727]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{lang.label}</span>
                          </div>
                          {!isAutoDetect && manualLang?.id === lang.id && (
                            <span className="font-mono text-[11px] text-[#02C8F0] flex items-center gap-1">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              /* GitHub Mode: Full Width Project Name Only (Language Dropdown Hidden) */
              <div className="w-full">
                <div className="flex flex-col">
                  <label
                    htmlFor="projectNameInput"
                    className="font-mono text-xs text-[#717171] uppercase tracking-wider mb-1.5 select-none"
                  >
                    PROJECT NAME
                  </label>
                  <input
                    id="projectNameInput"
                    type="text"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value);
                      autoDetectedRepoNameRef.current = '';
                    }}
                    placeholder="e.g., student-management-system (or leave blank to auto-detect from repo name)"
                    autoComplete="off"
                    className="scroll-mt-24 bg-[#212121] text-[#F1F1F1] border border-[#303030] focus:border-[#02C8F0] focus:outline-none rounded-lg px-3.5 py-2.5 font-body-md text-sm w-full transition-colors placeholder:text-[#717171] [&:-webkit-autofill]:bg-[#212121] [&:-webkit-autofill]:text-[#F1F1F1] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#212121_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#F1F1F1]"
                  />
                </div>
              </div>
            )}

            {/* Direct Code Snippet Workspace */}
            {sourceType === 'direct' ? (
              <div className="flex flex-col gap-2">
                
                {/* Header Bar above Editor */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#717171] select-none">
                    SOURCE CODE
                  </span>
                  <div className="flex items-center gap-3 text-xs text-[#AAAAAA] select-none">
                    <button
                      id="loadSampleBtn"
                      type="button"
                      onClick={handleLoadSample}
                      className="flex items-center gap-1.5 text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer bg-transparent"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#02C8F0]" />
                      <span>Load Sample Code</span>
                    </button>
                    <span className="text-[#303030]">|</span>
                    <button
                      id="clearEditorBtn"
                      type="button"
                      onClick={handleClearEditor}
                      className="flex items-center gap-1.5 text-[#AAAAAA] hover:text-[#F1F1F1] transition-colors cursor-pointer bg-transparent"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#AAAAAA]" />
                      <span>Clear Editor</span>
                    </button>
                  </div>
                </div>

                {/* Code Editor Window */}
                <div className="bg-[#0F0F0F] border border-[#303030] rounded-lg overflow-hidden flex flex-col">
                  
                  {/* Editor Window Titlebar */}
                  <div className="bg-[#1C1C1C] border-b border-[#303030] px-4 py-2 flex items-center justify-between select-none">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                      </div>
                      <div
                        id="fileTabBadge"
                        className="font-mono text-xs text-[#F1F1F1] bg-[#0F0F0F] px-2.5 py-0.5 rounded border border-[#303030] flex items-center gap-1.5"
                      >
                        <FileCode className="w-3.5 h-3.5 text-[#02C8F0]" />
                        <span>{dynamicFilename}</span>
                      </div>
                      {effectiveLang && (
                        <span
                          id="activeGrammarBadge"
                          className="font-mono text-[11px] text-[#02C8F0] bg-[#02C8F0]/10 border border-[#02C8F0]/20 px-2 py-0.5 rounded hidden sm:inline-flex items-center gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#02C8F0]" />
                          {isAutoDetect ? `Auto: ${(effectiveLang?.label || 'Code').split(' ')[0]}` : `${(effectiveLang?.label || 'Code').split(' ')[0]} Mode`}
                        </span>
                      )}
                    </div>
                    <div id="topLineCounter" className="font-mono text-xs text-[#717171]">
                      {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                    </div>
                  </div>

                  {/* Monospace Code Workspace Body */}
                  <div className="min-h-[260px] max-h-[420px] p-4 flex font-mono text-xs leading-relaxed bg-[#131313] relative overflow-hidden">
                    
                    {/* Line Numbers Gutter */}
                    <div
                      id="lineNumbersGutter"
                      ref={gutterRef}
                      className="font-mono text-xs text-[#717171] pr-3 select-none border-r border-[#262626] mr-3 text-right w-8 flex flex-col shrink-0 overflow-hidden"
                    >
                      {linesArray.map((num) => (
                        <span key={num} className="leading-relaxed">
                          {num}
                        </span>
                      ))}
                    </div>

                    {/* Code Input Textarea & Highlight Overlay */}
                    <div className="flex-1 relative flex flex-col min-h-[220px] overflow-hidden">
                      {/* Highlighted Code Underlay */}
                      <pre
                        ref={highlightRef}
                        aria-hidden="true"
                        className="absolute inset-0 m-0 p-0 font-mono text-xs leading-relaxed overflow-hidden pointer-events-none whitespace-pre-wrap break-all text-[#F1F1F1] select-none"
                      >
                        <code
                          className={`language-${effectiveLang?.id || 'javascript'}`}
                          dangerouslySetInnerHTML={{ __html: highlightedCode }}
                        />
                      </pre>

                      {/* Interactive Textarea Overlay */}
                      <textarea
                        id="codeEditorArea"
                        ref={textareaRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onScroll={handleScroll}
                        placeholder="// Paste your source code here (e.g. controllers, services, algorithms)..."
                        spellCheck="false"
                        className="scroll-mt-24 absolute inset-0 w-full h-full bg-transparent text-transparent caret-[#02C8F0] font-mono text-xs placeholder:text-[#717171] placeholder:italic focus:outline-none resize-none leading-relaxed border-none p-0 overflow-y-auto selection:bg-[#02C8F0]/30 selection:text-transparent"
                      />
                    </div>

                  </div>

                  {/* Bottom Editor Status Bar */}
                  <div className="bg-[#181818] border-t border-[#303030] px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs text-[#717171] select-none">
                    <div id="bottomEditorMetrics">
                      {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters • {lineCount}{' '}
                      {lineCount === 1 ? 'line' : 'lines'}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:inline">
                        {effectiveLang ? `${(effectiveLang?.label || 'Code').split(' ')[0]} Dual-Engine: Ready` : 'Dual-Engine Pipeline: Ready'}
                      </span>
                      <div className="w-24 h-1.5 bg-[#212121] rounded-full overflow-hidden">
                        <div
                          id="usageProgressBar"
                          className="h-full bg-[#02C8F0] transition-all duration-150"
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <span id="usageProgressPercent" className="text-[#AAAAAA] w-8 text-right">
                        {usagePercent}%
                      </span>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              /* Public GitHub Repository Input Workspace */
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col">
                  <label
                    htmlFor="githubUrlInput"
                    className="font-mono text-xs text-[#717171] uppercase tracking-wider mb-1.5 select-none"
                  >
                    GITHUB REPOSITORY URL
                  </label>
                  <input
                    id="githubUrlInput"
                    type="url"
                    value={githubUrl}
                    onChange={(e) => handleGithubUrlChange(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    autoComplete="off"
                    className="scroll-mt-24 bg-[#212121] text-[#F1F1F1] border border-[#303030] focus:border-[#02C8F0] focus:outline-none rounded-lg px-3.5 py-2.5 font-body-md text-sm w-full transition-colors placeholder:text-[#717171] [&:-webkit-autofill]:bg-[#212121] [&:-webkit-autofill]:text-[#F1F1F1] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#212121_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#F1F1F1]"
                  />
                </div>

                <div className="flex flex-col">
                  <label
                    htmlFor="githubBranchInput"
                    className="font-mono text-xs text-[#717171] uppercase tracking-wider mb-1.5 select-none"
                  >
                    TARGET BRANCH (OPTIONAL)
                  </label>
                  <input
                    id="githubBranchInput"
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    autoComplete="off"
                    className="bg-[#212121] text-[#F1F1F1] border border-[#303030] focus:border-[#02C8F0] focus:outline-none rounded-lg px-3.5 py-2.5 font-body-md text-sm w-full transition-colors placeholder:text-[#717171] [&:-webkit-autofill]:bg-[#212121] [&:-webkit-autofill]:text-[#F1F1F1] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#212121_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#F1F1F1]"
                  />
                </div>

                <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 text-xs text-[#AAAAAA] leading-relaxed">
                  <span className="text-[#F1F1F1] font-semibold">GitHub Ingestion Pipeline: </span>
                  Scans candidate files (max 50 files, 10MB repository limit). Re:Code enforces SSRF safeguards, blocking private IP ranges and internal redirects.
                </div>
              </div>
            )}

            {/* Form Footer & Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-[#262626] mt-1">
              
              {/* In-memory non-executing security disclaimer banner */}
              <div className="flex items-center gap-2 text-[#717171] text-xs select-none">
                <Shield className="w-4 h-4 text-[#AAAAAA] shrink-0" />
                <span>Code is analyzed in-memory as untrusted data and is never executed.</span>
              </div>

              {/* Primary "Start Review" Action Button */}
              <button
                id="startReviewBtn"
                type="button"
                disabled={loading}
                onClick={handleSubmitReview}
                className="bg-[#F1F1F1] text-[#0F0F0F] hover:bg-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer select-none shrink-0 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Code...</span>
                  </>
                ) : (
                  <>
                    <span>Start Review</span>
                    <Play className="w-4 h-4 fill-current" />
                  </>
                )}
              </button>

            </div>

          </div>

        </div>
      </main>

      {/* Docked Footer */}
      <Footer className="mt-auto" />
    </div>
  );
}
