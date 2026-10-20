import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

def draw_chen_er_diagram():
    # Figure setup (portrait, high resolution)
    fig, ax = plt.subplots(figsize=(11, 15), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 136)
    ax.axis('off')

    # Color palette matching black & white academic publication standards
    stroke_color = '#111827'
    fill_color = '#ffffff'
    line_width = 1.4

    # Helper: Draw Oval Attribute
    def draw_attribute(cx, cy, label, is_pk=False, rx=4.2, ry=1.6, fontsize=8):
        ellipse = patches.Ellipse((cx, cy), rx * 2, ry * 2, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width, zorder=4)
        ax.add_patch(ellipse)
        ax.text(cx, cy, label, ha='center', va='center', fontsize=fontsize, fontweight='bold' if is_pk else 'normal', zorder=5)
        if is_pk:
            # Underline for PK
            ax.plot([cx - rx * 0.65, cx + rx * 0.65], [cy - 0.7, cy - 0.7], color=stroke_color, linewidth=1.1, zorder=6)

    # Helper: Draw Diamond Relationship
    def draw_diamond(cx, cy, label, w=13, h=4.2, is_identifying=False, fontsize=8.5):
        pts = [[cx, cy + h/2], [cx + w/2, cy], [cx, cy - h/2], [cx - w/2, cy]]
        if is_identifying:
            # Double diamond
            poly_outer = patches.Polygon(pts, closed=True, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width, zorder=3)
            ax.add_patch(poly_outer)
            pts_inner = [[cx, cy + h/2 - 0.5], [cx + w/2 - 0.8, cy], [cx, cy - h/2 + 0.5], [cx - w/2 + 0.8, cy]]
            poly_inner = patches.Polygon(pts_inner, closed=True, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width * 0.8, zorder=4)
            ax.add_patch(poly_inner)
        else:
            poly = patches.Polygon(pts, closed=True, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width, zorder=3)
            ax.add_patch(poly)
        ax.text(cx, cy, label, ha='center', va='center', fontsize=fontsize, fontweight='bold', zorder=5)

    # Helper: Draw Entity Rectangle
    def draw_entity(x, y, w, h, label, is_weak=False, fontsize=9.5, is_pillar=False):
        if is_weak:
            # Double rectangle
            rect_outer = patches.Rectangle((x, y), w, h, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width, zorder=3)
            ax.add_patch(rect_outer)
            rect_inner = patches.Rectangle((x + 0.5, y + 0.4), w - 1.0, h - 0.8, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width * 0.8, zorder=4)
            ax.add_patch(rect_inner)
        else:
            rect = patches.Rectangle((x, y), w, h, facecolor=fill_color, edgecolor=stroke_color, linewidth=line_width, zorder=3)
            ax.add_patch(rect)
        
        if is_pillar:
            ax.text(x + w/2, y + h/2, label, ha='center', va='center', fontsize=fontsize, fontweight='heavy', zorder=5, rotation=0)
        else:
            ax.text(x + w/2, y + h/2, label, ha='center', va='center', fontsize=fontsize, fontweight='bold', zorder=5)

    # Helper: Connecting Line
    def draw_line(x1, y1, x2, y2, is_double=False):
        if is_double:
            ax.plot([x1, x2], [y1 + 0.25, y2 + 0.25], color=stroke_color, linewidth=line_width * 0.8, zorder=1)
            ax.plot([x1, x2], [y1 - 0.25, y2 - 0.25], color=stroke_color, linewidth=line_width * 0.8, zorder=1)
        else:
            ax.plot([x1, x2], [y1, y2], color=stroke_color, linewidth=line_width, zorder=1)

    # ==========================================
    # 1. PILLAR RECTANGLES (USER & REVIEW)
    # ==========================================
    # Left Pillar: USER (profiles)
    draw_entity(6, 15, 7, 105, "USER", fontsize=16, is_pillar=True)
    # Right Pillar: REVIEW (reviews)
    draw_entity(87, 15, 7, 105, "REVIEW", fontsize=16, is_pillar=True)

    # ==========================================
    # 2. TOP FAN-OUT ATTRIBUTES
    # ==========================================
    # Attributes above USER (y=120 to 127)
    user_attrs = [
        (5.5, 127, "id", True, 3.2, 1.4),
        (13, 127, "full_name", False, 4.2, 1.4),
        (22, 127, "email", False, 3.8, 1.4),
        (30, 127, "role", False, 3.2, 1.4),
        (38, 127, "created_at", False, 4.4, 1.4),
    ]
    for cx, cy, lbl, pk, rx, ry in user_attrs:
        draw_line(9.5, 120, cx, cy - ry)
        draw_attribute(cx, cy, lbl, is_pk=pk, rx=rx, ry=ry)

    # Attributes above REVIEW
    review_attrs_top = [
        (66, 127, "id", True, 3.2, 1.4),
        (75, 127, "project_name", False, 5.0, 1.4),
        (85.5, 127, "source_type", False, 4.8, 1.4),
        (95, 127, "repo_url", False, 4.0, 1.4),
    ]
    for cx, cy, lbl, pk, rx, ry in review_attrs_top:
        draw_line(90.5, 120, cx, cy - ry)
        draw_attribute(cx, cy, lbl, is_pk=pk, rx=rx, ry=ry)

    # ==========================================
    # 3. BOTTOM FAN-OUT ATTRIBUTES (REVIEW)
    # ==========================================
    review_attrs_bot = [
        (64, 7, "health_score", False, 5.0, 1.4),
        (73, 7, "grade", False, 3.2, 1.4),
        (80.5, 7, "status", False, 3.2, 1.4),
        (88, 7, "summary", False, 3.8, 1.4),
        (96, 7, "created_at", False, 4.4, 1.4),
    ]
    for cx, cy, lbl, pk, rx, ry in review_attrs_bot:
        draw_line(90.5, 15, cx, cy + ry)
        draw_attribute(cx, cy, lbl, is_pk=pk, rx=rx, ry=ry)

    # ==========================================
    # 4. TIER 1: REVIEW REPORT
    # ==========================================
    y_t1 = 112
    draw_line(13, y_t1, 23, y_t1)
    ax.text(15, y_t1 + 0.8, "1", fontsize=10, fontweight='bold')
    draw_diamond(27, y_t1, "Downloads", w=9, h=3.6)
    draw_line(31.5, y_t1, 41.5, y_t1)
    ax.text(39.5, y_t1 + 0.8, "N", fontsize=10, fontweight='bold')

    draw_entity(41.5, y_t1 - 2.2, 17, 4.4, "REVIEW REPORT", fontsize=8.5)

    draw_line(58.5, y_t1, 68.5, y_t1, is_double=True)
    ax.text(60.5, y_t1 + 0.8, "N", fontsize=10, fontweight='bold')
    draw_diamond(73, y_t1, "Generates", w=9, h=3.6, is_identifying=True)
    draw_line(77.5, y_t1, 87, y_t1, is_double=True)
    ax.text(84.5, y_t1 + 0.8, "1", fontsize=10, fontweight='bold')

    # Attributes for REVIEW REPORT
    draw_line(45, y_t1 + 2.2, 43, 118.5)
    draw_attribute(43, 119.5, "id", is_pk=True, rx=3.0, ry=1.3)
    draw_line(55, y_t1 + 2.2, 57, 118.5)
    draw_attribute(57, 119.5, "report_type", is_pk=False, rx=4.5, ry=1.3)
    draw_line(45, y_t1 - 2.2, 43, 105.5)
    draw_attribute(43, 104.5, "download_url", is_pk=False, rx=4.8, ry=1.3)
    draw_line(55, y_t1 - 2.2, 57, 105.5)
    draw_attribute(57, 104.5, "created_at", is_pk=False, rx=4.2, ry=1.3)

    # ==========================================
    # 5. TIER 2: SUBMITS / INITIATES (DIRECT RELATIONSHIP)
    # ==========================================
    y_t2 = 96
    draw_line(13, y_t2, 43, y_t2)
    ax.text(16, y_t2 + 0.8, "1", fontsize=10, fontweight='bold')
    draw_diamond(50, y_t2, "Submits / Initiates", w=14, h=4.0)
    draw_line(57, y_t2, 87, y_t2)
    ax.text(84, y_t2 + 0.8, "N", fontsize=10, fontweight='bold')

    # ==========================================
    # 6. TIER 3: SANDBOXES / INSPECTS (WITH RELATIONSHIP ATTRIBUTES)
    # ==========================================
    y_t3 = 82
    draw_line(13, y_t3, 42.5, y_t3)
    ax.text(16, y_t3 + 0.8, "M", fontsize=10, fontweight='bold')
    draw_diamond(50, y_t3, "Sandboxes / Inspects", w=15, h=4.2)
    draw_line(57.5, y_t3, 87, y_t3)
    ax.text(84, y_t3 + 0.8, "N", fontsize=10, fontweight='bold')

    # Attributes branching down from diamond
    draw_line(46, y_t3 - 2.1, 38, 74.5)
    draw_attribute(38, 73.5, "guest_session_id", rx=5.6, ry=1.4, fontsize=7.5)
    draw_line(50, y_t3 - 2.1, 50, 74.5)
    draw_attribute(50, 73.5, "rls_access_role", rx=5.2, ry=1.4, fontsize=7.5)
    draw_line(54, y_t3 - 2.1, 62, 74.5)
    draw_attribute(62, 73.5, "is_authenticated", rx=5.4, ry=1.4, fontsize=7.5)

    # ==========================================
    # 7. TIER 4: REVIEW FILE
    # ==========================================
    y_t4 = 61
    draw_line(13, y_t4, 23.5, y_t4)
    ax.text(16, y_t4 + 0.8, "1", fontsize=10, fontweight='bold')
    draw_diamond(27, y_t4, "Ingests", w=8, h=3.6)
    draw_line(31, y_t4, 41.5, y_t4)
    ax.text(39, y_t4 + 0.8, "N", fontsize=10, fontweight='bold')

    draw_entity(41.5, y_t4 - 2.2, 17, 4.4, "REVIEW FILE", is_weak=True, fontsize=8.5)

    draw_line(58.5, y_t4, 69, y_t4, is_double=True)
    ax.text(61, y_t4 + 0.8, "N", fontsize=10, fontweight='bold')
    draw_diamond(73, y_t4, "Contains", w=8, h=3.6, is_identifying=True)
    draw_line(77, y_t4, 87, y_t4, is_double=True)
    ax.text(84, y_t4 + 0.8, "1", fontsize=10, fontweight='bold')

    # Attributes for REVIEW FILE (3 top, 3 bottom)
    draw_line(44, y_t4 + 2.2, 38, 67.5)
    draw_attribute(38, 68.5, "id", is_pk=True, rx=3.0, ry=1.3)
    draw_line(50, y_t4 + 2.2, 50, 67.5)
    draw_attribute(50, 68.5, "file_path", rx=4.2, ry=1.3)
    draw_line(56, y_t4 + 2.2, 62, 67.5)
    draw_attribute(62, 68.5, "language", rx=3.8, ry=1.3)

    draw_line(44, y_t4 - 2.2, 38, 54.5)
    draw_attribute(38, 53.5, "lines_count", rx=4.2, ry=1.3)
    draw_line(50, y_t4 - 2.2, 50, 54.5)
    draw_attribute(50, 53.5, "issues_count", rx=4.5, ry=1.3)
    draw_line(56, y_t4 - 2.2, 62, 54.5)
    draw_attribute(62, 53.5, "created_at", rx=4.0, ry=1.3)

    # ==========================================
    # 8. TIER 5: REVIEW ISSUE
    # ==========================================
    y_t5 = 41
    draw_line(13, y_t5, 23.5, y_t5)
    ax.text(16, y_t5 + 0.8, "1", fontsize=10, fontweight='bold')
    draw_diamond(27, y_t5, "Remediates", w=9.5, h=3.6)
    draw_line(31.75, y_t5, 41.5, y_t5)
    ax.text(39, y_t5 + 0.8, "N", fontsize=10, fontweight='bold')

    draw_entity(41.5, y_t5 - 2.2, 17, 4.4, "REVIEW ISSUE", is_weak=True, fontsize=8.5)

    draw_line(58.5, y_t5, 68.5, y_t5, is_double=True)
    ax.text(61, y_t5 + 0.8, "N", fontsize=10, fontweight='bold')
    draw_diamond(73, y_t5, "Identifies", w=9, h=3.6, is_identifying=True)
    draw_line(77.5, y_t5, 87, y_t5, is_double=True)
    ax.text(84, y_t5 + 0.8, "1", fontsize=10, fontweight='bold')

    # Attributes for REVIEW ISSUE
    draw_line(44, y_t5 + 2.2, 38, 47.5)
    draw_attribute(38, 48.5, "id", is_pk=True, rx=3.0, ry=1.3)
    draw_line(50, y_t5 + 2.2, 50, 47.5)
    draw_attribute(50, 48.5, "rule_id", rx=3.8, ry=1.3)
    draw_line(56, y_t5 + 2.2, 62, 47.5)
    draw_attribute(62, 48.5, "severity", rx=3.6, ry=1.3)

    draw_line(44, y_t5 - 2.2, 38, 34.5)
    draw_attribute(38, 33.5, "category", rx=3.8, ry=1.3)
    draw_line(50, y_t5 - 2.2, 50, 34.5)
    draw_attribute(50, 33.5, "line_number", rx=4.5, ry=1.3)
    draw_line(56, y_t5 - 2.2, 62, 34.5)
    draw_attribute(62, 33.5, "engine_source", rx=5.0, ry=1.3)

    # ==========================================
    # 9. TIER 6: AI DIAGNOSTICS
    # ==========================================
    y_t6 = 22
    draw_line(13, y_t6, 23.5, y_t6)
    ax.text(16, y_t6 + 0.8, "1", fontsize=10, fontweight='bold')
    draw_diamond(27, y_t6, "Prompts", w=8, h=3.6)
    draw_line(31, y_t6, 41.5, y_t6)
    ax.text(39, y_t6 + 0.8, "N", fontsize=10, fontweight='bold')

    draw_entity(41.5, y_t6 - 2.2, 17, 4.4, "AI DIAGNOSTICS", is_weak=True, fontsize=8.5)

    draw_line(58.5, y_t6, 68.5, y_t6, is_double=True)
    ax.text(61, y_t6 + 0.8, "N", fontsize=10, fontweight='bold')
    draw_diamond(73, y_t6, "Synthesizes", w=9.5, h=3.6, is_identifying=True)
    draw_line(77.5, y_t6, 87, y_t6, is_double=True)
    ax.text(84, y_t6 + 0.8, "1", fontsize=10, fontweight='bold')

    # Attributes for AI DIAGNOSTICS
    draw_line(45, y_t6 + 2.2, 43, 28.5)
    draw_attribute(43, 29.5, "id", is_pk=True, rx=3.0, ry=1.3)
    draw_line(55, y_t6 + 2.2, 57, 28.5)
    draw_attribute(57, 29.5, "model_name", rx=4.6, ry=1.3)
    draw_line(45, y_t6 - 2.2, 43, 15.5)
    draw_attribute(43, 14.5, "tokens_used", rx=4.4, ry=1.3)
    draw_line(55, y_t6 - 2.2, 57, 15.5)
    draw_attribute(57, 14.5, "ast_rules_count", rx=5.2, ry=1.3)

    plt.tight_layout()
    output_png = os.path.join(os.path.dirname(__file__), '..', 'docs', 'recode_er_diagram_chen.png')
    plt.savefig(output_png, dpi=300, facecolor='#ffffff', bbox_inches='tight')
    plt.close()
    print(f"High-resolution PNG saved successfully to: {os.path.abspath(output_png)}")

if __name__ == '__main__':
    draw_chen_er_diagram()
