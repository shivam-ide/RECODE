import os
import xml.etree.ElementTree as ET

def create_er_drawio(output_path="RECODE_ER_DIAGRAM.drawio"):
    mxfile = ET.Element('mxfile', {
        'host': 'app.diagrams.net',
        'modified': '2026-10-17T03:30:00.000Z',
        'agent': 'Antigravity Re:Code Generator',
        'version': '21.0.0',
        'type': 'device'
    })
    
    diagram = ET.SubElement(mxfile, 'diagram', {
        'id': 'ReCode_ER_Model',
        'name': 'ReCode ER Diagram'
    })
    
    graph_model = ET.SubElement(diagram, 'mxGraphModel', {
        'dx': '1600',
        'dy': '1200',
        'grid': '1',
        'gridSize': '10',
        'guides': '1',
        'tooltips': '1',
        'connect': '1',
        'arrows': '1',
        'fold': '1',
        'page': '1',
        'pageScale': '1',
        'pageWidth': '1800',
        'pageHeight': '1400',
        'math': '0',
        'shadow': '0'
    })
    
    root = ET.SubElement(graph_model, 'root')
    
    # Layer 0 & 1
    ET.SubElement(root, 'mxCell', {'id': '0'})
    ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})
    
    cell_id = 2
    def get_id():
        nonlocal cell_id
        cid = str(cell_id)
        cell_id += 1
        return cid

    # Diagram Title Banner
    title_id = get_id()
    ET.SubElement(root, 'mxCell', {
        'id': title_id,
        'value': 'Re:Code — Entity Relationship (ER) Diagram\n(Dual-Engine Automated Code Review & Security Diagnostics Platform)',
        'style': 'text;html=1;strokeColor=#0288D1;fillColor=#E1F5FE;align=center;verticalAlign=middle;rounded=1;fontSize=15;fontStyle=1;fontColor=#01579B;strokeWidth=2;',
        'vertex': '1',
        'parent': '1'
    })
    ET.SubElement(root.find(f".//*[@id='{title_id}']"), 'mxGeometry', {
        'x': '500', 'y': '30', 'width': '650', 'height': '50', 'as': 'geometry'
    })

    # Helper: Add Entity (Rectangle)
    def add_entity(name, x, y, w=160, h=60, fill="#E3F2FD", stroke="#1565C0"):
        eid = get_id()
        cell = ET.SubElement(root, 'mxCell', {
            'id': eid,
            'value': f"&lt;b&gt;{name}&lt;/b&gt;",
            'style': f"rounded=0;whiteSpace=wrap;html=1;fontSize=13;fillColor={fill};strokeColor={stroke};strokeWidth=2;fontColor=#111827;fontFamily=Helvetica;",
            'vertex': '1',
            'parent': '1'
        })
        ET.SubElement(cell, 'mxGeometry', {
            'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'
        })
        return eid, x + w / 2, y + h / 2

    # Helper: Add Attribute (Oval)
    def add_attribute(name, x, y, is_key=False, is_fk=False, w=110, h=40):
        aid = get_id()
        val = f"&lt;u&gt;{name}&lt;/u&gt;" if is_key else name
        if is_key:
            fill, stroke, sw = "#FFF9C4", "#F57F17", "2"
        elif is_fk:
            fill, stroke, sw = "#F3E5F5", "#7B1FA2", "1.5"
        else:
            fill, stroke, sw = "#FFFDE7", "#FBC02D", "1"
            
        cell = ET.SubElement(root, 'mxCell', {
            'id': aid,
            'value': val,
            'style': f"ellipse;whiteSpace=wrap;html=1;fontSize=11;fillColor={fill};strokeColor={stroke};strokeWidth={sw};fontColor=#212121;fontFamily=Helvetica;",
            'vertex': '1',
            'parent': '1'
        })
        ET.SubElement(cell, 'mxGeometry', {
            'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'
        })
        return aid, x + w / 2, y + h / 2

    # Helper: Add Relationship (Diamond)
    def add_relationship(name, x, y, w=100, h=50, fill="#E8F5E9", stroke="#2E7D32"):
        rid = get_id()
        cell = ET.SubElement(root, 'mxCell', {
            'id': rid,
            'value': f"&lt;b&gt;{name}&lt;/b&gt;",
            'style': f"rhombus;whiteSpace=wrap;html=1;fontSize=11;fillColor={fill};strokeColor={stroke};strokeWidth=1.5;fontColor=#1B5E20;fontFamily=Helvetica;",
            'vertex': '1',
            'parent': '1'
        })
        ET.SubElement(cell, 'mxGeometry', {
            'x': str(x), 'y': str(y), 'width': str(w), 'height': str(h), 'as': 'geometry'
        })
        return rid, x + w / 2, y + h / 2

    # Helper: Connect Elements
    def connect(source_id, target_id, label="", style="endArrow=none;html=1;rounded=0;strokeColor=#424242;strokeWidth=1.2;"):
        cid = get_id()
        cell = ET.SubElement(root, 'mxCell', {
            'id': cid,
            'value': label,
            'style': style,
            'edge': '1',
            'parent': '1',
            'source': source_id,
            'target': target_id
        })
        ET.SubElement(cell, 'mxGeometry', {'relative': '1', 'as': 'geometry'})
        return cid

    # =========================================================================
    # 1. ENTITY: profiles
    # =========================================================================
    prof_id, prof_cx, prof_cy = add_entity("PROFILES\n(public.profiles)", 720, 220, w=170, h=65, fill="#E3F2FD", stroke="#1565C0")
    
    # Attributes for profiles
    prof_attrs = [
        ("id (PK)", 540, 110, True, False),
        ("email", 665, 110, False, False),
        ("full_name", 790, 110, False, False),
        ("role", 915, 110, False, False),
        ("created_at", 1040, 110, False, False)
    ]
    for name, ax, ay, is_k, is_f in prof_attrs:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, prof_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # =========================================================================
    # 2. ENTITY: auth.users (Supabase Managed)
    # =========================================================================
    auth_id, auth_cx, auth_cy = add_entity("AUTH.USERS\n(Supabase Auth)", 220, 220, w=160, h=65, fill="#ECEFF1", stroke="#455A64")
    
    # Attributes for auth.users
    auth_attrs = [
        ("id (PK)", 100, 110, True, False),
        ("email", 220, 110, False, False),
        ("raw_meta", 340, 110, False, False)
    ]
    for name, ax, ay, is_k, is_f in auth_attrs:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, auth_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # Relationship: auth.users -> [Syncs / Maps] -> profiles (1 to 1)
    rel_auth_prof, _, _ = add_relationship("Maps To", 490, 228, w=110, h=50)
    connect(auth_id, rel_auth_prof, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_auth_prof, prof_id, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # =========================================================================
    # 3. ENTITY: reviews
    # =========================================================================
    rev_id, rev_cx, rev_cy = add_entity("REVIEWS\n(Audit Sessions)", 720, 480, w=170, h=75, fill="#C8E6C9", stroke="#1B5E20")

    # Relationship: profiles -> [Initiates] -> reviews (1 to M)
    rel_prof_rev, _, _ = add_relationship("Initiates", 755, 360, w=100, h=50)
    connect(prof_id, rel_prof_rev, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_prof_rev, rev_id, "M", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # Attributes for reviews
    rev_attrs_left = [
        ("id (PK)", 530, 400, True, False),
        ("user_id (FK)", 510, 450, False, True),
        ("guest_session_id", 490, 500, False, False),
        ("project_name", 500, 550, False, False),
        ("source_type", 530, 600, False, False),
        ("repo_url", 570, 650, False, False)
    ]
    for name, ax, ay, is_k, is_f in rev_attrs_left:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, rev_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    rev_attrs_right = [
        ("health_score", 980, 400, False, False),
        ("grade", 1000, 450, False, False),
        ("status", 1000, 500, False, False),
        ("partial_mode", 990, 550, False, False),
        ("summary", 970, 600, False, False),
        ("created_at", 930, 650, False, False)
    ]
    for name, ax, ay, is_k, is_f in rev_attrs_right:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, rev_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # =========================================================================
    # 4. ENTITY: review_files
    # =========================================================================
    rf_id, rf_cx, rf_cy = add_entity("REVIEW_FILES\n(Evaluated Files)", 240, 780, w=170, h=65, fill="#FFE0B2", stroke="#E65100")

    # Relationship: reviews -> [Contains] -> review_files (1 to M)
    rel_rev_rf, _, _ = add_relationship("Contains", 480, 660, w=100, h=50)
    connect(rev_id, rel_rev_rf, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_rev_rf, rf_id, "M", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # Attributes for review_files
    rf_attrs = [
        ("id (PK)", 70, 710, True, False),
        ("review_id (FK)", 60, 760, False, True),
        ("file_path", 60, 810, False, False),
        ("language", 70, 860, False, False),
        ("lines_count", 150, 910, False, False),
        ("issues_count", 270, 910, False, False)
    ]
    for name, ax, ay, is_k, is_f in rf_attrs:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, rf_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # =========================================================================
    # 5. ENTITY: review_reports
    # =========================================================================
    rr_id, rr_cx, rr_cy = add_entity("REVIEW_REPORTS\n(PDF / README)", 1210, 780, w=170, h=65, fill="#E1BEE7", stroke="#6A1B9A")

    # Relationship: reviews -> [Exports] -> review_reports (1 to M)
    rel_rev_rr, _, _ = add_relationship("Exports", 1040, 660, w=100, h=50)
    connect(rev_id, rel_rev_rr, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_rev_rr, rr_id, "M", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # Attributes for review_reports
    rr_attrs = [
        ("id (PK)", 1440, 710, True, False),
        ("review_id (FK)", 1450, 760, False, True),
        ("report_type", 1450, 810, False, False),
        ("download_url", 1440, 860, False, False),
        ("created_at", 1330, 910, False, False)
    ]
    for name, ax, ay, is_k, is_f in rr_attrs:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, rr_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # =========================================================================
    # 6. ENTITY: review_issues
    # =========================================================================
    ri_id, ri_cx, ri_cy = add_entity("REVIEW_ISSUES\n(Vulnerabilities & Diffs)", 715, 1050, w=180, h=75, fill="#FFCDD2", stroke="#B71C1C")

    # Relationship: review_files -> [Yields] -> review_issues (1 to M)
    rel_rf_ri, _, _ = add_relationship("Yields", 460, 960, w=100, h=50)
    connect(rf_id, rel_rf_ri, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_rf_ri, ri_id, "M", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # Direct Relationship: reviews -> [Aggregates / Cascade] -> review_issues (1 to M)
    rel_rev_ri, _, _ = add_relationship("Aggregates", 755, 780, w=100, h=50)
    connect(rev_id, rel_rev_ri, "1", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")
    connect(rel_rev_ri, ri_id, "M", style="endArrow=none;html=1;strokeColor=#212121;strokeWidth=1.5;fontStyle=1;fontSize=12;fontColor=#D32F2F;")

    # Attributes for review_issues
    ri_attrs_left = [
        ("id (PK)", 520, 980, True, False),
        ("line_number", 490, 1030, False, False),
        ("severity", 480, 1080, False, False),
        ("category", 490, 1130, False, False),
        ("rule_id", 520, 1180, False, False),
        ("title", 570, 1220, False, False)
    ]
    for name, ax, ay, is_k, is_f in ri_attrs_left:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, ri_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    ri_attrs_right = [
        ("description", 1010, 980, False, False),
        ("remediation", 1030, 1030, False, False),
        ("diff_before", 1040, 1080, False, False),
        ("diff_after", 1030, 1130, False, False),
        ("engine_source", 1010, 1180, False, False),
        ("created_at", 960, 1220, False, False)
    ]
    for name, ax, ay, is_k, is_f in ri_attrs_right:
        aid, _, _ = add_attribute(name, ax, ay, is_k, is_f)
        connect(aid, ri_id, style="endArrow=none;html=1;strokeColor=#9E9E9E;strokeWidth=1;")

    # Write formatted XML
    tree = ET.ElementTree(mxfile)
    ET.indent(tree, space="  ", level=0)
    tree.write(output_path, encoding='utf-8', xml_declaration=True)
    print(f"Generated Draw.io ER Diagram successfully at: {output_path}")

if __name__ == "__main__":
    create_er_drawio("RECODE_ER_DIAGRAM.drawio")
    # Also save a copy in docs/
    create_er_drawio("docs/RECODE_ER_DIAGRAM.drawio")
