# Re:Code: Automated Code Review, Static AST Security Analysis, and Generative AI Diagnostics Platform

**Academic Project Report Appendix**  
*Degree Requirement for Bachelor of Science in Computer Science (B.Sc. CS)*  
**Author:** Shivam Vishwakarma  
**Platform Version:** Re:Code v1.0.0 (Production Release)  
**Academic Year:** 2026  

---

## 1. Abstract

Modern software engineering demands high-velocity deployment cycles without compromising software reliability or security. While manual peer code reviews remain the gold standard for software quality assurance, they are inherently labor-intensive, slow, and prone to human oversight—particularly when auditing subtle injection vulnerabilities and asynchronous resource leaks. Conversely, conventional Static Application Security Testing (SAST) tools suffer from excessive false-positive rates and lack contextual understanding, while raw Large Language Model (LLM) prompts frequently hallucinate non-existent line numbers and syntactically invalid remediations.

This project introduces **Re:Code**, a hybrid code analysis and automated diagnostic system that synergistically combines deterministic **Abstract Syntax Tree (AST)** static traversal with contextual **Generative AI (Google Gemini)** reasoning. The platform ingests source code from direct snippets or recursive GitHub repositories, parses AST nodes to isolate syntax errors and security rule violations, queries Gemini with structured JSON output constraints, normalizes and deduplicates findings, calculates an objective 0-100 health score with letter grades, and persists audit sessions in a Supabase PostgreSQL database governed by Row Level Security (RLS). Re:Code incorporates an enterprise-grade security hardening layer featuring a pre-request DNS resolution Server-Side Request Forgery (SSRF) shield, in-memory payload clamps, and an XSS-immune code diff viewer adhering to YouTube Dark Mode design standards.

---

## 2. Problem Definition & Motivation

### 2.1 The Code Quality & Security Bottleneck
Software vulnerabilities are overwhelmingly introduced during the implementation phase. According to industry analyses (NIST, OWASP), fixing a vulnerability in post-production costs up to 30 times more than remediating it during development. Manual code review bottlenecks teams, leading to rushed approvals where critical issues (such as unparameterized SQL queries, hardcoded JWT secrets, and unhandled promise rejections) slip into production codebases.

### 2.2 Limitations of Existing Methodologies
1. **Rule-Based Linters (ESLint, SonarQube)**:
   * *Strengths*: Fast, deterministic, zero network latency.
   * *Limitations*: Incapable of understanding broader semantic intent, architectural patterns, or proposing multi-line contextual refactoring diffs.
2. **Naive LLM Code Reviewers (Unconstrained Prompts)**:
   * *Strengths*: Natural language explanations, broad conceptual understanding.
   * *Limitations*: Hallucinated line numbers, non-deterministic output formats, susceptibility to prompt injection, high API costs on large codebases, and lack of deterministic scoring baselines.
3. **Application Vulnerability to Ingestion Attacks**:
   * Automated code ingestion systems that fetch remote git repositories are acutely vulnerable to Server-Side Request Forgery (SSRF), DNS rebinding, and denial-of-service via memory exhaustion from oversized payloads.

---

## 3. Proposed System Architecture & Objectives

**Re:Code** resolves these dilemmas through a layered, defense-in-depth pipeline:

```
[ Code Submission: Snippet / GitHub URL ]
                 │
                 ▼
[ Security Hardening: SSRF Shield + DNS Resolution + 2MB Payload Clamp ]
                 │
                 ▼
[ Ingestion & Normalization: File Filtering & Batching ]
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Static AST Engine ] [ Gemini AI Engine ]
(@babel/parser)       (gemini-2.5-flash)
        │                 │
        └────────┬────────┘
                 ▼
[ Finding Normalizer & Deduplication ]
                 │
                 ▼
[ Deterministic Health Scoring (0-100, Grade A-F) ]
                 │
        ┌────────┴────────┐
        ▼                 ▼
[ Supabase PostgreSQL ] [ Multi-Format Reports ]
(RLS Persistence)       (PDFKit + Markdown)
        │
        ▼
[ Matte YouTube Dark UI (React 19 + XSS-Immune DiffViewer) ]
```

### Key Engineering Objectives:
* **Hybrid Verification**: Combine deterministic AST rule guarantees with Gemini contextual explanations.
* **Deterministic Scoring**: Compute code health scores via an objective mathematical penalty deduction algorithm.
* **SSRF & Denial-of-Service Immunity**: Pre-resolve DNS hostnames, reject all RFC private IP spaces, and clamp request bodies to 2MB.
* **Zero-Glow Visual Consistency**: Design an accessible, matte, YouTube Dark Mode user experience free from blurry neon glows or purple gradients.

---

## 4. Module Breakdown & Engineering Implementation

The platform was engineered across 19 sequential development modules:

### Module 1: Project Initialization & Health Probing
Established project skeleton with Express 5 REST API, standardized JSON responses (`apiResponse.js`), and dual health endpoints (`/health`, `/api/v1/health`) for container readiness probes.

### Module 2: Monorepo Topology & Environment Isolation
Configured npm workspaces managing `/backend` and `/frontend` under a single root. Structured `.env` configuration for database poolers, AI credentials, and client origins.

### Module 3: Database Persistence & Row Level Security
Implemented Supabase PostgreSQL schema with 5 relational tables (`profiles`, `reviews`, `review_files`, `review_issues`, `review_reports`). Established connection pooling on port 6543, cascade deletion triggers, and Row Level Security (RLS) policies isolating user and guest audits.

### Module 4: REST API Framework & Centralized Error Handling
Engineered custom `AppError` operational exception classes and a centralized Express error handling middleware that automatically redacts sensitive secrets (JWTs, Supabase keys, Gemini keys) from stack traces.

### Module 5: Code Submission & Schema Validation
Created validation services for direct snippets (language detection, 50,000 character limit) and GitHub repository targets (strict HTTPS, valid owner/repo schema).

### Module 6: GitHub Ingestion & Git Tree Traversal
Implemented recursive repository tree ingestion using the GitHub REST API. Enforced limits: maximum 50 candidate source files, 10MB total repository size, filtering out dependencies (`node_modules`, `vendor`), minified bundles, and non-code assets.

### Module 7: Static AST Analysis Engine
Engineered static AST analyzer leveraging `@babel/parser` and `@babel/traverse`. Created deterministic rules detecting SQL injection string concatenation (CWE-89), hardcoded JWT secrets (CWE-798), `eval()` execution (CWE-95), and blocking synchronous file I/O in loops (CWE-400). Syntax errors generate isolated `#AST-SYNTAX` finding cards without aborting the review run.

### Module 8: Security Headers & CORS Origin Control
Integrated Helmet with a Content Security Policy (CSP) constraining script and connection sources. Configured strict CORS origin checking whitelist matching `CLIENT_URL` and development origins.

### Module 9: Google Gemini Generative AI Review Engine
Integrated Google Gemini 2.5 Flash using structured response schemas (`Type.OBJECT`, `Type.ARRAY`). Prompts enforce strict line mapping, root cause analysis, and before/after remediation git diffs. Implemented resilient fallback to AST findings if the AI service experiences network throttling.

### Module 10: Deterministic Code Health Scoring Engine
Formulated penalty scoring algorithm deducting 25 points for Critical issues, 15 for High, 8 for Medium, and 3 for Low issues from a 100-point baseline, computing letter grades (A through F) with deployment gating indicators.

### Module 11: End-to-End Analysis Pipeline Orchestration
Constructed `orchestrator.js` uniting GitHub ingestion, AST static scanning, Gemini AI review, finding normalization, health scoring, and database persistence into an atomic workflow.

### Module 12: Database Persistence & Repository Layer
Built `reviewRepository.js` using Supabase Client for atomic transactional insertion of review sessions, associated files, and granular issues with join queries and cascade deletion.

### Module 13: YouTube Dark Mode Design System
Engineered client interface in Tailwind CSS v4 and React 19 matching the official YouTube Dark Mode canvas (`#0F0F0F`, `#181818`, `#212121`, `#02C8F0`). Built atomic `PillBadge` and `SeverityChip` components with flat, solid matte borders.

### Module 14: Authentication & Guest Session Sandboxing
Implemented hybrid authentication supporting Supabase email/password login and persistent guest sandbox sessions using `x-guest-session-id` headers and local storage sync.

### Module 15: Review Dashboard Canvas & Interactive Filtering
Built interactive review inspection canvas featuring health score gauges, file tree navigation, severity filtering (Critical, High, Medium, Low), search indexing, and 1-click patch application states.

### Module 16: Audit History Tracking & Session Deletion
Constructed `HistoryPage.jsx` providing chronological review audit history, search and filter controls, letter grade chips, review inspection redirection, and cascade deletion.

### Module 17: Multi-Format Reporting (PDF & README Generation)
Implemented export engines using `PDFKit` to produce branded multi-page diagnostic audit PDF reports and markdown generators for dynamic repository `README.md` health badges.

### Module 18: Security Hardening & SSRF Defense
Engineered a comprehensive SSRF shield resolving DNS hostnames prior to outbound fetches, blacklisting all private IP spaces (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16), clamping in-memory request bodies to 2MB (HTTP 413), and creating an XSS-immune code diff viewer (`DiffViewer.jsx`).

### Module 19: Full End-to-End Audit & Academic Documentation
Conducted comprehensive verification across all test suites, resolved bundle warnings via Vite Rolldown code-splitting, validated visual asset loading across all 4 pages, and compiled formal documentation.

---

## 5. Technical Stack Specifications

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js | `>= 18.18.0` | Asynchronous JavaScript runtime |
| **Package Management** | npm Workspaces | `>= 9.0.0` | Monorepo package management |
| **Backend Framework** | Express.js | `^5.3.0` | REST API routing and middleware pipeline |
| **AST Parser** | `@babel/parser` | `^7.29.9` | ECMAScript/TypeScript AST syntax tree generation |
| **AST Traverser** | `@babel/traverse` | `^7.29.10` | Visitor-pattern AST node inspection |
| **Generative AI** | Google Gemini 2.5 Flash | SDK `^2.30.0` | Semantic code reasoning & refactoring diffs |
| **Database & Auth** | Supabase (PostgreSQL) | `^2.118.0` | Relational storage with Row Level Security |
| **Database Pooler** | `pg` (node-postgres) | `^8.23.1` | Direct PostgreSQL migration connection |
| **PDF Generation** | PDFKit | `^0.20.2` | Vector PDF diagnostic audit reports |
| **Frontend Framework** | React | `^19.2.8` | Client user interface library |
| **Styling Engine** | Tailwind CSS | `^4.3.3` | Utility-first design token styling |
| **Bundler & Dev Server**| Vite (Rolldown) | `^8.3.0` | High-speed ESM development and build bundler |
| **Client Linter** | Oxlint | `^1.81.0` | High-performance static code linter |
| **Backend Test Runner**| Jest | `^30.5.2` | Unit, integration, and regression test runner |
| **HTTP Testing** | Supertest | `^7.3.1` | Integration test HTTP agent |

---

## 6. Testing, Quality Assurance & Security Validation

### 6.1 Test Suite Summary
The backend automated test suite comprises **13 test suites** and **187 individual test specifications**, executed under Jest:

```text
Test Suites: 13 passed, 13 total
Tests:       187 passed, 187 total
Snapshots:   0 total
Time:        33.277 s
Pass Rate:   100.0%
```

### 6.2 Test Suite Breakdown by Module
1. `health.test.js`: Root and standardized API health endpoint contracts (Module 1).
2. `security.test.js`: Helmet CSP headers, CORS origin verification, 404 handlers, rate limiting (Module 8).
3. `validators.test.js`: Direct snippet boundaries and GitHub repository URL validation (Module 5).
4. `database.test.js`: Supabase connectivity and query validation (Module 3).
5. `staticAnalyzer.test.js`: AST traversal rules for SQLi, hardcoded JWT, eval, synchronous I/O, syntax error handling (Module 7).
6. `githubIngestion.test.js`: GitHub git tree ingestion, candidate file filtering, rate limit handling (Module 6).
7. `geminiIntegration.test.js`: AI structured JSON schema responses, mock fallback logic (Module 9).
8. `scoring.test.js`: Penalty score calculations, letter grade assignments, grade boundary conditions (Module 10).
9. `normalizer.test.js`: Finding merging, deduplication, and line proximity clustering (Module 11).
10. `persistence.test.js`: Relational review storage, file/issue joins, cascade deletions (Module 12).
11. `reports.test.js`: Vector PDF report binary generation and README markdown badges (Module 17).
12. `pipeline.test.js`: Full end-to-end review orchestrator integration (Module 11).
13. `securityHardening.test.js`: SSRF shield DNS verification across 10 internal targets, 2MB payload clamps (Module 18).

### 6.3 SSRF 10-Pattern Attack Target Regression Matrix
Tested against `POST /api/v1/submissions/validate` and `POST /api/v1/reviews/run`:

| # | Attack Target Vector | Sample Target URL | Expected Status | Result |
| :-: | :--- | :--- | :-: | :---: |
| 1 | IPv4 Loopback | `http://127.0.0.1/admin/secrets` | HTTP 400 | **PASS** |
| 2 | Localhost Hostname | `https://localhost/owner/repo` | HTTP 400 | **PASS** |
| 3 | Cloud Metadata Service | `http://169.254.169.254/latest/meta-data/` | HTTP 400 | **PASS** |
| 4 | Class A Private (10/8) | `https://10.0.0.1/internal/repo` | HTTP 400 | **PASS** |
| 5 | Class B Private (172.16/12) | `https://172.16.5.10/database/repo` | HTTP 400 | **PASS** |
| 6 | Class C Private (192.168/16) | `https://192.168.1.1/router/firmware` | HTTP 400 | **PASS** |
| 7 | Unspecified Address | `https://0.0.0.0:8080/test` | HTTP 400 | **PASS** |
| 8 | IPv6 Loopback | `https://[::1]/internal/repo` | HTTP 400 | **PASS** |
| 9 | Internal Domain Names | `https://vault.internal/secrets` | HTTP 400 | **PASS** |
| 10 | Obfuscated Decimal IP | `http://2130706433/secrets` (127.0.0.1) | HTTP 400 | **PASS** |

### 6.4 Payload Boundary Enforcement Results
* Normal requests (`< 2MB`): Returned **HTTP 200 OK**.
* Payloads exceeding 2MB (`Content-Length > 2097152` or serialized body `> 2MB`): Rejected immediately with **HTTP 413 Payload Too Large**.

---

## 7. Results & Performance Evaluation

* **AST Parsing Latency**: Static traversal of JavaScript/TypeScript files averages **12ms to 25ms** per file on standard developer hardware.
* **Ingestion Throughput**: A 50-file GitHub repository is ingested, filtered, and analyzed concurrently in under **4.2 seconds**.
* **Frontend Bundle Optimization**: Vite production build produces **0 warnings** with Rolldown code-splitting:
  * Vendor chunk (`react`, `react-dom`, `react-router-dom`): 231.68 kB (gzip: 72.95 kB)
  * Application logic chunk: 386.35 kB (gzip: 97.09 kB)
  * Total initial load footprint: `< 175 kB` gzipped.
* **Code Linter**: `oxlint` executed across all 19 client components and utilities with **0 warnings and 0 errors** in 61ms.

---

## 8. Limitations & Future Scope

### 8.1 Current Limitations
1. **Multi-Language AST Depth**: The static AST engine currently uses Babel, offering full syntax traversal for JavaScript and TypeScript. Python, Java, and C++ are analyzed primarily through regularized AST tokenizers and Gemini generative reasoning.
2. **Repository Size Cap**: To prevent server starvation on shared infrastructure, repository scanning is capped at 50 candidate files and 10MB total code payload.

### 8.2 Future Scope & Extensions
1. **Tree-sitter Multi-Language Core**: Integrating WebAssembly Tree-sitter bindings to provide native AST tree parsing across Rust, Go, Python, and C++.
2. **GitHub Pull Request Webhook Bot**: Deploying Re:Code as a GitHub App that automatically analyzes opened Pull Requests and submits inline review comments.
3. **IDE Extension**: Packaging the diagnostic engine into an official Visual Studio Code extension with live inline squiggly warnings and 1-click refactoring shortcuts.
4. **Local LLM Sidecar**: Incorporating quantized local models (e.g. Gemma 2 9B, Qwen 2.5 Coder) for air-gapped on-premise enterprise deployments.

---

## 9. Conclusion

The **Re:Code** automated code review platform demonstrates that combining deterministic static analysis (Babel AST) with generative AI reasoning (Google Gemini) creates a highly effective, resilient diagnostic pipeline. By anchoring unstructured AI outputs with deterministic AST findings, mathematical health scoring, and robust defense-in-depth security hardening (SSRF shield, payload clamps, XSS-immune diff viewer), the project achieves professional-grade software assurance suitable for both modern software teams and academic evaluation.

---

## 10. References & Standards

1. **OWASP Foundation** (2021). *OWASP Top 10:2021 Security Vulnerabilities*. Open Web Application Security Project.
2. **The MITRE Corporation** (2024). *Common Weakness Enumeration (CWE) Specification*. National Vulnerability Database.
3. **Babel Project** (2025). *Babel Parser AST Specification & Visitor Traversal Architecture*.
4. **Google DeepMind** (2025). *Gemini 2.5: Multimodal & Reasoning Language Models for Structured Code Intelligence*.
5. **PostgreSQL Global Development Group** (2024). *PostgreSQL 16 Documentation: Row Security Policies & Performance Indexing*.
6. **IETF RFC 1918 & RFC 3927** (1996, 2005). *Address Allocation for Private Internets and Dynamic Configuration of IPv4 Link-Local Addresses*.
