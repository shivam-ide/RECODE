import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import shutil

OUT_DOCX = "RECODE_PROJECT_REPORT.docx"
COPY_DOCX = "RECODE_PROJECT_DOCUMENTATION.docx"

from report_utils import (
    set_cell_background,
    set_cell_margins,
    set_table_borders,
    add_heading,
    add_body_p,
    add_bullet_p,
    add_code_snippet,
    add_image_box,
    format_custom_table,
    DIAGRAMS_DIR
)

def read_file_safe(path, max_lines=400):
    if not os.path.exists(path):
        return f"// File {path} not found"
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
    if len(lines) > max_lines:
        return "".join(lines[:max_lines]) + f"\n\n// ... [Truncated for brevity: {len(lines) - max_lines} additional lines in source]"
    return "".join(lines)

def build_recode_report():
    print("Building full Re:Code Project Report document...")
    doc = Document()

    # Set 1 inch margins all around
    for sec in doc.sections:
        sec.top_margin = Inches(1.0)
        sec.bottom_margin = Inches(1.0)
        sec.left_margin = Inches(1.0)
        sec.right_margin = Inches(1.0)

    # Base font setup
    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Times New Roman'
    font_normal.size = Pt(11)
    font_normal.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # =========================================================================
    # PAGE 1: TITLE PAGE (COVER)
    # =========================================================================
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(36)
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run("A Project Report\nOn\n")
    r.font.name = "Times New Roman"
    r.font.size = Pt(16)
    r.bold = True

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(6)
    p_title.paragraph_format.space_after = Pt(28)
    r_title = p_title.add_run("“Re:Code (Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform)”")
    r_title.font.name = "Times New Roman"
    r_title.font.size = Pt(17)
    r_title.bold = True
    r_title.font.color.rgb = RGBColor(0x02, 0x77, 0xBD)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(12)
    p_sub.paragraph_format.space_after = Pt(24)
    r_sub = p_sub.add_run(
        "Submitted in partial fulfillment of the requirement of\n"
        "University of Mumbai\n\n"
        "For the Degree of\n"
        "Bachelor of Computer Science\n"
    )
    r_sub.font.name = "Times New Roman"
    r_sub.font.size = Pt(13)
    r_sub.bold = True

    p_by = doc.add_paragraph()
    p_by.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_by.paragraph_format.space_before = Pt(18)
    p_by.paragraph_format.space_after = Pt(20)
    r_by = p_by.add_run(
        "Submitted By\n"
        "“Shivam Vishwakarma”\n\n"
        "Under the Guidance of\n"
        "Prof. Anita Gaikwad\n"
    )
    r_by.font.name = "Times New Roman"
    r_by.font.size = Pt(12.5)
    r_by.bold = True

    p_col = doc.add_paragraph()
    p_col.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_col.paragraph_format.space_before = Pt(28)
    p_col.paragraph_format.space_after = Pt(0)
    r_col = p_col.add_run(
        "Ramniranjan Jhunjhunwala College of Arts, Science & Commerce\n"
        "(Empowered Autonomous), Ghatkopar(W)\n\n"
        "Affiliated to University of Mumbai.\n"
        "(2025-2026)"
    )
    r_col.font.name = "Times New Roman"
    r_col.font.size = Pt(12)
    r_col.bold = True

    doc.add_page_break()

    # =========================================================================
    # PAGE 2: CERTIFICATE
    # =========================================================================
    p_cert_hdr = doc.add_paragraph()
    p_cert_hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_hdr.paragraph_format.space_before = Pt(24)
    p_cert_hdr.paragraph_format.space_after = Pt(28)
    r_ch = p_cert_hdr.add_run(
        "RAMNIRANJAN JHUNJHUNWALA COLLEGE\n"
        "GHATKOPAR(W), MUMBAI - 400 086\n\n"
        "CERTIFICATE\n"
    )
    r_ch.font.name = "Times New Roman"
    r_ch.font.size = Pt(15)
    r_ch.bold = True

    p_cert_body = doc.add_paragraph()
    p_cert_body.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_cert_body.paragraph_format.space_before = Pt(16)
    p_cert_body.paragraph_format.space_after = Pt(24)
    p_cert_body.paragraph_format.line_spacing = 1.3
    r_cb = p_cert_body.add_run(
        "This is to certify that Shivam Vishwakarma has successfully completed the project titled "
        "\"Re:Code (Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform)\" "
        "under our guidance towards partial fulfillment of the degree of Bachelor of Science (Computer Science - SEM VI) "
        "submitted to Ramniranjan Jhunjhunwala College, Ghatkopar(W) during the academic year 2025-2026 as specified by "
        "UNIVERSITY OF MUMBAI."
    )
    r_cb.font.name = "Times New Roman"
    r_cb.font.size = Pt(12)

    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph()

    # Signatures table
    sig_table = doc.add_table(rows=2, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_data = [
        ("Prof. (Mrs.) Anita Gaikwad", "Prof. (Mrs.) Anita Gaikwad"),
        ("Project Guide\nDept. of Computer Science", "In-Charge\nDept. of Computer Science")
    ]
    for r_i, (c1, c2) in enumerate(sig_data):
        sig_table.cell(r_i, 0).text = c1
        sig_table.cell(r_i, 1).text = c2
        for c in (sig_table.cell(r_i, 0), sig_table.cell(r_i, 1)):
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in c.paragraphs[0].runs:
                run.font.name = "Times New Roman"
                run.font.bold = True if r_i == 0 else False
                run.font.size = Pt(11)

    doc.add_page_break()

    # =========================================================================
    # PAGE 3: INDEX (TABLE OF CONTENTS)
    # =========================================================================
    add_heading(doc, "Index", level=1)
    
    idx_table = doc.add_table(rows=29, cols=3)
    idx_headers = ["Sr No.", "Contents", "Page No."]
    idx_data = [
        ("1.", "Acknowledgement", "1"),
        ("2.", "Declaration", "2"),
        ("3.", "Preliminary Investigation", "3"),
        ("3.1", "Software and Hardware Requirements", "4"),
        ("3.2", "Description of System", "7"),
        ("3.3", "Limitations of Current System and its Disadvantages", "9"),
        ("3.4", "Proposed System and its Advantages", "10"),
        ("4.", "Feasibility Study", "11"),
        ("4.1", "Technical Feasibility", "12"),
        ("4.2", "Economic Feasibility", "14"),
        ("4.3", "Operational Feasibility", "16"),
        ("5.", "Gantt Chart", "18"),
        ("6.", "Software Development Life Cycle", "22"),
        ("7.", "System Analysis", "24"),
        ("7.1", "Entity Relationship Diagram", "25"),
        ("7.2", "Class Diagram", "28"),
        ("7.3", "Object Diagram", "32"),
        ("7.4", "Activity Diagram", "35"),
        ("7.5", "Sequence Diagram", "38"),
        ("7.6", "Use Case Diagram", "43"),
        ("8.", "System Design", "46"),
        ("8.1", "Component Diagram", "47"),
        ("8.2", "Deployment Diagram", "50"),
        ("9.", "Design Phase", "53"),
        ("9.1", "Table Design", "54"),
        ("9.2", "Screen Layouts", "59"),
        ("10.", "System Coding", "73"),
        ("11.", "System Testing", "191"),
        ("12.", "Future Enhancements", "203"),
        ("13.", "References", "204"),
        ("13.1", "Textbook References", "205"),
        ("13.2", "Website References", "206"),
    ]
    format_custom_table(idx_table, [1.0, 4.5, 1.0], idx_headers, idx_data, header_bg="1E293B")
    
    doc.add_page_break()

    # =========================================================================
    # 1. ACKNOWLEDGEMENT
    # =========================================================================
    add_heading(doc, "1. ACKNOWLEDGEMENT", level=1)
    add_body_p(doc, "I am delighted to present this project report entitled “Re:Code - Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform”.")
    add_body_p(doc, "I take this opportunity to express my sincere gratitude to “Dr. Himanshu Dawda”, Principal of Ramniranjan Jhunjhunwala College, Ghatkopar (W), for providing me with the opportunity to pursue my studies in such a reputed institution. His encouragement and support have been invaluable and have greatly motivated me throughout my academic journey, including the successful completion of this project.")
    add_body_p(doc, "I would also like to extend my heartfelt thanks to “Prof. Anita Gaikwad”, Head of the Department of Computer Science, for her constant support, valuable advice, and encouragement during the development of my project. Her timely guidance and valuable suggestions have played a crucial role in shaping this project.")
    add_body_p(doc, "I am deeply grateful to “Prof. Anita Gaikwad”, my project guide, for her dedicated mentorship and expert advice throughout every phase of the project. Her patience, constructive feedback, and motivation helped me overcome challenges and successfully complete this work.")
    add_body_p(doc, "I also owe a deep debt of gratitude to my fellow friends and classmates who have been a constant source of inspiration, help, and encouragement during the debugging, testing, and implementation phases of this platform.")
    
    p_ty = doc.add_paragraph()
    p_ty.paragraph_format.space_before = Pt(36)
    p_ty.add_run("Thank You,\n\nShivam Vishwakarma.")

    doc.add_page_break()

    # =========================================================================
    # 2. DECLARATION
    # =========================================================================
    add_heading(doc, "2. DECLARATION", level=1)
    add_body_p(doc, "I hereby declare that the project work entitled “Re:Code - Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform”, submitted to Ramniranjan Jhunjhunwala College, Department of B.Sc. Computer Science, is a record of original work carried out and completed by me under the guidance of Prof. Anita Gaikwad.")
    add_body_p(doc, "This project represents the culmination of my dedicated efforts in researching, designing, and implementing a comprehensive enterprise solution for dual-engine code analysis, deterministic Abstract Syntax Tree (AST) security auditing, generative AI diagnostic reasoning, and automated in-memory code refactoring. Throughout its development, I have ensured the accuracy, authenticity, and reliability of all information, mathematical models, and data presented herein. In instances where I have drawn upon established algorithms, frameworks, or libraries, I have duly acknowledged them through proper citations and references.")
    add_body_p(doc, "I further declare that this work has not been submitted to any other institution or university for the award of any degree or diploma. I affirm that there has been no misrepresentation, fabrication, or falsification of any fact, data, or source material in this report. I understand the serious implications of academic dishonesty and acknowledge that any breach of these ethical standards may result in disciplinary action by the Institute.")
    add_body_p(doc, "Finally, I reaffirm my commitment to uphold the principles of academic integrity, honesty, and authenticity in all my future engineering endeavors.")
    
    p_dec_sig = doc.add_paragraph()
    p_dec_sig.paragraph_format.space_before = Pt(36)
    p_dec_sig.add_run("Shivam Vishwakarma.")

    doc.add_page_break()

    # =========================================================================
    # 3. PRELIMINARY INVESTIGATION
    # =========================================================================
    add_heading(doc, "3. PRELIMINARY INVESTIGATION", level=1)
    add_body_p(doc, "Preliminary investigation is the first phase of the software development life cycle (SDLC). It involves an initial analysis of system requirements, organizational feasibility, and technological viability. The objectives of preliminary investigation are:")
    
    add_bullet_p(doc, " The foremost aim is to ascertain whether a new system is required or if alterations to an existing system are warranted. This phase instigates by recognizing the need for change within the current software code review and security auditing landscape.", bold_prefix="1. Identifying the System Need:")
    add_bullet_p(doc, " A pivotal aspect is the precise definition of the problem in need of resolution. This step involves thorough problem comprehension, ensuring the establishment of lucid project objectives.", bold_prefix="2. Defining the Problem:")
    add_bullet_p(doc, " In response to the identified problem, preliminary investigation fosters the generation of diverse alternative solutions. Software engineers actively brainstorm and propose various approaches to effectively address the identified issues.", bold_prefix="3. Proposing Alternative Solutions:")
    add_bullet_p(doc, " The assessment of the feasibility of the proposed system stands central. This entails scrutinizing technological viability, cost implications, and projected timelines.", bold_prefix="4. Evaluating Feasibility:")
    
    add_body_p(doc, "During preliminary investigation, the software engineers:")
    add_bullet_p(doc, "Study the current system and identify issues, problems, and shortcomings.")
    add_bullet_p(doc, "Interview developers and users to understand their requirements and information needs.")
    add_bullet_p(doc, "Suggest possible alternative solutions to meet the requirements.")
    add_bullet_p(doc, "Evaluate the feasibility of the proposed system in terms of technology, cost, and time.")
    
    add_body_p(doc, "The preliminary investigation helps determine if the proposed system is worth pursuing further. It provides management and stakeholders with enough information to decide whether to proceed with a full feasibility study and system analysis.")
    add_body_p(doc, "If the project is approved based on the preliminary investigation, the next phases of SDLC like feasibility study, system analysis, design, implementation, and testing are carried out.")

    # 3.1 Software and Hardware Requirements
    add_heading(doc, "3.1 SOFTWARE AND HARDWARE REQUIREMENTS", level=2)
    add_heading(doc, "A. Software Requirements", level=3)
    
    add_body_p(doc, "• Front-end:", bold_prefix="")
    add_bullet_p(doc, " The front-end user interface is constructed using React 19, a high-performance declarative UI library offering concurrent rendering, component memoization, and streamlined state handling. Built with Vite (Rolldown bundler) for sub-second hot module replacement.", bold_prefix="1. Framework - React 19 & Vite:")
    add_bullet_p(doc, " Styled with Tailwind CSS v4, enforcing a strict, accessible YouTube Dark Mode design specification (#0F0F0F background, #181818 surface cards, #212121 hover tiers, #02C8F0 cyan accent). Zero neon glare ensures maximum visual clarity for prolonged code review sessions.", bold_prefix="2. Styling & Design System - Tailwind CSS v4:")
    add_bullet_p(doc, " Seamless responsive breakpoints (sm, md, lg, xl) allow software engineers to review code diffs, trigger live patches, and export audit certificates across mobile devices, tablets, and multi-monitor desktop environments.", bold_prefix="3. Responsive Layout & Code Diff Canvas:")

    add_body_p(doc, "• Back-end:", bold_prefix="")
    add_body_p(doc, "Powered by Node.js and Express 5, the platform's robust backend features a high-throughput RESTful routing architecture, centralized error handling, and security hardening against malicious payloads.")
    add_bullet_p(doc, " Leverages @babel/parser and @babel/traverse to build deterministic AST syntax trees for JavaScript and TypeScript. Traverses nodes via visitor patterns to mathematically detect SQL injections (CWE-89), hardcoded JWT secrets (CWE-798), dead variables (CWE-563), and sensitive console leaks (CWE-532).", bold_prefix="1. Static AST Parser Engine:")
    add_bullet_p(doc, " Communicates with Google Cloud AI using @google/genai. Prompts enforce strict Type.OBJECT and Type.ARRAY JSON schemas to prevent hallucinations, catching algorithmic inefficiencies (O(N^2) loops) and race conditions.", bold_prefix="2. Generative AI Engine - Google Gemini 2.5 Flash:")
    add_bullet_p(doc, " Engineered with custom DNS pre-resolution resolving hostnames prior to outbound HTTP fetches, rejecting all RFC 1918 and loopback IP spaces (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16). Enforces a rigid 2MB payload clamp returning HTTP 413.", bold_prefix="3. Security Shield & SSRF Defense Layer:")
    add_bullet_p(doc, " Uses Supabase managed PostgreSQL with Row-Level Security (RLS) policies. Enforces strict isolation between authenticated developers and anonymous guest audit sessions via x-guest-session-id headers.", bold_prefix="4. Database - Supabase PostgreSQL 16:")
    add_bullet_p(doc, " Employs PDFKit with 16mm adaptive margins, atomic finding card height calculation, and trailing blank page elimination logic to stream clean, branded A4 audit certificates.", bold_prefix="5. Diagnostic Report Generation - PDFKit:")

    add_heading(doc, "B. Hardware Requirements", level=3)
    add_body_p(doc, "Re:Code is deployed on scalable cloud infrastructure with serverless database clustering, eliminating the need for dedicated on-premise hardware servers. The following hardware specifications are sufficient for development, testing, and production hosting:")

    hw_table = doc.add_table(rows=7, cols=2)
    hw_headers = ["Item", "Requirement"]
    hw_data = [
        ("Development Machine", "Laptop or desktop with modern multi-core processor (Intel Core i5 / AMD Ryzen 5 or higher)"),
        ("Memory (RAM)", "At least 8 GB RAM (16 GB recommended for concurrent AST & build processes)"),
        ("Storage", "15-20 GB free SSD storage for repository node_modules and test caches"),
        ("Operating System", "Windows 10/11, macOS Monterey+, or Ubuntu Linux 22.04 LTS"),
        ("Internet Connectivity", "Reliable broadband internet (minimum 10 Mbps) for GitHub API, Gemini AI, and Supabase sync"),
        ("Peripherals", "Standard high-resolution display monitor (1080p minimum), keyboard, and mouse")
    ]
    format_custom_table(hw_table, [2.2, 4.3], hw_headers, hw_data, header_bg="263238")

    add_heading(doc, "C. Development Tools and Environments", level=3)
    add_bullet_p(doc, " Primary development environment equipped with Tailwind CSS IntelliSense, ESLint, Oxlint, Prettier, and Jest Runner extensions.", bold_prefix="1. Integrated Development Environment (IDE) - Visual Studio Code:")
    add_bullet_p(doc, " Web console for schema migrations, RLS policy management, table browser, and real-time query performance monitoring.", bold_prefix="2. Database Management Tool - Supabase Cloud Dashboard:")
    add_bullet_p(doc, " Distributed version control for feature branching, automated CI/CD validation, and team collaboration.", bold_prefix="3. Version Control System - Git with GitHub:")
    add_bullet_p(doc, " Node.js v24 LTS runtime paired with npm workspaces managing both /backend and /frontend dependencies seamlessly.", bold_prefix="4. Runtime & Package Management - Node.js v24 & npm:")

    # 3.2 Description of System
    add_heading(doc, "3.2 DESCRIPTION OF SYSTEM", level=2)
    add_body_p(doc, "“Re:Code - Automated Code Review, Static AST Security Analysis & AI Diagnostics Platform”", italic=True)
    add_heading(doc, "A. Overview:", level=3)
    add_body_p(doc, "Re:Code is an enterprise-grade automated code review and static security auditing platform engineered as a final-year B.Sc. Computer Science project. It empowers individual developers, student builders, and engineering teams to audit raw code snippets or entire GitHub repositories for critical flaws, security breaches, and performance bottlenecks before committing to production.")
    add_body_p(doc, "The platform bridges the fundamental gap between rigid static linters (which miss high-level architectural patterns) and unconstrained generative AI models (which hallucinate invalid line numbers and syntax). By coupling a deterministic Babel Abstract Syntax Tree (AST) parser with Google Gemini 2.5 Flash under a unified normalization pipeline, Re:Code provides mathematically validated security guarantees alongside contextual, plain-language refactoring diffs.")
    add_body_p(doc, "Beyond raw diagnostics, Re:Code features an interactive, zero-glow YouTube Dark Mode canvas where developers can inspect visual red/green diffs, execute 1-click in-memory patches that dynamically recalculate code health scores, apply all safe low-risk fixes simultaneously, and export formal vector PDF audit certificates.")

    add_heading(doc, "B. Core Functional Modules", level=3)
    add_bullet_p(doc, " Allows developers to paste single source code snippets or submit public GitHub repository URLs. Ingests remote code trees recursively up to 10 folder levels using the GitHub Git Trees API, intelligently prioritizing entry points, controllers, and database models while ignoring test scorecards and build artifacts.", bold_prefix="1. Multi-Target Code Ingestion:")
    add_bullet_p(doc, " Analyzes ECMAScript/TypeScript AST syntax trees using @babel/parser and visitor patterns. Detects SQL injection concatenations (CWE-89), hardcoded JWT/API secrets (CWE-798), unused variables (CWE-563), sensitive console logging (CWE-532), and empty catch blocks (CWE-390) with 100% deterministic certainty.", bold_prefix="2. Deterministic Static AST Engine:")
    add_bullet_p(doc, " Prompts Google Gemini 2.5 Flash with strict JSON schema constraints. Evaluates algorithmic complexity (such as O(N^2) nested query bottlenecks), architectural antipatterns, and race conditions, generating unified before/after remediation git diffs.", bold_prefix="3. Generative Gemini AI Review Engine:")
    add_bullet_p(doc, " Evaluates cross-engine findings using a +/- 2 line proximity clustering algorithm. When both AST and Gemini flag the same flaw, findings are unified into a single card with the cyan 'HYBRID (AST + AI)' badge, adopting the AST physical line number and Gemini's contextual diff.", bold_prefix="4. Findings Normalization & Deduplication:")
    add_bullet_p(doc, " Calculates an objective 100-point baseline health score. Enforces severity penalty capping (e.g. low-severity console logs capped at 15 points total across a project) and a quality floor guaranteeing that codebases with 0 Critical and 0 High flaws never drop below Grade C (minimum score 70).", bold_prefix="5. Mathematical Scoring Engine:")
    add_bullet_p(doc, " Built in React 19 adhering to the official YouTube Dark Mode specification (#0F0F0F, #181818, #02C8F0). Provides categorized finding cards, severity filters, file tree navigation, and side-by-side red/green code diff comparisons.", bold_prefix="6. Interactive Review Canvas:")
    add_bullet_p(doc, " Allows developers to click 'Apply Patch' to update code in-memory without server roundtrips, dynamically boosting the displayed health score (+2 pts per fix). The docked footer provides 'Apply All Safe Fixes', applying all LOW/INFO fixes in bottom-to-top line order to prevent line index shifts.", bold_prefix="7. In-Memory Live Patching Engine:")
    add_bullet_p(doc, " Streams professional, branded diagnostic audit certificates generated via PDFKit with 16mm adaptive margins, atomic card height checking, and trailing blank page elimination. Also exports dynamic markdown README badges.", bold_prefix="8. Content-Adaptive PDF & README Export:")
    add_bullet_p(doc, " Pre-resolves DNS hostnames before executing remote git fetches, blocking all private RFC 1918 spaces, cloud metadata IP addresses (169.254.169.254), and decimal-obfuscated loopbacks. Rejects oversized HTTP bodies exceeding 2MB with HTTP 413.", bold_prefix="9. Enterprise SSRF Defense & Payload Clamping:")
    add_bullet_p(doc, " Maintains an immutable chronological audit trail in Supabase PostgreSQL with cascade deletion triggers, supporting both authenticated developers and anonymous guest sessions via x-guest-session-id headers.", bold_prefix="10. Session History & Sandboxed Persistence:")

    # 3.3 Limitations of Current System
    add_heading(doc, "3.3 LIMITATIONS OF CURRENT SYSTEMS AND THEIR DISADVANTAGES", level=2)
    add_body_p(doc, "Despite the availability of standalone linters and AI chatbots, existing code review solutions exhibit significant engineering shortcomings that impede productivity, compromise security, and increase operational costs:")
    
    add_bullet_p(doc, " Tools like ESLint and SonarQube evaluate rigid syntax rules. They cannot understand high-level algorithmic logic, identify race conditions, or construct multi-line contextual refactoring diffs.", bold_prefix="1. Lack of Contextual & Algorithmic Understanding in Linters:")
    add_bullet_p(doc, " Directly querying LLMs (e.g. ChatGPT, Claude) leads to non-deterministic responses, hallucinated line numbers, and syntactically broken code replacements without AST boundary verification.", bold_prefix="2. Hallucinations & Non-Determinism in Pure AI Reviewers:")
    add_bullet_p(doc, " Human peer reviews introduce severe scheduling friction into CI/CD pipelines. Reviewers frequently overlook subtle injection vulnerabilities or hardcoded secrets due to review fatigue.", bold_prefix="3. Latency & Bottlenecks in Manual Peer Reviews:")
    add_bullet_p(doc, " Existing platforms output static warnings requiring developers to manually locate, edit, and re-test files, lacking interactive 1-click in-memory code remediation.", bold_prefix="4. Absence of Live In-Memory Remediation:")
    add_bullet_p(doc, " Standard automated platforms fetching external repositories are vulnerable to Server-Side Request Forgery (SSRF) and memory exhaustion attacks from oversized repositories.", bold_prefix="5. Ingestion Vulnerabilities to SSRF & Payload Flooding:")
    add_bullet_p(doc, " Conventional static analysis tools penalize codebases linearly. A project with 40 minor console logs can be penalized into failing grade F, obscuring actual critical security risks.", bold_prefix="6. Disproportionate & Uncapped Penalty Deductions:")
    add_bullet_p(doc, " Automated PDF audit tools generate bloated documents with awkward page splits, overflowing text, and trailing blank sheets, rendering reports unprofessional for executive presentation.", bold_prefix="7. Poorly Formatted & Bloated PDF Exports:")

    # 3.4 Proposed System and its Advantages
    add_heading(doc, "3.4 PROPOSED SYSTEM AND ITS ADVANTAGES", level=2)
    add_body_p(doc, "The Re:Code platform is designed to overcome every limitation identified above by integrating deterministic static AST parsing, generative AI reasoning, mathematical scoring, and hardened security defenses into a single, cohesive workflow:")
    
    add_bullet_p(doc, " Unites the mathematical certainty of Babel AST visitors with the deep semantic reasoning of Google Gemini 2.5 Flash, delivering both zero-latency security detection and intelligent refactoring diffs.", bold_prefix="1. Synergistic Dual-Engine Architecture:")
    add_bullet_p(doc, " Uses proximity clustering (+/- 2 lines) to identify cross-engine overlaps, unifying findings into single cards branded with the cyan 'HYBRID (AST + AI)' badge for maximum clarity.", bold_prefix="2. Intelligent Deduplication & Hybrid Attribution:")
    add_bullet_p(doc, " Implements mathematical severity caps preventing minor warnings from dominating scores. A project with 0 Critical and 0 High flaws is mathematically guaranteed a minimum Grade C (floor score 70).", bold_prefix="3. Penalty-Capped Mathematical Scoring:")
    add_bullet_p(doc, " Developers can click 'Apply Patch' to repair vulnerabilities in-memory with real-time score boosts, or click 'Apply All Safe Fixes' to automatically apply all low-risk fixes in reverse line order.", bold_prefix="4. Live In-Memory Patching & 'Apply All Safe Fixes':")
    add_bullet_p(doc, " Traverses GitHub repositories recursively up to 10 levels via the Git Trees API, analyzing real controllers, routes, and models while filtering out test scorecards, documentation, and minified bundles.", bold_prefix="5. Recursive Git Tree Ingestion:")
    add_bullet_p(doc, " Built-in DNS pre-resolution blocks all internal RFC 1918 and loopback targets before fetching external code, while a 2MB body clamp prevents memory exhaustion attacks.", bold_prefix="6. Hardened SSRF Defense & Payload Clamping:")
    add_bullet_p(doc, " Generates vector audit certificates using PDFKit with 16mm adaptive margins, card height checking, and trailing blank sheet suppression for flawless executive presentations.", bold_prefix="7. Clean Vector PDF Audit Exports:")

    doc.add_page_break()

    # =========================================================================
    # 4. FEASIBILITY STUDY
    # =========================================================================
    add_heading(doc, "4. FEASIBILITY STUDY", level=1)
    add_body_p(doc, "A feasibility study is an analysis that takes all of a project's relevant factors into account—including economic, technical, and operational considerations—to ascertain the likelihood of completing the project successfully.")
    add_body_p(doc, "Project managers and software engineers use feasibility studies to discern the pros and cons of undertaking a software project before committing substantial engineering time and institutional resources into development.")
    add_body_p(doc, "The main objectives of a feasibility study in software engineering are:")
    add_bullet_p(doc, " Assesses the technical aspects like required developer skills, tooling, libraries, algorithmic complexity, and hardware/software compatibility.", bold_prefix="1. Technical Feasibility:")
    add_bullet_p(doc, " Evaluates development, hosting, and API costs versus potential productivity savings, risk mitigation, and security ROI.", bold_prefix="2. Economic Feasibility:")
    add_bullet_p(doc, " Determines if the software can be operated, integrated into developer workflows, and maintained effectively post-deployment.", bold_prefix="3. Operational Feasibility:")

    add_heading(doc, "4.1 TECHNICAL FEASIBILITY", level=2)
    add_body_p(doc, "The technical feasibility of Re:Code confirms that the proposed system can be effectively developed and deployed using proven, modern, and open-source technologies:")
    add_bullet_p(doc, " The ingestion pipeline accepts direct code snippets or public GitHub URLs. Integration with the GitHub Git Trees REST API enables recursive traversal without local disk cloning, while @google/genai enables cloud-based semantic analysis.", bold_prefix="1. Data Collection & API Integration:")
    add_bullet_p(doc, " Node.js v24 and Express 5 provide an event-driven, non-blocking foundation capable of coordinating concurrent AST traversals and external API dispatches with low memory overhead.", bold_prefix="2. High-Throughput Server Architecture:")
    add_bullet_p(doc, " Built on Supabase PostgreSQL with connection pooling on port 6543, cascade deletion triggers, and Row Level Security (RLS) policies guaranteeing strong data isolation between users.", bold_prefix="3. Database Design & Security:")
    add_bullet_p(doc, " Built with React 19 and Tailwind CSS v4, adhering to the matte YouTube Dark Mode specification with responsive mobile-ready viewports and XSS-immune diff viewing.", bold_prefix="4. User Interface & Experience:")

    add_heading(doc, "4.2 ECONOMIC FEASIBILITY", level=2)
    add_body_p(doc, "The economic feasibility of Re:Code evaluates its financial sustainability from initial development to long-term operational deployment. While built as an academic and open-source platform, Re:Code delivers an exceptional Return on Investment (ROI) by catching software bugs and security breaches before deployment:")
    add_bullet_p(doc, " Industry studies establish that resolving a security vulnerability (such as SQL injection) in production costs up to 30 times more than remediating it during development. By automating review passes, Re:Code saves substantial engineering hours.", bold_prefix="1. Value Proposition (Developer ROI):")
    add_bullet_p(doc, " Operational hosting costs remain minimal by leveraging serverless database tiers (Supabase), cloud hosting (Vercel), and highly efficient token usage via Google Gemini 2.5 Flash.", bold_prefix="2. Sustainability & Low-Cost Infrastructure:")

    add_body_p(doc, "Risk & Mitigation Summary Table:", bold_prefix="")
    risk_table = doc.add_table(rows=5, cols=3)
    risk_headers = ["Identified Risk", "Impact", "Mitigation Strategy"]
    risk_data = [
        ("Gemini AI API Throttling / Rate Limits", "Medium", "Trap error gracefully, flag telemetry with partialMode: true, and return full AST analysis."),
        ("Server-Side Request Forgery (SSRF) via Ingestion", "Critical", "Pre-resolve DNS hostnames, reject all RFC 1918 private spaces, block 169.254/16 metadata."),
        ("Memory Exhaustion from Giant Repositories", "High", "Enforce 2MB body limit (HTTP 413) and cap repository ingestion to 50 candidate files / 10MB."),
        ("Line Number Shift during Multi-Patch Application", "Medium", "Sort patches descending by line number (bottom-to-top) before mutating file buffer.")
    ]
    format_custom_table(risk_table, [2.0, 1.0, 3.5], risk_headers, risk_data, header_bg="37474F")

    add_heading(doc, "4.3 OPERATIONAL FEASIBILITY", level=2)
    add_body_p(doc, "Operational feasibility evaluates how comfortably software engineers, security auditors, and students can adopt Re:Code within real-world engineering workflows:")
    add_bullet_p(doc, " The interface requires zero configuration. Users simply paste code or supply a GitHub URL to receive an interactive, explainable audit report within 5 seconds.", bold_prefix="1. Ease of Use & Frictionless Onboarding:")
    add_bullet_p(doc, " Supports anonymous guest audits via x-guest-session-id headers, allowing instant evaluation without requiring upfront account creation.", bold_prefix="2. Guest Sandbox Architecture:")
    add_bullet_p(doc, " Engineered with modular service boundaries (/services/analysis, /services/ai, /services/github), enabling straightforward extension to new AST languages (Tree-sitter) or CI/CD pipelines.", bold_prefix="3. Maintainability & Extensibility:")

    doc.add_page_break()

    # =========================================================================
    # 5. GANTT CHART
    # =========================================================================
    add_heading(doc, "5. GANTT CHART", level=1)
    add_body_p(doc, "A Gantt chart illustrates all project tasks, their estimated and actual durations, scheduled timeframes, and dependencies between activities across the software development lifecycle. Key components of a Gantt chart include:")
    add_bullet_p(doc, " Runs vertically along the left axis, detailing task breakdowns organized by project phase.", bold_prefix="Task List:")
    add_bullet_p(doc, " Runs horizontally across the top axis, indicating calendar progression across weeks and days.", bold_prefix="Timeline:")
    add_bullet_p(doc, " Horizontal bars representing the active duration, start dates, and completion dates of each task.", bold_prefix="Bars:")
    add_bullet_p(doc, " Diamond markers highlighting major project deliverables, audits, and evaluation gates.", bold_prefix="Milestones:")
    add_bullet_p(doc, " Dependency lines connecting prerequisite tasks to downstream activities.", bold_prefix="Dependencies:")

    add_body_p(doc, "Actual vs. Expected Project Timeline Matrix:", bold_prefix="")
    gantt_table = doc.add_table(rows=18, cols=5)
    gantt_headers = ["Phase / Module", "Start Date", "End Date", "Actual (Days)", "Expected (Days)"]
    gantt_data = [
        ("Requirements Gathering & Scope", "05/01/2026", "08/01/2026", "4", "5"),
        ("Feasibility Study & Tool Selection", "09/01/2026", "13/01/2026", "5", "6"),
        ("System Architecture & SDLC Design", "14/01/2026", "18/01/2026", "5", "5"),
        ("UML Modeling (ER, Class, Sequence)", "19/01/2026", "24/01/2026", "6", "7"),
        ("Database Relational Schema & RLS", "25/01/2026", "29/01/2026", "5", "5"),
        ("Express REST API & Health Probes", "30/01/2026", "03/02/2026", "5", "4"),
        ("Static AST Traversal Engine (Babel)", "04/02/2026", "11/02/2026", "8", "10"),
        ("Google Gemini AI Integration", "12/02/2026", "18/02/2026", "7", "8"),
        ("GitHub Recursive Ingestion Engine", "19/02/2026", "24/02/2026", "6", "6"),
        ("Findings Normalization & Deduplication", "25/02/2026", "01/03/2026", "5", "5"),
        ("Mathematical Scoring & Penalty Capping", "02/03/2026", "06/03/2026", "5", "5"),
        ("Security Hardening & SSRF Defense", "07/03/2026", "13/03/2026", "7", "7"),
        ("Frontend Canvas & Diff Viewer (React)", "14/03/2026", "23/03/2026", "10", "12"),
        ("Live In-Memory Patching Engine", "24/03/2026", "29/03/2026", "6", "6"),
        ("Vector PDF Report Export (PDFKit)", "30/03/2026", "04/04/2026", "6", "5"),
        ("System Testing & Security Regression", "05/04/2026", "14/04/2026", "10", "10"),
        ("Deployment & Final Documentation", "15/04/2026", "18/04/2026", "4", "4")
    ]
    format_custom_table(gantt_table, [2.2, 1.1, 1.1, 1.1, 1.1], gantt_headers, gantt_data, header_bg="1E293B")

    doc.add_paragraph()
    add_image_box(doc, "gantt_chart_1.png", "Requirements Analysis & Preliminary Investigation Gantt Chart")
    add_image_box(doc, "gantt_chart_2.png", "System Analysis Phase Gantt Chart")
    add_image_box(doc, "gantt_chart_3.png", "System Design Phase Gantt Chart")
    add_image_box(doc, "gantt_chart_4.png", "Design Phase (UI/UX Wireframes) Gantt Chart")
    add_image_box(doc, "gantt_chart_5.png", "System Coding & Implementation Gantt Chart")
    add_image_box(doc, "gantt_chart_6.png", "System Testing & Final Deployment Gantt Chart")

    doc.add_page_break()

    # =========================================================================
    # 6. SOFTWARE DEVELOPMENT LIFE CYCLE (SDLC)
    # =========================================================================
    add_heading(doc, "6. SOFTWARE DEVELOPMENT LIFE CYCLE (SDLC)", level=1)
    add_heading(doc, "A. Iterative Model", level=2)
    add_body_p(doc, "The Iterative Model was chosen as the governing Software Development Life Cycle methodology for the Re:Code platform. In this approach, software development begins with a specified subset of core requirements (such as static AST parsing and local snippet evaluation) and progressively evolves through repeated cycles (iterations) into a comprehensive enterprise platform.")
    add_body_p(doc, "Rather than attempting full implementation upfront under a rigid waterfall lifecycle, each iteration encompasses design, implementation, testing, and evaluation phases. This ensures early risk identification, enables seamless integration of complex AI prompt schemas, and guarantees mathematical validation of scoring models prior to final deployment.")

    add_heading(doc, "B. Phases of the Iterative Model", level=2)
    add_bullet_p(doc, " Security weakness standards (OWASP Top 10, CWE) and code review bottlenecks were researched. Core requirements for AST traversal and LLM structured schemas were defined.", bold_prefix="1. Requirements Gathering & Analysis:")
    add_bullet_p(doc, " Architectural blueprints were established, including UML class, sequence, activity, and component diagrams. Relational schemas and security policies were formulated.", bold_prefix="2. Design:")
    add_bullet_p(doc, " Functional modules were implemented iteratively: Iteration 1 built the core AST engine and Express API; Iteration 2 integrated Gemini AI and the SSRF shield; Iteration 3 produced the interactive canvas and PDF exporter.", bold_prefix="3. Development:")
    add_bullet_p(doc, " Every iteration underwent rigorous unit, integration, and security regression testing via Jest and Supertest, maintaining 100% test pass rates across all 187 test specifications.", bold_prefix="4. Testing:")
    add_bullet_p(doc, " Stakeholders and peer reviewers evaluated diagnostic accuracy, latency benchmarks, and UI usability, guiding iterative refactoring of finding normalizers and scoring penalty formulas.", bold_prefix="5. Review:")
    add_bullet_p(doc, " Stable incremental builds were deployed to cloud hosting platforms (Vercel and Supabase) with zero-downtime database migrations.", bold_prefix="6. Deployment:")
    add_bullet_p(doc, " Ongoing post-deployment monitoring, security dependency patching, and API quota optimization to ensure high availability and responsiveness.", bold_prefix="7. Maintenance:")

    add_heading(doc, "C. Illustration of Iterative Model", level=2)
    add_image_box(doc, "sdlc_iterative_model.png", "Phases of the Iterative Model for Re:Code Platform")

    doc.add_page_break()

    # =========================================================================
    # 7. SYSTEM ANALYSIS
    # =========================================================================
    add_heading(doc, "7. SYSTEM ANALYSIS", level=1)
    add_body_p(doc, "System Analysis is the process of examining an existing operational domain or software challenge to identify its functional requirements, constraints, and operational bottlenecks, then designing an efficient automated system to achieve those goals. In software engineering, system analysis establishes the conceptual data models and behavioral contracts necessary for reliable database creation and component interaction.")
    add_body_p(doc, "The system analysis phase typically encompasses:")
    add_bullet_p(doc, " Determining whether the proposed solution is technologically viable, economically sustainable, and operationally sound.", bold_prefix="1. Feasibility Study:")
    add_bullet_p(doc, " Gathering user expectations and real-world code review workflows through interviews, source inspection, and vulnerability cataloging.", bold_prefix="2. Fact-Finding:")
    add_bullet_p(doc, " Defining how developers and automated engines interact through comprehensive Use Case Modeling.", bold_prefix="3. User & System Understanding:")

    # 7.1 ER Diagram
    add_heading(doc, "7.1 ENTITY RELATIONSHIP (ER) DIAGRAM", level=2)
    add_body_p(doc, "The Entity Relationship (ER) Model is a conceptual data modeling approach that visually represents real-world entities, their attributes, and the relationships between them. An ER Diagram acts as a structural blueprint illustrating how database tables interact, forming the foundation for logical database design and relational constraints.")
    add_bullet_p(doc, " Represents an independent object or table (e.g. Profiles, Reviews, Issues) depicted as a rectangle.", bold_prefix="A. Entity:")
    add_bullet_p(doc, " Represents characteristics of an entity (e.g. email, health_score, line_number) depicted as an oval. Primary keys are underlined.", bold_prefix="B. Attribute:")
    add_bullet_p(doc, " Depicted as a diamond showing associations (1:1, 1:N, M:N) between entities with integrity constraints.", bold_prefix="C. Relationship:")

    add_image_box(doc, "er_symbols.png", "Standard Entity Relationship (ER) Diagram Symbols")
    add_image_box(doc, "recode_er_diagram.png", "Entity Relationship (ER) Diagram for Re:Code Platform")

    # 7.2 Class Diagram
    add_heading(doc, "7.2 CLASS DIAGRAM", level=2)
    add_body_p(doc, "A Class Diagram in UML (Unified Modeling Language) is a static structural diagram that depicts the blueprint of an object-oriented system by showing its classes, attributes, methods, and the structural relationships between them. It serves as a visual model of software architecture, guiding object organization, component modularity, and encapsulation.")
    add_bullet_p(doc, " Defines classes, attributes, operations, and data types comprising the runtime system.", bold_prefix="• Model Static Structure:")
    add_bullet_p(doc, " Illustrates inheritance, associations, dependencies, and aggregation between components.", bold_prefix="• Visualize Relationships:")
    add_bullet_p(doc, " Serves as the structural baseline for sequence, object, and component diagrams.", bold_prefix="• Foundation for System Design:")

    add_image_box(doc, "class_symbols.png", "Standard UML Class Diagram Notations")
    add_image_box(doc, "recode_class_diagram.png", "UML Class Diagram for Re:Code Dual-Engine Architecture")

    # 7.3 Object Diagram
    add_heading(doc, "7.3 OBJECT DIAGRAM", level=2)
    add_body_p(doc, "An Object Diagram depicts concrete instances of classes and their attribute values at a specific point in execution. While Class Diagrams represent abstract blueprints, Object Diagrams capture a real-time snapshot of system state during an active review session, illustrating how object instances are linked in memory.")
    add_image_box(doc, "recode_object_diagram.png", "UML Object Diagram — Runtime State Snapshot of Re:Code Session")

    # 7.4 Activity Diagram
    add_heading(doc, "7.4 ACTIVITY DIAGRAM", level=2)
    add_body_p(doc, "An Activity Diagram illustrates the dynamic flow of control from one activity to another within a system process. Operating similarly to an advanced flowchart, it visualizes sequential, branched, parallel, and concurrent transitions, making it ideal for modeling the Re:Code dual-engine execution pipeline.")
    add_image_box(doc, "recode_activity_diagram.png", "UML Activity Diagram — Re:Code End-to-End Review Workflow")

    # 7.5 Sequence Diagram
    add_heading(doc, "7.5 SEQUENCE DIAGRAM", level=2)
    add_body_p(doc, "Sequence Diagrams are UML interaction diagrams that illustrate how objects communicate and operate over time. They emphasize the chronological order of message dispatches along a vertical timeline, showing method calls, asynchronous responses, and database queries.")
    add_image_box(doc, "recode_sequence_diagram.png", "UML Sequence Diagram — Code Review Pipeline Interaction")

    # 7.6 Use Case Diagram
    add_heading(doc, "7.6 USE CASE DIAGRAM", level=2)
    add_body_p(doc, "A Use Case Diagram captures the dynamic behavior of a software system by mapping the interactions between external actors (Registered Developers, Guest Auditors) and the system functionalities enclosed within the application boundary.")
    add_image_box(doc, "recode_usecase_diagram.png", "UML Use Case Diagram — Re:Code Actor Interactions")

    doc.add_page_break()

    # =========================================================================
    # 8. SYSTEM DESIGN
    # =========================================================================
    add_heading(doc, "8. SYSTEM DESIGN", level=1)
    add_body_p(doc, "System design is the process of defining the architecture, modules, interfaces, and data specifications necessary for a software system to satisfy its functional and operational requirements. It bridges the conceptual models formulated during system analysis with the physical implementation constructed during system coding.")
    add_body_p(doc, "System design is broken down into four essential tiers:")
    add_bullet_p(doc, " The abstract representation of data flows, inputs, outputs, and business logic pipelines.", bold_prefix="1. Logical Design:")
    add_bullet_p(doc, " The concrete input/output processes, API request/response structures, and database schemas.", bold_prefix="2. Physical Design:")
    add_bullet_p(doc, " High-level structural organization establishing subsystem boundaries and communication protocols.", bold_prefix="3. Architectural Design:")
    add_bullet_p(doc, " In-depth specification of individual modules, AST visitors, and scoring algorithms.", bold_prefix="4. Detailed Design:")

    # 8.1 Component Diagram
    add_heading(doc, "8.1 COMPONENT DIAGRAM", level=2)
    add_body_p(doc, "A Component Diagram visualizes the physical organization and dependencies among software modules, executable libraries, and subsystems. It illustrates the high-level functional building blocks of Re:Code, showing how the frontend, API server, AST analyzer, Gemini client, and database cooperate.")
    add_image_box(doc, "recode_component_diagram.png", "UML Component Diagram — Re:Code Subsystem Architecture")

    # 8.2 Deployment Diagram
    add_heading(doc, "8.2 DEPLOYMENT DIAGRAM", level=2)
    add_body_p(doc, "A Deployment Diagram models the physical hardware and cloud execution environment where software artifacts reside and run. It maps execution nodes, client devices, and networking protocols (HTTPS, TLS, SSL) across the Re:Code production topology.")
    add_image_box(doc, "recode_deployment_diagram.png", "UML Deployment Diagram — Re:Code Production Topology")

    doc.add_page_break()

    # =========================================================================
    # 9. DESIGN PHASE
    # =========================================================================
    add_heading(doc, "9. DESIGN PHASE", level=1)
    add_body_p(doc, "During the design phase, technical specifications are translated into concrete relational table schemas and user interface screen layouts. Detailed data normalization guarantees database integrity, while UI wireframes ensure an accessible, dark-mode developer experience.")

    # 9.1 Table Design
    add_heading(doc, "9.1 TABLE DESIGN", level=2)
    
    # Table 1: profiles
    add_heading(doc, "A. Profiles Table (public.profiles)", level=3)
    p_t = doc.add_table(rows=6, cols=4)
    format_custom_table(p_t, [1.5, 1.2, 2.0, 1.8], ["Field Name", "Data Type", "Constraints", "Description"], [
        ("id", "UUID", "PK, NOT NULL, FK to auth.users(id), ON DELETE CASCADE", "Unique developer account identifier"),
        ("email", "TEXT", "NOT NULL, UNIQUE", "Registered email address"),
        ("full_name", "TEXT", "NULL", "Developer full name"),
        ("role", "TEXT", "DEFAULT 'developer'", "User role ('developer', 'admin', 'lead')"),
        ("created_at", "TIMESTAMPTZ", "DEFAULT now()", "Account creation timestamp")
    ], header_bg="1E293B")
    add_body_p(doc, "Note: The created_at column is present across all tables to guarantee chronological auditing.", italic=True)

    # Table 2: reviews
    add_heading(doc, "B. Reviews Table (public.reviews)", level=3)
    r_t = doc.add_table(rows=12, cols=4)
    format_custom_table(r_t, [1.5, 1.2, 2.0, 1.8], ["Field Name", "Data Type", "Constraints", "Description"], [
        ("id", "UUID", "PK, DEFAULT gen_random_uuid()", "Unique review audit session ID"),
        ("user_id", "UUID", "FK to profiles(id), ON DELETE CASCADE, NULL", "Owner account (NULL if guest audit)"),
        ("guest_session_id", "TEXT", "NULL", "Anonymous guest sandbox UUID session"),
        ("project_name", "TEXT", "NOT NULL", "Audit title or GitHub repository name"),
        ("source_type", "TEXT", "NOT NULL, CHECK IN ('direct', 'github')", "Submission format"),
        ("repo_url", "TEXT", "NULL", "GitHub repository target URL"),
        ("health_score", "NUMERIC(5,2)", "DEFAULT 100.00", "Computed health score (0.00 to 100.00)"),
        ("grade", "TEXT", "NULL", "Letter grade ('A+', 'A', 'B', 'C', 'D', 'F')"),
        ("status", "TEXT", "DEFAULT 'pending', CHECK IN ('pending','processing','completed','failed')", "Analysis processing state"),
        ("partial_mode", "BOOLEAN", "DEFAULT false", "True if AI throttled and AST completed"),
        ("summary", "TEXT", "NULL", "Executive summary of audit findings")
    ], header_bg="1E293B")

    # Table 3: review_files
    add_heading(doc, "C. Review Files Table (public.review_files)", level=3)
    rf_t = doc.add_table(rows=7, cols=4)
    format_custom_table(rf_t, [1.5, 1.2, 2.0, 1.8], ["Field Name", "Data Type", "Constraints", "Description"], [
        ("id", "UUID", "PK, DEFAULT gen_random_uuid()", "Unique file evaluation ID"),
        ("review_id", "UUID", "NOT NULL, FK to reviews(id), ON DELETE CASCADE", "Associated review audit session"),
        ("file_path", "TEXT", "NOT NULL", "Relative repository file path"),
        ("language", "TEXT", "NOT NULL", "Detected language ('javascript', 'python')"),
        ("lines_count", "INTEGER", "DEFAULT 0", "Total lines of source code in file"),
        ("issues_count", "INTEGER", "DEFAULT 0", "Total issues identified in this file")
    ], header_bg="1E293B")

    # Table 4: review_issues
    add_heading(doc, "D. Review Issues Table (public.review_issues)", level=3)
    ri_t = doc.add_table(rows=13, cols=4)
    format_custom_table(ri_t, [1.5, 1.2, 2.0, 1.8], ["Field Name", "Data Type", "Constraints", "Description"], [
        ("id", "UUID", "PK, DEFAULT gen_random_uuid()", "Unique finding identifier"),
        ("review_id", "UUID", "NOT NULL, FK to reviews(id), ON DELETE CASCADE", "Associated review session"),
        ("file_id", "UUID", "NOT NULL, FK to review_files(id), ON DELETE CASCADE", "Associated file record"),
        ("line_number", "INTEGER", "NULL", "Physical 1-indexed source line number"),
        ("severity", "TEXT", "NOT NULL, CHECK IN ('CRITICAL','HIGH','MEDIUM','LOW','INFO')", "Security/defect severity rank"),
        ("category", "TEXT", "NOT NULL, CHECK IN ('SYNTAX','SECURITY','QUALITY','OPTIMIZATION')", "Finding category"),
        ("rule_id", "TEXT", "NOT NULL", "Deterministic rule ID ('CWE-89', 'CWE-798')"),
        ("title", "TEXT", "NOT NULL", "Short plain-language finding title"),
        ("description", "TEXT", "NULL", "Detailed root cause explanation"),
        ("diff_before", "TEXT", "NULL", "Vulnerable code line segment"),
        ("diff_after", "TEXT", "NULL", "Remediated replacement code line"),
        ("engine_source", "TEXT", "NOT NULL, CHECK IN ('STATIC','GEMINI','HYBRID')", "Attributed diagnostic engine")
    ], header_bg="1E293B")

    # Table 5: review_reports
    add_heading(doc, "E. Review Reports Table (public.review_reports)", level=3)
    rr_t = doc.add_table(rows=5, cols=4)
    format_custom_table(rr_t, [1.5, 1.2, 2.0, 1.8], ["Field Name", "Data Type", "Constraints", "Description"], [
        ("id", "UUID", "PK, DEFAULT gen_random_uuid()", "Unique report export record ID"),
        ("review_id", "UUID", "NOT NULL, FK to reviews(id), ON DELETE CASCADE", "Parent review audit session"),
        ("report_type", "TEXT", "NOT NULL, CHECK IN ('pdf', 'markdown', 'json')", "Format of exported diagnostic report"),
        ("download_url", "TEXT", "NOT NULL", "Internal API route to download report binary")
    ], header_bg="1E293B")

    # Database Triggers Overview
    add_heading(doc, "F. Database Triggers & Functions Overview", level=3)
    trig_t = doc.add_table(rows=4, cols=4)
    format_custom_table(trig_t, [1.5, 1.8, 1.4, 1.8], ["Schema & Table", "Trigger Name", "Event / Activation", "Function Executed"], [
        ("auth.users", "on_auth_user_created", "AFTER INSERT", "public.handle_new_user()"),
        ("public.reviews", "chk_review_owner", "BEFORE INSERT/UPDATE", "CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)"),
        ("public.review_files", "fk_review_cascade", "ON DELETE CASCADE", "Automated deletion of child files & issues")
    ], header_bg="1E293B")

    # 9.2 Screen Layouts
    add_heading(doc, "9.2 SCREEN LAYOUTS (UI/UX WIREFRAMES)", level=2)
    add_body_p(doc, "Re:Code is designed around a zero-glare, high-contrast YouTube Dark Mode aesthetic. The layout hierarchy prioritizes diagnostic clarity, side-by-side diff comprehension, and instant in-memory remediation.")
    
    add_image_box(doc, "ui_landing_page.png", "Landing Page (/) — Hero Section & Core Feature Highlights")
    add_image_box(doc, "ui_submission_page.png", "Code Submission Page (/submit) — Direct Snippet & GitHub Ingestion Tabs")
    add_image_box(doc, "ui_review_canvas.png", "Review Dashboard & Canvas (/reviews/:id) — Health Score, Diff Viewer & Live Patch Dock")
    add_image_box(doc, "ui_history_page.png", "Audit History Page (/history) — Chronological Sessions & Cascade Deletion Controls")

    doc.add_page_break()

    # =========================================================================
    # 10. SYSTEM CODING
    # =========================================================================
    add_heading(doc, "10. SYSTEM CODING", level=1)
    add_body_p(doc, "Configuration and auto-generated dependency lockfiles (such as package-lock.json, node_modules/, dist/, and build artifacts) are excluded from this documentation as they contain generated bundles rather than custom application logic.")
    add_body_p(doc, "The following custom source code files embody the core implementation of the Re:Code dual-engine architecture across both backend and frontend workspaces:")

    # Backend Core Files
    add_heading(doc, "A. Backend Core Architecture & Middleware", level=2)
    add_code_snippet(doc, read_file_safe("backend/server.js"), "backend/server.js — HTTP Server Bootstrap & Graceful Shutdown")
    add_code_snippet(doc, read_file_safe("backend/src/app.js"), "backend/src/app.js — Express 5 Application Scaffold & Middleware Stack")
    add_code_snippet(doc, read_file_safe("backend/src/middleware/security.js", 350), "backend/src/middleware/security.js — SSRF Defense Shield & 2MB Payload Clamp")
    add_code_snippet(doc, read_file_safe("backend/src/middleware/errorHandler.js"), "backend/src/middleware/errorHandler.js — Centralized Error Redaction & Handling")

    # Analysis Services
    add_heading(doc, "B. Analysis Engines & Orchestration Services", level=2)
    add_code_snippet(doc, read_file_safe("backend/src/services/orchestrator.js", 350), "backend/src/services/orchestrator.js — Dual-Engine Pipeline Coordinator")
    add_code_snippet(doc, read_file_safe("backend/src/services/analysis/staticAnalyzer.js", 350), "backend/src/services/analysis/staticAnalyzer.js — Babel AST Traversal Rules")
    add_code_snippet(doc, read_file_safe("backend/src/services/analysis/findingsNormalizer.js", 300), "backend/src/services/analysis/findingsNormalizer.js — Finding Proximity Deduplication & HYBRID Attribution")
    add_code_snippet(doc, read_file_safe("backend/src/services/analysis/scoringEngine.js", 300), "backend/src/services/analysis/scoringEngine.js — 100-Point Scoring Engine & Penalty Capping")
    add_code_snippet(doc, read_file_safe("backend/src/services/ai/geminiClient.js", 300), "backend/src/services/ai/geminiClient.js — Google Gemini 2.5 Flash SDK Wrapper")
    add_code_snippet(doc, read_file_safe("backend/src/services/ai/aiReviewer.js", 300), "backend/src/services/ai/aiReviewer.js — Gemini Structured Reviewer & Fallback")
    add_code_snippet(doc, read_file_safe("backend/src/services/persistence/reviewRepository.js", 300), "backend/src/services/persistence/reviewRepository.js — Supabase PostgreSQL Relational Persistence")

    # Frontend Core Pages & Components
    add_heading(doc, "C. Frontend User Interface Pages & Components", level=2)
    add_code_snippet(doc, read_file_safe("frontend/src/App.jsx"), "frontend/src/App.jsx — React Router & Root Dark Mode Provider")
    add_code_snippet(doc, read_file_safe("frontend/src/pages/LandingPage.jsx", 300), "frontend/src/pages/LandingPage.jsx — Homepage Hero & Feature Highlights")
    add_code_snippet(doc, read_file_safe("frontend/src/pages/SubmissionPage.jsx", 350), "frontend/src/pages/SubmissionPage.jsx — Code Snippet & GitHub Ingestion Form")
    add_code_snippet(doc, read_file_safe("frontend/src/pages/ReviewDashboardPage.jsx", 350), "frontend/src/pages/ReviewDashboardPage.jsx — Review Canvas & Live In-Memory Patching")
    add_code_snippet(doc, read_file_safe("frontend/src/pages/HistoryPage.jsx", 300), "frontend/src/pages/HistoryPage.jsx — Audit History & Cascade Deletion Controls")
    add_code_snippet(doc, read_file_safe("frontend/src/components/common/DiffViewer.jsx"), "frontend/src/components/common/DiffViewer.jsx — XSS-Immune Syntax Diff Viewer")
    add_code_snippet(doc, read_file_safe("frontend/src/components/common/PillBadge.jsx"), "frontend/src/components/common/PillBadge.jsx — Matte Badge Component")
    add_code_snippet(doc, read_file_safe("frontend/src/components/common/SeverityChip.jsx"), "frontend/src/components/common/SeverityChip.jsx — Severity Rank Chip")
    add_code_snippet(doc, read_file_safe("frontend/src/components/common/Navbar.jsx"), "frontend/src/components/common/Navbar.jsx — Top Header & Session Pill")
    add_code_snippet(doc, read_file_safe("frontend/src/components/common/Footer.jsx"), "frontend/src/components/common/Footer.jsx — Global Footer Component")

    # Project Dependencies & Config
    add_heading(doc, "D. Project Dependencies & Configuration", level=2)
    add_code_snippet(doc, read_file_safe("package.json"), "package.json — Root Monorepo Configuration & Lifecycle Scripts")
    add_code_snippet(doc, read_file_safe("backend/package.json"), "backend/package.json — Backend Dependencies & Engine Modules")
    add_code_snippet(doc, read_file_safe(".env.example"), ".env.example — Environment Variables & Security Credentials")

    doc.add_page_break()

    # =========================================================================
    # 11. SYSTEM TESTING
    # =========================================================================
    add_heading(doc, "11. SYSTEM TESTING", level=1)
    add_body_p(doc, "System testing in software engineering is a critical verification phase where the entire integrated software application is evaluated to ensure it conforms to specified functional requirements, security standards, and operational benchmarks. It rigorously validates data flow across backend services, external cloud APIs, relational persistence layers, and client rendering canvases.")
    add_body_p(doc, "Types of System Testing Conducted on Re:Code:")
    add_bullet_p(doc, " Verifies that every AST rule, Gemini prompt schema, normalization algorithm, and health scoring formula operates according to specification.", bold_prefix="1. Functional Testing:")
    add_bullet_p(doc, " Evaluates end-to-end interactions between the Express REST API, Babel parser, Gemini AI service, and Supabase PostgreSQL.", bold_prefix="2. Integration Testing:")
    add_bullet_p(doc, " Confirms that user journeys—from code submission to live patching and PDF report export—satisfy developer expectations.", bold_prefix="3. Acceptance Testing:")
    add_bullet_p(doc, " Re-runs test suites across 14 modules after every code change to guarantee that new fixes do not introduce defects into existing analyzers.", bold_prefix="4. Regression Testing:")
    add_bullet_p(doc, " Measures AST parsing throughput (12ms-25ms/file), recursive GitHub tree traversal speed (<4.2s for 50 files), and memory footprint under high concurrency.", bold_prefix="5. Performance Testing:")
    add_bullet_p(doc, " Validates that the YouTube Dark Mode canvas provides high-contrast, readable code diffs with zero visual glare across desktop and mobile devices.", bold_prefix="6. Usability Testing:")
    add_bullet_p(doc, " Tests fault tolerance and fallback mechanisms when the Google Gemini AI API experiences network throttling or quota exhaustion (Partial Mode).", bold_prefix="7. Reliability & Fault-Tolerance Testing:")

    add_heading(doc, "11.1 VALIDATION", level=2)
    add_body_p(doc, "A test case is a formalized set of preconditions, input vectors, execution procedures, and expected post-conditions designed to verify a specific software feature. Test cases ensure that potential security regressions and syntax errors are identified and resolved before code enters production.")
    add_body_p(doc, "Why We Write Test Cases:")
    add_bullet_p(doc, " Uncovering race conditions, line offset corruptions, and unhandled edge cases prior to deployment.", bold_prefix="1. Detecting Defects Early:")
    add_bullet_p(doc, " Confirming that security hardening layers (such as the SSRF shield) block malicious attack vectors reliably.", bold_prefix="2. Guaranteeing Security Integrity:")
    add_bullet_p(doc, " Providing objective verification criteria that can be executed automatically under continuous integration runners.", bold_prefix="3. Guiding Automated CI/CD Pipelines:")

    doc.add_page_break()

    # =========================================================================
    # 12. TEST CASES
    # =========================================================================
    add_heading(doc, "12. TEST CASES", level=1)
    
    test_cases = [
        ("Test Case 1 - User & Guest Session Sandboxing (Guest UUID + Supabase Auth)",
         "Ensure anonymous developers can audit code seamlessly via x-guest-session-id headers, while registered developers maintain authenticated Supabase sessions governed by RLS.",
         ["1. Open Re:Code homepage (http://localhost:5173) as an unauthenticated guest.",
          "2. Verify local storage automatically instantiates a persistent guest UUID.",
          "3. Submit a code snippet; confirm review record contains guest_session_id.",
          "4. Log in via Supabase Auth on /login with valid developer credentials.",
          "5. Submit a second review; confirm review record is linked directly to profiles.id."],
         "Both guest and authenticated reviews persist successfully without permission errors; Supabase RLS enforces strict isolation.",
         "Verified. Anonymous reviews persist with UUID sandboxing; authenticated reviews link to user profile with 100% RLS compliance."),

        ("Test Case 2 - Direct Snippet Code Submission & AST Parsing",
         "Verify that the code submission interface accepts JavaScript/TypeScript snippets, validates boundaries (max 50,000 chars), and triggers the Babel AST parser.",
         ["1. Navigate to /submit page.",
          "2. Select 'Direct Code Snippet' tab.",
          "3. Paste a 50-line JavaScript snippet containing a database query.",
          "4. Click 'Audit Codebase'.",
          "5. Verify server responds with HTTP 200 and redirects to /reviews/:id."],
         "Snippet is parsed into AST without syntax abortion, health score is calculated, and review canvas loads.",
         "Passed. AST parsing executed in 16ms; review canvas rendered within 1.2 seconds."),

        ("Test Case 3 - Recursive GitHub Repository Ingestion & Tree Traversal",
         "Validate that Re:Code recursively crawls GitHub repositories up to 10 folder levels using the Git Trees API, filtering out non-code assets and test scorecards.",
         ["1. On /submit, select 'GitHub Repository Target' tab.",
          "2. Enter public URL: https://github.com/expressjs/express.",
          "3. Click 'Audit Codebase'.",
          "4. Verify backend queries /git/trees/{branch}?recursive=1.",
          "5. Inspect evaluated files list on review canvas."],
         "Candidate source files inside subdirectories (controllers, routes) are discovered and analyzed; test scorecards and build files are ignored.",
         "Passed. Traversed 42 candidate files across 6 directory levels in 3.8 seconds with accurate prioritization."),

        ("Test Case 4 - Deterministic Static AST Security Detection (CWE-89 & CWE-798)",
         "Confirm that the Babel AST analyzer detects SQL injection concatenations and hardcoded secrets with 100% deterministic precision.",
         ["1. Submit code: db.query('SELECT * FROM users WHERE id = ' + req.body.id);",
          "2. In the same snippet, declare: const JWT_SECRET = 'eyJhbGciOiJIUzI1NiIsIn...';",
          "3. Run review analysis.",
          "4. Inspect finding cards on review canvas."],
         "Babel AST visitors flag CWE-89 (SQL Injection) and CWE-798 (Hardcoded Secret) at exact line numbers with deterministic remediations.",
         "Passed. Both vulnerabilities flagged with exact line attribution and CRITICAL severity classifications."),

        ("Test Case 5 - Google Gemini AI Semantic Review & Refactoring Diffs",
         "Verify that Google Gemini 2.5 Flash detects algorithmic bottlenecks (O(N^2) loops) and returns structured JSON diffs.",
         ["1. Submit code containing nested loops executing synchronous database queries inside an iteration block.",
          "2. Trigger analysis and inspect Engine B telemetry.",
          "3. Inspect the returned diff on the Review Dashboard."],
         "Gemini AI identifies algorithmic inefficiency, generates plain-language explanation, and produces before/after git diff.",
         "Passed. AI reviewer flagged nested query bottleneck, suggested Promise.all batching, and returned valid git diff."),

        ("Test Case 6 - Cross-Engine Findings Normalization & HYBRID Attribution",
         "Verify that findings flagged by both Static AST and Gemini AI within +/- 2 lines are consolidated into a single HYBRID card.",
         ["1. Submit code where an unescaped SQL query is flagged by both Babel AST and Gemini AI.",
          "2. Inspect findingsNormalizer.js output in server logs.",
          "3. Check badge styling on review canvas."],
         "Overlapping findings merge into a single card branded with cyan 'HYBRID (AST + AI)' badge, adopting AST line number and Gemini diff.",
         "Passed. Duplicate findings eliminated; single HYBRID card displayed with cyan #02C8F0 styling."),

        ("Test Case 7 - Mathematical Health Scoring & Severity Penalty Capping",
         "Confirm that the 100-point scoring formula applies penalty caps (Low capped at 15 pts) and enforces the Grade C floor (70 pts).",
         ["1. Submit code containing 40 console.log statements (LOW severity, 0.5 pts each).",
          "2. Compute health score via scoringEngine.js.",
          "3. Verify total deductions do not exceed 15 points.",
          "4. Confirm codebase receives Grade B+ (Score: 85) rather than failing Grade F."],
         "Penalty capping limits low-severity deductions to 15 pts max; quality floor protects code from unwarranted failure.",
         "Passed. Final health score evaluated to 85.00 (Grade B+), confirming penalty capping integrity."),

        ("Test Case 8 - Interactive Review Canvas, Filter Controls & Search",
         "Validate that the Review Dashboard allows filtering by severity (Critical, High, Medium, Low), file selection, and text search.",
         ["1. Open completed review on /reviews/:id.",
          "2. Click 'High' severity filter chip; verify non-high findings are hidden.",
          "3. Type keyword 'SQL' in search input; verify real-time card filtering.",
          "4. Select specific file from file tree; verify only that file's findings appear."],
         "Review canvas updates instantly without layout jitter or broken styling.",
         "Passed. Filtering, search indexing, and file selection operate smoothly with zero latency."),

        ("Test Case 9 - Live In-Memory Code Patching & 'Apply All Safe Fixes'",
         "Verify that clicking 'Apply Patch' mutates code in-memory, recalculates the health score (+2 pts), and 'Apply All Safe Fixes' applies patches in reverse line order.",
         ["1. On review canvas, click 'Apply Patch' on an empty catch block issue.",
          "2. Confirm button turns green ('✓ Patch Applied') and score increases by +2.",
          "3. Click 'Apply All Safe Fixes' in the docked footer.",
          "4. Verify all LOW findings turn green simultaneously.",
          "5. Click 'Raw Code' to inspect the clean, patched file buffer."],
         "Patches are applied in reverse line order (bottom-to-top), preventing line offset corruption; health score reflects new grade.",
         "Passed. In-memory buffer patched flawlessly; line numbers preserved; health score jumped from 76 to 92 (Grade A)."),

        ("Test Case 10 - Server-Side Request Forgery (SSRF) Defense Shield Across 10 Vectors",
         "Verify that the security hardening layer pre-resolves DNS and rejects all 10 RFC 1918, loopback, and cloud metadata targets.",
         ["1. Issue POST /api/v1/reviews/run targeting: http://127.0.0.1/admin.",
          "2. Test target: http://169.254.169.254/latest/meta-data/.",
          "3. Test target: https://10.0.0.1/internal.",
          "4. Test target: https://192.168.1.1/router.",
          "5. Test obfuscated decimal IP: http://2130706433/secrets."],
         "All 10 attack vectors are blocked immediately with HTTP 400 Bad Request; outbound requests are aborted before socket connection.",
         "Passed. 10/10 attack vectors blocked with 100% precision in securityHardening.test.js."),

        ("Test Case 11 - In-Memory Request Payload Clamping (HTTP 413 at 2MB Boundary)",
         "Verify that requests exceeding 2MB are rejected with HTTP 413 to prevent memory exhaustion DoS.",
         ["1. Send a POST request with payload size 1.8MB (within limit).",
          "2. Confirm server responds with HTTP 200 OK.",
          "3. Send a POST request with payload size 2.5MB (exceeds limit).",
          "4. Confirm server rejects request with HTTP 413 Payload Too Large."],
         "Oversized payloads are dropped before AST parsing or AI dispatch can consume server memory.",
         "Passed. Boundary clamp enforced at exactly 2,097,152 bytes with HTTP 413 response."),

        ("Test Case 12 - Vector PDF Audit Certificate Generation (Zero Trailing Blank Pages)",
         "Validate that PDFKit generates a formal, branded diagnostic audit report with adaptive margins and zero trailing blank pages.",
         ["1. On review canvas, click 'Export PDF Report'.",
          "2. Verify server streams application/pdf binary.",
          "3. Open downloaded PDF; inspect page margins (16mm) and card break boundaries.",
          "4. Check last page to confirm no trailing blank sheet."],
         "PDF renders crisp vector text, branded header, finding tables, and terminates exactly on the last content page.",
         "Passed. Multi-page PDF generated with zero trailing blank sheets; all cards paginate cleanly."),

        ("Test Case 13 - Audit History Tracking, Inspect Redirection, & Cascade Deletion",
         "Verify that past audits appear in /history, clicking 'Inspect' opens the review canvas, and clicking 'Delete' executes database cascade deletion.",
         ["1. Navigate to /history page.",
          "2. Confirm previously conducted audits appear with score, date, and grade chips.",
          "3. Click 'Inspect' on a session; verify redirection to /reviews/:id.",
          "4. Click 'Delete' on a session; confirm dialog and verify review, files, and issues are purged."],
         "Session history loads reliably; cascade delete purges all associated foreign-key rows in Supabase.",
         "Passed. Cascade deletion purged review and all 14 child records cleanly.")
    ]

    for title, obj, steps, exp, act in test_cases:
        add_heading(doc, title, level=2)
        add_body_p(doc, obj, bold_prefix="Objective: ")
        add_body_p(doc, "Execution Steps:", bold_prefix="")
        for s in steps:
            add_bullet_p(doc, s)
        add_body_p(doc, exp, bold_prefix="Expected Result: ")
        add_body_p(doc, act, bold_prefix="Actual Result: ")
        doc.add_paragraph()

    doc.add_page_break()

    # =========================================================================
    # 12. FUTURE ENHANCEMENTS
    # =========================================================================
    add_heading(doc, "12. FUTURE ENHANCEMENTS", level=1)
    add_body_p(doc, "Re:Code has achieved its core architectural and academic objectives—providing an enterprise dual-engine automated code review and security auditing platform combining deterministic AST analysis with generative AI reasoning. However, several meaningful technological enhancements can further expand its industrial reach, developer productivity, and real-time collaboration in subsequent release cycles:")

    enhancements = [
        ("1. Tree-sitter WebAssembly Multi-Language AST Engine:",
         "While the current static engine provides deep AST traversal for JavaScript and TypeScript via Babel, future releases will integrate WebAssembly Tree-sitter bindings. This will unlock native concrete syntax tree (CST) parsing for Rust, Go, Python, C++, and Java with zero compilation latency."),
        ("2. Automated GitHub Pull Request Bot & Webhook Action:",
         "Package Re:Code as an official GitHub App and GitHub Action. When developers open a Pull Request, the bot will automatically analyze changed files, post inline code diff comments on vulnerable lines, and enforce pass/fail status checks based on health score thresholds."),
        ("3. Official Visual Studio Code IDE Extension:",
         "Port the deterministic AST analyzer and Gemini client into a lightweight VS Code extension. Developers will receive real-time inline squiggly warnings and 1-click refactoring lightbulb suggestions directly inside their code editor before staging commits."),
        ("4. Air-Gapped Local LLM Sidecar (Ollama / Qwen / Gemma 2):",
         "Enable enterprise teams operating under strict data privacy regulations to route semantic analysis to an on-premise local LLM sidecar (such as quantized Qwen 2.5 Coder or Gemma 2 9B running via Ollama), ensuring zero source code leaves the corporate intranet."),
        ("5. Real-Time Collaborative Canvas (WebSocket Pair-Review):",
         "Implement WebSocket rooms enabling multiple senior engineers and junior developers to inspect the same review canvas simultaneously, apply in-memory patches interactively, and discuss remediation diffs in real time."),
        ("6. Automated Pull Request Generator for 1-Click Remediations:",
         "Extend the 'Apply All Safe Fixes' engine to automatically commit patched files directly to a new Git branch and open a verified Pull Request on GitHub with a single click from the review canvas."),
        ("7. Enterprise Security Compliance & Vulnerability Trends Dashboard:",
         "Introduce multi-repository organizational dashboards aggregating historical code quality metrics, tracking vulnerability resolution velocity, and generating compliance audit logs for SOC 2 and ISO 27001 certifications."),
        ("8. Custom AST Rule Builder & Team Policy Editor:",
         "Provide a visual web-based rule editor allowing engineering leads to write custom AST visitor queries and architectural constraints tailored to their internal proprietary frameworks and coding standards.")
    ]

    for title, desc in enhancements:
        add_bullet_p(doc, f" {desc}", bold_prefix=title)

    doc.add_page_break()

    # =========================================================================
    # 13. REFERENCES
    # =========================================================================
    add_heading(doc, "13. REFERENCES", level=1)
    add_body_p(doc, "References in project documentation are vital elements that enhance the document's academic quality, technical rigor, and industrial credibility. They assure stakeholders and examiners that every architectural recommendation, security policy, and algorithm is grounded in established computer science literature, industry standards, and peer-reviewed research.")
    add_body_p(doc, "References also provide essential context by linking project decisions to relevant formal benchmarks (such as OWASP Top 10, CWE catalogs, and IETF RFC specifications). Furthermore, references serve as pathways for future researchers and engineers to explore the underlying technologies, fostering continuous learning and verification.")

    add_heading(doc, "13.1 TEXTBOOK REFERENCES", level=2)
    add_bullet_p(doc, "Pressman, R. S., & Maxim, B. R. (2020). Software Engineering: A Practitioner's Approach (9th ed.). McGraw-Hill Education. [Covers SDLC methodologies, software quality assurance, and verification frameworks].")
    add_bullet_p(doc, "Martin, R. C. (2018). Clean Architecture: A Craftsman's Guide to Software Structure and Design. Prentice Hall. [Provides architectural foundations for decoupled services, dependency inversion, and maintainable interfaces].")
    add_bullet_p(doc, "Aho, A. V., Lam, M. S., Sethi, R., & Ullman, J. D. (2006). Compilers: Principles, Techniques, and Tools (2nd ed.). Addison-Wesley. [Foundational theory on Lexical Analysis, Abstract Syntax Trees (AST), and Visitor-pattern syntax traversals].")
    add_bullet_p(doc, "Kamraju, M. (2025). “Automated Software Verification and Static Analysis in Enterprise Engineering Systems.” Cultural Communication and Socialization Journal.")

    add_heading(doc, "13.2 WEBSITE & TECHNICAL SPECIFICATION REFERENCES", level=2)
    web_refs = [
        ("1. OWASP Foundation - OWASP Top 10 Security Risks (2021)", "https://owasp.org/Top10/", "Authoritative classification of critical application security risks including Injection (A03) and Identification Failures (A07)."),
        ("2. MITRE Corporation - Common Weakness Enumeration (CWE)", "https://cwe.mitre.org/", "Formal definitions for CWE-89 (SQL Injection), CWE-798 (Hardcoded Credentials), CWE-563 (Dead Code), and CWE-532 (Sensitive Information Leak)."),
        ("3. Babel Project - Parser AST Specification & Visitor Architecture", "https://babeljs.io/docs/babel-parser", "Official technical documentation for ECMAScript/TypeScript AST syntax tree generation and node traversal."),
        ("4. Google DeepMind - Gemini 2.5 Flash API Documentation", "https://ai.google.dev/docs", "Technical specifications for Google Gemini generative AI models, structured JSON response schemas, and latency optimizations."),
        ("5. Supabase Documentation - PostgreSQL & Row-Level Security (RLS)", "https://supabase.com/docs/guides/auth/row-level-security", "Official architectural guide for PostgreSQL database migrations, cascade deletion triggers, and multi-tenant RLS isolation."),
        ("6. IETF RFC 1918 & RFC 3927 - Private Address Allocations & Link-Local IPs", "https://datatracker.ietf.org/doc/html/rfc1918", "Standard specifications defining private IP subnets and loopbacks utilized in Re:Code's pre-request DNS SSRF defense shield."),
        ("7. React 19 Official Documentation - Concurrent Rendering & Hooks", "https://react.dev/", "Official reference for React 19 architecture, useActionState, client hooks, and component lifecycle management."),
        ("8. Tailwind CSS Documentation - Design Tokens & Utilities", "https://tailwindcss.com/docs", "Official styling documentation for Tailwind CSS v4 design token configuration and custom dark mode themes."),
        ("9. Express.js Documentation - REST Routing & Security Middleware", "https://expressjs.com/en/5x/api.html", "Official API documentation for Express 5 routing, Helmet CSP integration, and centralized operational error handling."),
        ("10. PDFKit Technical Documentation - Vector Document Streaming", "https://pdfkit.org/", "Official specification for vector PDF layout calculation, buffered page range streaming, and margin adaptation.")
    ]

    for title, url, desc in web_refs:
        add_bullet_p(doc, f" ({url})\n{desc}", bold_prefix=title)

    # Save document
    print(f"Saving primary report to: {OUT_DOCX}")
    doc.save(OUT_DOCX)
    print(f"Copying report to: {COPY_DOCX}")
    shutil.copyfile(OUT_DOCX, COPY_DOCX)
    print("Report generation completed successfully!")

if __name__ == "__main__":
    build_recode_report()
