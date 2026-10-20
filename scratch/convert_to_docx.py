import os
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_shading(cell, color_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_borders(cell, top="CCCCCC", bottom="CCCCCC", left=None, right=None):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    
    borders = {'top': top, 'bottom': bottom}
    if left: borders['left'] = left
    else: borders['left'] = 'none'
    if right: borders['right'] = right
    else: borders['right'] = 'none'
    
    for side, color in borders.items():
        if color == 'none':
            b_elm = parse_xml(f'<w:{side} {nsdecls("w")} w:val="none"/>')
        else:
            b_elm = parse_xml(f'<w:{side} {nsdecls("w")} w:val="single" w:sz="4" w:space="0" w:color="{color}"/>')
        tcBorders.append(b_elm)
    tcPr.append(tcBorders)

def add_styled_paragraph(doc, text, style='Normal', space_before=0, space_after=6, align=WD_ALIGN_PARAGRAPH.LEFT, line_spacing=1.15):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing

    # Process inline bold/italics
    # Regex split by **bold** or *italic* or `code`
    tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**') and len(token) >= 4:
            run = p.add_run(token[2:-2])
            run.bold = True
            run.font.name = 'Times New Roman'
        elif token.startswith('*') and token.endswith('*') and len(token) >= 2:
            run = p.add_run(token[1:-1])
            run.italic = True
            run.font.name = 'Times New Roman'
        elif token.startswith('`') and token.endswith('`') and len(token) >= 2:
            run = p.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(199, 37, 78) # dark magenta/red for inline code
        else:
            run = p.add_run(token)
            run.font.name = 'Times New Roman'
    return p

def convert_md_to_docx(md_path, docx_path):
    doc = Document()

    # Set page layout to A4 with academic margins
    sections = doc.sections
    for s in sections:
        s.page_width = Inches(8.27)
        s.page_height = Inches(11.69)
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.25) # Extra gutter for binding
        s.right_margin = Inches(1.0)

    # Set base Normal style font
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(12)
    normal_style.font.color.rgb = RGBColor(30, 30, 30)

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_code_block = False
    code_block_lines = []
    in_table = False
    table_lines = []

    def flush_table():
        nonlocal in_table, table_lines
        if not table_lines:
            in_table = False
            return
        
        # Parse table rows
        rows_data = []
        for tline in table_lines:
            tline = tline.strip()
            if not tline.startswith('|'):
                continue
            # Check if separator row like |:---|:---|
            if re.match(r'^\|[\s\:\-]+(?:\|[\s\:\-]+)*\|?$', tline):
                continue
            cells = [c.strip() for c in tline.split('|')[1:-1]]
            if cells:
                rows_data.append(cells)
        
        if rows_data:
            num_cols = max(len(r) for r in rows_data)
            table = doc.add_table(rows=len(rows_data), cols=num_cols)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            
            for r_idx, row_cells in enumerate(rows_data):
                for c_idx in range(num_cols):
                    cell = table.cell(r_idx, c_idx)
                    cell_text = row_cells[c_idx] if c_idx < len(row_cells) else ''
                    
                    set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
                    
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_before = Pt(2)
                    p.paragraph_format.space_after = Pt(2)
                    p.paragraph_format.line_spacing = 1.05
                    
                    if r_idx == 0:
                        # Header Row
                        set_cell_shading(cell, "0F172A") # Slate dark
                        set_cell_borders(cell, top="0F172A", bottom="0F172A")
                        tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', cell_text)
                        for token in tokens:
                            if not token: continue
                            if token.startswith('**') and token.endswith('**'):
                                r = p.add_run(token[2:-2])
                            else:
                                r = p.add_run(token)
                            r.bold = True
                            r.font.name = 'Times New Roman'
                            r.font.size = Pt(10.5)
                            r.font.color.rgb = RGBColor(255, 255, 255)
                    else:
                        # Alternating row shading
                        if r_idx % 2 == 1:
                            set_cell_shading(cell, "F8FAFC")
                        else:
                            set_cell_shading(cell, "FFFFFF")
                        set_cell_borders(cell, top="E2E8F0", bottom="E2E8F0")
                        
                        tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', cell_text)
                        for token in tokens:
                            if not token: continue
                            if token.startswith('**') and token.endswith('**'):
                                r = p.add_run(token[2:-2])
                                r.bold = True
                            elif token.startswith('*') and token.endswith('*'):
                                r = p.add_run(token[1:-1])
                                r.italic = True
                            elif token.startswith('`') and token.endswith('`'):
                                r = p.add_run(token[1:-1])
                                r.font.name = 'Consolas'
                                r.font.size = Pt(9.5)
                                r.font.color.rgb = RGBColor(199, 37, 78)
                            else:
                                r = p.add_run(token)
                            r.font.name = 'Times New Roman'
                            r.font.size = Pt(10)
                            r.font.color.rgb = RGBColor(30, 41, 59)
            doc.add_paragraph().paragraph_format.space_after = Pt(4)
        
        table_lines = []
        in_table = False

    def flush_code():
        nonlocal in_code_block, code_block_lines
        if not code_block_lines:
            in_code_block = False
            return
        
        # Add code block as a single cell table with shaded light background
        code_table = doc.add_table(rows=1, cols=1)
        code_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = code_table.cell(0, 0)
        set_cell_shading(cell, "F1F5F9")
        set_cell_borders(cell, top="CBD5E1", bottom="CBD5E1", left="3B82F6", right="CBD5E1")
        set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        
        full_code = "".join(code_block_lines).strip('\n')
        run = p.add_run(full_code)
        run.font.name = 'Consolas'
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(15, 23, 42)
        
        doc.add_paragraph().paragraph_format.space_after = Pt(4)
        code_block_lines = []
        in_code_block = False

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Handle page breaks
        if stripped == '\\pagebreak' or stripped == '\\newpage':
            if in_table: flush_table()
            if in_code_block: flush_code()
            doc.add_page_break()
            i += 1
            continue

        # Handle Code Blocks
        if stripped.startswith('```'):
            if in_code_block:
                flush_code()
            else:
                if in_table: flush_table()
                in_code_block = True
                code_block_lines = []
            i += 1
            continue

        if in_code_block:
            code_block_lines.append(line)
            i += 1
            continue

        # Handle Tables
        if stripped.startswith('|') and stripped.endswith('|'):
            in_table = True
            table_lines.append(line)
            i += 1
            continue
        elif in_table:
            flush_table()

        # Empty lines
        if not stripped:
            i += 1
            continue

        # Horizontal rules
        if stripped in ('---', '***', '___'):
            i += 1
            continue

        # Figures / Diagram captions
        if stripped.startswith('*Figure') or stripped.startswith('[Figure'):
            p = add_styled_paragraph(doc, stripped, space_before=4, space_after=12, align=WD_ALIGN_PARAGRAPH.CENTER)
            p.runs[0].italic = True if p.runs else False
            i += 1
            continue

        # Headings
        if stripped.startswith('# '):
            text = stripped[2:].strip().replace('**', '')
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if ('PROJECT REPORT' in text or 'RAMNIRANJAN' in text or 'INDEX' in text or 'CERTIFICATE' in text) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(8)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(text)
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(15, 23, 42)
            i += 1
            continue

        if stripped.startswith('## '):
            text = stripped[3:].strip().replace('**', '')
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if ('CERTIFICATE' in text or 'ON' in text) else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(text)
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(15)
            run.font.color.rgb = RGBColor(30, 41, 59)
            i += 1
            continue

        if stripped.startswith('### '):
            text = stripped[4:].strip().replace('**', '')
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(text)
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(13)
            run.font.color.rgb = RGBColor(51, 65, 85)
            i += 1
            continue

        if stripped.startswith('#### '):
            text = stripped[5:].strip().replace('**', '')
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(text)
            run.bold = True
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
            run.font.color.rgb = RGBColor(71, 85, 105)
            i += 1
            continue

        # Bullet Lists
        if stripped.startswith('- ') or stripped.startswith('* '):
            bullet_text = stripped[2:].strip()
            add_styled_paragraph(doc, bullet_text, space_before=1, space_after=3, line_spacing=1.15)
            # Add bullet symbol
            p = doc.paragraphs[-1]
            p.paragraph_format.left_indent = Inches(0.25)
            # Prepend bullet
            run_b = p.insert_paragraph_before() # not needed, bullet can be run
            # Better: use style='List Bullet'
            p.style = 'List Bullet'
            i += 1
            continue

        # Numbered Lists
        num_match = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if num_match:
            num_str, item_text = num_match.groups()
            add_styled_paragraph(doc, f"{num_str}. {item_text}", space_before=2, space_after=3, line_spacing=1.15)
            p = doc.paragraphs[-1]
            p.paragraph_format.left_indent = Inches(0.25)
            i += 1
            continue

        # Blockquote
        if stripped.startswith('> '):
            quote_text = stripped[2:].strip()
            p = add_styled_paragraph(doc, quote_text, space_before=4, space_after=6, line_spacing=1.15)
            p.paragraph_format.left_indent = Inches(0.4)
            p.paragraph_format.right_indent = Inches(0.4)
            for r in p.runs:
                r.italic = True
            i += 1
            continue

        # Centered metadata lines for cover page / certificate
        if any(marker in stripped for marker in ['Submitted By', 'Under the Guidance', 'Bachelor of Science', 'Ramniranjan Jhunjhunwala College', 'Affiliated to University', 'Academic Year', 'CERTIFICATE', 'Prof. (Ms.)']):
            add_styled_paragraph(doc, stripped, space_before=2, space_after=4, align=WD_ALIGN_PARAGRAPH.CENTER)
            i += 1
            continue

        # Standard Paragraph
        add_styled_paragraph(doc, stripped, space_before=0, space_after=6, align=WD_ALIGN_PARAGRAPH.JUSTIFY)
        i += 1

    if in_table:
        flush_table()
    if in_code_block:
        flush_code()

    doc.save(docx_path)
    print(f"Successfully generated DOCX report at: {docx_path}")

if __name__ == '__main__':
    md_file = os.path.abspath("docs/RECODE_DISSERTATION_BLACKBOOK.md")
    docx_file = os.path.abspath("docs/RECODE_DISSERTATION_BLACKBOOK.docx")
    convert_md_to_docx(md_file, docx_file)
