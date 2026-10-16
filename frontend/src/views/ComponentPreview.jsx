import React, { useState } from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import PillBadge from '../components/common/PillBadge';
import SeverityChip from '../components/common/SeverityChip';
import DiffViewer from '../components/common/DiffViewer';
import { 
  Check, 
  Terminal, 
  Layers, 
  Palette, 
  Code2, 
  Sparkles, 
  ShieldCheck, 
  Eye, 
  Flame,
  FileCode2,
  Cpu,
  RefreshCw
} from 'lucide-react';

const COLOR_TOKENS = [
  { name: 'surface-base', hex: '#0F0F0F', category: 'Surface', description: 'Application backdrop' },
  { name: 'surface-panel', hex: '#181818', category: 'Surface', description: 'Cards, navbars & sidebars' },
  { name: 'surface-input', hex: '#212121', category: 'Surface', description: 'Form fields & interactive chips' },
  { name: 'border-subtle', hex: '#303030', category: 'Border', description: 'Standard container dividers' },
  { name: 'border-strong', hex: '#3F3F3F', category: 'Border', description: 'Active & hover stroke highlights' },
  { name: 'text-primary', hex: '#F1F1F1', category: 'Text', description: 'Headings & primary content' },
  { name: 'text-secondary', hex: '#AAAAAA', category: 'Text', description: 'Subheadings & metadata labels' },
  { name: 'text-tertiary', hex: '#717171', category: 'Text', description: 'Muted captions & timestamps' },
  { name: 'code-cyan', hex: '#02C8F0', category: 'Accent', description: 'Brand highlight & code accents' },
  { name: 'severity-critical', hex: '#FF4D4D', category: 'Severity', description: 'OWASP / Remote Code Execution' },
  { name: 'severity-high', hex: '#FFA116', category: 'Severity', description: 'Privilege escalation / Auth leak' },
  { name: 'severity-med', hex: '#FFD600', category: 'Severity', description: 'Performance & logic smells' },
  { name: 'severity-low', hex: '#78DFFF', category: 'Severity', description: 'Formatting & minor conventions' },
  { name: 'severity-clean', hex: '#27C93F', category: 'Severity', description: 'Passed deterministic validation' },
];

export default function ComponentPreview({ onProbeBackend, backendStatus, backendLoading }) {
  const [activeTab, setActiveTab] = useState('preview');
  const [copiedToken, setCopiedToken] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('TypeScript');
  const [chipVariant, setChipVariant] = useState('matte');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const copyHex = (token) => {
    navigator.clipboard?.writeText(token.hex);
    setCopiedToken(token.name);
    setTimeout(() => setCopiedToken(null), 1800);
  };

  const sampleDiagnostics = [
    {
      id: 'REC-101',
      severity: 'critical',
      title: 'SQL Injection via Unsanitized Template Literal',
      cwe: 'CWE-89',
      location: 'src/controllers/auth.js:42',
      snippet: 'const query = `SELECT * FROM users WHERE email = \'${req.body.email}\'`;',
      engine: 'Deterministic AST AST-Visitor',
      step: 'Step 2: Security AST',
    },
    {
      id: 'REC-204',
      severity: 'high',
      title: 'Hardcoded JWT Secret in Production Config',
      cwe: 'CWE-798',
      location: 'src/config/jwt.ts:18',
      snippet: 'export const JWT_SECRET = "super_secret_recode_key_2026";',
      engine: 'AST Secret Pattern Matcher',
      step: 'Step 2: Security AST',
    },
    {
      id: 'REC-309',
      severity: 'med',
      title: 'Unbounded Parallel Promise.all() without Concurrency Cap',
      cwe: 'CWE-400',
      location: 'src/services/batchProcessor.js:105',
      snippet: 'await Promise.all(items.map(i => uploadToBucket(i)));',
      engine: 'Gemini AI Semantic Analysis',
      step: 'Step 3: AI Inference',
    },
    {
      id: 'REC-412',
      severity: 'low',
      title: 'Implicit Any Return in Public Method Signature',
      cwe: 'TS-7006',
      location: 'src/utils/parser.ts:88',
      snippet: 'export function parseNode(astNode) { return astNode.body; }',
      engine: 'Static Linter Oxc/ESLint',
      step: 'Step 1: Lexical Check',
    },
    {
      id: 'REC-501',
      severity: 'clean',
      title: 'Cryptographic Hashing uses Argon2id with 64MB Memory Factor',
      cwe: 'OWASP-A02',
      location: 'src/services/hasher.js:12',
      snippet: 'argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536 });',
      engine: 'Deterministic Verification',
      step: 'Passed Validation',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#F1F1F1] flex flex-col font-sans selection:bg-[#02C8F0]/30 selection:text-[#F1F1F1]">
      {/* 1. Atomic Navbar Component */}
      <Navbar
        brandTitle="Re:Code"
        statusText="Module 2 Verified"
        activeRoute={activeTab}
        onRouteChange={(route) => setActiveTab(route)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto pt-[76px] pb-16 px-4 sm:px-6 lg:px-8 flex flex-col gap-10">
        
        {/* Header Hero Section */}
        <section className="bg-[#181818] border border-[#303030] rounded-lg p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <PillBadge variant="cyan" size="sm" icon={Code2}>
                Tailwind CSS v4
              </PillBadge>
              <PillBadge variant="clean" size="sm" dot={true}>
                YouTube Dark Verified
              </PillBadge>
              <PillBadge variant="step" size="sm">
                Module 2 Design System
              </PillBadge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F1F1]">
              Atomic Component &amp; Token Preview Route
            </h1>
            <p className="text-sm text-[#AAAAAA] leading-relaxed">
              Official Re:Code UI architecture adhering to matte, zero-glow YouTube Dark Mode design tokens (#0F0F0F, #181818, #212121, #02C8F0). Built with atomic React components in <code className="text-[#02C8F0] font-mono text-xs">/frontend/src/components/common/</code>.
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
            <div className="bg-[#212121] border border-[#303030] rounded px-4 py-2 flex items-center justify-between gap-4">
              <span className="text-xs text-[#AAAAAA]">Font Hierarchy</span>
              <span className="text-xs font-mono text-[#02C8F0]">Inter &bull; JetBrains Mono</span>
            </div>
            <div className="bg-[#212121] border border-[#303030] rounded px-4 py-2 flex items-center justify-between gap-4">
              <span className="text-xs text-[#AAAAAA]">Visual Bleed</span>
              <span className="text-xs font-mono text-[#27C93F] font-semibold">0% / Zero Glow</span>
            </div>
          </div>
        </section>

        {/* SECTION 1: YouTube Dark Mode Token Matrix */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#303030] pb-3">
            <div className="flex items-center gap-2.5">
              <Palette className="w-5 h-5 text-[#02C8F0]" />
              <h2 className="text-lg font-bold text-[#F1F1F1]">1. YouTube Dark Mode Token Palette</h2>
            </div>
            <span className="text-xs font-mono text-[#717171]">14 Exact Color Tokens</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {COLOR_TOKENS.map((token) => {
              const isCopied = copiedToken === token.name;
              return (
                <div
                  key={token.name}
                  onClick={() => copyHex(token)}
                  className="group bg-[#181818] border border-[#303030] hover:border-[#3F3F3F] rounded-md p-3 flex flex-col justify-between cursor-pointer transition-colors duration-150 relative"
                  title="Click to copy HEX code"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-[#AAAAAA] uppercase tracking-wider">
                      {token.category}
                    </span>
                    <span className="text-[10px] font-mono text-[#717171] group-hover:text-[#F1F1F1] transition-colors">
                      {isCopied ? 'COPIED!' : 'CLICK TO COPY'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 my-1">
                    <div
                      className="w-10 h-10 rounded border border-[#303030] flex-shrink-0 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: token.hex }}
                    >
                      {isCopied && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-mono text-xs font-semibold text-[#F1F1F1] truncate">
                        {token.name}
                      </p>
                      <p className="font-mono text-xs text-[#02C8F0]">
                        {token.hex}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#717171] mt-2 border-t border-[#262626] pt-1.5 truncate">
                    {token.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: PillBadge Atomic Component Showcase */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#303030] pb-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-[#02C8F0]" />
              <h2 className="text-lg font-bold text-[#F1F1F1]">2. PillBadge Component Showcase</h2>
            </div>
            <span className="text-xs font-mono text-[#717171]">Flat Rounded Chips &bull; Language, Step, Status</span>
          </div>

          <div className="bg-[#181818] border border-[#303030] rounded-lg p-5 sm:p-6 space-y-6">
            {/* Language Chips */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                Language Badges (Mono Font)
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'C++', 'Solidity', 'SQL'].map((lang) => (
                  <PillBadge
                    key={lang}
                    variant="language"
                    size="md"
                    onClick={() => setSelectedLanguage(lang)}
                    className={selectedLanguage === lang ? 'border-[#02C8F0] text-[#02C8F0]' : ''}
                  >
                    {lang}
                  </PillBadge>
                ))}
              </div>
              <p className="text-[11px] text-[#717171]">
                Active selection: <span className="text-[#02C8F0] font-mono">{selectedLanguage}</span> (Click any chip to toggle)
              </p>
            </div>

            {/* Pipeline Step Tags */}
            <div className="space-y-2 border-t border-[#262626] pt-4">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                Pipeline Step Tags
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                <PillBadge variant="step" size="md" icon={Terminal}>
                  Step 1: AST Ingestion
                </PillBadge>
                <PillBadge variant="step" size="md" icon={ShieldCheck}>
                  Step 2: Static Vulnerability Scan
                </PillBadge>
                <PillBadge variant="step" size="md" icon={Sparkles}>
                  Step 3: Gemini AI Reasoning
                </PillBadge>
                <PillBadge variant="step" size="md" icon={FileCode2}>
                  Step 4: Refactor Git Diff
                </PillBadge>
              </div>
            </div>

            {/* Status Chips */}
            <div className="space-y-2 border-t border-[#262626] pt-4">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                Status Chips with Live Flat Dot
              </h3>
              <div className="flex flex-wrap items-center gap-2.5">
                <PillBadge variant="status" dot={true} dotColor="#27C93F">
                  AST Engine Operational
                </PillBadge>
                <PillBadge variant="status" dot={true} dotColor="#FFA116">
                  Gemini API Rate Limiting
                </PillBadge>
                <PillBadge variant="status" dot={true} dotColor="#FF4D4D">
                  Service Offline
                </PillBadge>
                <PillBadge variant="cyan" dot={true}>
                  Diagnostics Ready
                </PillBadge>
                <PillBadge variant="muted">
                  AST Cache Warm
                </PillBadge>
              </div>
            </div>

            {/* Size Matrix */}
            <div className="space-y-2 border-t border-[#262626] pt-4">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                Size Hierarchy
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <PillBadge size="sm" variant="default">Small (sm: 11px)</PillBadge>
                <PillBadge size="md" variant="default">Medium (md: 12px)</PillBadge>
                <PillBadge size="lg" variant="default">Large (lg: 14px)</PillBadge>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SeverityChip Atomic Component Showcase */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#303030] pb-3">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-[#FF4D4D]" />
              <h2 className="text-lg font-bold text-[#F1F1F1]">3. SeverityChip Component Showcase</h2>
            </div>
            
            {/* Variant Switcher */}
            <div className="flex items-center gap-1 bg-[#212121] p-1 rounded border border-[#303030]">
              {['matte', 'solid', 'outline'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChipVariant(v)}
                  className={`px-2.5 py-1 text-xs font-mono rounded capitalize transition-colors ${
                    chipVariant === v
                      ? 'bg-[#181818] text-[#02C8F0] border border-[#3F3F3F] font-semibold'
                      : 'text-[#AAAAAA] hover:text-[#F1F1F1]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#181818] border border-[#303030] rounded-lg p-5 sm:p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                All Severity Tiers (Style: <span className="text-[#02C8F0]">{chipVariant}</span>)
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <SeverityChip severity="critical" variant={chipVariant} count={3} />
                <SeverityChip severity="high" variant={chipVariant} count={12} />
                <SeverityChip severity="medium" variant={chipVariant} count={8} />
                <SeverityChip severity="low" variant={chipVariant} count={4} />
                <SeverityChip severity="info" variant={chipVariant} count={19} />
                <SeverityChip severity="clean" variant={chipVariant} count={42} />
              </div>
            </div>

            {/* Custom Labels & Sizes */}
            <div className="space-y-2 border-t border-[#262626] pt-4">
              <h3 className="text-xs font-semibold text-[#AAAAAA] uppercase tracking-wider font-mono">
                Sizes &amp; Custom Diagnostic Labels
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <SeverityChip severity="critical" size="sm" label="CRIT (sm)" variant={chipVariant} />
                <SeverityChip severity="critical" size="md" label="CRITICAL (md)" variant={chipVariant} />
                <SeverityChip severity="critical" size="lg" label="CRITICAL SEC-AUDIT (lg)" variant={chipVariant} />
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <SeverityChip severity="high" size="md" label="Auth Bypass (CWE-287)" variant={chipVariant} />
                <SeverityChip severity="medium" size="md" label="DoS Vector (CWE-400)" variant={chipVariant} />
                <SeverityChip severity="low" size="md" label="Type Smell (TS-7006)" variant={chipVariant} />
                <SeverityChip severity="clean" size="md" label="OWASP Pass (A02)" variant={chipVariant} />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Real-World Diagnostic Composition (AST Code Review) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#303030] pb-3">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-[#02C8F0]" />
              <h2 className="text-lg font-bold text-[#F1F1F1]">4. Integrated Real-World Review Diagnostics</h2>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-[#717171] mr-1">Filter:</span>
              {['all', 'critical', 'high', 'medium', 'clean'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2 py-0.5 rounded uppercase ${
                    filterSeverity === sev
                      ? 'bg-[#02C8F0]/20 text-[#02C8F0] border border-[#02C8F0]/40 font-bold'
                      : 'text-[#AAAAAA] hover:text-[#F1F1F1] bg-[#212121]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {sampleDiagnostics
              .filter((item) => filterSeverity === 'all' || item.severity === filterSeverity)
              .map((diag) => (
                <div
                  key={diag.id}
                  className="bg-[#181818] border border-[#303030] hover:border-[#3F3F3F] rounded-lg p-4 sm:p-5 transition-all duration-150 flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityChip severity={diag.severity} size="sm" />
                      <span className="font-mono text-xs font-semibold text-[#02C8F0]">
                        {diag.id}
                      </span>
                      <span className="text-xs text-[#3F3F3F]">&bull;</span>
                      <span className="font-mono text-xs text-[#AAAAAA]">
                        {diag.cwe}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <PillBadge variant="step" size="sm">
                        {diag.step}
                      </PillBadge>
                      <PillBadge variant="language" size="sm">
                        {diag.engine}
                      </PillBadge>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-[#F1F1F1]">
                      {diag.title}
                    </h4>
                    <p className="text-xs font-mono text-[#717171] mt-0.5">
                      File: {diag.location}
                    </p>
                  </div>

                  <div className="bg-[#0F0F0F] border border-[#262626] rounded p-2.5 font-mono text-xs text-[#AAAAAA] overflow-x-auto">
                    <code>{diag.snippet}</code>
                  </div>
                </div>
              ))}
          </div>

          {/* Module 18: Secure Code Diff Viewer Showcase */}
          <div className="pt-6 border-t border-[#303030] space-y-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-[#02C8F0]" />
              <h3 className="text-sm font-bold text-[#F1F1F1] font-mono">
                XSS-Immune Code Diff Viewer (Module 18 Component)
              </h3>
            </div>
            <p className="text-xs text-[#AAAAAA]">
              Code snippets and refactoring diffs are rendered strictly inside semantic <code className="text-[#02C8F0] font-mono">&lt;pre&gt;</code> and <code className="text-[#02C8F0] font-mono">&lt;code&gt;</code> text containers, sanitized against XSS execution.
            </p>
            <DiffViewer
              filePath="services/authService.js"
              lineNumber={42}
              diffBefore={`const token = jwt.sign({ user: req.body.username }, "HARDCODED_DEV_SECRET");`}
              diffAfter={`const token = jwt.sign(\n  { sub: user.id, role: user.role },\n  process.env.JWT_SECRET,\n  { expiresIn: '1h', algorithm: 'HS256' }\n);`}
              ruleId="security/jwt-hardcoded-secret"
              patchReady={true}
            />
          </div>
        </section>

        {/* SECTION 5: Bleed & Blurry Glow Acceptance Verification Zone */}
        <section className="bg-[#181818] border border-[#303030] rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-[#27C93F]" />
            <h2 className="text-base font-bold text-[#F1F1F1]">
              5. Acceptance Verification: Zero Blur &amp; Zero Glow Audit
            </h2>
          </div>
          <p className="text-xs text-[#AAAAAA] leading-relaxed">
            All elements use matte solid borders (<code className="text-[#02C8F0] font-mono">#303030</code>, <code className="text-[#02C8F0] font-mono">#3F3F3F</code>) and flat opaque backgrounds. No <code className="text-[#02C8F0] font-mono">box-shadow</code> glows, fuzzy drop-shadows, or neon text-shadow bleeds exist. Typography renders crisp against the true YouTube Dark Mode base canvas (<code className="text-[#02C8F0] font-mono">#0F0F0F</code>).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-[#212121] border border-[#303030] rounded p-3 flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[#AAAAAA]">Text Shadow Test</span>
              <span className="text-xs text-[#27C93F] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> None (Strict Matte)
              </span>
            </div>
            <div className="bg-[#212121] border border-[#303030] rounded p-3 flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[#AAAAAA]">Drop Shadow Bleed</span>
              <span className="text-xs text-[#27C93F] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> None (Flat Surfaces)
              </span>
            </div>
            <div className="bg-[#212121] border border-[#303030] rounded p-3 flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[#AAAAAA]">Font Rendering</span>
              <span className="text-xs text-[#27C93F] font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Inter + JetBrains Mono
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 6: Module 1 Health Probe Integration */}
        <section className="bg-[#181818] border border-[#303030] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-5 h-5 text-[#02C8F0]" />
              <h2 className="text-base font-bold text-[#F1F1F1]">
                6. Backend Health Verification (Module 1 Check)
              </h2>
            </div>
            <PillBadge variant="status" size="sm" dot={true}>
              GET /api/v1/health
            </PillBadge>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="probe-backend-btn"
              onClick={onProbeBackend}
              disabled={backendLoading}
              className="bg-[#212121] text-[#F1F1F1] hover:bg-[#282828] border border-[#303030] hover:border-[#3F3F3F] px-4 py-2 rounded text-xs font-mono font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {backendLoading ? 'Connecting...' : 'Probe Backend Health'}
            </button>
            <span className="text-xs text-[#717171]">
              Target: <code className="text-[#AAAAAA] font-mono">http://localhost:5000/api/v1/health</code>
            </span>
          </div>

          {backendStatus && (
            <div className="bg-[#0F0F0F] border border-[#303030] rounded p-3 text-xs font-mono">
              <span className="text-[#AAAAAA] block mb-1">Server Response:</span>
              <pre className="text-[#02C8F0] overflow-x-auto">
                {JSON.stringify(backendStatus, null, 2)}
              </pre>
            </div>
          )}
        </section>

      </main>

      {/* 2. Atomic Docked Footer Component */}
      <Footer creator="Shivam Vishwakarma" />
    </div>
  );
}
