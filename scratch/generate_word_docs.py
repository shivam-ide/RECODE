import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    """Set background color of a table cell."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set cell padding in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_heading_with_spacing(doc, text, level):
    h = doc.add_heading(text, level=level)
    h.paragraph_format.space_before = Pt(14)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True
    return h

def add_callout(doc, title, text, bg_color="F0F9FF", border_color="02C8F0"):
    """Create a beautiful callout box with a colored left border."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    # Set left border thick, others none
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    r_title = p.add_run(f"📌 {title}\n")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(10.5)
    r_title.font.color.rgb = RGBColor(0x02, 0x88, 0xD1)

    r_text = p.add_run(text)
    r_text.font.name = "Segoe UI"
    r_text.font.size = Pt(9.5)
    r_text.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    doc.add_paragraph() # Spacer

def add_code_block(doc, code_str, caption=""):
    """Add a syntax-styled code box."""
    if caption:
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.space_before = Pt(8)
        p_cap.paragraph_format.space_after = Pt(2)
        r_cap = p_cap.add_run(f"Code Snippet: {caption}")
        r_cap.font.name = "Segoe UI"
        r_cap.font.size = Pt(8.5)
        r_cap.font.italic = True
        r_cap.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F8F9FA")
    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)

    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="E0E0E0"/>'
        f'<w:left w:val="single" w:sz="18" w:space="0" w:color="02C8F0"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="E0E0E0"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="E0E0E0"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(code_str)
    r.font.name = "Consolas"
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    doc.add_paragraph() # Spacer

def style_table(table, header_bg="0F0F0F", alt_bg="F9FAFB"):
    """Format table with alternating row colors and bold headers."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, row in enumerate(table.rows):
        is_header = (i == 0)
        for cell in row.cells:
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            if is_header:
                set_cell_background(cell, header_bg)
                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(0)
                    for r in p.runs:
                        r.font.bold = True
                        r.font.name = "Segoe UI"
                        r.font.size = Pt(9.5)
                        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            else:
                bg = alt_bg if (i % 2 == 1) else "FFFFFF"
                set_cell_background(cell, bg)
                for p in cell.paragraphs:
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(0)
                    for r in p.runs:
                        r.font.name = "Segoe UI"
                        r.font.size = Pt(9)
                        r.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

def main():
    doc = Document()

    # Set 0.75 in margins
    for sec in doc.sections:
        sec.top_margin = Inches(0.75)
        sec.bottom_margin = Inches(0.75)
        sec.left_margin = Inches(0.75)
        sec.right_margin = Inches(0.75)

    # Base font setup
    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Segoe UI'
    font_normal.size = Pt(10)
    font_normal.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # =========================================================================
    # COVER / HEADER TITLE BLOCK
    # =========================================================================
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(20)
    title_p.paragraph_format.space_after = Pt(4)
    r_title = title_p.add_run("Re:Code")
    r_title.bold = True
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(28)
    r_title.font.color.rgb = RGBColor(0x02, 0xC8, 0xF0)

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(4)
    r_sub = sub_p.add_run("Enterprise Dual-Engine Automated Code Review & Security Audit Platform")
    r_sub.bold = True
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(15)
    r_sub.font.color.rgb = RGBColor(0x0F, 0x0F, 0x0F)

    tag_p = doc.add_paragraph()
    tag_p.paragraph_format.space_before = Pt(0)
    tag_p.paragraph_format.space_after = Pt(16)
    r_tag = tag_p.add_run("Read. Review. Refine.  |  Complete Architectural Specification & Presentation Defense Manual")
    r_tag.font.name = "Segoe UI"
    r_tag.font.size = Pt(10.5)
    r_tag.font.italic = True
    r_tag.font.color.rgb = RGBColor(0x71, 0x71, 0x71)

    # Metadata Table
    meta_table = doc.add_table(rows=5, cols=2)
    meta_data = [
        ("Platform Name", "Re:Code (Automated Code Quality & Security Auditor)"),
        ("Architecture", "Dual-Engine Pipeline: Deterministic AST + Google Gemini Generative AI"),
        ("Tech Stack", "React 19, Tailwind CSS (YouTube Dark Mode), Node.js, Express, Babel AST, Supabase, PDFKit"),
        ("Current Version", "v1.0.0-mod2 (207 Unit & Integration Tests Passing 100%)"),
        ("Document Scope", "Full System Architecture, Pipeline Deep-Dive, Ingestion, Scoring Formula, Defense Q&A, and Demo Script"),
    ]
    for row_idx, (k, v) in enumerate(meta_data):
        meta_table.cell(row_idx, 0).text = k
        meta_table.cell(row_idx, 1).text = v
    style_table(meta_table, header_bg="212121", alt_bg="F4F4F4")
    doc.add_paragraph()

    add_callout(
        doc,
        "Executive Summary & Elevator Pitch",
        "Re:Code solves the modern code review trilemma: static linters produce false positives and lack semantic depth, pure LLM reviewers hallucinate line numbers and miss rigid syntax boundaries, and human reviews create engineering bottlenecks. Re:Code unites deterministic AST traversal (Babel) with semantic generative AI (Google Gemini 1.5/2.0) into a single unified pipeline that normalizes findings, caps penalty deductions, boosts health scores via live in-memory patching, and exports formal PDF audit certificates with zero trailing blank pages.",
        bg_color="F0FDF4",
        border_color="27C93F"
    )

    # =========================================================================
    # SECTION 1: ARCHITECTURAL OVERVIEW & PIPELINE
    # =========================================================================
    add_heading_with_spacing(doc, "1. System Architecture & Dual-Engine Pipeline", level=1)
    
    p = doc.add_paragraph()
    p.add_run(
        "Re:Code is designed as an enterprise-grade client-server application optimized for extreme reliability, "
        "deterministic reproducibility, and rich visual presentation. The execution pipeline is divided into seven distinct phases:\n"
    )

    steps = [
        ("Phase 1: Ingestion & Discovery", "Ingests single code snippets, multi-file projects, or public GitHub repositories via the GitHub Git Trees recursive API (/git/trees/{branch}?recursive=1). Automatically filters out test scorecards, documentation, and minified artifacts."),
        ("Phase 2: Concurrent Dual-Engine Execution", "Spawns parallel analysis threads. Engine A executes deterministic Babel AST visitors for OWASP Top 10 vulnerabilities (SQLi, hardcoded secrets, dead code). Engine B prompts Google Gemini AI for algorithmic complexity, design flaws, and architectural antipatterns."),
        ("Phase 3: Normalization & Deduplication", "Merges findings based on file path identity, +/- 2 line proximity, and semantic rule correlation. Resolves collisions into unified 'HYBRID (AST + AI)' findings, adopting AST line precision and Gemini's plain-language explanations."),
        ("Phase 4: Mathematical Scoring Engine", "Calculates a 100-point base health score with dynamic severity penalty capping (e.g. low-severity console logs capped at 15 pts max). Enforces safety floors (0 Critical/High guarantees Grade C or better)."),
        ("Phase 5: State Persistence & Supabase Sync", "Stores review metadata, evaluated files, and categorized issues into PostgreSQL via Supabase with Row Level Security (RLS) supporting both authenticated profiles and anonymous guest audit sessions."),
        ("Phase 6: Interactive Review Canvas (Page 3)", "Renders findings in a YouTube Dark Mode interface (#0F0F0F). Developers can inspect code diffs, trigger 'Apply All Safe Fixes', execute live in-memory patching, and preview updated files in real time."),
        ("Phase 7: Content-Adaptive Reporting", "Generates professional formal PDF audit reports via PDFKit with 16mm adaptive margins, atomic card pagination (break-inside: avoid), minified line wrapping, and dynamic markdown README generation.")
    ]
    for s_title, s_desc in steps:
        p_step = doc.add_paragraph()
        p_step.paragraph_format.left_indent = Inches(0.25)
        p_step.paragraph_format.space_before = Pt(2)
        p_step.paragraph_format.space_after = Pt(2)
        r_st = p_step.add_run(f"• {s_title}: ")
        r_st.bold = True
        p_step.add_run(s_desc)

    doc.add_paragraph()

    # Architecture Pipeline Table
    pipe_table = doc.add_table(rows=8, cols=3)
    pipe_headers = ["Pipeline Stage", "Primary Technology / Service", "Key Responsibilities"]
    for c_idx, h in enumerate(pipe_headers):
        pipe_table.cell(0, c_idx).text = h

    pipe_rows = [
        ("Ingestion Layer", "githubIngestion.js, ingestionManager.js", "Recursive Git Trees traversal (10 levels, 50 candidate files), language detection, scorecards exclusion"),
        ("Engine A (AST)", "staticAnalyzer.js, @babel/parser, @babel/traverse", "Deterministic AST traversal, CWE-89 SQLi, CWE-798 Secrets, CWE-563 Dead Code, CWE-532 Logs, Syntax errors"),
        ("Engine B (AI)", "aiReviewer.js, geminiClient.js, @google/genai", "Structured JSON prompts, algorithmic complexity O(N^2), logic race conditions, partial mode fallback"),
        ("Normalizer", "findingsNormalizer.js", "+/- 2 line proximity matching, HYBRID (AST + AI) attribution, single-card deduplication"),
        ("Scoring Engine", "scoringEngine.js", "100-pt base formula, penalty capping (Low: 15pt max, Med: 20pt max), Grade C quality floor"),
        ("Persistence", "reviewRepository.js, Supabase PostgreSQL", "Relational persistence across reviews, review_files, review_issues, RLS guest session support"),
        ("Export Engine", "pdfGenerator.js, readmeGenerator.js, PDFKit", "Dynamic A4 PDF reports, atomic cards, zero trailing blank pages, GitHub README.md export"),
    ]
    for r_idx, row in enumerate(pipe_rows, start=1):
        for c_idx, val in enumerate(row):
            pipe_table.cell(r_idx, c_idx).text = val
    style_table(pipe_table)
    doc.add_paragraph()

    # =========================================================================
    # SECTION 2: REPOSITORY & SNIPPET INGESTION ENGINE
    # =========================================================================
    add_heading_with_spacing(doc, "2. Repository & Snippet Ingestion Engine", level=1)
    
    p = doc.add_paragraph()
    p.add_run(
        "A critical engineering breakthrough in Re:Code is the deep recursive scanning capability for public GitHub repositories. "
        "Standard repository crawlers rely on the flat '/contents' endpoint, which only fetches root-level placeholder files and misses "
        "all actual backend controllers, routes, and business logic, leading to false-positive 100/100 perfect scores. "
        "Re:Code solves this by utilizing GitHub's recursive Git Trees API.\n"
    )

    add_code_block(
        doc,
        "// GitHub Git Trees Recursive Endpoint Invocation\n"
        "const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;\n"
        "const response = await fetch(treeUrl, { headers });\n"
        "const treeData = await response.json();\n\n"
        "// Filter for code blobs while excluding node_modules, build artifacts, and docs\n"
        "const candidateBlobs = treeData.tree.filter((node) => {\n"
        "  if (node.type !== 'blob') return false;\n"
        "  const p = node.path.toLowerCase();\n"
        "  if (p.includes('node_modules/') || p.includes('dist/') || p.includes('.git/') ||\n"
        "      p.includes('scorecard/') || p.includes('docs/') || p.endsWith('.html')) return false;\n"
        "  return /\\.(jsx?|tsx?|py|java|cpp)$/i.test(p);\n"
        "});",
        caption="backend/src/services/github/githubService.js - Recursive Git Trees Ingestion"
    )

    add_callout(
        doc,
        "File Prioritization & Exclusion Rules",
        "Re:Code sorts candidate files using an architectural priority index: core application files (app.js, server.js, index.js), backend controllers, routes, and database models are processed first. Documentation files, unit test fixtures, and static reports are strictly excluded so the audit evaluates only executable application code.",
        bg_color="FFFBEB",
        border_color="FFA116"
    )

    # =========================================================================
    # SECTION 3: DETERMINISTIC STATIC AST ENGINE (BABEL)
    # =========================================================================
    add_heading_with_spacing(doc, "3. Deterministic Static AST Engine (Babel Parser)", level=1)
    
    p = doc.add_paragraph()
    p.add_run(
        "Engine A parses source code into an Abstract Syntax Tree (AST) using `@babel/parser` with full support for modern ECMAScript, "
        "JSX, TypeScript, and top-level async/await. Unlike regex linters that rely on brittle text matching, AST traversal examines the "
        "exact semantic token tree, guaranteeing 100% deterministic accuracy with zero hallucinations.\n"
    )

    rules_table = doc.add_table(rows=7, cols=4)
    r_headers = ["Rule ID", "CWE / Standard", "AST Visitor Pattern", "Deterministic Remediation"]
    for c_idx, h in enumerate(r_headers):
        rules_table.cell(0, c_idx).text = h

    r_rows = [
        ("SQL_INJECTION", "CWE-89 / OWASP A03", "BinaryExpression (+) inside database call (db.query, pool.query)", "Replace string concatenation with parameterized placeholders ($1, $2)"),
        ("HARDCODED_SECRET", "CWE-798 / OWASP A07", "StringLiteral matching high-entropy regex (JWT, AWS, Stripe keys)", "Extract secret into root .env and reference via process.env.KEY"),
        ("UNUSED_VARIABLE", "CWE-563 / Dead Code", "VariableDeclarator where binding.referenced is false in parent scope", "Remove unused variable or export it for modular usage"),
        ("CONSOLE_LOG_STMT", "CWE-532 / Info Leak", "CallExpression on MemberExpression 'console.log' or 'console.debug'", "Remove debug statements or route through structured logger (Pino/Winston)"),
        ("EMPTY_CATCH_BLOCK", "CWE-390 / Error Handling", "CatchClause containing an empty BlockStatement (zero statements)", "Log caught error with logger.error(err.message) and rethrow or handle"),
        ("PARSER_ERROR", "AST Syntax Integrity", "SyntaxError trapped during Babel parse pass", "Pinpoint exact missing delimiter, mismatched bracket, or unclosed string"),
    ]
    for r_idx, row in enumerate(r_rows, start=1):
        for c_idx, val in enumerate(row):
            rules_table.cell(r_idx, c_idx).text = val
    style_table(rules_table)
    doc.add_paragraph()

    # =========================================================================
    # SECTION 4: GENERATIVE GEMINI AI REVIEW ENGINE
    # =========================================================================
    add_heading_with_spacing(doc, "4. Generative Gemini AI Review Engine", level=1)
    
    p = doc.add_paragraph()
    p.add_run(
        "Engine B integrates the Google Gemini API (via `@google/genai`) to provide high-level architectural insight that deterministic "
        "rules cannot capture. Gemini evaluates algorithmic inefficiencies (e.g. O(N^2) loops inside database calls, unbounded recursive calls, "
        "missing index lookups), logic race conditions, and business logic flaws.\n"
    )

    add_code_block(
        doc,
        "// Structured Prompt Enforcement for Google Gemini AI\n"
        "const prompt = `You are Re:Code's Senior Security & Architectural Auditor.\n"
        "Inspect the provided source code for:\n"
        "1. Algorithmic flaws (infinite loops, cycle traps in graph traversals, O(N^2) bottlenecks)\n"
        "2. Architectural antipatterns and security flaws\n"
        "Output ONLY a raw valid JSON array matching this exact schema:\n"
        "[{\n"
        '  "title": "String title",\n'
        '  "file": "${filePath}",\n'
        '  "line": 15,\n'
        '  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",\n'
        '  "category": "SECURITY" | "QUALITY" | "OPTIMIZATION" | "SYNTAX",\n'
        '  "explanation": "Clear plain language explanation",\n'
        '  "diff_before": "vulnerable snippet",\n'
        '  "diff_after": "remediated replacement"\n'
        "}]`;",
        caption="backend/src/services/ai/aiReviewer.js - Structured Prompting"
    )

    add_callout(
        doc,
        "Fault Tolerance & Partial Analysis Mode",
        "If Google Gemini encounters an API quota limit, network timeout, or invalid JSON output, Re:Code never fails the review. Instead, the orchestrator gracefully switches to 'Partial Analysis Mode' (flagged in review telemetry), allowing the full AST static analysis findings and scoring engine to complete uninterrupted.",
        bg_color="EFF6FF",
        border_color="02C8F0"
    )

    # =========================================================================
    # SECTION 5: NORMALIZATION, DEDUPLICATION & HYBRID ATTRIBUTION
    # =========================================================================
    add_heading_with_spacing(doc, "5. Findings Normalization & HYBRID Attribution", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "A major challenge in dual-engine architectures is finding duplication: if both AST and Gemini detect a hardcoded secret on line 10, "
        "displaying two duplicate cards confuses developers and artificially inflates penalties. Re:Code's `findingsNormalizer.js` executes "
        "a multi-stage normalization algorithm:\n"
    )

    norm_steps = [
        ("Proximity Matching", "Correlates findings across engines if they share the same normalized file path, are within +/- 2 lines of each other, and match semantic category/rule criteria."),
        ("HYBRID Attribution", "When an issue is corroborated by both engines, it is tagged as 'HYBRID (AST + AI)'. It inherits the AST engine's exact physical line number and Gemini's plain-language explanation and patch."),
        ("Same-Line Collision Merging", "If multiple rules trigger on the same line (e.g. an unused variable that also contains a hardcoded JWT token), Re:Code consolidates them into a single comprehensive CRITICAL finding: 'Hardcoded Secret (Variable is also unused)'."),
        ("Severity-Based Sorting", "Orders final findings strictly from most dangerous to least dangerous: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO.")
    ]
    for n_title, n_desc in norm_steps:
        p_n = doc.add_paragraph()
        p_n.paragraph_format.left_indent = Inches(0.25)
        p_n.paragraph_format.space_before = Pt(2)
        p_n.paragraph_format.space_after = Pt(2)
        r_nt = p_n.add_run(f"• {n_title}: ")
        r_nt.bold = True
        p_n.add_run(n_desc)

    doc.add_paragraph()

    # Engine Badge Table
    badge_table = doc.add_table(rows=4, cols=3)
    b_headers = ["Attribution Label", "UI Badge Styling", "Engine Trigger Condition"]
    for c_idx, h in enumerate(b_headers):
        badge_table.cell(0, c_idx).text = h

    b_rows = [
        ("HYBRID (AST + AI)", "Cyan Accent (#02C8F0)", "Corroborated by both Babel Static AST and Google Gemini AI"),
        ("Static AST", "Dark Slate (#AAAAAA)", "Detected independently by deterministic Babel AST rules"),
        ("Gemini AI", "Amber Accent (#FFA116)", "Identified independently by Gemini AI semantic/architectural analysis"),
    ]
    for r_idx, row in enumerate(b_rows, start=1):
        for c_idx, val in enumerate(row):
            badge_table.cell(r_idx, c_idx).text = val
    style_table(badge_table)
    doc.add_paragraph()

    # =========================================================================
    # SECTION 6: MATHEMATICAL SCORING ENGINE & PENALTY CAPPING
    # =========================================================================
    add_heading_with_spacing(doc, "6. Mathematical Scoring Engine & Penalty Formula", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "Code quality scores must reflect genuine security posture. A naive deduction model would cause 40 console.log statements "
        "to drop a production-grade codebase to 0/100 (Grade F), which is unacceptable. Re:Code introduces a mathematically "
        "bounded penalty capping algorithm:\n"
    )

    add_code_block(
        doc,
        "// Re:Code Mathematical Scoring Formula with Severity Capping\n"
        "let totalDeductions = 0;\n"
        "totalDeductions += criticalCount * 20;               // 20 pts per Critical (no cap)\n"
        "totalDeductions += highCount * 10;                   // 10 pts per High (no cap)\n"
        "totalDeductions += Math.min(20, mediumCount * 3);    // 3 pts per Medium (Capped at 20 pts)\n"
        "totalDeductions += Math.min(15, lowCount * 0.5);     // 0.5 pts per Low (Capped at 15 pts)\n\n"
        "let finalScore = Math.max(0, Math.min(100, Math.round(100 - totalDeductions)));\n\n"
        "// Quality Floor: 0 Critical and 0 High guarantees Grade C (minimum 70/100)\n"
        "if (criticalCount === 0 && highCount === 0 && finalScore < 70) {\n"
        "  finalScore = 70;\n"
        "}",
        caption="backend/src/services/analysis/scoringEngine.js - Penalty Capping Formula"
    )

    grade_table = doc.add_table(rows=6, cols=3)
    g_headers = ["Score Range", "Letter Grade", "Production Assessment"]
    for c_idx, h in enumerate(g_headers):
        grade_table.cell(0, c_idx).text = h

    g_rows = [
        ("90 - 100", "Grade A+", "Production Ready — Exceptional code quality and zero critical security risks"),
        ("80 - 89", "Grade A / B+", "Stable — Clean architecture with minor optimization recommendations"),
        ("70 - 79", "Grade B / C", "Needs Attention — Zero high/critical issues, but low/medium smells exist"),
        ("60 - 69", "Grade D", "Elevated Risk — High-severity vulnerabilities detected; requires remediation"),
        ("Below 60", "Grade F", "Critical Risk — Exploitable CWE vulnerabilities present; do not deploy"),
    ]
    for r_idx, row in enumerate(g_rows, start=1):
        for c_idx, val in enumerate(row):
            grade_table.cell(r_idx, c_idx).text = val
    style_table(grade_table)
    doc.add_paragraph()

    # =========================================================================
    # SECTION 7: FRONTEND REVIEW CANVAS & IN-MEMORY LIVE PATCHING
    # =========================================================================
    add_heading_with_spacing(doc, "7. Frontend Review Canvas & Live In-Memory Patching", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "The frontend is engineered according to the YouTube Dark Mode specification (#0F0F0F, #181818, #212121, #303030) "
        "delivering a responsive, high-density development workspace. The core review interface (Page 3) features:\n"
    )

    fe_features = [
        ("Clean Minimalist Header", "Presents only the official Re:Code logo (/Logo.svg), vertical divider (|), and subtitle ('Read. Review. Refine.') with zero unnecessary navigation clutter."),
        ("Interactive Diff Viewer (DiffViewer.jsx)", "Renders red/green diff snippets strictly inside semantic <pre> and <code> text containers with full XSS immunity and automatic 120-character line wrapping."),
        ("In-Memory Live Code Patching", "Clicking 'Apply Patch' replaces the vulnerable line directly inside the client's live memory model without requiring server roundtrips, boosting the health score by +2 pts dynamically."),
        ("Apply All Safe Fixes", "A dedicated health dock button that automatically applies all LOW/INFO severity remediations (unused variables, console logs) in descending line order (bottom-to-top) to prevent line offset displacement."),
        ("Live Raw Code Modal", "Allows developers to view and copy the complete updated, in-memory patched file with a single click."),
        ("Formal PDF Export", "Streams a content-adaptive A4 audit report directly from the backend with zero trailing blank pages.")
    ]
    for f_title, f_desc in fe_features:
        p_f = doc.add_paragraph()
        p_f.paragraph_format.left_indent = Inches(0.25)
        p_f.paragraph_format.space_before = Pt(2)
        p_f.paragraph_format.space_after = Pt(2)
        r_ft = p_f.add_run(f"• {f_title}: ")
        r_ft.bold = True
        p_f.add_run(f_desc)

    doc.add_paragraph()

    # =========================================================================
    # SECTION 8: DYNAMIC PDF GENERATION (PDFKIT)
    # =========================================================================
    add_heading_with_spacing(doc, "8. Dynamic PDF Generation Engine (PDFKit)", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "A common issue in automated report generation is trailing blank pages caused by rigid page height declarations. "
        "Re:Code eliminates this through dynamic height estimation and safe footer rendering inside `pdfGenerator.js`:\n"
    )

    pdf_points = [
        ("Adaptive A4 Margins", "Configured at exactly 16mm (45.35 typographic points) to maximize usable content canvas."),
        ("Atomic Finding Cards", "Calculates required card height (title + explanation + before/after diffs) before drawing. If a card would exceed the safe bottom margin (pageHeight - MARGIN - 30pt), it triggers doc.addPage() cleanly before rendering the card."),
        ("Zero Trailing Blank Pages", "Iterates through buffered pages during the footer pass while temporarily suppressing bottom margins (doc.page.margins.bottom = 0) to strictly prevent PDFKit from auto-creating trailing empty sheets."),
        ("Minified Code Wrapping", "Lines exceeding 120 characters are truncated with an ellipsis (...) and rendered with bounding width constraints to avoid horizontal canvas overflow.")
    ]
    for pt_title, pt_desc in pdf_points:
        p_pt = doc.add_paragraph()
        p_pt.paragraph_format.left_indent = Inches(0.25)
        p_pt.paragraph_format.space_before = Pt(2)
        p_pt.paragraph_format.space_after = Pt(2)
        r_ptt = p_pt.add_run(f"• {pt_title}: ")
        r_ptt.bold = True
        p_pt.add_run(pt_desc)

    doc.add_paragraph()

    # =========================================================================
    # SECTION 9: DATABASE SCHEMA & SUPABASE PERSISTENCE
    # =========================================================================
    add_heading_with_spacing(doc, "9. Database Architecture & Supabase Integration", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "Re:Code utilizes PostgreSQL hosted on Supabase with Row Level Security (RLS) policies. "
        "The relational schema cleanly separates reviews, evaluated files, and atomic audit findings:\n"
    )

    db_table = doc.add_table(rows=4, cols=3)
    db_headers = ["Table Name", "Key Columns", "Relational Purpose"]
    for c_idx, h in enumerate(db_headers):
        db_table.cell(0, c_idx).text = h

    db_rows = [
        ("reviews", "id (UUID), user_id, project_name, score, grade, source_type, repo_url, created_at", "Master review record storing overall health score, grade, and metadata"),
        ("review_files", "id, review_id (FK), file_path, language, lines_count, content, issues_count", "Individual evaluated files with full source code preserved for live patching"),
        ("review_issues", "id, review_id (FK), file_id (FK), rule_id, severity, line_number, diff_before, diff_after, engine", "Normalized findings with remediation diffs and engine attribution"),
    ]
    for r_idx, row in enumerate(db_rows, start=1):
        for c_idx, val in enumerate(row):
            db_table.cell(r_idx, c_idx).text = val
    style_table(db_table)
    doc.add_paragraph()

    add_callout(
        doc,
        "Zero-Friction Guest Audit Mode",
        "Re:Code allows guest developers to audit code immediately without forced authentication. The frontend generates a unique UUID session token transmitted via the 'x-guest-session-id' header, allowing guest audits to persist and render without violating database security boundaries.",
        bg_color="F5F3FF",
        border_color="8B5CF6"
    )

    # =========================================================================
    # SECTION 10: VIVA & TECHNICAL INTERVIEW DEFENSE GUIDE
    # =========================================================================
    add_heading_with_spacing(doc, "10. Viva, Presentation & Interview Defense Guide", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "This section prepares you to answer any technical, architectural, or edge-case question from professors, "
        "evaluators, engineering managers, or recruiters.\n"
    )

    qas = [
        (
            "Q1: Why did you build a Dual-Engine architecture instead of relying entirely on Google Gemini?",
            "Answer: Generative AI models are non-deterministic, can hallucinate invalid line numbers, and occasionally struggle with exact character boundaries. Static AST traversal (Babel) provides mathematical 100% certainty for known security rules (like CWE-89 SQLi and CWE-798 Secrets) with zero latency. Gemini complements this by catching high-level architectural flaws and O(N^2) bottlenecks that AST patterns cannot anticipate. By combining them, Re:Code achieves both mathematical precision and deep semantic comprehension."
        ),
        (
            "Q2: How does the Deduplication & Normalization algorithm work without losing findings?",
            "Answer: When both engines analyze a repository, they output findings independently. Our findingsNormalizer.js uses three criteria: (1) normalized file path match across OS backslashes, (2) proximity line matching within +/- 2 lines, and (3) semantic category or rule correlation. When an overlap is detected, it merges them into a single 'HYBRID (AST + AI)' finding, retaining the exact line number from the AST engine while adopting Gemini's plain-language remediation and diff."
        ),
        (
            "Q3: Why doesn't a project with 40 console.log statements fail with Grade F?",
            "Answer: In our scoringEngine.js, we implemented dynamic severity penalty capping. While Critical issues deduct 20 points each without a cap, Low issues (like console logs or formatting) deduct 0.5 points each but are capped at a maximum of 15 points across the entire project. Furthermore, we enforce a quality floor: any codebase with 0 Critical and 0 High vulnerabilities will never drop below Grade C (minimum score 70)."
        ),
        (
            "Q4: How does the GitHub Ingestion avoid missing deep backend files in large repositories?",
            "Answer: Standard crawlers query the GitHub Contents API, which only reads root-level files. Re:Code queries the GitHub Git Trees API with the recursive=1 flag (GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1). This returns the full repository file tree in a single network call. We then prioritize backend folders (routes, controllers, models) and exclude scorecards, documentation, and build artifacts."
        ),
        (
            "Q5: How does in-memory code patching work without corrupting line numbers for subsequent patches?",
            "Answer: When applying multiple patches (such as clicking 'Apply All Safe Fixes'), Re:Code sorts the candidate issues descending by line number (from bottom to top). Replacing lines starting at line 100 before line 10 ensures that line offset shifts at the bottom do not alter line numbers at the top of the file."
        ),
        (
            "Q6: How do you guarantee the PDF export doesn't create blank pages at the end?",
            "Answer: In pdfGenerator.js using PDFKit, we predict each card's height before rendering. If a card would overflow, we cleanly call doc.addPage(). For the docked footer, we iterate over doc.bufferedPageRange() while temporarily setting doc.page.margins.bottom = 0, preventing PDFKit from triggering an automatic extra page."
        ),
        (
            "Q7: How is XSS prevented in the code diff viewer?",
            "Answer: DiffViewer.jsx uses sanitizeCodeSnippet() to strip malicious HTML and injects code exclusively into semantic <pre> and <code> text nodes using React JSX text rendering, which treats all code strictly as immutable text literals rather than executable DOM nodes."
        ),
        (
            "Q8: What happens if Gemini API quotas run out during a live demo?",
            "Answer: Re:Code's aiReviewer.js is wrapped in a robust try-catch handler with JSON sanitizers. If the Gemini API fails or runs out of credits, it logs a warning and enters 'Partial Analysis Mode'. The AST engine continues uninterrupted, the score is calculated accurately, and the developer still receives a complete audit."
        )
    ]

    for q, a in qas:
        p_q = doc.add_paragraph()
        p_q.paragraph_format.space_before = Pt(8)
        p_q.paragraph_format.space_after = Pt(2)
        r_q = p_q.add_run(q)
        r_q.bold = True
        r_q.font.name = "Segoe UI"
        r_q.font.size = Pt(10)
        r_q.font.color.rgb = RGBColor(0x02, 0x88, 0xD1)

        p_a = doc.add_paragraph()
        p_a.paragraph_format.left_indent = Inches(0.2)
        p_a.paragraph_format.space_before = Pt(0)
        p_a.paragraph_format.space_after = Pt(6)
        r_a = p_a.add_run(a)
        r_a.font.name = "Segoe UI"
        r_a.font.size = Pt(9.5)
        r_a.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    doc.add_paragraph()

    # =========================================================================
    # SECTION 11: STEP-BY-STEP LIVE DEMO WALKTHROUGH SCRIPT
    # =========================================================================
    add_heading_with_spacing(doc, "11. 5-Minute Live Demonstration Script", level=1)

    p = doc.add_paragraph()
    p.add_run(
        "Follow this exact script when presenting Re:Code to evaluators, professors, or during job interviews:\n"
    )

    demo_steps = [
        ("Step 1: Introduction (30 seconds)", "Open http://localhost:5173. Showcase the clean YouTube Dark Mode aesthetic (#0F0F0F) and explain: 'Re:Code is an enterprise dual-engine code review platform uniting deterministic AST security linting with Google Gemini AI semantic analysis.'"),
        ("Step 2: Ingest Code (45 seconds)", "Navigate to /submit. Demonstrate dual ingestion: paste a vulnerable JavaScript snippet (containing a raw SQL injection, hardcoded JWT secret, and console.log) or enter a public GitHub repository URL. Click 'Audit Codebase'."),
        ("Step 3: Review Canvas Walkthrough (90 seconds)", "Show Page 3. Highlight the Health Score (e.g. 64/100, Grade D), the severity cards, and the category health bars (Bugs, Security, Quality). Point out the single clean badges: 'Static AST', 'Gemini AI', and 'HYBRID (AST + AI)'."),
        ("Step 4: Interactive Diff & Live Patching (60 seconds)", "Show the red (-) and green (+) diff lines inside DiffViewer. Click 'Apply Patch' on a finding: show how the button turns green with '✓ Patch Applied', the score dynamically increases in memory, and the code updates instantly."),
        ("Step 5: Health Dock 'Apply All Safe Fixes' (45 seconds)", "Click 'Apply All Safe Fixes' in the bottom health dock. Show how all LOW warnings (console logs, unused variables) turn green simultaneously, and the score jumps to Production Ready."),
        ("Step 6: Live Raw Code & Export (30 seconds)", "Click 'Raw Code' to inspect the clean, in-memory patched file. Finally, click 'Download PDF' to generate the formal audit certificate, showing the clean A4 layout, official branding, and zero trailing blank pages.")
    ]
    for d_title, d_desc in demo_steps:
        p_d = doc.add_paragraph()
        p_d.paragraph_format.left_indent = Inches(0.25)
        p_d.paragraph_format.space_before = Pt(3)
        p_d.paragraph_format.space_after = Pt(3)
        r_dt = p_d.add_run(f"• {d_title}: ")
        r_dt.bold = True
        p_d.add_run(d_desc)

    doc.add_paragraph()

    # Save output docx
    output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "RECODE_PROJECT_DOCUMENTATION.docx"))
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    main()
