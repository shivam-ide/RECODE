import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

def draw_relational_schema():
    fig, ax = plt.subplots(figsize=(14, 10.5), dpi=300)
    ax.set_xlim(0, 110)
    ax.set_ylim(0, 85)
    ax.axis('off')

    # Background
    ax.add_patch(patches.Rectangle((0, 0), 110, 85, facecolor='#f8fafc', edgecolor='none'))

    # Title Banner
    ax.add_patch(patches.Rectangle((4, 78), 102, 5, facecolor='#0f172a', edgecolor='none'))
    ax.text(55, 80.5, "Re:Code — Relational Database Schema & Architecture", color='#ffffff', fontsize=14, fontweight='bold', ha='center', va='center')

    def draw_table(x, y, w, rows, title, title_bg='#1e293b'):
        row_h = 2.7
        total_h = (len(rows) + 1) * row_h
        top_y = y
        # Table container
        ax.add_patch(patches.Rectangle((x, top_y - total_h), w, total_h, facecolor='#ffffff', edgecolor='#334155', linewidth=1.4, zorder=2))
        # Header
        ax.add_patch(patches.Rectangle((x, top_y - row_h), w, row_h, facecolor=title_bg, edgecolor='#334155', linewidth=1.4, zorder=3))
        ax.text(x + w/2, top_y - row_h/2, title, color='#ffffff', fontsize=9.5, fontweight='bold', ha='center', va='center', zorder=4)

        for i, (col_type, col_name, data_type) in enumerate(rows):
            curr_y = top_y - (i + 2) * row_h
            if i % 2 == 1:
                ax.add_patch(patches.Rectangle((x + 0.1, curr_y), w - 0.2, row_h, facecolor='#f1f5f9', edgecolor='none', zorder=2))
            
            # Key indicator
            if col_type == 'PK':
                ax.text(x + 1.2, curr_y + row_h/2, 'PK', color='#b45309', fontsize=8, fontweight='bold', va='center', zorder=4)
            elif col_type == 'FK':
                ax.text(x + 1.2, curr_y + row_h/2, 'FK', color='#0284c7', fontsize=8, fontweight='bold', va='center', zorder=4)
            
            # Column name
            ax.text(x + 4.0, curr_y + row_h/2, col_name, color='#0f172a', fontsize=8, fontweight='semibold', va='center', zorder=4)
            # Data type
            ax.text(x + w - 1.2, curr_y + row_h/2, data_type, color='#64748b', fontsize=7.5, ha='right', va='center', zorder=4)

    # 1. Profiles
    draw_table(6, 74, 25, [
        ('PK', 'id', 'UUID'),
        ('', 'email', 'TEXT (UQ)'),
        ('', 'full_name', 'TEXT'),
        ('', 'role', 'TEXT'),
        ('', 'created_at', 'TIMESTAMPTZ')
    ], 'profiles (USER)')

    # 2. Reviews
    draw_table(42, 74, 28, [
        ('PK', 'id', 'UUID'),
        ('FK', 'user_id', 'UUID (NULL)'),
        ('', 'guest_session_id', 'TEXT (NULL)'),
        ('', 'project_name', 'TEXT'),
        ('', 'source_type', 'TEXT'),
        ('', 'repo_url', 'TEXT'),
        ('', 'health_score', 'NUMERIC(5,2)'),
        ('', 'grade', 'TEXT (A-F)'),
        ('', 'status', 'TEXT'),
        ('', 'partial_mode', 'BOOLEAN'),
        ('', 'created_at', 'TIMESTAMPTZ')
    ], 'reviews (AUDIT SESSION)')

    # 3. Review Reports
    draw_table(6, 48, 25, [
        ('PK', 'id', 'UUID'),
        ('FK', 'review_id', 'UUID'),
        ('', 'report_type', 'TEXT (PDF|SARIF)'),
        ('', 'download_url', 'TEXT'),
        ('', 'created_at', 'TIMESTAMPTZ')
    ], 'review_reports (EXPORTS)')

    # 4. Review Files
    draw_table(78, 74, 26, [
        ('PK', 'id', 'UUID'),
        ('FK', 'review_id', 'UUID'),
        ('', 'file_path', 'TEXT'),
        ('', 'language', 'TEXT'),
        ('', 'lines_count', 'INTEGER'),
        ('', 'issues_count', 'INTEGER'),
        ('', 'created_at', 'TIMESTAMPTZ')
    ], 'review_files (SOURCE FILES)')

    # 5. Review Issues
    draw_table(54, 38, 50, [
        ('PK', 'id', 'UUID'),
        ('FK', 'review_id', 'UUID (FK to reviews)'),
        ('FK', 'file_id', 'UUID (FK to review_files)'),
        ('', 'line_number', 'INTEGER'),
        ('', 'severity', 'TEXT (CRITICAL|HIGH|MED|LOW|INFO)'),
        ('', 'category', 'TEXT (SYNTAX|SECURITY|QUALITY)'),
        ('', 'rule_id', 'TEXT'),
        ('', 'title', 'TEXT'),
        ('', 'engine_source', 'TEXT (STATIC|GEMINI|HYBRID)'),
        ('', 'created_at', 'TIMESTAMPTZ')
    ], 'review_issues (SECURITY VULNERABILITIES & CODE SMELLS)')

    # Relationships Lines
    # Profiles -> Reviews
    ax.plot([31, 42], [67, 67], color='#475569', linewidth=1.8)
    ax.text(36.5, 68, "1 : N", color='#1e293b', fontsize=8.5, fontweight='bold', ha='center')

    # Reviews -> Review Files
    ax.plot([70, 78], [67, 67], color='#475569', linewidth=1.8)
    ax.text(74, 68, "1 : N", color='#1e293b', fontsize=8.5, fontweight='bold', ha='center')

    # Reviews -> Review Reports
    ax.plot([42, 31], [45, 41], color='#475569', linewidth=1.8)
    ax.text(36.5, 44, "1 : N", color='#1e293b', fontsize=8.5, fontweight='bold', ha='center')

    # Reviews -> Review Issues
    ax.plot([56, 56], [41.5, 38], color='#475569', linewidth=1.8)
    ax.text(58, 40, "1 : N", color='#1e293b', fontsize=8.5, fontweight='bold')

    # Review Files -> Review Issues
    ax.plot([91, 91], [52.4, 38], color='#475569', linewidth=1.8)
    ax.text(93, 45, "1 : N", color='#1e293b', fontsize=8.5, fontweight='bold')

    plt.tight_layout()
    output_png = os.path.join(os.path.dirname(__file__), '..', 'docs', 'recode_er_diagram_relational.png')
    plt.savefig(output_png, dpi=300, facecolor='#f8fafc', bbox_inches='tight')
    plt.close()
    print(f"Relational PNG saved: {os.path.abspath(output_png)}")

if __name__ == '__main__':
    draw_relational_schema()
