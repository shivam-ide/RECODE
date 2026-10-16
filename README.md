# { Re:Code } — Read. Review. Refine.

> **Intelligent Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform**  
> *A College Project by Shivam Vishwakarma*

---

## 📌 Overview

**Re:Code** is an engineering-grade code analysis platform combining deterministic Abstract Syntax Tree (AST) static analysis with Google Gemini AI models. It empowers engineering teams and student builders to catch critical flaws, detect vulnerability vectors (OWASP Top 10), and receive plain-language refactoring diffs with 1-click remediation before code reaches production.

---

## 🏗️ Monorepo Architecture

```text
recode-app/
├── backend/                  # Node.js / Express REST API, AST engine & Gemini service
│   ├── src/                  # Server source code & analyzers
│   ├── package.json          # Backend dependencies & lifecycle scripts
│   └── README.md             # Backend architecture documentation
├── frontend/                 # Client UI application (Canvas, Diff Inspector, History)
│   ├── package.json          # Frontend dependencies & lifecycle scripts
│   └── README.md             # Frontend UI documentation
├── .env.example              # Documented environment variable template
├── .gitignore                # Complete exclusion list (node_modules, .env, dist, cache)
├── package.json              # Monorepo workspaces & concurrent script runner
└── README.md                 # Project documentation & setup instructions
```

---

## 📚 Project Documentation

Comprehensive architectural specifications, developer setup instructions, and academic research appendices are available in the [`/docs`](./docs) directory:

* 🏛️ **[System Architecture Specification](./docs/ARCHITECTURE.md)**: Monorepo topology, Express backend architecture, Supabase PostgreSQL schema, AST parser engine, Google Gemini AI pipeline, and Module 18 SSRF shield.
* 🛠️ **[Developer Setup & Installation Guide](./docs/SETUP_GUIDE.md)**: Prerequisites, environment variables, database migration commands, dev server workflows, and troubleshooting.
* 🎓 **[B.Sc. Computer Science Project Report Appendix](./docs/PROJECT_REPORT_APPENDIX.md)**: Formal academic project documentation covering problem formulation, 19-module breakdown, test results matrix, and future scope.

---

## ⚡ Tooling Requirements

- **Node.js**: `>= 18.0.0` (Active environment: `v24.22.0`)
- **npm**: `>= 9.0.0` (Active environment: `v11.19.1`)
- **Git**: `>= 2.30.0` (Active environment: `v2.56.0`)

---

## 🚀 Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and provide your credentials:

```bash
cp .env.example .env
```

Key configuration parameters:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Client anonymous key for public queries
- `SUPABASE_SERVICE_ROLE_KEY`: Elevated administrative backend key
- `GEMINI_API_KEY`: Google Gemini API key for AI diagnostic reasoning
- `PORT`: Backend server port (Default: `5000`)
- `RATE_LIMIT_*`: Throttling and denial-of-service prevention limits

### 2. Available Scripts

From the root monorepo directory:

```bash
# Run both backend and frontend concurrently
npm run dev:all

# Run test suites across all workspaces
npm run test:all

# Build all workspaces
npm run build:all

# Run linting across all workspaces
npm run lint:all
```

---

## 🛡️ Security & Privacy Notice
All code snippets and public GitHub repositories are evaluated in-memory as untrusted data. Private keys, `.env` files, and local audit caches are strictly excluded from version control via `.gitignore`.
