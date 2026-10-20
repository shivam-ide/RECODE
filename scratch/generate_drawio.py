import xml.etree.ElementTree as ET
import os

def build_drawio_file():
    # Root element
    mxfile = ET.Element('mxfile', host="app.diagrams.net", modified="2026-10-21T04:20:00.000Z", agent="ReCode ER Generator", version="24.0.0", type="device")

    # =========================================================================
    # PAGE 1: Chen Notation ER Diagram
    # =========================================================================
    diagram1 = ET.SubElement(mxfile, 'diagram', id="recode-chen-er", name="ReCode Chen ER Diagram")
    model1 = ET.SubElement(diagram1, 'mxGraphModel', dx="1400", dy="1800", grid="1", gridSize="10", guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth="960", pageHeight="1380", background="#ffffff", math="0", shadow="0")
    root1 = ET.SubElement(model1, 'root')

    # Base cells
    ET.SubElement(root1, 'mxCell', id="0")
    ET.SubElement(root1, 'mxCell', id="1", parent="0")

    cell_id_counter = 100
    def get_id():
        nonlocal cell_id_counter
        cell_id_counter += 1
        return f"cell_{cell_id_counter}"

    # Helper: Add Entity (Rectangle)
    def add_entity(x, y, w, h, text, is_weak=False, is_pillar=False):
        cid = get_id()
        if is_pillar:
            style = "rounded=0;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=2;fillColor=#ffffff;fontFamily=Helvetica;fontSize=18;fontStyle=1;letterSpacing=2;"
        elif is_weak:
            style = "rounded=0;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=2;fillColor=#ffffff;fontFamily=Helvetica;fontSize=13;fontStyle=1;shape=ext;double=1;"
        else:
            style = "rounded=0;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=2;fillColor=#ffffff;fontFamily=Helvetica;fontSize=13;fontStyle=1;"
        
        cell = ET.SubElement(root1, 'mxCell', id=cid, value=f"<b>{text}</b>", style=style, vertex="1", parent="1")
        ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
        return cid

    # Helper: Add Diamond (Relationship)
    def add_relationship(x, y, w, h, text, is_identifying=False):
        cid = get_id()
        if is_identifying:
            style = "rhombus;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=2;fillColor=#ffffff;fontFamily=Helvetica;fontSize=12;fontStyle=1;shape=doubleRhombus;"
        else:
            style = "rhombus;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=1.8;fillColor=#ffffff;fontFamily=Helvetica;fontSize=12;fontStyle=1;"
        cell = ET.SubElement(root1, 'mxCell', id=cid, value=text, style=style, vertex="1", parent="1")
        ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
        return cid

    # Helper: Add Oval (Attribute)
    def add_attribute(x, y, w, h, text, is_pk=False):
        cid = get_id()
        val = f"<u><b>{text}</b></u>" if is_pk else text
        style = "ellipse;whiteSpace=wrap;html=1;strokeColor=#111827;strokeWidth=1.5;fillColor=#ffffff;fontFamily=Helvetica;fontSize=11;"
        cell = ET.SubElement(root1, 'mxCell', id=cid, value=val, style=style, vertex="1", parent="1")
        ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(h), **{'as': 'geometry'})
        return cid

    # Helper: Add Connector Edge
    def add_connector(source_id, target_id, label="", is_double=False):
        cid = get_id()
        if is_double:
            style = "endArrow=none;html=1;strokeColor=#111827;strokeWidth=2;shape=link;fontFamily=Helvetica;fontSize=12;fontStyle=1;"
        else:
            style = "endArrow=none;html=1;strokeColor=#111827;strokeWidth=1.5;fontFamily=Helvetica;fontSize=12;fontStyle=1;"
        cell = ET.SubElement(root1, 'mxCell', id=cid, value=label, style=style, edge="1", parent="1", source=source_id, target=target_id)
        ET.SubElement(cell, 'mxGeometry', relative="1", **{'as': 'geometry'})
        return cid

    # 1. PILLARS
    user_pillar = add_entity(60, 130, 65, 1020, "USER", is_pillar=True)
    review_pillar = add_entity(835, 130, 65, 1020, "REVIEW", is_pillar=True)

    # 2. TOP ATTRIBUTES - USER
    u_attrs = [
        (25, 45, 60, 32, "id", True),
        (95, 45, 75, 32, "full_name", False),
        (180, 45, 65, 32, "email", False),
        (255, 45, 55, 32, "role", False),
        (320, 45, 75, 32, "created_at", False),
    ]
    for x, y, w, h, lbl, pk in u_attrs:
        aid = add_attribute(x, y, w, h, lbl, pk)
        add_connector(user_pillar, aid)

    # 3. TOP ATTRIBUTES - REVIEW
    r_attrs_top = [
        (610, 45, 60, 32, "id", True),
        (680, 45, 95, 32, "project_name", False),
        (785, 45, 85, 32, "source_type", False),
        (880, 45, 75, 32, "repo_url", False),
    ]
    for x, y, w, h, lbl, pk in r_attrs_top:
        aid = add_attribute(x, y, w, h, lbl, pk)
        add_connector(review_pillar, aid)

    # 4. BOTTOM ATTRIBUTES - REVIEW
    r_attrs_bot = [
        (595, 1200, 90, 32, "health_score", False),
        (695, 1200, 55, 32, "grade", False),
        (760, 1200, 55, 32, "status", False),
        (825, 1200, 70, 32, "summary", False),
        (905, 1200, 75, 32, "created_at", False),
    ]
    for x, y, w, h, lbl, pk in r_attrs_bot:
        aid = add_attribute(x, y, w, h, lbl, pk)
        add_connector(review_pillar, aid)

    # 5. TIER 1: REVIEW REPORT
    t1_rel_left = add_relationship(210, 195, 100, 50, "Downloads")
    t1_entity = add_entity(390, 195, 180, 50, "REVIEW REPORT")
    t1_rel_right = add_relationship(650, 195, 100, 50, "Generates", is_identifying=True)
    add_connector(user_pillar, t1_rel_left, "1")
    add_connector(t1_rel_left, t1_entity, "N")
    add_connector(t1_entity, t1_rel_right, "N", is_double=True)
    add_connector(t1_rel_right, review_pillar, "1", is_double=True)

    # Tier 1 Attributes
    a1 = add_attribute(380, 125, 60, 32, "id", True)
    a2 = add_attribute(510, 125, 85, 32, "report_type", False)
    a3 = add_attribute(365, 275, 95, 32, "download_url", False)
    a4 = add_attribute(500, 275, 80, 32, "created_at", False)
    add_connector(t1_entity, a1)
    add_connector(t1_entity, a2)
    add_connector(t1_entity, a3)
    add_connector(t1_entity, a4)

    # 6. TIER 2: SUBMITS / INITIATES
    t2_rel = add_relationship(400, 345, 160, 60, "Submits / Initiates")
    add_connector(user_pillar, t2_rel, "1")
    add_connector(t2_rel, review_pillar, "N")

    # 7. TIER 3: SANDBOXES / INSPECTS
    t3_rel = add_relationship(395, 475, 170, 60, "Sandboxes / Inspects")
    add_connector(user_pillar, t3_rel, "M")
    add_connector(t3_rel, review_pillar, "N")
    # Attributes on relationship
    a_sb1 = add_attribute(270, 565, 125, 36, "guest_session_id", False)
    a_sb2 = add_attribute(415, 565, 115, 36, "rls_access_role", False)
    a_sb3 = add_attribute(550, 565, 120, 36, "is_authenticated", False)
    add_connector(t3_rel, a_sb1)
    add_connector(t3_rel, a_sb2)
    add_connector(t3_rel, a_sb3)

    # 8. TIER 4: REVIEW FILE
    t4_rel_left = add_relationship(210, 680, 95, 50, "Ingests")
    t4_entity = add_entity(390, 680, 180, 50, "REVIEW FILE", is_weak=True)
    t4_rel_right = add_relationship(650, 680, 95, 50, "Contains", is_identifying=True)
    add_connector(user_pillar, t4_rel_left, "1")
    add_connector(t4_rel_left, t4_entity, "N")
    add_connector(t4_entity, t4_rel_right, "N", is_double=True)
    add_connector(t4_rel_right, review_pillar, "1", is_double=True)

    # Tier 4 Attributes (3 top, 3 bottom)
    af1 = add_attribute(350, 610, 60, 32, "id", True)
    af2 = add_attribute(445, 610, 75, 32, "file_path", False)
    af3 = add_attribute(545, 610, 70, 32, "language", False)
    af4 = add_attribute(335, 755, 80, 32, "lines_count", False)
    af5 = add_attribute(440, 755, 85, 32, "issues_count", False)
    af6 = add_attribute(545, 755, 75, 32, "created_at", False)
    add_connector(t4_entity, af1)
    add_connector(t4_entity, af2)
    add_connector(t4_entity, af3)
    add_connector(t4_entity, af4)
    add_connector(t4_entity, af5)
    add_connector(t4_entity, af6)

    # 9. TIER 5: REVIEW ISSUE
    t5_rel_left = add_relationship(205, 865, 105, 50, "Remediates")
    t5_entity = add_entity(390, 865, 180, 50, "REVIEW ISSUE", is_weak=True)
    t5_rel_right = add_relationship(650, 865, 100, 50, "Identifies", is_identifying=True)
    add_connector(user_pillar, t5_rel_left, "1")
    add_connector(t5_rel_left, t5_entity, "N")
    add_connector(t5_entity, t5_rel_right, "N", is_double=True)
    add_connector(t5_rel_right, review_pillar, "1", is_double=True)

    # Tier 5 Attributes
    ai1 = add_attribute(350, 795, 60, 32, "id", True)
    ai2 = add_attribute(445, 795, 70, 32, "rule_id", False)
    ai3 = add_attribute(545, 795, 65, 32, "severity", False)
    ai4 = add_attribute(340, 940, 70, 32, "category", False)
    ai5 = add_attribute(435, 940, 80, 32, "line_number", False)
    ai6 = add_attribute(535, 940, 95, 32, "engine_source", False)
    add_connector(t5_entity, ai1)
    add_connector(t5_entity, ai2)
    add_connector(t5_entity, ai3)
    add_connector(t5_entity, ai4)
    add_connector(t5_entity, ai5)
    add_connector(t5_entity, ai6)

    # 10. TIER 6: AI DIAGNOSTICS
    t6_rel_left = add_relationship(210, 1050, 95, 50, "Prompts")
    t6_entity = add_entity(390, 1050, 180, 50, "AI DIAGNOSTICS", is_weak=True)
    t6_rel_right = add_relationship(645, 1050, 105, 50, "Synthesizes", is_identifying=True)
    add_connector(user_pillar, t6_rel_left, "1")
    add_connector(t6_rel_left, t6_entity, "N")
    add_connector(t6_entity, t6_rel_right, "N", is_double=True)
    add_connector(t6_rel_right, review_pillar, "1", is_double=True)

    # Tier 6 Attributes
    ad1 = add_attribute(380, 980, 60, 32, "id", True)
    ad2 = add_attribute(510, 980, 85, 32, "model_name", False)
    ad3 = add_attribute(370, 1125, 85, 32, "tokens_used", False)
    ad4 = add_attribute(490, 1125, 100, 32, "ast_rules_count", False)
    add_connector(t6_entity, ad1)
    add_connector(t6_entity, ad2)
    add_connector(t6_entity, ad3)
    add_connector(t6_entity, ad4)


    # =========================================================================
    # PAGE 2: Relational Database Schema (Crow's Foot Tables)
    # =========================================================================
    diagram2 = ET.SubElement(mxfile, 'diagram', id="recode-relational-schema", name="ReCode Relational Schema")
    model2 = ET.SubElement(diagram2, 'mxGraphModel', dx="1200", dy="900", grid="1", gridSize="10", guides="1", tooltips="1", connect="1", arrows="1", fold="1", page="1", pageScale="1", pageWidth="1100", pageHeight="850", background="#f8fafc", math="0", shadow="0")
    root2 = ET.SubElement(model2, 'root')

    ET.SubElement(root2, 'mxCell', id="r0")
    ET.SubElement(root2, 'mxCell', id="r1", parent="r0")

    def add_table_entity(x, y, w, title, rows):
        row_h = 26
        total_h = 30 + len(rows) * row_h
        table_id = get_id()
        table_style = "swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;fillColor=#1e293b;fontColor=#ffffff;strokeColor=#334155;rounded=1;arcSize=4;"
        tbl = ET.SubElement(root2, 'mxCell', id=table_id, value=title, style=table_style, vertex="1", parent="r1")
        ET.SubElement(tbl, 'mxGeometry', x=str(x), y=str(y), width=str(w), height=str(total_h), **{'as': 'geometry'})

        for i, (ktype, col_name, dtype) in enumerate(rows):
            rid = get_id()
            bg = "#f1f5f9" if i % 2 == 1 else "#ffffff"
            rstyle = f"text;strokeColor=none;fillColor={bg};align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;"
            
            kprefix = ""
            if ktype == "PK":
                kprefix = "<font color='#b45309'><b>PK</b></font> "
            elif ktype == "FK":
                kprefix = "<font color='#0284c7'><b>FK</b></font> "
            
            val = f"{kprefix}<b>{col_name}</b> <font color='#64748b' style='float:right'>{dtype}</font>"
            row_cell = ET.SubElement(root2, 'mxCell', id=rid, value=val, style=rstyle, vertex="1", parent=table_id)
            ET.SubElement(row_cell, 'mxGeometry', y=str(30 + i * row_h), width=str(w), height=str(row_h), **{'as': 'geometry'})

        return table_id

    # 1. profiles
    t_prof = add_table_entity(40, 80, 260, "profiles (USER)", [
        ("PK", "id", "UUID"),
        ("", "email", "TEXT (UQ)"),
        ("", "full_name", "TEXT"),
        ("", "role", "TEXT"),
        ("", "created_at", "TIMESTAMPTZ"),
    ])

    # 2. reviews
    t_rev = add_table_entity(380, 80, 300, "reviews (AUDIT SESSION)", [
        ("PK", "id", "UUID"),
        ("FK", "user_id", "UUID (NULL)"),
        ("", "guest_session_id", "TEXT (NULL)"),
        ("", "project_name", "TEXT"),
        ("", "source_type", "TEXT (direct|github)"),
        ("", "repo_url", "TEXT"),
        ("", "health_score", "NUMERIC(5,2)"),
        ("", "grade", "TEXT (A-F)"),
        ("", "status", "TEXT"),
        ("", "partial_mode", "BOOLEAN"),
        ("", "created_at", "TIMESTAMPTZ"),
    ])

    # 3. review_reports
    t_rep = add_table_entity(40, 380, 260, "review_reports (EXPORTS)", [
        ("PK", "id", "UUID"),
        ("FK", "review_id", "UUID"),
        ("", "report_type", "TEXT (PDF|SARIF)"),
        ("", "download_url", "TEXT"),
        ("", "created_at", "TIMESTAMPTZ"),
    ])

    # 4. review_files
    t_files = add_table_entity(760, 80, 270, "review_files (SOURCE FILES)", [
        ("PK", "id", "UUID"),
        ("FK", "review_id", "UUID"),
        ("", "file_path", "TEXT"),
        ("", "language", "TEXT"),
        ("", "lines_count", "INTEGER"),
        ("", "issues_count", "INTEGER"),
        ("", "created_at", "TIMESTAMPTZ"),
    ])

    # 5. review_issues
    t_issues = add_table_entity(520, 480, 510, "review_issues (SECURITY VULNERABILITIES & CODE SMELLS)", [
        ("PK", "id", "UUID"),
        ("FK", "review_id", "UUID (FK to reviews)"),
        ("FK", "file_id", "UUID (FK to review_files)"),
        ("", "line_number", "INTEGER"),
        ("", "severity", "TEXT (CRITICAL|HIGH|MED|LOW|INFO)"),
        ("", "category", "TEXT (SYNTAX|SECURITY|QUALITY)"),
        ("", "rule_id", "TEXT"),
        ("", "title", "TEXT"),
        ("", "diff_before / diff_after", "TEXT"),
        ("", "engine_source", "TEXT (STATIC|GEMINI|HYBRID)"),
        ("", "created_at", "TIMESTAMPTZ"),
    ])

    def add_rel_edge(src, tgt, label):
        eid = get_id()
        style = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.8;fontFamily=Helvetica;fontSize=11;fontStyle=1;startArrow=ERone;endArrow=ERmany;"
        e = ET.SubElement(root2, 'mxCell', id=eid, value=label, style=style, edge="1", parent="r1", source=src, target=tgt)
        ET.SubElement(e, 'mxGeometry', relative="1", **{'as': 'geometry'})

    add_rel_edge(t_prof, t_rev, "1 : N")
    add_rel_edge(t_rev, t_files, "1 : N")
    add_rel_edge(t_rev, t_rep, "1 : N")
    add_rel_edge(t_rev, t_issues, "1 : N")
    add_rel_edge(t_files, t_issues, "1 : N")

    # Save to file
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'docs')
    out_file = os.path.join(out_dir, 'recode_er_diagram.drawio')
    
    xml_str = ET.tostring(mxfile, encoding='utf-8', method='xml').decode('utf-8')
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n' + xml_str)

    print(f"Draw.io file generated successfully at: {os.path.abspath(out_file)}")

if __name__ == '__main__':
    build_drawio_file()
