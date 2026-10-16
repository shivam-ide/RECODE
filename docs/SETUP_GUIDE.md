# Re:Code Local Setup & Developer Guide

> Step-by-step instructions for installing dependencies, configuring environment variables, running migrations, launching dev servers, and executing test suites.

---

## 1. System Prerequisites

Ensure your development environment meets the following baseline requirements:

| Component | Minimum Version | Recommended Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.18.0` | `v20.x LTS` or higher | `node -v` |
| **npm** | `v9.0.0` | `v10.x` or higher | `npm -v` |
| **Git** | `v2.30.0` | Latest | `git --version` |

---

## 2. Repository Installation

Re:Code uses **npm workspaces** to manage both the Express backend and React frontend from the repository root.

```bash
# 1. Clone the repository
git clone https://github.com/shivam-ide/recode-app.git
cd recode-app

# 2. Install dependencies for all workspaces with a single command
npm install
```

This installs dependencies across the root, `/backend`, and `/frontend` directories concurrently.

---

## 3. Environment Variable Configuration

Create a `.env` file in the project root directory by copying the sample template:

```bash
# Windows PowerShell
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

### Complete Environment Variables Reference

```env
# ==============================================================================
# 1. APPLICATION ENVIRONMENT & NETWORKING
# ==============================================================================
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173,http://localhost:5174

# ==============================================================================
# 2. GOOGLE GEMINI AI CONFIGURATION
# ==============================================================================
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# ==============================================================================
# 3. SUPABASE POSTGRESQL & AUTHENTICATION
# ==============================================================================
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key_here
SUPABASE_DB_PASSWORD=your_supabase_postgres_password_here

# ==============================================================================
# 4. GITHUB API TOKEN (OPTIONAL)
# Increases rate limits from 60 req/hr to 5,000 req/hr for repository audits
# ==============================================================================
GITHUB_TOKEN=your_optional_github_personal_access_token
```

### Frontend Environment (Vite)
If configuring custom API URLs for remote deployments, verify `/frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key_here
```

---

## 4. Database Setup & Migration

Re:Code requires a Supabase PostgreSQL instance with Row Level Security (RLS) tables.

Run the automated migration runner to apply table schemas, indexes, and RLS triggers:

```bash
npm run migrate
```

*What this script does:*
1. Connects to the PostgreSQL connection pooler (port `6543`).
2. Applies `/backend/src/db/migrations/001_initial_schema.sql`.
3. Creates tables: `profiles`, `reviews`, `review_files`, `review_issues`, `review_reports`.
4. Creates performance indexes on `review_id` and `user_id`.
5. Establishes automatic triggers on `auth.users` to synchronize user profile records.
6. Enforces Row Level Security (RLS) policies for authenticated and guest users.

---

## 5. Running the Application Locally

### Option A: Run Both Backend & Frontend Simultaneously (Recommended)
```bash
npm run dev:all
```

### Option B: Run Services in Separate Terminals

**Terminal 1 — Express Backend API (Port 5000):**
```bash
npm run dev:backend
```
*Health verification:* Visit `http://localhost:5000/api/v1/health`

**Terminal 2 — React Client with Vite (Port 5173):**
```bash
npm run dev:frontend
```
*Application access:* Open `http://localhost:5173` in your browser.

---

## 6. Testing & Quality Assurance

### Run Backend Unit & Integration Tests (13 Suites, 187 Tests)
```bash
npm test --workspace=backend
```
Runs the full backend test suite in Jest with `--detectOpenHandles --runInBand`.

### Run Security Hardening Suite (Module 18)
```bash
npx --prefix backend jest tests/securityHardening.test.js
```
Verifies SSRF protection against 10 common internal network target patterns, DNS resolution, and 2MB payload clamps.

### Run Frontend Linting & Production Build
```bash
# Run oxlint across client codebase (0 warnings, 0 errors)
npm run lint --workspace=frontend

# Build optimized production bundle with Vite and Rolldown code-splitting
npm run build --workspace=frontend
```

### Run End-to-End System Audit Script
Ensure the backend server is running on port 5000, then execute:
```bash
node scratch/verify_all_modules.mjs
```
Validates Modules 1 through 18, testing health probes, CORS, submission validation, AST diagnostics, Gemini pipeline, persistence, PDF generation, README export, SSRF shield, and payload clamping.

---

## 7. Troubleshooting & FAQ

### 1. `EADDRINUSE: address already in use :::5000`
* **Cause**: Another process or previous node server instance is holding port 5000.
* **Resolution**:
  * Windows: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process`
  * macOS/Linux: `lsof -ti:5000 | xargs kill -9`

### 2. `Payload Too Large: Request exceeds maximum permitted limit of 2MB`
* **Cause**: The submitted code payload or repository snapshot exceeds the 2MB safety clamp.
* **Resolution**: Submit code files under 2MB. For large repositories, Re:Code automatically batches and filters files up to the 50 candidate file limit.

### 3. `SSRF Protection: Access to '...' is strictly forbidden`
* **Cause**: A target repository URL resolved to an internal, loopback, or private network address (e.g. `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `localhost`).
* **Resolution**: This is an intentional security defense (Module 18). Provide public repository URLs hosted on official `https://github.com/owner/repo`.

### 4. Supabase Connection Timeout (`ETIMEDOUT` on port 5432)
* **Cause**: Direct port 5432 is blocked by some ISPs or corporate networks.
* **Resolution**: Use the transaction pooler on port `6543` specified in the database configuration.
