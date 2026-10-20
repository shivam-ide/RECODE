import os

html_path = os.path.join(os.path.dirname(__file__), 'render_out.html')
out_svg = os.path.join(os.path.dirname(__file__), '..', 'docs', 'recode_class_diagram.svg')

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('<svg id="test-id"')
if start != -1:
    end = content.find('</svg>', start) + 6
    svg_code = content[start:end]
    svg_code = svg_code.replace('test-id', 'recode-class-diagram')
    with open(out_svg, 'w', encoding='utf-8') as out:
        out.write('<?xml version="1.0" encoding="UTF-8"?>\n' + svg_code)
    print(f'Saved docs/recode_class_diagram.svg! Size: {len(svg_code)} bytes')
else:
    print('SVG not found')
