const fs = require('fs');
const path = require('path');

function createErDiagramSvg() {
  const width = 1000;
  const height = 1360;

  const strokeColor = '#111827';
  const fillColor = '#ffffff';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      .entity-rect { fill: #ffffff; stroke: ${strokeColor}; stroke-width: 1.8; }
      .weak-entity-rect { fill: #ffffff; stroke: ${strokeColor}; stroke-width: 1.6; }
      .diamond { fill: #ffffff; stroke: ${strokeColor}; stroke-width: 1.8; }
      .attribute-oval { fill: #ffffff; stroke: ${strokeColor}; stroke-width: 1.4; }
      .link-line { stroke: ${strokeColor}; stroke-width: 1.4; fill: none; }
      .text-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 13.5px; font-weight: 700; fill: #111827; text-anchor: middle; dominant-baseline: central; }
      .text-rel { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 11.5px; font-weight: 600; fill: #111827; text-anchor: middle; dominant-baseline: central; }
      .text-attr { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 10px; font-weight: 500; fill: #1f2937; text-anchor: middle; dominant-baseline: central; }
      .text-pk { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 10px; font-weight: 700; fill: #111827; text-anchor: middle; dominant-baseline: central; text-decoration: underline; }
      .text-card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 13px; font-weight: 700; fill: #111827; text-anchor: middle; dominant-baseline: central; }
      .text-pillar { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 2.5px; fill: #111827; text-anchor: middle; dominant-baseline: central; }
    </style>
  </defs>

  <!-- Background Canvas -->
  <rect width="${width}" height="${height}" fill="#ffffff"/>

  <!-- ========================================== -->
  <!-- 1. CONNECTOR LINES & RELATIONSHIPS LAYER   -->
  <!-- ========================================== -->

  <!-- Top Fan-out lines for USER (profiles) -->
  <line x1="85" y1="140" x2="50" y2="71" class="link-line" />
  <line x1="85" y1="140" x2="120" y2="71" class="link-line" />
  <line x1="85" y1="140" x2="195" y2="71" class="link-line" />
  <line x1="85" y1="140" x2="265" y2="71" class="link-line" />
  <line x1="85" y1="140" x2="340" y2="71" class="link-line" />

  <!-- Top Fan-out lines for REVIEW (reviews) -->
  <line x1="915" y1="140" x2="680" y2="71" class="link-line" />
  <line x1="915" y1="140" x2="765" y2="71" class="link-line" />
  <line x1="915" y1="140" x2="855" y2="71" class="link-line" />
  <line x1="915" y1="140" x2="940" y2="71" class="link-line" />

  <!-- Bottom Fan-out lines for REVIEW (reviews) -->
  <line x1="915" y1="1180" x2="665" y2="1254" class="link-line" />
  <line x1="915" y1="1180" x2="750" y2="1254" class="link-line" />
  <line x1="915" y1="1180" x2="815" y2="1254" class="link-line" />
  <line x1="915" y1="1180" x2="885" y2="1254" class="link-line" />
  <line x1="915" y1="1180" x2="955" y2="1254" class="link-line" />

  <!-- LEVEL 1: USER -> Downloads -> REVIEW REPORT = Generates = REVIEW -->
  <line x1="120" y1="210" x2="210" y2="210" class="link-line" />
  <line x1="280" y1="210" x2="425" y2="210" class="link-line" />
  <!-- Generates: Double line for identifying relationship -->
  <line x1="575" y1="208" x2="675" y2="208" class="link-line" />
  <line x1="575" y1="212" x2="675" y2="212" class="link-line" />
  <line x1="755" y1="208" x2="880" y2="208" class="link-line" />
  <line x1="755" y1="212" x2="880" y2="212" class="link-line" />
  <!-- Attributes for REVIEW REPORT -->
  <line x1="455" y1="192" x2="435" y2="156" class="link-line" />
  <line x1="545" y1="192" x2="565" y2="156" class="link-line" />
  <line x1="455" y1="228" x2="435" y2="264" class="link-line" />
  <line x1="545" y1="228" x2="565" y2="264" class="link-line" />

  <!-- LEVEL 2: Direct Submits / Initiates Relationship -->
  <line x1="120" y1="370" x2="430" y2="370" class="link-line" />
  <line x1="570" y1="370" x2="880" y2="370" class="link-line" />

  <!-- LEVEL 3: Sandboxes / Inspects Relationship with 3 attributes -->
  <line x1="120" y1="490" x2="420" y2="490" class="link-line" />
  <line x1="580" y1="490" x2="880" y2="490" class="link-line" />
  <line x1="460" y1="510" x2="385" y2="559" class="link-line" />
  <line x1="500" y1="518" x2="500" y2="559" class="link-line" />
  <line x1="540" y1="510" x2="615" y2="559" class="link-line" />

  <!-- LEVEL 4: USER -> Ingests -> REVIEW FILE = Contains = REVIEW -->
  <line x1="120" y1="700" x2="205" y2="700" class="link-line" />
  <line x1="285" y1="700" x2="422" y2="700" class="link-line" />
  <!-- Double lines for Contains -->
  <line x1="578" y1="698" x2="675" y2="698" class="link-line" />
  <line x1="578" y1="702" x2="675" y2="702" class="link-line" />
  <line x1="755" y1="698" x2="880" y2="698" class="link-line" />
  <line x1="755" y1="702" x2="880" y2="702" class="link-line" />
  <!-- Attributes for REVIEW FILE -->
  <line x1="445" y1="680" x2="385" y2="651" class="link-line" />
  <line x1="500" y1="680" x2="500" y2="651" class="link-line" />
  <line x1="555" y1="680" x2="615" y2="651" class="link-line" />
  <line x1="445" y1="720" x2="385" y2="749" class="link-line" />
  <line x1="500" y1="720" x2="500" y2="749" class="link-line" />
  <line x1="555" y1="720" x2="615" y2="749" class="link-line" />

  <!-- LEVEL 5: USER -> Remediates -> REVIEW ISSUE = Identifies = REVIEW -->
  <line x1="120" y1="890" x2="200" y2="890" class="link-line" />
  <line x1="290" y1="890" x2="420" y2="890" class="link-line" />
  <!-- Double lines for Identifies -->
  <line x1="580" y1="888" x2="675" y2="888" class="link-line" />
  <line x1="580" y1="892" x2="675" y2="892" class="link-line" />
  <line x1="755" y1="888" x2="880" y2="888" class="link-line" />
  <line x1="755" y1="892" x2="880" y2="892" class="link-line" />
  <!-- Attributes for REVIEW ISSUE -->
  <line x1="445" y1="870" x2="385" y2="841" class="link-line" />
  <line x1="500" y1="870" x2="500" y2="841" class="link-line" />
  <line x1="555" y1="870" x2="615" y2="841" class="link-line" />
  <line x1="445" y1="910" x2="385" y2="939" class="link-line" />
  <line x1="500" y1="910" x2="500" y2="939" class="link-line" />
  <line x1="555" y1="910" x2="615" y2="939" class="link-line" />

  <!-- LEVEL 6: USER -> Prompts -> AI DIAGNOSTICS = Synthesizes = REVIEW -->
  <line x1="120" y1="1080" x2="205" y2="1080" class="link-line" />
  <line x1="285" y1="1080" x2="420" y2="1080" class="link-line" />
  <!-- Double lines for Synthesizes -->
  <line x1="580" y1="1078" x2="675" y2="1078" class="link-line" />
  <line x1="580" y1="1082" x2="675" y2="1082" class="link-line" />
  <line x1="755" y1="1078" x2="880" y2="1078" class="link-line" />
  <line x1="755" y1="1082" x2="880" y2="1082" class="link-line" />
  <!-- Attributes for AI DIAGNOSTICS -->
  <line x1="460" y1="1060" x2="435" y2="1031" class="link-line" />
  <line x1="540" y1="1060" x2="565" y2="1031" class="link-line" />
  <line x1="460" y1="1100" x2="435" y2="1129" class="link-line" />
  <line x1="540" y1="1100" x2="565" y2="1129" class="link-line" />

  <!-- ========================================== -->
  <!-- 2. PILLAR RECTANGLES (USER & REVIEW)      -->
  <!-- ========================================== -->

  <!-- Left Pillar: USER (profiles) -->
  <rect x="50" y="140" width="70" height="1040" class="entity-rect" />
  <text x="85" y="660" class="text-pillar">USER</text>

  <!-- Right Pillar: REVIEW (reviews) -->
  <rect x="880" y="140" width="70" height="1040" class="entity-rect" />
  <text x="915" y="660" class="text-pillar">REVIEW</text>

  <!-- ========================================== -->
  <!-- 3. INTERMEDIATE ENTITY BOXES              -->
  <!-- ========================================== -->

  <!-- Level 1 Entity: REVIEW REPORT -->
  <rect x="425" y="192" width="150" height="36" class="entity-rect" />
  <text x="500" y="210" class="text-title">REVIEW REPORT</text>

  <!-- Level 4 Entity: REVIEW FILE (Double border for weak entity) -->
  <rect x="422" y="680" width="156" height="40" class="weak-entity-rect" />
  <rect x="426" y="684" width="148" height="32" class="weak-entity-rect" />
  <text x="500" y="700" class="text-title">REVIEW FILE</text>

  <!-- Level 5 Entity: REVIEW ISSUE (Double border for weak entity) -->
  <rect x="420" y="870" width="160" height="40" class="weak-entity-rect" />
  <rect x="424" y="874" width="152" height="32" class="weak-entity-rect" />
  <text x="500" y="890" class="text-title">REVIEW ISSUE</text>

  <!-- Level 6 Entity: AI DIAGNOSTICS (Double border) -->
  <rect x="420" y="1060" width="160" height="40" class="weak-entity-rect" />
  <rect x="424" y="1064" width="152" height="32" class="weak-entity-rect" />
  <text x="500" y="1080" class="text-title">AI DIAGNOSTICS</text>

  <!-- ========================================== -->
  <!-- 4. RELATIONSHIP DIAMONDS                   -->
  <!-- ========================================== -->

  <!-- Level 1 Left Diamond: Downloads -->
  <polygon points="245,190 280,210 245,230 210,210" class="diamond" />
  <text x="245" y="210" class="text-rel">Downloads</text>
  <!-- Level 1 Right Diamond: Generates (Double diamond) -->
  <polygon points="715,188 755,210 715,232 675,210" class="diamond" />
  <polygon points="715,192 749,210 715,228 681,210" class="diamond" />
  <text x="715" y="210" class="text-rel">Generates</text>

  <!-- Level 2 Diamond: Submits / Initiates -->
  <polygon points="500,345 570,370 500,395 430,370" class="diamond" />
  <text x="500" y="370" class="text-rel">Submits / Initiates</text>

  <!-- Level 3 Diamond: Sandboxes / Inspects -->
  <polygon points="500,462 580,490 500,518 420,490" class="diamond" />
  <text x="500" y="490" class="text-rel">Sandboxes / Inspects</text>

  <!-- Level 4 Left Diamond: Ingests -->
  <polygon points="245,680 285,700 245,720 205,700" class="diamond" />
  <text x="245" y="700" class="text-rel">Ingests</text>
  <!-- Level 4 Right Diamond: Contains (Double diamond) -->
  <polygon points="715,678 755,700 715,722 675,700" class="diamond" />
  <polygon points="715,682 749,700 715,718 681,700" class="diamond" />
  <text x="715" y="700" class="text-rel">Contains</text>

  <!-- Level 5 Left Diamond: Remediates -->
  <polygon points="245,870 290,890 245,910 200,890" class="diamond" />
  <text x="245" y="890" class="text-rel">Remediates</text>
  <!-- Level 5 Right Diamond: Identifies (Double diamond) -->
  <polygon points="715,868 755,890 715,912 675,890" class="diamond" />
  <polygon points="715,872 749,890 715,908 681,890" class="diamond" />
  <text x="715" y="890" class="text-rel">Identifies</text>

  <!-- Level 6 Left Diamond: Prompts -->
  <polygon points="245,1060 285,1080 245,1100 205,1080" class="diamond" />
  <text x="245" y="1080" class="text-rel">Prompts</text>
  <!-- Level 6 Right Diamond: Synthesizes (Double diamond) -->
  <polygon points="715,1058 755,1080 715,1102 675,1080" class="diamond" />
  <polygon points="715,1062 749,1080 715,1098 681,1080" class="diamond" />
  <text x="715" y="1080" class="text-rel">Synthesizes</text>

  <!-- ========================================== -->
  <!-- 5. CARDINALITY LABELS                      -->
  <!-- ========================================== -->

  <!-- Level 1 -->
  <text x="145" y="200" class="text-card">1</text>
  <text x="400" y="200" class="text-card">N</text>
  <text x="600" y="200" class="text-card">N</text>
  <text x="860" y="200" class="text-card">1</text>

  <!-- Level 2 -->
  <text x="145" y="360" class="text-card">1</text>
  <text x="860" y="360" class="text-card">N</text>

  <!-- Level 3 -->
  <text x="145" y="480" class="text-card">M</text>
  <text x="860" y="480" class="text-card">N</text>

  <!-- Level 4 -->
  <text x="145" y="690" class="text-card">1</text>
  <text x="400" y="690" class="text-card">N</text>
  <text x="600" y="690" class="text-card">N</text>
  <text x="860" y="690" class="text-card">1</text>

  <!-- Level 5 -->
  <text x="145" y="880" class="text-card">1</text>
  <text x="400" y="880" class="text-card">N</text>
  <text x="600" y="880" class="text-card">N</text>
  <text x="860" y="880" class="text-card">1</text>

  <!-- Level 6 -->
  <text x="145" y="1070" class="text-card">1</text>
  <text x="400" y="1070" class="text-card">N</text>
  <text x="600" y="1070" class="text-card">N</text>
  <text x="860" y="1070" class="text-card">1</text>

  <!-- ========================================== -->
  <!-- 6. ATTRIBUTE OVALS                         -->
  <!-- ========================================== -->

  <!-- Top Attributes: USER (profiles) -->
  <ellipse cx="50" cy="55" rx="30" ry="16" class="attribute-oval" />
  <text x="50" y="55" class="text-pk">id</text>

  <ellipse cx="120" cy="55" rx="34" ry="16" class="attribute-oval" />
  <text x="120" y="55" class="text-attr">full_name</text>

  <ellipse cx="195" cy="55" rx="30" ry="16" class="attribute-oval" />
  <text x="195" y="55" class="text-attr">email</text>

  <ellipse cx="265" cy="55" rx="28" ry="16" class="attribute-oval" />
  <text x="265" y="55" class="text-attr">role</text>

  <ellipse cx="340" cy="55" rx="36" ry="16" class="attribute-oval" />
  <text x="340" y="55" class="text-attr">created_at</text>

  <!-- Top Attributes: REVIEW (reviews) -->
  <ellipse cx="680" cy="55" rx="30" ry="16" class="attribute-oval" />
  <text x="680" y="55" class="text-pk">id</text>

  <ellipse cx="765" cy="55" rx="44" ry="16" class="attribute-oval" />
  <text x="765" y="55" class="text-attr">project_name</text>

  <ellipse cx="855" cy="55" rx="40" ry="16" class="attribute-oval" />
  <text x="855" y="55" class="text-attr">source_type</text>

  <ellipse cx="940" cy="55" rx="34" ry="16" class="attribute-oval" />
  <text x="940" y="55" class="text-attr">repo_url</text>

  <!-- Bottom Attributes: REVIEW (reviews) -->
  <ellipse cx="665" cy="1270" rx="42" ry="16" class="attribute-oval" />
  <text x="665" y="1270" class="text-attr">health_score</text>

  <ellipse cx="745" cy="1270" rx="28" ry="16" class="attribute-oval" />
  <text x="745" y="1270" class="text-attr">grade</text>

  <ellipse cx="810" cy="1270" rx="28" ry="16" class="attribute-oval" />
  <text x="810" y="1270" class="text-attr">status</text>

  <ellipse cx="880" cy="1270" rx="34" ry="16" class="attribute-oval" />
  <text x="880" y="1270" class="text-attr">summary</text>

  <ellipse cx="955" cy="1270" rx="36" ry="16" class="attribute-oval" />
  <text x="955" y="1270" class="text-attr">created_at</text>

  <!-- Level 1 Attributes: REVIEW REPORT -->
  <ellipse cx="435" cy="140" rx="30" ry="16" class="attribute-oval" />
  <text x="435" y="140" class="text-pk">id</text>

  <ellipse cx="565" cy="140" rx="40" ry="16" class="attribute-oval" />
  <text x="565" y="140" class="text-attr">report_type</text>

  <ellipse cx="435" cy="280" rx="42" ry="16" class="attribute-oval" />
  <text x="435" y="280" class="text-attr">download_url</text>

  <ellipse cx="565" cy="280" rx="36" ry="16" class="attribute-oval" />
  <text x="565" y="280" class="text-attr">created_at</text>

  <!-- Level 3 Attributes: Sandboxes / Inspects (Relationship attributes) -->
  <ellipse cx="375" cy="575" rx="55" ry="16" class="attribute-oval" />
  <text x="375" y="575" class="text-attr">guest_session_id</text>

  <ellipse cx="500" cy="575" rx="50" ry="16" class="attribute-oval" />
  <text x="500" y="575" class="text-attr">rls_access_role</text>

  <ellipse cx="625" cy="575" rx="54" ry="16" class="attribute-oval" />
  <text x="625" y="575" class="text-attr">is_authenticated</text>

  <!-- Level 4 Attributes: REVIEW FILE -->
  <ellipse cx="385" cy="635" rx="30" ry="16" class="attribute-oval" />
  <text x="385" y="635" class="text-pk">id</text>

  <ellipse cx="500" cy="635" rx="38" ry="16" class="attribute-oval" />
  <text x="500" y="635" class="text-attr">file_path</text>

  <ellipse cx="615" cy="635" rx="34" ry="16" class="attribute-oval" />
  <text x="615" y="635" class="text-attr">language</text>

  <ellipse cx="385" cy="765" rx="38" ry="16" class="attribute-oval" />
  <text x="385" y="765" class="text-attr">lines_count</text>

  <ellipse cx="500" cy="765" rx="42" ry="16" class="attribute-oval" />
  <text x="500" y="765" class="text-attr">issues_count</text>

  <ellipse cx="615" cy="765" rx="36" ry="16" class="attribute-oval" />
  <text x="615" y="765" class="text-attr">created_at</text>

  <!-- Level 5 Attributes: REVIEW ISSUE -->
  <ellipse cx="385" cy="825" rx="30" ry="16" class="attribute-oval" />
  <text x="385" y="825" class="text-pk">id</text>

  <ellipse cx="500" cy="825" rx="34" ry="16" class="attribute-oval" />
  <text x="500" y="825" class="text-attr">rule_id</text>

  <ellipse cx="615" cy="825" rx="32" ry="16" class="attribute-oval" />
  <text x="615" y="825" class="text-attr">severity</text>

  <ellipse cx="385" cy="955" rx="34" ry="16" class="attribute-oval" />
  <text x="385" y="955" class="text-attr">category</text>

  <ellipse cx="500" cy="955" rx="40" ry="16" class="attribute-oval" />
  <text x="500" y="955" class="text-attr">line_number</text>

  <ellipse cx="615" cy="955" rx="46" ry="16" class="attribute-oval" />
  <text x="615" y="955" class="text-attr">engine_source</text>

  <!-- Level 6 Attributes: AI DIAGNOSTICS -->
  <ellipse cx="430" cy="1015" rx="30" ry="16" class="attribute-oval" />
  <text x="430" y="1015" class="text-pk">id</text>

  <ellipse cx="570" cy="1015" rx="44" ry="16" class="attribute-oval" />
  <text x="570" y="1015" class="text-attr">model_name</text>

  <ellipse cx="430" cy="1145" rx="42" ry="16" class="attribute-oval" />
  <text x="430" y="1145" class="text-attr">tokens_used</text>

  <ellipse cx="570" cy="1145" rx="50" ry="16" class="attribute-oval" />
  <text x="570" y="1145" class="text-attr">ast_rules_count</text>

</svg>`;
}

const svg = createErDiagramSvg();
const outputPath = path.join(__dirname, '..', 'docs', 'recode_er_diagram_chen.svg');
fs.writeFileSync(outputPath, svg, 'utf8');
console.log('Saved Chen ER diagram to:', outputPath);
