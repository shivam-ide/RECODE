# Re:Code — Enterprise Dual-Engine Automated Code Review & Security Audit Platform

> **Read. Review. Refine.**  
> *Complete Architectural Specification, Pipeline Deep-Dive, and Presentation Defense Manual*

---

## 📋 Executive Summary & Elevator Pitch

**Re:Code** is an enterprise-grade automated code review platform that solves the modern code review trilemma:
1. **Traditional Linters & Static Analysis** (ESLint, SonarQube) are rigid, produce false positives, and cannot evaluate high-level architectural flaws or algorithmic complexity.
2. **Pure LLM Reviewers** (ChatGPT, Gemini alone) hallucinate line numbers, miss strict syntax/AST boundaries, and struggle with deterministic repeatability.
3. **Manual Human Reviews** create massive engineering bottlenecks, slow down CI/CD pipelines, and let security flaws slip into production.

**The Re:Code Solution:**  
Re:Code couples a **Deterministic AST Parser** (Babel) with a **Semantic Generative AI Engine** (Google Gemini 1.5/2.0) into a single, fault-tolerant review pipeline. Overlapping issues are corroborated and labeled as **`HYBRID (AST + AI)`**, penalties are mathematically capped to prevent minor formatting from failing a project, in-memory live code patching boosts health scores in real time, and content-adaptive PDF audit reports are exported with zero trailing blank pages.

---

## 🏗️ 1. System Architecture & Dual-Engine Pipeline

```
                                  [ User Input ]
                   (Single Snippet, Multi-File, or GitHub URL)
                                        │
                                        ▼
                         [ Ingestion & Discovery Layer ]
                  (Recursive Git Trees API, Blob Filtering)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
          [ Engine A: Static AST ]               [ Engine B: Gemini AI ]
       (Babel Parser & AST Visitors)          (Google Gemini 1.5/2.0 LLM)
       • CWE-89 SQL Injection                • Algorithmic Bottlenecks O(N^2)
       • CWE-798 Hardcoded Secrets           • Design & Architectural Flaws
       • CWE-563 Dead Code / Unused          • Race Conditions / Logic Traps
       • CWE-532 Console Logs                • Partial Mode Fallback Protection
       • CWE-390 Empty Catch Blocks          
                    └───────────────────┬───────────────────┘
                                        │
                                        ▼
                      [ Normalization & Deduplication ]
                   (Line Proximity +/-2, HYBRID Attribution)
                                        │
                                        ▼
                       [ Mathematical Scoring Engine ]
                   (100-pt Base, Severity Penalty Capping)
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
         [ PostgreSQL / Supabase ]               [ Interactive Review Canvas ]
          • Reviews, Files, Issues                 • YouTube Dark Mode UI
          • Row Level Security (RLS)               • In-Memory Live Patching
          • Guest UUID Sessions                    • Health Dock: Safe Fixes
                                                   • Dynamic A4 PDF & README
```

### The Seven Pipeline Stages:
1. **Ingestion & Discovery**: Ingests pasted snippets, file bundles, or traverses GitHub repositories recursively up to 10 folder levels using the Git Trees API.
2. **Concurrent Dual-Engine Execution**: Dispatches the source code simultaneously to Babel AST visitors and Google Gemini AI via `@google/genai`.
3. **Normalization & Deduplication**: Detects cross-engine overlaps based on file identity, line proximity ($\le 2$ lines), and semantic rule equivalence.
4. **Mathematical Scoring**: Calculates an explainable 100-point health score using penalty capping per severity level.
5. **Persistence & Sync**: Stores review metadata, evaluated files, and categorized issues into PostgreSQL via Supabase.
6. **Interactive Review Canvas (Page 3)**: Displays findings with interactive red/green diffs, 1-click in-memory patches, and "Apply All Safe Fixes".
7. **Content-Adaptive Export**: Streams formal A4 audit PDFs via PDFKit and exports GitHub-ready `README.md` summaries.

---

## 🔍 2. Repository & Snippet Ingestion Engine

### Why GitHub Git Trees API?
Standard crawlers query `/repos/{owner}/{repo}/contents`, which only returns root-level files. When scanning real projects (like e-commerce backends or microservices), this misses the actual controllers, routes, and models inside `src/` or `server/`, resulting in false 100/100 perfect scores.

Re:Code switches to the **GitHub Git Trees Recursive API**:
```http
GET https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1
```

### Filtering & Candidate Prioritization:
- **Included Extensions**: `.js`, `.jsx`, `.ts`, `.tsx`, `.py`, `.java`, `.cpp`
- **Excluded Paths**: `node_modules/`, `dist/`, `build/`, `.git/`, `coverage/`, `scorecard/`, `docs/`, `test-results/`, and `*.html`
- **Architectural Priority**: Application entry points (`app.js`, `server.js`, `index.js`), controllers, routes, and database models are processed first.

---

## ⚙️ 3. Deterministic Static AST Engine (Babel)

The AST engine operates on parsed AST structures rather than regex string matching.

### Implemented Rule Matrix:
| Rule ID | CWE / Standard | AST Visitor Pattern | Deterministic Remediation |
| :--- | :--- | :--- | :--- |
| **`SQL_INJECTION`** | CWE-89 / OWASP A03 | `BinaryExpression (+)` inside database query call (`db.query`, `pool.query`) | Parameterized placeholders (`$1, $2`) |
| **`HARDCODED_SECRET`** | CWE-798 / OWASP A07 | `StringLiteral` matching high-entropy regex (JWT, AWS keys, Stripe tokens) | Extract to root `.env` via `process.env.KEY` |
| **`UNUSED_VARIABLE`** | CWE-563 / Dead Code | `VariableDeclarator` where `binding.referenced` is false in scope | Remove unused identifier or export it |
| **`CONSOLE_LOG_STMT`** | CWE-532 / Info Leak | `CallExpression` on `console.log` / `console.debug` | Remove statement or route to Winston/Pino |
| **`EMPTY_CATCH_BLOCK`** | CWE-390 / Error Handling | `CatchClause` containing an empty `BlockStatement` | Log with `logger.error` and handle or rethrow |
| **`PARSER_ERROR`** | Syntax Integrity | Trapped syntax exception during Babel parse pass | Pinpoint exact missing delimiter or token |

---

## 🤖 4. Generative Google Gemini AI Review Engine

Engine B communicates with the Gemini 1.5 / 2.0 API via `@google/genai`.

### Prompt Strategy & Structured Output:
- Instructs Gemini to evaluate:
  - Algorithmic flaws (infinite recursion, cycle traps in graph traversals, O(N^2) nested database queries).
  - Business logic race conditions and architectural antipatterns.
- Enforces strict JSON schema output matching `{ title, file, line, severity, category, explanation, diff_before, diff_after }`.

### Graceful Fallback (Partial Analysis Mode):
If Gemini API rate limits or network issues occur:
- The error is trapped gracefully without throwing a 500 error.
- Telemetry marks `partialMode: true`.
- The full deterministic AST analysis and scoring engine continue uninterrupted.

---

## 🔀 5. Findings Normalization & HYBRID Attribution

### Proximity Matching & Deduplication Algorithm:
1. **File Matching**: Normalizes Windows backslashes (`\`) and POSIX slashes (`/`).
2. **Proximity Window**: Flags matching rules within $\pm 2$ lines.
3. **Consolidation**:
   - Adopts the AST engine's exact physical line number.
   - Adopts Gemini AI's plain-language explanation and diff patch.
   - Assigns **`engine: "HYBRID (AST + AI)"`** with cyan badge styling.
4. **Same-Line Collision Handling**:
   - If a line has both an unused variable and a hardcoded secret, it merges into a single CRITICAL card:  
     `"Hardcoded Secret (Variable is also unused)"`.

### Badge Styling Matrix:
- **`HYBRID (AST + AI)`**: Cyan Badge (`#02C8F0`) — Corroborated by both AST & Gemini.
- **`Static AST`**: Dark Gray Badge (`#AAAAAA`) — Detected by deterministic Babel rules.
- **`Gemini AI`**: Amber Badge (`#FFA116`) — Discovered by Gemini semantic analysis.

---

## 📊 6. Mathematical Scoring Engine & Penalty Capping

### The Scoring Formula:
$$\text{Deductions} = (N_{\text{crit}} \times 20) + (N_{\text{high}} \times 10) + \min(20, N_{\text{med}} \times 3) + \min(15, N_{\text{low}} \times 0.5)$$
$$\text{Health Score} = \max(0, \min(100, 100 - \text{Deductions}))$$

### Key Rules:
- **Penalty Capping**: Low-severity issues (console logs, unused variables) can deduct at most **15 points** total across an entire project. Medium issues are capped at **20 points**.
- **Quality Floor**: Any project with **0 Critical** and **0 High** vulnerabilities will **never drop below Grade C (minimum score 70)**.

### Letter Grade Scale:
- **90 – 100**: **Grade A+** (Production Ready)
- **80 – 89**: **Grade A / B+** (Stable Architecture)
- **70 – 79**: **Grade B / C** (Needs Attention)
- **60 – 69**: **Grade D** (Elevated Security Risk)
- **Below 60**: **Grade F** (Critical Vulnerabilities Present)

---

## 💻 7. Frontend Review Canvas & Live In-Memory Patching

### UI/UX Design System:
- **YouTube Dark Mode Specification**: `#0F0F0F` background, `#181818` cards, `#212121` hover states, `#303030` borders.
- **Minimalist Header**: Re:Code Official Logo (`/Logo.svg`) + `|` + `"Read. Review. Refine."`. Zero clutter.

### Key Interactive Features:
1. **Interactive Diff Viewer (`DiffViewer.jsx`)**:
   - Red (-) vulnerable lines vs green (+) remediated lines.
   - Lines exceeding 120 characters are truncated with an ellipsis (`...`) and wrapped using `word-break: break-all; white-space: pre-wrap;`.
   - Complete XSS immunity via semantic `<pre>` and `<code>` text nodes.
2. **In-Memory Live Code Patching**:
   - Clicking **"Apply Patch"** updates the client's live code model directly without server roundtrips.
   - Dynamically boosts the displayed health score (+2 pts per fix).
3. **"Apply All Safe Fixes"**:
   - Single-click action in the docked footer.
   - Automatically applies all LOW and INFO severity patches in **descending line order** (bottom-to-top), preventing line offset corruption.
4. **Live Raw Code Modal**:
   - Inspects the complete, in-memory patched file with 1-click clipboard copying.
5. **Formal PDF Export**:
   - Downloads a formal PDF audit certificate directly from the backend.

---

## 📄 8. Dynamic PDF Generation Engine (PDFKit)

### Eliminating Trailing Blank Pages:
- **Adaptive A4 Margins**: 16mm (45.35pt).
- **Atomic Finding Cards**: Dynamically checks card height before rendering; triggers `doc.addPage()` cleanly before drawing if a card would overflow.
- **Safe Docked Footer**: Iterates over `doc.bufferedPageRange()` while temporarily suppressing `doc.page.margins.bottom = 0` to strictly prevent PDFKit from generating a blank trailing sheet.
- **Minified Line Wrapping**: Lines exceeding 120 characters are truncated with `...` to prevent horizontal canvas spillover.

---

## 🗄️ 9. Database Schema & Supabase Integration

### Relational Schema (PostgreSQL):
- **`reviews`**: Stores review ID (UUID), project name, health score, letter grade, and source metadata.
- **`review_files`**: Stores individual evaluated files with complete file content preserved for live patching.
- **`review_issues`**: Stores atomic findings with remediation diffs, line numbers, and engine attribution.

### Guest Mode Architecture:
- Anonymous audits generate a UUID session transmitted via `x-guest-session-id`.
- Permits guest users to audit repositories and export reports with zero authentication friction while respecting Supabase Row Level Security (RLS).

---

## 🛡️ 10. Security & Quality Assurance

- **OWASP Compliance**: Protects against SQLi, XSS, insecure deserialization, and information leaks.
- **Middleware**: Express `helmet`, strict CORS whitelist, `express-rate-limit`, and input sanitization.
- **Test Coverage**: **14 test suites** with **207 unit and integration tests** passing 100%.

---

## 🎓 11. Viva & Technical Interview Defense Guide

### Top 8 Viva Questions & Model Answers:

#### Q1: Why use a Dual-Engine architecture instead of relying solely on Google Gemini?
> **Answer**: Generative AI models are non-deterministic, can hallucinate invalid line numbers, and lack strict syntax boundary guarantees. Static AST traversal provides mathematical 100% certainty for known security rules (like SQLi and Hardcoded Secrets) with zero latency. Gemini complements this by catching algorithmic bottlenecks and architectural flaws that AST rules cannot anticipate. Re:Code delivers both mathematical precision and deep semantic reasoning.

#### Q2: How does the Deduplication and Normalization engine work?
> **Answer**: Our `findingsNormalizer.js` applies three criteria: (1) normalized file path match, (2) line proximity within $\pm 2$ lines, and (3) semantic rule correlation. When an overlap is detected, it merges them into a single `HYBRID (AST + AI)` finding, adopting the exact line number from the AST engine and the remediation diff from Gemini.

#### Q3: Why doesn't a project with 40 console.log statements receive Grade F?
> **Answer**: In `scoringEngine.js`, we implemented dynamic severity penalty capping. Low-severity issues deduct 0.5 points each but are capped at a maximum of 15 points across the entire project. Furthermore, we enforce a quality floor: any codebase with 0 Critical and 0 High vulnerabilities will never drop below Grade C (minimum score 70).

#### Q4: How does the GitHub Ingestion avoid missing deep backend files?
> **Answer**: Standard crawlers query the GitHub Contents API, which only reads root-level files. Re:Code queries the GitHub Git Trees API with the recursive flag (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`). This returns the entire tree in a single call, allowing us to prioritize controllers, routes, and models while ignoring test scorecards and build artifacts.

#### Q5: How does live in-memory patching work without corrupting line numbers?
> **Answer**: When applying multiple patches (via "Apply All Safe Fixes"), Re:Code sorts candidate issues descending by line number (bottom to top). Modifying lines at the bottom of the file first ensures that line index shifts do not alter line numbers higher up in the file.

#### Q6: How does the PDF engine prevent trailing blank pages?
> **Answer**: In `pdfGenerator.js`, we dynamically predict card height before rendering. For the docked footer pass, we iterate over `doc.bufferedPageRange()` while temporarily setting `doc.page.margins.bottom = 0`, preventing PDFKit from auto-triggering an unwanted extra page.

#### Q7: How is XSS prevented in the code diff viewer?
> **Answer**: `DiffViewer.jsx` sanitizes input using `sanitizeCodeSnippet()` and renders code strictly inside React semantic `<pre>` and `<code>` text nodes, treating all code as immutable text literals rather than executable DOM nodes.

#### Q8: What happens if Gemini API quotas run out during a live demo?
> **Answer**: `aiReviewer.js` catches errors gracefully and enters "Partial Analysis Mode". The AST engine continues uninterrupted, the score is calculated accurately, and the review completes without crashing.

---

## 🎬 12. 5-Minute Live Demonstration Script

1. **Step 1: Introduction (30s)**: Open `http://localhost:5173`. Showcase the YouTube Dark Mode UI and state: *"Re:Code is an enterprise dual-engine platform uniting deterministic AST security linting with Google Gemini AI semantic analysis."*
2. **Step 2: Ingest Code (45s)**: Navigate to `/submit`. Paste a vulnerable snippet (SQL injection, hardcoded secret, console.log) or enter a public GitHub repo URL. Click **"Audit Codebase"**.
3. **Step 3: Review Canvas Walkthrough (90s)**: Show the Health Score, severity cards, and category health bars. Point out the clean single engine badges: `Static AST`, `Gemini AI`, and `HYBRID (AST + AI)`.
4. **Step 4: Interactive Diff & Live Patching (60s)**: Show red (-) vs green (+) diffs. Click **"Apply Patch"**: show the button turn green (`✓ Patch Applied`), the score dynamically increase, and the in-memory code update.
5. **Step 5: Health Dock 'Apply All Safe Fixes' (45s)**: Click **"Apply All Safe Fixes"**. Show all LOW warnings turn green simultaneously and the score jump to Production Ready.
6. **Step 6: Live Raw Code & Export (30s)**: Click **"Raw Code"** to inspect the clean patched file. Click **"Download PDF"** to generate the formal audit report with zero trailing blank pages.
