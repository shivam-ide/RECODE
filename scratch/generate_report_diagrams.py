import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

OUT_DIR = "scratch/report_diagrams"
os.makedirs(OUT_DIR, exist_ok=True)

def setup_fig(w=8, h=6, dpi=200):
    fig, ax = plt.subplots(figsize=(w, h), dpi=dpi)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')
    return fig, ax

def save_fig(fig, filename):
    path = os.path.join(OUT_DIR, filename)
    fig.tight_layout()
    fig.savefig(path, bbox_inches='tight', dpi=200, facecolor='white')
    plt.close(fig)
    print(f"Saved: {path}")

# ==============================================================================
# 1. GANTT CHARTS
# ==============================================================================
def gen_gantt_1():
    fig, ax = setup_fig(8, 4)
    tasks = [
        ("Project Ideation & Requirements", 1, 4),
        ("Software & Hardware Feasibility", 4, 8),
        ("Preliminary Investigation", 7, 12),
        ("Security & Vulnerability Modeling", 10, 16),
        ("Literature & Standards Review (OWASP)", 14, 20),
    ]
    ax.text(50, 93, "Requirements Analysis & Preliminary Investigation Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    ax.axhline(85, color='#ccc', lw=1)
    
    # Days header
    for d in range(1, 21):
        x = 25 + (d - 1) * 3.6
        ax.text(x + 1.8, 87, str(d), ha='center', fontsize=7, color='#666')
        ax.axvline(x, ymin=0.1, ymax=0.88, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 75
    for task, start, end in tasks:
        ax.text(22, y + 2, task, ha='right', va='center', fontsize=8.5, fontweight='medium')
        x_start = 25 + (start - 1) * 3.6
        width = (end - start + 1) * 3.6
        rect = patches.FancyBboxPatch((x_start, y), width, 5, boxstyle="round,pad=0.2", facecolor='#0288D1', edgecolor='#01579B', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.5, f"{end - start + 1}d", ha='center', va='center', fontsize=7.5, color='white', fontweight='bold')
        y -= 13
    save_fig(fig, "gantt_chart_1.png")

def gen_gantt_2():
    fig, ax = setup_fig(8, 4.5)
    tasks = [
        ("SDLC Model Selection", 1, 3),
        ("Entity-Relationship (ER) Modeling", 3, 7),
        ("Class Diagram Architecture", 7, 10),
        ("Object & State Diagrams", 9, 12),
        ("Activity & Workflow Modeling", 11, 15),
        ("Sequence & Interaction Modeling", 14, 18),
        ("Use Case Specifications", 17, 21),
    ]
    ax.text(50, 94, "System Analysis Phase Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    for d in range(1, 22):
        x = 26 + (d - 1) * 3.4
        ax.text(x + 1.7, 88, str(d), ha='center', fontsize=7, color='#666')
        ax.axvline(x, ymin=0.08, ymax=0.88, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 78
    for task, start, end in tasks:
        ax.text(24, y + 2, task, ha='right', va='center', fontsize=8, fontweight='medium')
        x_start = 26 + (start - 1) * 3.4
        width = (end - start + 1) * 3.4
        rect = patches.FancyBboxPatch((x_start, y), width, 4.5, boxstyle="round,pad=0.2", facecolor='#2E7D32', edgecolor='#1B5E20', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.2, f"{end - start + 1}d", ha='center', va='center', fontsize=7, color='white', fontweight='bold')
        y -= 10.5
    save_fig(fig, "gantt_chart_2.png")

def gen_gantt_3():
    fig, ax = setup_fig(8, 3.5)
    tasks = [
        ("Component Diagram Architecture", 1, 5),
        ("Deployment & Topology Design", 4, 8),
        ("Database Relational Schema Design", 7, 12),
        ("API RESTful Contracts Design", 10, 14),
    ]
    ax.text(50, 93, "System Design Phase Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    for d in range(1, 16):
        x = 28 + (d - 1) * 4.6
        ax.text(x + 2.3, 86, str(d), ha='center', fontsize=7.5, color='#666')
        ax.axvline(x, ymin=0.1, ymax=0.87, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 74
    for task, start, end in tasks:
        ax.text(26, y + 2.2, task, ha='right', va='center', fontsize=8.5, fontweight='medium')
        x_start = 28 + (start - 1) * 4.6
        width = (end - start + 1) * 4.6
        rect = patches.FancyBboxPatch((x_start, y), width, 5, boxstyle="round,pad=0.2", facecolor='#E65100', edgecolor='#BF360C', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.5, f"{end - start + 1}d", ha='center', va='center', fontsize=7.5, color='white', fontweight='bold')
        y -= 14
    save_fig(fig, "gantt_chart_3.png")

def gen_gantt_4():
    fig, ax = setup_fig(8, 3.8)
    tasks = [
        ("UI/UX Wireframing & Design System", 1, 7),
        ("Review Canvas & Diff Component Mockups", 6, 13),
        ("History & Settings Interface Layouts", 12, 17),
        ("Mobile & Responsive Viewport Adaptations", 15, 20),
    ]
    ax.text(50, 93, "Design Phase (UI/UX & Wireframes) Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    for d in range(1, 21):
        x = 26 + (d - 1) * 3.5
        ax.text(x + 1.7, 86, str(d), ha='center', fontsize=7, color='#666')
        ax.axvline(x, ymin=0.1, ymax=0.87, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 74
    for task, start, end in tasks:
        ax.text(24, y + 2.2, task, ha='right', va='center', fontsize=8.5, fontweight='medium')
        x_start = 26 + (start - 1) * 3.5
        width = (end - start + 1) * 3.5
        rect = patches.FancyBboxPatch((x_start, y), width, 5, boxstyle="round,pad=0.2", facecolor='#6A1B9A', edgecolor='#4A148C', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.5, f"{end - start + 1}d", ha='center', va='center', fontsize=7.5, color='white', fontweight='bold')
        y -= 14
    save_fig(fig, "gantt_chart_4.png")

def gen_gantt_5():
    fig, ax = setup_fig(8, 4.5)
    tasks = [
        ("Backend Scaffold & Supabase Schema", 1, 6),
        ("Static AST Traversal Engine (Babel)", 5, 12),
        ("Google Gemini 2.5 AI Service Integration", 10, 16),
        ("Normalizer & Scoring Math Engine", 15, 20),
        ("Security Hardening & SSRF Defense Shield", 18, 24),
        ("Frontend Canvas, DiffViewer & Live Patching", 21, 28),
        ("PDFKit Vector Audit Generation & README Export", 26, 31),
    ]
    ax.text(50, 94, "System Coding & Implementation Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    for d in range(1, 32):
        x = 25 + (d - 1) * 2.35
        if d % 2 == 1:
            ax.text(x + 1.1, 88, str(d), ha='center', fontsize=6.5, color='#666')
        ax.axvline(x, ymin=0.08, ymax=0.88, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 78
    for task, start, end in tasks:
        ax.text(23, y + 2, task, ha='right', va='center', fontsize=8, fontweight='medium')
        x_start = 25 + (start - 1) * 2.35
        width = (end - start + 1) * 2.35
        rect = patches.FancyBboxPatch((x_start, y), width, 4.5, boxstyle="round,pad=0.2", facecolor='#00838F', edgecolor='#006064', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.2, f"{end - start + 1}d", ha='center', va='center', fontsize=6.5, color='white', fontweight='bold')
        y -= 10.5
    save_fig(fig, "gantt_chart_5.png")

def gen_gantt_6_7():
    fig, ax = setup_fig(8, 3.5)
    tasks = [
        ("Unit & Integration Testing (Jest 187 tests)", 1, 6),
        ("Security Regression & SSRF 10-Target Vector", 5, 9),
        ("End-to-End Analysis Pipeline Verification", 8, 12),
        ("Production Deployment (Vercel + Supabase)", 12, 14),
    ]
    ax.text(50, 93, "System Testing & Final Deployment Gantt Chart", ha='center', fontsize=12, fontweight='bold')
    for d in range(1, 15):
        x = 28 + (d - 1) * 4.9
        ax.text(x + 2.4, 86, str(d), ha='center', fontsize=7.5, color='#666')
        ax.axvline(x, ymin=0.1, ymax=0.87, color='#f0f0f0', lw=0.8, linestyle='--')
    
    y = 73
    for task, start, end in tasks:
        ax.text(26, y + 2.2, task, ha='right', va='center', fontsize=8.5, fontweight='medium')
        x_start = 28 + (start - 1) * 4.9
        width = (end - start + 1) * 4.9
        color = '#C2185B' if "Testing" in task or "Regression" in task or "Verification" in task else '#2E7D32'
        rect = patches.FancyBboxPatch((x_start, y), width, 5, boxstyle="round,pad=0.2", facecolor=color, edgecolor='#333', lw=1)
        ax.add_patch(rect)
        ax.text(x_start + width/2, y + 2.5, f"{end - start + 1}d", ha='center', va='center', fontsize=7.5, color='white', fontweight='bold')
        y -= 14
    save_fig(fig, "gantt_chart_6.png")

# ==============================================================================
# 2. SDLC ITERATIVE MODEL
# ==============================================================================
def gen_sdlc():
    fig, ax = setup_fig(8, 7)
    ax.text(50, 96, "Software Development Life Cycle — Iterative Model for Re:Code", ha='center', fontsize=12, fontweight='bold')
    
    # Requirements & Analysis Boxes
    req_box = patches.FancyBboxPatch((40, 85), 20, 6, boxstyle="round,pad=0.2", facecolor='#E3F2FD', edgecolor='#1565C0', lw=1.5)
    ax.add_patch(req_box)
    ax.text(50, 88, "Requirements Gathering", ha='center', va='center', fontsize=8.5, fontweight='bold')
    
    ax.annotate("", xy=(50, 78), xytext=(50, 85), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333'))
    
    ana_box = patches.FancyBboxPatch((40, 72), 20, 6, boxstyle="round,pad=0.2", facecolor='#E8F5E9', edgecolor='#2E7D32', lw=1.5)
    ax.add_patch(ana_box)
    ax.text(50, 75, "System Analysis", ha='center', va='center', fontsize=8.5, fontweight='bold')
    
    ax.annotate("", xy=(50, 65), xytext=(50, 72), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333'))
    
    # Iteration Containers
    iter_names = [
        ("Iteration 1: Core Engine", 10, "AST Parser & Express REST"),
        ("Iteration 2: AI & Hardening", 40, "Gemini AI & SSRF Shield"),
        ("Iteration 3: Canvas & PDF", 70, "Review UI & PDFKit Reports")
    ]
    
    for title, x, sub in iter_names:
        cont = patches.FancyBboxPatch((x, 26), 22, 38, boxstyle="round,pad=0.5", facecolor='#FAFAFA', edgecolor='#02C8F0', lw=1.5, linestyle='--')
        ax.add_patch(cont)
        ax.text(x + 11, 61, title, ha='center', va='center', fontsize=8, fontweight='bold', color='#0277BD')
        ax.text(x + 11, 58, f"({sub})", ha='center', va='center', fontsize=6.5, color='#666')
        
        steps = ["Design", "Development", "Testing", "Review"]
        sy = 51
        for s in steps:
            sb = patches.FancyBboxPatch((x + 2, sy), 18, 5, boxstyle="round,pad=0.2", facecolor='#FFFFFF', edgecolor='#455A64', lw=1)
            ax.add_patch(sb)
            ax.text(x + 11, sy + 2.5, s, ha='center', va='center', fontsize=7.5)
            if s != "Review":
                ax.annotate("", xy=(x + 11, sy - 2), xytext=(x + 11, sy), arrowprops=dict(arrowstyle="->", lw=1, color='#666'))
            sy -= 7
            
    # Connect iterations
    ax.annotate("", xy=(39, 44), xytext=(32, 44), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0288D1'))
    ax.annotate("", xy=(69, 44), xytext=(62, 44), arrowprops=dict(arrowstyle="->", lw=1.5, color='#0288D1'))
    
    # Deployment & Maintenance
    ax.annotate("", xy=(50, 18), xytext=(50, 26), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333'))
    dep_box = patches.FancyBboxPatch((40, 12), 20, 6, boxstyle="round,pad=0.2", facecolor='#FFF3E0', edgecolor='#E65100', lw=1.5)
    ax.add_patch(dep_box)
    ax.text(50, 15, "Production Deployment", ha='center', va='center', fontsize=8.5, fontweight='bold')
    
    ax.annotate("", xy=(50, 5), xytext=(50, 12), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333'))
    maint_box = patches.FancyBboxPatch((40, 0.5), 20, 5, boxstyle="round,pad=0.2", facecolor='#F3E5F5', edgecolor='#7B1FA2', lw=1.5)
    ax.add_patch(maint_box)
    ax.text(50, 3, "Maintenance & Upgrades", ha='center', va='center', fontsize=8, fontweight='bold')

    save_fig(fig, "sdlc_iterative_model.png")

# ==============================================================================
# 3. ER DIAGRAM SYMBOLS & RECODE ER DIAGRAM
# ==============================================================================
def gen_er_symbols():
    fig, ax = setup_fig(7, 5)
    ax.text(50, 94, "Entity Relationship (ER) Diagram Standard Symbols", ha='center', fontsize=11, fontweight='bold')
    
    symbols = [
        ("Entity", "Rectangle representing real-world object/table", lambda x, y: patches.Rectangle((x-10, y-3), 20, 6, facecolor='#E3F2FD', edgecolor='#1565C0', lw=1.5)),
        ("Weak Entity", "Double rectangle dependent on strong entity", lambda x, y: (patches.Rectangle((x-10, y-3), 20, 6, facecolor='none', edgecolor='#1565C0', lw=1), patches.Rectangle((x-9, y-2.3), 18, 4.6, facecolor='#E3F2FD', edgecolor='#1565C0', lw=1.5))),
        ("Attribute", "Oval representing properties of entity", lambda x, y: patches.Ellipse((x, y), 18, 6, facecolor='#FFF9C4', edgecolor='#F57F17', lw=1.5)),
        ("Key Attribute", "Underlined oval for Primary Key", lambda x, y: patches.Ellipse((x, y), 18, 6, facecolor='#FFF9C4', edgecolor='#F57F17', lw=1.5)),
        ("Relationship", "Diamond indicating association between entities", lambda x, y: patches.Polygon([[x, y+4], [x+8, y], [x, y-4], [x-8, y]], facecolor='#E8F5E9', edgecolor='#2E7D32', lw=1.5)),
        ("Cardinality Link", "Connector line showing (1:1, 1:N, M:N)", lambda x, y: ax.plot([x-8, x+8], [y, y], color='#333', lw=1.5))
    ]
    
    y = 80
    for name, desc, draw_fn in symbols:
        ax.text(5, y, name, fontsize=9, fontweight='bold', va='center')
        ax.text(32, y, desc, fontsize=8, va='center', color='#444')
        res = draw_fn(82, y)
        if isinstance(res, tuple):
            for r in res: ax.add_patch(r)
        elif isinstance(res, patches.Patch):
            ax.add_patch(res)
        y -= 14
    save_fig(fig, "er_symbols.png")

def gen_recode_er_diagram():
    fig, ax = setup_fig(9, 7)
    ax.text(50, 96, "Entity Relationship (ER) Diagram — Re:Code Platform", ha='center', fontsize=12, fontweight='bold')
    
    # Entities
    # 1. profiles (top center)
    p_box = patches.Rectangle((38, 76), 24, 8, facecolor='#BBDEFB', edgecolor='#0D47A1', lw=1.5)
    ax.add_patch(p_box)
    ax.text(50, 80, "profiles\n(auth.users)", ha='center', va='center', fontsize=8.5, fontweight='bold')
    
    # 2. reviews (center)
    r_box = patches.Rectangle((37, 44), 26, 9, facecolor='#C8E6C9', edgecolor='#1B5E20', lw=1.5)
    ax.add_patch(r_box)
    ax.text(50, 48.5, "reviews\n(Audit Sessions)", ha='center', va='center', fontsize=9, fontweight='bold')
    
    # 3. review_files (mid-left)
    rf_box = patches.Rectangle((6, 20), 24, 8, facecolor='#FFE0B2', edgecolor='#E65100', lw=1.5)
    ax.add_patch(rf_box)
    ax.text(18, 24, "review_files\n(Source Files)", ha='center', va='center', fontsize=8, fontweight='bold')
    
    # 4. review_issues (bottom center)
    ri_box = patches.Rectangle((37, 5), 26, 9, facecolor='#FFCDD2', edgecolor='#B71C1C', lw=1.5)
    ax.add_patch(ri_box)
    ax.text(50, 9.5, "review_issues\n(Findings & Diffs)", ha='center', va='center', fontsize=8.5, fontweight='bold')
    
    # 5. review_reports (mid-right)
    rr_box = patches.Rectangle((70, 44), 24, 8, facecolor='#E1BEE7', edgecolor='#4A148C', lw=1.5)
    ax.add_patch(rr_box)
    ax.text(82, 48, "review_reports\n(PDF/README)", ha='center', va='center', fontsize=8, fontweight='bold')
    
    # Relationships (Diamonds)
    # profiles to reviews
    d1 = patches.Polygon([[50, 68], [55, 64], [50, 60], [45, 64]], facecolor='#FFF9C4', edgecolor='#F57F17', lw=1)
    ax.add_patch(d1)
    ax.text(50, 64, "Owns", ha='center', va='center', fontsize=7.5, fontweight='bold')
    ax.plot([50, 50], [76, 68], color='#333', lw=1.2)
    ax.plot([50, 50], [60, 53], color='#333', lw=1.2)
    ax.text(52, 73, "1", fontsize=8, fontweight='bold')
    ax.text(52, 55, "N", fontsize=8, fontweight='bold')
    
    # reviews to review_files
    d2 = patches.Polygon([[28, 38], [33, 34], [28, 30], [23, 34]], facecolor='#FFF9C4', edgecolor='#F57F17', lw=1)
    ax.add_patch(d2)
    ax.text(28, 34, "Has", ha='center', va='center', fontsize=7.5, fontweight='bold')
    ax.plot([40, 31], [44, 37], color='#333', lw=1.2)
    ax.plot([25, 20], [31, 28], color='#333', lw=1.2)
    ax.text(38, 41, "1", fontsize=8, fontweight='bold')
    ax.text(21, 30, "N", fontsize=8, fontweight='bold')

    # review_files to review_issues
    d3 = patches.Polygon([[30, 16], [35, 12], [30, 8], [25, 12]], facecolor='#FFF9C4', edgecolor='#F57F17', lw=1)
    ax.add_patch(d3)
    ax.text(30, 12, "Yields", ha='center', va='center', fontsize=7, fontweight='bold')
    ax.plot([22, 27], [20, 15], color='#333', lw=1.2)
    ax.plot([33, 37], [10, 8], color='#333', lw=1.2)
    
    # reviews directly to review_issues (cascade)
    ax.plot([50, 50], [44, 14], color='#888', lw=1, linestyle=':')
    ax.text(51, 28, "1 : N (Cascade)", fontsize=7, color='#666')
    
    # reviews to review_reports
    d4 = patches.Polygon([[66, 52], [69, 48], [66, 44], [63, 48]], facecolor='#FFF9C4', edgecolor='#F57F17', lw=1)
    ax.add_patch(d4)
    ax.text(66, 48, "Gen", ha='center', va='center', fontsize=6.5, fontweight='bold')
    ax.plot([63, 64], [48, 48], color='#333', lw=1.2)
    ax.plot([68, 70], [48, 48], color='#333', lw=1.2)
    ax.text(62, 50, "1", fontsize=8, fontweight='bold')
    ax.text(69, 50, "N", fontsize=8, fontweight='bold')

    save_fig(fig, "recode_er_diagram.png")

# ==============================================================================
# 4. CLASS DIAGRAM SYMBOLS & RECODE CLASS DIAGRAM
# ==============================================================================
def gen_class_symbols():
    fig, ax = setup_fig(7, 4.5)
    ax.text(50, 93, "UML Class Diagram Standard Notations", ha='center', fontsize=11, fontweight='bold')
    
    notations = [
        ("Association", "Simple structural connection between classes", lambda y: ax.annotate("", xy=(90, y), xytext=(65, y), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333'))),
        ("Aggregation", "Weak 'has-a' relationship (part outlives whole)", lambda y: (ax.plot([65, 84], [y, y], color='#333', lw=1.5), ax.add_patch(patches.Polygon([[84, y], [87, y+2], [90, y], [87, y-2]], facecolor='white', edgecolor='#333', lw=1.5)))),
        ("Composition", "Strong 'part-of' relationship (part dies with whole)", lambda y: (ax.plot([65, 84], [y, y], color='#333', lw=1.5), ax.add_patch(patches.Polygon([[84, y], [87, y+2], [90, y], [87, y-2]], facecolor='#111', edgecolor='#111', lw=1.5)))),
        ("Generalization", "Inheritance from parent superclass", lambda y: (ax.plot([65, 85], [y, y], color='#333', lw=1.5), ax.add_patch(patches.Polygon([[85, y+3], [90, y], [85, y-3]], facecolor='white', edgecolor='#333', lw=1.5)))),
        ("Dependency", "Client relies on supplier (dashed line)", lambda y: ax.annotate("", xy=(90, y), xytext=(65, y), arrowprops=dict(arrowstyle="->", lw=1.5, color='#333', linestyle='--'))),
    ]
    
    y = 78
    for name, desc, draw_fn in notations:
        ax.text(5, y, name, fontsize=9, fontweight='bold', va='center')
        ax.text(26, y, desc, fontsize=8, va='center', color='#444')
        draw_fn(y)
        y -= 15
    save_fig(fig, "class_symbols.png")

def gen_recode_class_diagram():
    fig, ax = setup_fig(9, 7.5)
    ax.text(50, 97, "UML Class Diagram — Re:Code Core Architecture", ha='center', fontsize=12, fontweight='bold')
    
    # Class Box 1: Orchestrator
    o_box = patches.Rectangle((34, 73), 32, 20, facecolor='#F3E5F5', edgecolor='#4A148C', lw=1.5)
    ax.add_patch(o_box)
    ax.plot([34, 66], [88, 88], color='#4A148C', lw=1)
    ax.plot([34, 66], [81, 81], color='#4A148C', lw=1)
    ax.text(50, 90.5, "AnalysisOrchestrator", ha='center', va='center', fontsize=8.5, fontweight='bold')
    ax.text(35, 84.5, "- reviewId: UUID\n- sourceType: String", fontsize=7)
    ax.text(35, 76, "+ runPipeline(req): ReviewResult\n+ triggerAsyncAnalysis(): void", fontsize=7)
    
    # Class Box 2: StaticASTAnalyzer
    ast_box = patches.Rectangle((4, 40), 28, 22, facecolor='#E8F5E9', edgecolor='#1B5E20', lw=1.5)
    ax.add_patch(ast_box)
    ax.plot([4, 32], [57, 57], color='#1B5E20', lw=1)
    ax.plot([4, 32], [49, 49], color='#1B5E20', lw=1)
    ax.text(18, 59, "StaticASTAnalyzer", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(5, 53, "- babelParser: Parser\n- rulesMatrix: RuleMap", fontsize=6.8)
    ax.text(5, 44.5, "+ analyzeCode(code): Issue[]\n+ checkSQLi(path): void\n+ checkHardcodedSecrets(): void\n+ handleSyntaxError(err): Issue", fontsize=6.5)
    
    # Class Box 3: GeminiAIRegistry
    ai_box = patches.Rectangle((68, 40), 28, 22, facecolor='#FFF3E0', edgecolor='#E65100', lw=1.5)
    ax.add_patch(ai_box)
    ax.plot([68, 96], [57, 57], color='#E65100', lw=1)
    ax.plot([68, 96], [49, 49], color='#E65100', lw=1)
    ax.text(82, 59, "GeminiAIReviewer", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(69, 53, "- client: GoogleGenAI\n- model: gemini-2.5-flash", fontsize=6.8)
    ax.text(69, 44.5, "+ reviewCode(code, ctx): AIResp\n+ enforceSchema(json): Issue[]\n+ handleRateLimitFallback(): void", fontsize=6.5)

    # Class Box 4: FindingsNormalizer
    norm_box = patches.Rectangle((35, 38), 30, 20, facecolor='#E0F7FA', edgecolor='#006064', lw=1.5)
    ax.add_patch(norm_box)
    ax.plot([35, 65], [53, 53], color='#006064', lw=1)
    ax.plot([35, 65], [47, 47], color='#006064', lw=1)
    ax.text(50, 55, "FindingsNormalizer", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(36, 50, "- proximityThreshold: 2", fontsize=6.8)
    ax.text(36, 42.5, "+ normalize(ast, ai): Issue[]\n+ deduplicateFindings(): Issue[]\n+ assignHybridAttribution(): void", fontsize=6.5)

    # Class Box 5: ScoringEngine
    sc_box = patches.Rectangle((4, 6), 28, 21, facecolor='#FCE4EC', edgecolor='#880E4F', lw=1.5)
    ax.add_patch(sc_box)
    ax.plot([4, 32], [22, 22], color='#880E4F', lw=1)
    ax.plot([4, 32], [16, 16], color='#880E4F', lw=1)
    ax.text(18, 24, "ScoringEngine", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(5, 19, "- baseScore: 100\n- penaltyCaps: PenaltyMap", fontsize=6.8)
    ax.text(5, 11, "+ computeHealth(issues): Score\n+ applyPenaltyCapping(): void\n+ assignGrade(score): String", fontsize=6.5)

    # Class Box 6: ReviewRepository (Persistence)
    rep_box = patches.Rectangle((68, 6), 28, 21, facecolor='#EDE7F6', edgecolor='#311B92', lw=1.5)
    ax.add_patch(rep_box)
    ax.plot([68, 96], [22, 22], color='#311B92', lw=1)
    ax.plot([68, 96], [16, 16], color='#311B92', lw=1)
    ax.text(82, 24, "ReviewRepository", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(69, 19, "- supabase: SupabaseClient", fontsize=6.8)
    ax.text(69, 11, "+ saveReview(rev): UUID\n+ saveIssues(iss): void\n+ getReviewById(id): ReviewData\n+ deleteReviewCascade(id): void", fontsize=6.5)

    # Connecting Arrows
    ax.annotate("", xy=(22, 62), xytext=(38, 73), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(50, 58), xytext=(50, 73), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(78, 62), xytext=(62, 73), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(20, 27), xytext=(40, 38), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(80, 27), xytext=(60, 38), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))

    save_fig(fig, "recode_class_diagram.png")

# ==============================================================================
# 5. OBJECT DIAGRAM & ACTIVITY DIAGRAM
# ==============================================================================
def gen_recode_object_diagram():
    fig, ax = setup_fig(9, 6.5)
    ax.text(50, 96, "UML Object Diagram — Runtime Snapshot of Review Audit", ha='center', fontsize=12, fontweight='bold')
    
    # Object 1: User Profile
    u_box = patches.Rectangle((36, 74), 28, 17, facecolor='#E3F2FD', edgecolor='#1565C0', lw=1.5)
    ax.add_patch(u_box)
    ax.plot([36, 64], [86, 86], color='#1565C0', lw=1)
    ax.text(50, 88, "user1 : Profile", ha='center', va='center', fontsize=8.5, fontweight='bold')
    ax.text(37, 80, "id = \"usr_883a09e2\"\nemail = \"shivam@recode.dev\"\nrole = \"developer\"", fontsize=7)

    # Object 2: Active Review Session
    r_box = patches.Rectangle((35, 42), 30, 20, facecolor='#E8F5E9', edgecolor='#2E7D32', lw=1.5)
    ax.add_patch(r_box)
    ax.plot([35, 65], [56, 56], color='#2E7D32', lw=1)
    ax.text(50, 58.5, "review1 : Review", ha='center', va='center', fontsize=8.5, fontweight='bold')
    ax.text(36, 49, "id = \"rev_f390d4\"\nprojectName = \"ecommerce-api\"\nsourceType = \"github\"\nhealthScore = 84.50\ngrade = \"B+\"\nstatus = \"completed\"", fontsize=6.8)

    # Object 3: File Analyzed
    f_box = patches.Rectangle((4, 12), 26, 18, facecolor='#FFF3E0', edgecolor='#E65100', lw=1.5)
    ax.add_patch(f_box)
    ax.plot([4, 30], [25, 25], color='#E65100', lw=1)
    ax.text(17, 27, "file1 : ReviewFile", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(5, 18.5, "id = \"fil_981a\"\nfilePath = \"src/auth.js\"\nlanguage = \"javascript\"\nlinesCount = 142\nissuesCount = 2", fontsize=6.8)

    # Object 4: Issue Finding
    i_box = patches.Rectangle((37, 8), 28, 22, facecolor='#FFEBEE', edgecolor='#C62828', lw=1.5)
    ax.add_patch(i_box)
    ax.plot([37, 65], [24, 24], color='#C62828', lw=1)
    ax.text(51, 26.5, "issue1 : ReviewIssue", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(38, 16, "id = \"iss_0042\"\nline = 34\nseverity = \"CRITICAL\"\nruleId = \"SQL_INJECTION\"\nengine = \"HYBRID (AST+AI)\"\ntitle = \"Unescaped Query Param\"", fontsize=6.8)

    # Object 5: Report Export
    rp_box = patches.Rectangle((70, 14), 26, 16, facecolor='#F3E5F5', edgecolor='#6A1B9A', lw=1.5)
    ax.add_patch(rp_box)
    ax.plot([70, 96], [25, 25], color='#6A1B9A', lw=1)
    ax.text(83, 27, "report1 : ReviewReport", ha='center', va='center', fontsize=8, fontweight='bold')
    ax.text(71, 19.5, "id = \"rep_771b\"\nreportType = \"pdf\"\ndownloadUrl = \"/api/reports/...\"\nstatus = \"ready\"", fontsize=6.8)

    # Links
    ax.plot([50, 50], [74, 62], color='#333', lw=1.2)
    ax.text(51, 68, "executes", fontsize=7.5, color='#444')
    
    ax.plot([35, 24], [45, 30], color='#333', lw=1.2)
    ax.text(26, 39, "contains", fontsize=7.5, color='#444')
    
    ax.plot([30, 37], [20, 20], color='#333', lw=1.2)
    ax.text(31, 22, "flags", fontsize=7.5, color='#444')

    ax.plot([65, 75], [45, 30], color='#333', lw=1.2)
    ax.text(72, 39, "exports", fontsize=7.5, color='#444')

    save_fig(fig, "recode_object_diagram.png")

def gen_recode_activity_diagram():
    fig, ax = setup_fig(8, 9)
    ax.text(50, 97, "UML Activity Diagram — Re:Code End-to-End Review Workflow", ha='center', fontsize=11, fontweight='bold')
    
    # Initial State (Solid Circle)
    c_start = patches.Circle((50, 92), 2, facecolor='black', edgecolor='black')
    ax.add_patch(c_start)
    ax.annotate("", xy=(50, 87), xytext=(50, 90), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    
    # Act 1: Submit Code
    a1 = patches.FancyBboxPatch((35, 82), 30, 5, boxstyle="round,pad=0.2", facecolor='#E3F2FD', edgecolor='#1565C0', lw=1)
    ax.add_patch(a1)
    ax.text(50, 84.5, "Submit Code (Snippet / GitHub Repo)", ha='center', va='center', fontsize=8)
    ax.annotate("", xy=(50, 77), xytext=(50, 82), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))

    # Decision 1: SSRF & Payload Check
    d1 = patches.Polygon([[50, 77], [56, 73], [50, 69], [44, 73]], facecolor='#FFF9C4', edgecolor='#F57F17', lw=1)
    ax.add_patch(d1)
    ax.text(50, 73, "Valid?", ha='center', va='center', fontsize=7.5, fontweight='bold')
    
    # Reject Branch
    ax.annotate("No (SSRF/Size)", xy=(82, 73), xytext=(56, 73), arrowprops=dict(arrowstyle="->", lw=1, color='#C62828'))
    rej_box = patches.FancyBboxPatch((74, 61), 22, 5, boxstyle="round,pad=0.2", facecolor='#FFEBEE', edgecolor='#C62828', lw=1)
    ax.add_patch(rej_box)
    ax.text(85, 63.5, "Return HTTP 400/413 Error", ha='center', va='center', fontsize=7, color='#C62828')

    # Yes Branch to Fork Bar
    ax.annotate("Yes", xy=(50, 64), xytext=(50, 69), arrowprops=dict(arrowstyle="->", lw=1, color='#2E7D32'))
    fork1 = patches.Rectangle((25, 63), 50, 1.2, facecolor='#222', edgecolor='#222')
    ax.add_patch(fork1)
    
    # Parallel Tasks: Engine A & Engine B
    ax.annotate("", xy=(33, 58), xytext=(33, 63), arrowprops=dict(arrowstyle="->", lw=1, color='#333'))
    ax.annotate("", xy=(67, 58), xytext=(67, 63), arrowprops=dict(arrowstyle="->", lw=1, color='#333'))
    
    a_ast = patches.FancyBboxPatch((20, 52), 26, 6, boxstyle="round,pad=0.2", facecolor='#E8F5E9', edgecolor='#2E7D32', lw=1)
    ax.add_patch(a_ast)
    ax.text(33, 55, "Babel AST Traversal\n(Deterministic Rules)", ha='center', va='center', fontsize=7)
    
    a_ai = patches.FancyBboxPatch((54, 52), 26, 6, boxstyle="round,pad=0.2", facecolor='#FFF3E0', edgecolor='#E65100', lw=1)
    ax.add_patch(a_ai)
    ax.text(67, 55, "Google Gemini AI Review\n(Algorithmic & Architecture)", ha='center', va='center', fontsize=7)
    
    # Join Bar
    ax.annotate("", xy=(33, 46), xytext=(33, 52), arrowprops=dict(arrowstyle="->", lw=1, color='#333'))
    ax.annotate("", xy=(67, 46), xytext=(67, 52), arrowprops=dict(arrowstyle="->", lw=1, color='#333'))
    join1 = patches.Rectangle((25, 45), 50, 1.2, facecolor='#222', edgecolor='#222')
    ax.add_patch(join1)

    # Next: Deduplication & Normalization
    ax.annotate("", xy=(50, 40), xytext=(50, 45), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    a_norm = patches.FancyBboxPatch((32, 35), 36, 5, boxstyle="round,pad=0.2", facecolor='#E0F7FA', edgecolor='#006064', lw=1)
    ax.add_patch(a_norm)
    ax.text(50, 37.5, "Normalize & Merge (HYBRID Attribution)", ha='center', va='center', fontsize=7.5)

    # Next: Mathematical Health Score
    ax.annotate("", xy=(50, 30), xytext=(50, 35), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    a_score = patches.FancyBboxPatch((32, 25), 36, 5, boxstyle="round,pad=0.2", facecolor='#FCE4EC', edgecolor='#880E4F', lw=1)
    ax.add_patch(a_score)
    ax.text(50, 27.5, "Compute Health Score & Letter Grade", ha='center', va='center', fontsize=7.5)

    # Next: Save to Supabase
    ax.annotate("", xy=(50, 20), xytext=(50, 25), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    a_db = patches.FancyBboxPatch((32, 15), 36, 5, boxstyle="round,pad=0.2", facecolor='#EDE7F6', edgecolor='#311B92', lw=1)
    ax.add_patch(a_db)
    ax.text(50, 17.5, "Persist Session in Supabase PostgreSQL", ha='center', va='center', fontsize=7.5)

    # Next: Render Review Canvas
    ax.annotate("", xy=(50, 10), xytext=(50, 15), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    a_ui = patches.FancyBboxPatch((30, 5), 40, 5, boxstyle="round,pad=0.2", facecolor='#DCEDC8', edgecolor='#33691E', lw=1)
    ax.add_patch(a_ui)
    ax.text(50, 7.5, "Render Interactive Canvas (Live Patching / PDF)", ha='center', va='center', fontsize=7.5)

    # End State (Bullseye)
    ax.annotate("", xy=(50, 1.5), xytext=(50, 5), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    c_out = patches.Circle((50, 1.2), 1.6, facecolor='none', edgecolor='black', lw=1.5)
    c_in = patches.Circle((50, 1.2), 1, facecolor='black', edgecolor='black')
    ax.add_patch(c_out)
    ax.add_patch(c_in)

    save_fig(fig, "recode_activity_diagram.png")

# ==============================================================================
# 6. SEQUENCE & USE CASE DIAGRAMS
# ==============================================================================
def gen_recode_sequence_diagram():
    fig, ax = setup_fig(9, 7)
    ax.text(50, 96, "UML Sequence Diagram — Code Review Pipeline Interaction", ha='center', fontsize=11, fontweight='bold')
    
    actors = [
        ("User", 10),
        ("Client UI\n(React 19)", 26),
        ("API Server\n(Express 5)", 44),
        ("AST Engine\n(Babel)", 62),
        ("Gemini AI\n(Cloud)", 78),
        ("Database\n(Supabase)", 92)
    ]
    
    for name, x in actors:
        box = patches.Rectangle((x-7, 86), 14, 7, facecolor='#ECEFF1', edgecolor='#374151', lw=1.2)
        ax.add_patch(box)
        ax.text(x, 89.5, name, ha='center', va='center', fontsize=7, fontweight='bold')
        ax.plot([x, x], [86, 10], color='#bbb', lw=1, linestyle='--')
        
    # Interaction Messages
    messages = [
        (80, 10, 26, "Submit Snippet / Repo URL", True),
        (74, 26, 44, "POST /api/v1/reviews/run", True),
        (68, 44, 44, "Validate SSRF & Clamp 2MB", False),
        (62, 44, 62, "analyzeCode(ast)", True),
        (56, 44, 78, "generateContent(prompt)", True),
        (50, 62, 44, "AST Findings (SQLi, Secrets)", True),
        (44, 78, 44, "AI Explanations & Diffs", True),
        (38, 44, 44, "Normalize & Score(100)", False),
        (32, 44, 92, "INSERT INTO reviews & issues", True),
        (26, 92, 44, "Session Persisted (UUID)", True),
        (20, 44, 26, "HTTP 200 { reviewId, score }", True),
        (14, 26, 10, "Render Canvas & Diffs", True),
    ]
    
    for y, x1, x2, label, is_call in messages:
        if x1 == x2: # Self call
            ax.plot([x1, x1+4, x1+4, x1], [y, y, y-3, y-3], color='#0277BD', lw=1.2)
            ax.text(x1+5, y-1.5, label, fontsize=6.5, va='center')
        else:
            style = "->" if is_call else "-->"
            ax.annotate("", xy=(x2, y), xytext=(x1, y), arrowprops=dict(arrowstyle="->", lw=1.2, color='#1565C0'))
            mid_x = (x1 + x2) / 2
            ax.text(mid_x, y + 1.2, label, fontsize=6.5, ha='center', va='bottom', color='#111')
            
    save_fig(fig, "recode_sequence_diagram.png")

def gen_recode_usecase_diagram():
    fig, ax = setup_fig(9, 6.5)
    ax.text(50, 96, "UML Use Case Diagram — Re:Code Actor Interactions", ha='center', fontsize=11, fontweight='bold')
    
    # System Boundary Box
    sys_box = patches.Rectangle((28, 5), 65, 86, facecolor='#FAFAFA', edgecolor='#02C8F0', lw=2)
    ax.add_patch(sys_box)
    ax.text(60, 88, "Re:Code Platform System Boundary", ha='center', fontsize=9, fontweight='bold', color='#0277BD')
    
    # Actors (Left)
    # Developer / Registered User
    ax.plot([10, 10], [67, 73], color='#333', lw=1.5) # body
    ax.plot([6, 14], [70, 70], color='#333', lw=1.5) # arms
    ax.plot([10, 7], [67, 62], color='#333', lw=1.5) # legs
    ax.plot([10, 13], [67, 62], color='#333', lw=1.5)
    c_head = patches.Circle((10, 75), 2, facecolor='white', edgecolor='#333', lw=1.5)
    ax.add_patch(c_head)
    ax.text(10, 58, "Developer\n(Registered)", ha='center', fontsize=7.5, fontweight='bold')

    # Guest Auditor
    ax.plot([10, 10], [32, 38], color='#333', lw=1.5) # body
    ax.plot([6, 14], [35, 35], color='#333', lw=1.5) # arms
    ax.plot([10, 7], [32, 27], color='#333', lw=1.5) # legs
    ax.plot([10, 13], [32, 27], color='#333', lw=1.5)
    c_head2 = patches.Circle((10, 40), 2, facecolor='white', edgecolor='#333', lw=1.5)
    ax.add_patch(c_head2)
    ax.text(10, 23, "Guest Auditor\n(Anonymous UUID)", ha='center', fontsize=7.5, fontweight='bold')

    # Use Cases (Ovals)
    usecases = [
        ("Submit Code Snippet", 45, 78),
        ("Scan GitHub Repo", 72, 78),
        ("Execute AST Traversal", 45, 62),
        ("Trigger Gemini AI Review", 72, 62),
        ("Inspect Interactive Diffs", 45, 46),
        ("Apply In-Memory Live Patches", 72, 46),
        ("Export Vector PDF Audit", 45, 30),
        ("Export README Badge", 72, 30),
        ("View Audit History", 45, 14),
        ("Manage / Delete Reviews", 72, 14)
    ]
    
    for text, cx, cy in usecases:
        ov = patches.Ellipse((cx, cy), 22, 9, facecolor='#E3F2FD', edgecolor='#1565C0', lw=1.2)
        ax.add_patch(ov)
        ax.text(cx, cy, text, ha='center', va='center', fontsize=7, fontweight='medium')
        
    # Connections from Actors to Use Cases
    # Developer links
    for target in [(45, 78), (72, 78), (45, 46), (72, 46), (45, 30), (72, 30), (45, 14), (72, 14)]:
        ax.plot([12, target[0]-11], [68, target[1]], color='#555', lw=1)
        
    # Guest links
    for target in [(45, 78), (72, 78), (45, 46), (72, 46), (45, 30), (45, 14)]:
        ax.plot([12, target[0]-11], [33, target[1]], color='#888', lw=1, linestyle='--')

    save_fig(fig, "recode_usecase_diagram.png")

# ==============================================================================
# 7. COMPONENT & DEPLOYMENT DIAGRAMS
# ==============================================================================
def gen_recode_component_diagram():
    fig, ax = setup_fig(9, 6.5)
    ax.text(50, 96, "UML Component Diagram — Re:Code Subsystem Architecture", ha='center', fontsize=11, fontweight='bold')
    
    components = [
        ("Frontend Client App\n(React 19 + Vite)", 6, 60, 26, 22, '#E0F2F1', '#00796B'),
        ("REST API Server\n(Express 5 Router)", 38, 60, 28, 22, '#E8EAF6', '#303F9F'),
        ("Security Shield\n(SSRF + 2MB Clamp)", 38, 30, 28, 18, '#FFEBEE', '#C62828'),
        ("AST Static Engine\n(@babel/parser)", 72, 70, 24, 18, '#FFF3E0', '#E65100'),
        ("Gemini AI Client\n(@google/genai)", 72, 45, 24, 18, '#F3E5F5', '#7B1FA2'),
        ("Scoring & Normalizer\n(Math Penalty Engine)", 72, 20, 24, 18, '#E8F5E9', '#2E7D32'),
        ("Supabase Database\n(PostgreSQL + RLS)", 6, 12, 26, 20, '#E1F5FE', '#0288D1'),
        ("PDFKit Vector Service\n(Report Generator)", 38, 5, 28, 16, '#FBE9E7', '#D84315')
    ]
    
    for name, x, y, w, h, bg, border in components:
        rect = patches.Rectangle((x, y), w, h, facecolor=bg, edgecolor=border, lw=1.5)
        ax.add_patch(rect)
        # Component tabs
        tab1 = patches.Rectangle((x-1.5, y+h-4), 3, 2.5, facecolor=bg, edgecolor=border, lw=1)
        tab2 = patches.Rectangle((x-1.5, y+h-8), 3, 2.5, facecolor=bg, edgecolor=border, lw=1)
        ax.add_patch(tab1)
        ax.add_patch(tab2)
        ax.text(x + w/2, y + h/2, name, ha='center', va='center', fontsize=7.5, fontweight='bold')

    # Connections
    ax.annotate("", xy=(38, 71), xytext=(32, 71), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.text(35, 72.5, "JSON", fontsize=6.5)

    ax.annotate("", xy=(52, 48), xytext=(52, 60), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))

    ax.annotate("", xy=(72, 79), xytext=(66, 75), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(72, 54), xytext=(66, 68), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.annotate("", xy=(72, 29), xytext=(66, 62), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))

    ax.annotate("", xy=(19, 32), xytext=(19, 60), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))
    ax.text(20, 46, "Auth SDK", fontsize=6.5)

    ax.annotate("", xy=(52, 21), xytext=(52, 30), arrowprops=dict(arrowstyle="->", lw=1.2, color='#333'))

    save_fig(fig, "recode_component_diagram.png")

def gen_recode_deployment_diagram():
    fig, ax = setup_fig(9, 6.5)
    ax.text(50, 96, "UML Deployment Diagram — Re:Code Production Topology", ha='center', fontsize=11, fontweight='bold')
    
    nodes = [
        ("«device»\nClient Workstation\n(Chrome / Firefox / Edge)", 4, 52, 28, 30, '#FAFAFA', '#455A64'),
        ("«server»\nApplication Server\n(Node.js v24 + Express 5)", 37, 52, 30, 32, '#F5F5F5', '#2E7D32'),
        ("«cloud»\nGoogle Cloud Platform\n(Gemini 2.5 Flash API)", 73, 62, 24, 24, '#FFF8E1', '#F57F17'),
        ("«database»\nSupabase Cloud Platform\n(PostgreSQL 16 + Pooler)", 73, 26, 24, 26, '#E0F7FA', '#00838F'),
        ("«cloud»\nGitHub REST Services\n(Git Trees & Blob API)", 37, 10, 30, 22, '#ECEFF1', '#37474F')
    ]
    
    for name, x, y, w, h, bg, border in nodes:
        # Draw 3D Cube Node
        d = 2.5
        cube_front = patches.Rectangle((x, y), w, h, facecolor=bg, edgecolor=border, lw=1.5)
        ax.add_patch(cube_front)
        cube_top = patches.Polygon([[x, y+h], [x+d, y+h+d], [x+w+d, y+h+d], [x+w, y+h]], facecolor='#EAEAEA', edgecolor=border, lw=1.2)
        ax.add_patch(cube_top)
        cube_side = patches.Polygon([[x+w, y], [x+w+d, y+d], [x+w+d, y+h+d], [x+w, y+h]], facecolor='#E0E0E0', edgecolor=border, lw=1.2)
        ax.add_patch(cube_side)
        ax.text(x + w/2, y + h/2, name, ha='center', va='center', fontsize=7.5, fontweight='bold')

    # Network Links
    ax.plot([32, 37], [68, 68], color='#333', lw=1.5)
    ax.text(34.5, 70, "HTTPS", fontsize=7, ha='center')

    ax.plot([67, 73], [74, 74], color='#333', lw=1.5)
    ax.text(70, 76, "TLS / API Key", fontsize=6.5, ha='center')

    ax.plot([67, 73], [58, 40], color='#333', lw=1.5)
    ax.text(71, 51, "SSL :6543", fontsize=6.5, ha='center')

    ax.plot([52, 52], [52, 32], color='#333', lw=1.5)
    ax.text(56, 42, "OAuth Token", fontsize=6.5)

    save_fig(fig, "recode_deployment_diagram.png")

# ==============================================================================
# 8. UI SCREEN LAYOUTS (WIREFRAMES)
# ==============================================================================
def gen_ui_layouts():
    # 1. Landing Page
    fig, ax = setup_fig(8, 5)
    ax.text(50, 95, "UI Wireframe: Landing Page (/)", ha='center', fontsize=11, fontweight='bold')
    # Frame
    ax.add_patch(patches.Rectangle((5, 5), 90, 85, facecolor='#0F0F0F', edgecolor='#333', lw=1.5))
    # Navbar
    ax.add_patch(patches.Rectangle((5, 78), 90, 12, facecolor='#181818', edgecolor='#282828', lw=1))
    ax.text(10, 84, "Re:Code", fontsize=10, fontweight='bold', color='#02C8F0')
    ax.text(70, 84, "Audit Code   History   Docs   [Sign In]", fontsize=7, color='#AAA')
    # Hero
    ax.text(50, 64, "Automated Code Review, Static AST Security\n& AI Diagnostics Platform", ha='center', fontsize=11, fontweight='bold', color='white')
    ax.text(50, 52, "Read. Review. Refine. Dual-engine analysis uniting Babel AST rules with Google Gemini reasoning.", ha='center', fontsize=7.5, color='#888')
    # CTA Buttons
    ax.add_patch(patches.Rectangle((33, 40), 16, 7, facecolor='#02C8F0', edgecolor='none'))
    ax.text(41, 43.5, "Audit Snippet", ha='center', va='center', fontsize=7.5, fontweight='bold', color='black')
    ax.add_patch(patches.Rectangle((51, 40), 16, 7, facecolor='#212121', edgecolor='#444', lw=1))
    ax.text(59, 43.5, "Scan GitHub", ha='center', va='center', fontsize=7.5, color='white')
    # Feature Cards
    for i, title in enumerate(["Deterministic AST", "Gemini AI Reasoning", "Live In-Memory Patching"]):
        x = 10 + i * 27
        ax.add_patch(patches.Rectangle((x, 12), 25, 22, facecolor='#181818', edgecolor='#2A2A2A', lw=1))
        ax.text(x+12.5, 27, title, ha='center', fontsize=7.5, fontweight='bold', color='#02C8F0')
        ax.text(x+12.5, 18, "Enterprise diagnostics\nwith mathematical rigor", ha='center', fontsize=6.5, color='#777')
    save_fig(fig, "ui_landing_page.png")

    # 2. Submission Page
    fig, ax = setup_fig(8, 5)
    ax.text(50, 95, "UI Wireframe: Code Submission Page (/submit)", ha='center', fontsize=11, fontweight='bold')
    ax.add_patch(patches.Rectangle((5, 5), 90, 85, facecolor='#0F0F0F', edgecolor='#333', lw=1.5))
    ax.add_patch(patches.Rectangle((5, 78), 90, 12, facecolor='#181818', edgecolor='#282828', lw=1))
    ax.text(10, 84, "Re:Code | Audit Codebase", fontsize=9, fontweight='bold', color='#02C8F0')
    # Tab Switcher
    ax.add_patch(patches.Rectangle((25, 70), 24, 6, facecolor='#02C8F0', edgecolor='none'))
    ax.text(37, 73, "Direct Code Snippet", ha='center', va='center', fontsize=7.5, fontweight='bold', color='black')
    ax.add_patch(patches.Rectangle((51, 70), 24, 6, facecolor='#212121', edgecolor='#333', lw=1))
    ax.text(63, 73, "GitHub Repository Target", ha='center', va='center', fontsize=7.5, color='#AAA')
    # Editor Area
    ax.add_patch(patches.Rectangle((15, 22), 70, 44, facecolor='#141414', edgecolor='#2A2A2A', lw=1))
    ax.text(18, 61, "// Paste JavaScript, TypeScript, Python, or C++ source code here...", fontsize=7, color='#555', fontfamily='monospace')
    ax.text(18, 54, "const db = pool.connect();", fontsize=7, color='#888', fontfamily='monospace')
    ax.text(18, 47, "const query = \"SELECT * FROM users WHERE id = \" + req.body.id; // SQLi vulnerability", fontsize=7, color='#FF5252', fontfamily='monospace')
    ax.text(18, 40, "db.query(query);", fontsize=7, color='#888', fontfamily='monospace')
    # Submit Button
    ax.add_patch(patches.Rectangle((35, 10), 30, 8, facecolor='#02C8F0', edgecolor='none'))
    ax.text(50, 14, "Start Dual-Engine Audit →", ha='center', va='center', fontsize=8.5, fontweight='bold', color='black')
    save_fig(fig, "ui_submission_page.png")

    # 3. Review Dashboard Canvas
    fig, ax = setup_fig(8, 5.5)
    ax.text(50, 96, "UI Wireframe: Review Dashboard & Canvas (/reviews/:id)", ha='center', fontsize=11, fontweight='bold')
    ax.add_patch(patches.Rectangle((5, 5), 90, 88, facecolor='#0F0F0F', edgecolor='#333', lw=1.5))
    # Header & Score Gauge
    ax.add_patch(patches.Rectangle((8, 66), 40, 22, facecolor='#181818', edgecolor='#282828', lw=1))
    ax.text(12, 82, "Health Score: 85 / 100  |  Grade B+", fontsize=8.5, fontweight='bold', color='#02C8F0')
    ax.text(12, 74, "Critical: 0  |  High: 1  |  Medium: 2  |  Low: 3", fontsize=7, color='#AAA')
    ax.text(12, 69, "Project: ecommerce-api  •  Files: 14", fontsize=6.5, color='#777')
    # Action Buttons
    ax.add_patch(patches.Rectangle((52, 74), 18, 7, facecolor='#212121', edgecolor='#444', lw=1))
    ax.text(61, 77.5, "Export PDF Report", ha='center', va='center', fontsize=7, color='white')
    ax.add_patch(patches.Rectangle((73, 74), 18, 7, facecolor='#212121', edgecolor='#444', lw=1))
    ax.text(82, 77.5, "README Badge", ha='center', va='center', fontsize=7, color='white')
    # Filter Tabs
    ax.text(12, 61, "Filters: [All Issues (6)] [Critical (0)] [High (1)] [Medium (2)] [Low (3)]", fontsize=7, color='#02C8F0')
    # Issue Card with Diff Viewer
    ax.add_patch(patches.Rectangle((8, 16), 84, 41, facecolor='#181818', edgecolor='#2A2A2A', lw=1))
    ax.text(12, 52, "🚨 SQL Injection Vulnerability via String Concatenation", fontsize=8, fontweight='bold', color='#FF5252')
    ax.add_patch(patches.Rectangle((70, 50), 20, 4, facecolor='#006064', edgecolor='none'))
    ax.text(80, 52, "HYBRID (AST + AI)", ha='center', va='center', fontsize=6, fontweight='bold', color='#80DEEA')
    ax.text(12, 45, "File: src/routes/user.js : Line 42   •   Rule: CWE-89", fontsize=6.5, color='#888')
    # Diff Viewer
    ax.add_patch(patches.Rectangle((12, 24), 76, 17, facecolor='#121212', edgecolor='#222', lw=1))
    ax.text(14, 36, "- const sql = \"SELECT * FROM users WHERE id = '\" + id + \"'\";", fontsize=6.5, color='#EF5350', fontfamily='monospace')
    ax.text(14, 28, "+ const sql = \"SELECT * FROM users WHERE id = $1\"; // Parameterized", fontsize=6.5, color='#66BB6A', fontfamily='monospace')
    # Patch Button
    ax.add_patch(patches.Rectangle((74, 18), 16, 5, facecolor='#2E7D32', edgecolor='none'))
    ax.text(82, 20.5, "✓ Apply Patch", ha='center', va='center', fontsize=6.5, fontweight='bold', color='white')
    # Safe Fixes Dock
    ax.add_patch(patches.Rectangle((8, 6), 84, 8, facecolor='#1C1C1C', edgecolor='#333', lw=1))
    ax.text(12, 10, "⚡ Quick Fix Dock: 3 safe low-severity patches available", fontsize=7, color='#CCC')
    ax.add_patch(patches.Rectangle((70, 7.5), 20, 5, facecolor='#02C8F0', edgecolor='none'))
    ax.text(80, 10, "Apply All Safe Fixes", ha='center', va='center', fontsize=6.5, fontweight='bold', color='black')
    save_fig(fig, "ui_review_canvas.png")

    # 4. History Page
    fig, ax = setup_fig(8, 4.5)
    ax.text(50, 95, "UI Wireframe: Audit History Tracking (/history)", ha='center', fontsize=11, fontweight='bold')
    ax.add_patch(patches.Rectangle((5, 5), 90, 85, facecolor='#0F0F0F', edgecolor='#333', lw=1.5))
    ax.add_patch(patches.Rectangle((5, 78), 90, 12, facecolor='#181818', edgecolor='#282828', lw=1))
    ax.text(10, 84, "Re:Code | Audit History & Sessions", fontsize=9, fontweight='bold', color='#02C8F0')
    # Table of Sessions
    ax.add_patch(patches.Rectangle((10, 15), 80, 58, facecolor='#181818', edgecolor='#2A2A2A', lw=1))
    ax.text(14, 66, "Project Name          Source       Date               Score    Grade    Actions", fontsize=7.5, fontweight='bold', color='#CCC')
    ax.plot([10, 90], [62, 62], color='#333', lw=1)
    rows = [
        ("ecommerce-backend", "GitHub", "2026-03-12", "88/100", "B+", "[Inspect] [Delete]"),
        ("auth-microservice", "Snippet", "2026-03-11", "94/100", "A", "[Inspect] [Delete]"),
        ("legacy-payment-api", "GitHub", "2026-03-10", "52/100", "F", "[Inspect] [Delete]"),
        ("user-dashboard-ui", "GitHub", "2026-03-08", "76/100", "C", "[Inspect] [Delete]"),
    ]
    y = 54
    for p, s, d, sc, g, act in rows:
        ax.text(14, y, p, fontsize=7, color='#02C8F0')
        ax.text(32, y, s, fontsize=7, color='#888')
        ax.text(42, y, d, fontsize=7, color='#888')
        ax.text(58, y, sc, fontsize=7, color='#CCC')
        ax.text(66, y, g, fontsize=7, fontweight='bold', color='#66BB6A' if g in ['A', 'B+'] else '#EF5350')
        ax.text(74, y, act, fontsize=7, color='#AAA')
        y -= 10
    save_fig(fig, "ui_history_page.png")

if __name__ == "__main__":
    print("Generating Gantt charts...")
    gen_gantt_1()
    gen_gantt_2()
    gen_gantt_3()
    gen_gantt_4()
    gen_gantt_5()
    gen_gantt_6_7()
    print("Generating SDLC diagram...")
    gen_sdlc()
    print("Generating ER diagrams...")
    gen_er_symbols()
    gen_recode_er_diagram()
    print("Generating Class diagrams...")
    gen_class_symbols()
    gen_recode_class_diagram()
    print("Generating Object & Activity diagrams...")
    gen_recode_object_diagram()
    gen_recode_activity_diagram()
    print("Generating Sequence & Use Case diagrams...")
    gen_recode_sequence_diagram()
    gen_recode_usecase_diagram()
    print("Generating Component & Deployment diagrams...")
    gen_recode_component_diagram()
    gen_recode_deployment_diagram()
    print("Generating UI Wireframes...")
    gen_ui_layouts()
    print("All diagrams generated successfully!")
