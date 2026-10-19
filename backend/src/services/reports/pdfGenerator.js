const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { formatIstTimestamp } = require('../../utils/dateFormatter');

/**
 * Decode common HTML/XML entities into literal characters
 *
 * @param {string} str - Raw input string
 * @returns {string} Entity-decoded string
 */
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x60;/gi, '`')
    .replace(/&#0?96;/g, '`')
    .replace(/&#36;/g, '$')
    .replace(/&#37;/g, '%')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/&#(\d+);/g, (match, dec) => {
      const code = parseInt(dec, 10);
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : match;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      const code = parseInt(hex, 16);
      return code >= 32 && code <= 126 ? String.fromCharCode(code) : match;
    });
}

/**
 * Normalize and sanitize general PDF text (titles, descriptions, categories)
 *
 * @param {string} rawText - Input text
 * @returns {string} Sanitized plain text
 */
function normalizePdfText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = decodeHtmlEntities(rawText);

  // Normalize smart quotes to standard ASCII quotes
  text = text
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033]/g, '"');

  // Normalize backtick variations to ASCII `
  text = text.replace(/[\u0060\u02CB\u2035\u00B4]/g, '`');

  // Normalize dashes / hyphens
  text = text.replace(/[\u2013\u2014\u2015\u2212\u2010\u2011\u2012]/g, '-');

  // Normalize symbols for universal font compatibility
  text = text
    .replace(/[\u2713\u2714]/g, '[OK]')
    .replace(/[\u2717\u2718]/g, '[X]')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-');

  // Normalize Unicode spaces
  text = text.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Strip zero-width & invisible characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00AD]/g, '');

  // Strip unprintable control characters
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return text.trim();
}

/**
 * Normalize and sanitize raw code snippets for VULNERABLE CODE and REMEDIATED FIX blocks
 *
 * Strictly preserves exact characters:
 * - Backticks (`)
 * - Template literals (${...})
 * - Curly braces ({})
 * - Brackets ([])
 * - Quotes (', ")
 * - Wildcards (%) including patterns like '%9812', '%s', '%d'
 *
 * Prevents string corruption like '%9812' -> 1498121 or `s'`.
 *
 * @param {string} rawCode - Raw code snippet
 * @returns {string} Sanitized code string
 */
function normalizePdfCode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';

  let code = decodeHtmlEntities(rawCode);

  // Normalize smart/curly quotes to ASCII quotes
  code = code
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033]/g, '"');

  // Normalize alternative grave/backtick accents to standard ASCII backtick `
  code = code.replace(/[\u02CB\u2035\u00B4]/g, '`');

  // Normalize dashes / minus signs to standard ASCII hyphen
  code = code.replace(/[\u2013\u2014\u2015\u2212\u2010\u2011\u2012]/g, '-');

  // Normalize Unicode spaces to standard ASCII space
  code = code.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Strip zero-width and invisible characters
  code = code.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00AD]/g, '');

  // Normalize newlines to standard \n
  code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Expand tabs to 2 spaces for consistent monospace indentation
  code = code.replace(/\t/g, '  ');

  // Remove unprintable control characters except \n
  code = code.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Safeguard: Limit display to first 8 lines, and cap massive runaway minified lines (>300 chars)
  const rawLines = code.split('\n');
  const maxDisplayLines = 8;
  const processedLines = rawLines.slice(0, maxDisplayLines).map((l) => {
    return l.length > 300 ? l.slice(0, 297) + '...' : l;
  });

  if (rawLines.length > maxDisplayLines) {
    processedLines.push(`// ... (${rawLines.length - maxDisplayLines} additional lines omitted)`);
  }

  return processedLines.join('\n');
}

/**
 * System monospace font resolver:
 * Checks system monospace TTFs (Consolas, Courier New, DejaVu Sans Mono, Liberation Mono, Monaco)
 * with graceful fallback to standard built-in 'Courier'.
 *
 * @param {PDFKit.PDFDocument} doc - PDFDocument instance
 * @returns {string} Registered font family name ('ReCodeMono' or 'Courier')
 */
let cachedMonoFontPath = undefined;

function getMonospaceFont(doc) {
  if (cachedMonoFontPath === undefined) {
    const candidates = [
      // Windows Monospace TTFs
      'C:\\Windows\\Fonts\\consola.ttf',
      'C:\\Windows\\Fonts\\cour.ttf',
      'C:\\Windows\\Fonts\\lucon.ttf',
      // Linux / Container Monospace TTFs
      '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
      '/usr/share/fonts/dejavu/DejaVuSansMono.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
      '/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf',
      '/usr/share/fonts/truetype/freefont/FreeMono.ttf',
      // macOS Monospace TTFs
      '/System/Library/Fonts/SFNSMono.ttf',
      '/System/Library/Fonts/Monaco.ttf',
      '/Library/Fonts/Courier New.ttf',
    ];

    cachedMonoFontPath = null;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          cachedMonoFontPath = p;
          break;
        }
      } catch {
        // continue
      }
    }
  }

  if (cachedMonoFontPath) {
    try {
      doc.registerFont('ReCodeMono', cachedMonoFontPath);
      return 'ReCodeMono';
    } catch {
      // Fallback to Courier
    }
  }

  return 'Courier';
}

/**
 * Re:Code — Enterprise Dynamic PDF Audit Service
 *
 * Implements strict content-adaptive pagination & encoding safeguards:
 * - Adaptive A4 margins: 16mm (45.35pt)
 * - Zero trailing blank pages: dynamic height prediction and safe footer rendering
 * - Atomic finding cards: dynamic height calculation preventing mid-card breaks
 * - Full character preservation: backticks, template literals, quotes, braces, wildcards (%9812)
 * - Monospace font resolution (Consolas / DejaVu Sans Mono / Courier)
 * - Explicit UTF-8 metadata and horizontal text wrapping
 *
 * @param {Object} reviewData - Canonical or persisted review payload
 * @param {Object} [options={}] - Customization options
 * @returns {Promise<Buffer>} Generated PDF binary buffer
 */
function generateReviewPdf(reviewData = {}, _options = {}) {
  return new Promise((resolve, reject) => {
    try {
      // 16mm standard A4 margin in typographic points (16 * 72 / 25.4 = ~45.35pt)
      const MARGIN = 45.35;

      const projectName = normalizePdfText(
        reviewData.project_name || reviewData.projectName || 'Unnamed Project'
      );
      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number(reviewData.health_score ?? reviewData.healthScore ?? reviewData.score ?? 100)
          )
        )
      );
      const grade = normalizePdfText(reviewData.grade || 'A+');
      const sourceType =
        reviewData.source_type || reviewData.sourceType || 'direct';
      const repoUrl = reviewData.repo_url || reviewData.repoUrl || null;
      const createdAt =
        reviewData.created_at || reviewData.createdAt || new Date().toISOString();
      const files = Array.isArray(reviewData.files) ? reviewData.files : [];
      const issues = Array.isArray(reviewData.issues) ? reviewData.issues : [];

      const doc = new PDFDocument({
        margin: MARGIN,
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true,
        pdfVersion: '1.7',
        lang: 'en-US',
        info: {
          Title: `Audit Report: ${projectName}`,
          Author: 'Re:Code Enterprise Review Pipeline',
          Subject: 'Automated Code Quality & Security Audit',
          Keywords: 'security, code quality, audit, owasp, static analysis',
          Creator: 'Re:Code Audit Platform',
          Producer: 'PDFKit Engine (UTF-8)',
          CreationDate: new Date(createdAt),
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Register monospace font for code blocks
      const codeFont = getMonospaceFont(doc);

      // Calculate severity breakdown counts
      const severityCounts = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0,
      };

      for (const iss of issues) {
        const sev = String(iss.severity || 'MEDIUM').toUpperCase().trim();
        if (severityCounts[sev] !== undefined) {
          severityCounts[sev]++;
        }
      }

      // Calculate category deductions
      const categoryDeductions = {
        SYNTAX: 0,
        SECURITY: 0,
        QUALITY: 0,
        OPTIMIZATION: 0,
      };

      for (const iss of issues) {
        const cat = String(iss.category || 'QUALITY').toUpperCase().trim();
        const sev = String(iss.severity || 'MEDIUM').toUpperCase().trim();
        const penalty =
          sev === 'CRITICAL' ? 20 : sev === 'HIGH' ? 10 : sev === 'MEDIUM' ? 5 : sev === 'LOW' ? 2 : 0;
        if (categoryDeductions[cat] !== undefined) {
          categoryDeductions[cat] += penalty;
        }
      }

      const bugsHealth = Math.max(0, Math.min(100, 100 - categoryDeductions.SYNTAX));
      const securityHealth = Math.max(0, Math.min(100, 100 - categoryDeductions.SECURITY));
      const qualityHealth = Math.max(0, Math.min(100, 100 - categoryDeductions.QUALITY));
      const optimizationHealth = Math.max(0, Math.min(100, 100 - categoryDeductions.OPTIMIZATION));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - MARGIN * 2;
      const safeBottomY = pageHeight - MARGIN - 30; // Leave 30pt breathing room for footer

      // ==========================================
      // SECTION 1: HEADER WITH BRANDING & SCORE
      // ==========================================
      const headerHeight = 84;
      doc.rect(MARGIN, MARGIN, contentWidth, headerHeight).fill('#0E0E0E');

      // Brand Logo (Official Re:Code Logo)
      const logoPaths = [
        path.resolve(__dirname, '../../assets/logo.png'),
        path.resolve(__dirname, '../../../assets/logo.png'),
        path.resolve(__dirname, '../../../../frontend/src/assets/logo.png'),
        path.resolve(__dirname, '../../../../frontend/public/logo.png'),
      ];
      const logoPath = logoPaths.find((p) => fs.existsSync(p));

      if (logoPath) {
        try {
          doc.image(logoPath, MARGIN + 14, MARGIN + 10, { width: 105, height: 26.25 });
        } catch {
          doc.fillColor('#02C8F0').font('Helvetica-Bold').fontSize(14).text('{ Re:Code }', MARGIN + 14, MARGIN + 14, { lineBreak: false });
          doc.fillColor('#AAAAAA').font('Helvetica').fontSize(9).text('•  Read. Review. Refine.', MARGIN + 94, MARGIN + 17, { lineBreak: false });
        }
      } else {
        doc.fillColor('#02C8F0').font('Helvetica-Bold').fontSize(14).text('{ Re:Code }', MARGIN + 14, MARGIN + 14, { lineBreak: false });
        doc.fillColor('#AAAAAA').font('Helvetica').fontSize(9).text('•  Read. Review. Refine.', MARGIN + 94, MARGIN + 17, { lineBreak: false });
      }

      // Report Title & Project Name
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13).text(`Audit Report: ${projectName}`, MARGIN + 14, MARGIN + 42, {
        width: 320,
        ellipsis: true,
        lineBreak: false,
      });

      // Metadata subtitle
      const sourceLabel = sourceType === 'github' ? (repoUrl ? `GitHub: ${repoUrl}` : 'Public GitHub Repository') : 'Pasted Code Snippet';
      const istTimestamp = formatIstTimestamp(createdAt);
      doc.fillColor('#888888').font('Helvetica').fontSize(8).text(
        `Scanned: ${istTimestamp}  |  ${sourceLabel}`,
        MARGIN + 14,
        MARGIN + 62,
        { width: 380, ellipsis: true, lineBreak: false }
      );

      // Health Score Box (Right-aligned in header)
      const scoreBoxW = 86;
      const scoreBoxH = 68;
      const scoreBoxX = pageWidth - MARGIN - scoreBoxW - 10;
      const scoreBoxY = MARGIN + 8;
      doc.rect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH).fill('#1A1A1A');
      doc.rect(scoreBoxX, scoreBoxY, scoreBoxW, scoreBoxH).lineWidth(1).stroke('#333333');

      const scoreColor =
        score >= 90 ? '#27C93F' : score >= 80 ? '#02C8F0' : score >= 70 ? '#FFA116' : '#FF4D4D';
      doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(16).text(`${score}/100`, scoreBoxX, scoreBoxY + 8, {
        width: scoreBoxW,
        align: 'center',
        lineBreak: false,
      });
      doc.fillColor('#F1F1F1').font('Helvetica-Bold').fontSize(10.5).text(`Grade ${grade}`, scoreBoxX, scoreBoxY + 30, {
        width: scoreBoxW,
        align: 'center',
        lineBreak: false,
      });
      doc.fillColor('#888888').font('Helvetica').fontSize(7.5).text(
        score >= 90 ? 'Production Ready' : score >= 70 ? 'Needs Attention' : 'High Risk',
        scoreBoxX,
        scoreBoxY + 48,
        { width: scoreBoxW, align: 'center', lineBreak: false }
      );

      doc.y = MARGIN + headerHeight + 16;

      // ==========================================
      // SECTION 2: EXECUTIVE SUMMARY & METRICS
      // ==========================================
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11.5).text('Executive Health Summary', MARGIN, doc.y, { lineBreak: false });
      doc.rect(MARGIN, doc.y + 14, contentWidth, 1).fill('#E0E0E0');
      doc.y += 20;

      // Severity Stat Cards (4 columns)
      const gap = 8;
      const cardWidth = (contentWidth - gap * 3) / 4;
      const cardHeight = 38;
      const cardY = doc.y;

      const stats = [
        { count: severityCounts.CRITICAL, label: 'CRITICAL ISSUES', bg: '#FFF0F0', border: '#FFCDD2', color: '#D32F2F' },
        { count: severityCounts.HIGH, label: 'HIGH ISSUES', bg: '#FFF8E1', border: '#FFE082', color: '#E65100' },
        { count: severityCounts.MEDIUM, label: 'MEDIUM ISSUES', bg: '#F5F5F5', border: '#E0E0E0', color: '#616161' },
        { count: severityCounts.LOW, label: 'LOW ISSUES', bg: '#E1F5FE', border: '#B3E5FC', color: '#0288D1' },
      ];

      stats.forEach((st, idx) => {
        const cx = MARGIN + idx * (cardWidth + gap);
        doc.rect(cx, cardY, cardWidth, cardHeight).fill(st.bg);
        doc.rect(cx, cardY, cardWidth, cardHeight).lineWidth(1).stroke(st.border);
        doc.fillColor(st.color).font('Helvetica-Bold').fontSize(14).text(String(st.count), cx, cardY + 5, { width: cardWidth, align: 'center', lineBreak: false });
        doc.fillColor('#555555').font('Helvetica-Bold').fontSize(7.5).text(st.label, cx, cardY + 23, { width: cardWidth, align: 'center', lineBreak: false });
      });

      doc.y = cardY + cardHeight + 10;

      // Category Metrics Bar
      const metricsBarHeight = 26;
      doc.rect(MARGIN, doc.y, contentWidth, metricsBarHeight).fill('#F8F9FA');
      doc.rect(MARGIN, doc.y, contentWidth, metricsBarHeight).lineWidth(1).stroke('#E9ECEF');
      const metricsText = `Bugs Health: ${bugsHealth}%   |   Security Health: ${securityHealth}%   |   Quality: ${qualityHealth}%   |   Optimization: ${optimizationHealth}%`;
      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(8).text(metricsText, MARGIN, doc.y + 8, { width: contentWidth, align: 'center', lineBreak: false });

      doc.y += metricsBarHeight + 14;

      // Evaluated Files Section (if any)
      if (files.length > 0) {
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text(`Evaluated Files (${files.length})`, MARGIN, doc.y, { lineBreak: false });
        doc.y += 14;
        const displayFiles = files.slice(0, 6);
        displayFiles.forEach((f) => {
          const fPath = normalizePdfText(f.file_path || f.path || 'snippet.js');
          const fLang = normalizePdfText(f.language || 'JavaScript');
          const fLines = f.lines_count || f.linesCount || 0;
          doc.fillColor('#444444').font('Helvetica').fontSize(8).text(
            `• ${fPath}  —  Language: ${fLang}  |  ${fLines} lines evaluated  |  ${f.issues_count || 0} issues`,
            MARGIN + 8,
            doc.y,
            { lineBreak: false, width: contentWidth - 16, ellipsis: true }
          );
          doc.y += 12;
        });
        doc.y += 4;
      }

      // ==========================================
      // SECTION 3: DETAILED FINDINGS & REMEDIATIONS
      // ==========================================
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11.5).text(`Detailed Findings (${issues.length})`, MARGIN, doc.y, { lineBreak: false });
      doc.rect(MARGIN, doc.y + 14, contentWidth, 1).fill('#E0E0E0');
      doc.y += 20;

      if (issues.length === 0) {
        doc.fillColor('#2E7D32').font('Helvetica-Bold').fontSize(9.5).text(
          '[OK] Clean codebase. No high or medium vulnerabilities were discovered during static AST and Gemini analysis.',
          MARGIN + 4,
          doc.y,
          { lineBreak: false }
        );
        doc.y += 20;
      } else {
        issues.forEach((issue, index) => {
          const sev = String(issue.severity || 'MEDIUM').toUpperCase().trim();
          const tagColor =
            sev === 'CRITICAL' ? '#D32F2F' : sev === 'HIGH' ? '#E65100' : sev === 'MEDIUM' ? '#F57F17' : '#0288D1';
          const title = normalizePdfText(issue.title || issue.ruleId || issue.rule_id || 'Review Finding');
          const ruleId = normalizePdfText(issue.ruleId || issue.rule_id || 'GENERAL_ISSUE');
          const line = issue.line || issue.line_number || 1;
          const file = normalizePdfText(issue.file || issue.file_path || 'source file');
          const description = normalizePdfText(issue.description || issue.explanation || 'No detailed explanation provided.');
          const diffBefore = normalizePdfCode(issue.diff_before || '');
          const diffAfter = normalizePdfCode(issue.diff_after || '');

          const codeWidth = contentWidth - 16;

          // Accurately measure dynamic heights with lineBreak: true
          doc.font(codeFont).fontSize(7.5);
          const beforeTextHeight = diffBefore
            ? doc.heightOfString(diffBefore, { width: codeWidth, lineBreak: true })
            : 0;
          const diffBeforeBoxHeight = diffBefore ? Math.ceil(beforeTextHeight + 16) : 0;

          const afterTextHeight = diffAfter
            ? doc.heightOfString(diffAfter, { width: codeWidth, lineBreak: true })
            : 0;
          const diffAfterBoxHeight = diffAfter ? Math.ceil(afterTextHeight + 16) : 0;

          // Measure description height
          doc.font('Helvetica').fontSize(8);
          const descHeight = doc.heightOfString(description, { width: contentWidth, lineGap: 1.5 });

          // Estimate total card height dynamically
          const cardRequiredHeight =
            12 + // Title line
            12 + // Rule & Location metadata
            descHeight + 6 + // Description + margin
            (diffBeforeBoxHeight ? diffBeforeBoxHeight + 6 : 0) +
            (diffAfterBoxHeight ? diffAfterBoxHeight + 6 : 0) +
            10; // Card bottom gap

          // If current card would spill past safe bottom, break page before starting this card
          if (doc.y + cardRequiredHeight > safeBottomY && doc.y > MARGIN + 40) {
            doc.addPage();
            doc.y = MARGIN + 10;
          }

          // Finding Title & Severity Pill
          doc.fillColor(tagColor).font('Helvetica-Bold').fontSize(8.5).text(`[${sev}]`, MARGIN, doc.y, { continued: true, lineBreak: false });
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9.5).text(`  ${index + 1}. ${title}`, { lineBreak: false });
          doc.y += 12;

          // Engine attribution
          const engineAttr =
            issue.engine ||
            (String(issue.engine_source || issue.source || '').toUpperCase().includes('HYBRID')
              ? 'HYBRID (AST + AI)'
              : String(issue.engine_source || issue.source || '').toUpperCase().includes('GEMINI')
              ? 'Gemini AI'
              : 'Static AST');

          // Rule & Location Metadata
          doc.fillColor('#666666').font('Helvetica').fontSize(7.5).text(
            `Rule ID: ${ruleId}   |   Location: ${file} (Line ${line})   |   Engine: ${engineAttr}`,
            MARGIN,
            doc.y,
            { lineBreak: false }
          );
          doc.y += 12;

          // Plain Language Explanation
          doc.fillColor('#333333').font('Helvetica').fontSize(8).text(description, MARGIN, doc.y, {
            width: contentWidth,
            lineGap: 1.5,
          });
          doc.y += 6;

          // Code Diff Blocks (Render dynamically with full character fidelity & clean horizontal wrapping)
          if (diffBefore) {
            doc.rect(MARGIN, doc.y, contentWidth, diffBeforeBoxHeight).fill('#FFEBEE');
            doc.rect(MARGIN, doc.y, 3, diffBeforeBoxHeight).fill('#D32F2F');
            doc.fillColor('#C62828').font('Helvetica-Bold').fontSize(7).text('VULNERABLE CODE (-)', MARGIN + 8, doc.y + 3, { lineBreak: false });
            doc.fillColor('#B71C1C').font(codeFont).fontSize(7.5).text(diffBefore, MARGIN + 8, doc.y + 12, {
              width: codeWidth,
              lineBreak: true,
            });
            doc.y += diffBeforeBoxHeight + 6;
          }

          if (diffAfter) {
            doc.rect(MARGIN, doc.y, contentWidth, diffAfterBoxHeight).fill('#E8F5E9');
            doc.rect(MARGIN, doc.y, 3, diffAfterBoxHeight).fill('#2E7D32');
            doc.fillColor('#2E7D32').font('Helvetica-Bold').fontSize(7).text('REMEDIATED FIX (+)', MARGIN + 8, doc.y + 3, { lineBreak: false });
            doc.fillColor('#1B5E20').font(codeFont).fontSize(7.5).text(diffAfter, MARGIN + 8, doc.y + 12, {
              width: codeWidth,
              lineBreak: true,
            });
            doc.y += diffAfterBoxHeight + 6;
          }

          doc.y += 10;
        });
      }

      // ==========================================
      // SECTION 4: SAFE DOCKED FOOTER (ZERO TRAILING PAGES)
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Suppress bottom margin temporarily during footer rendering to strictly prevent PDFKit auto-addPage
        const origBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const footerY = pageHeight - MARGIN + 8;
        doc.rect(MARGIN, footerY - 8, contentWidth, 0.5).fill('#CCCCCC');

        doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(
          '{ Re:Code } • Read. Review. Refine. | Comprehensive Quality & Reliability Report | OWASP Top 10 Active',
          MARGIN,
          footerY,
          { width: contentWidth - 80, lineBreak: false, baseline: 'middle' }
        );

        doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(
          `Page ${i + 1} of ${range.count}`,
          pageWidth - MARGIN - 60,
          footerY,
          { width: 60, align: 'right', lineBreak: false, baseline: 'middle' }
        );

        doc.page.margins.bottom = origBottomMargin;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Render HTML/CSS footer template for PDF reports matching Re:Code specifications
 *
 * @param {Object} [options]
 * @param {number} [options.pageNumber=1]
 * @param {number} [options.totalPages=1]
 * @returns {string} Rendered HTML footer template string
 */
function getPdfFooterHtml({ pageNumber = 1, totalPages = 1 } = {}) {
  return `<footer class="pdf-footer" style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-top: 0.5px solid #cccccc; padding-top: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-sizing: border-box; color: #64748b; font-size: 10px;">
  <div style="vertical-align: middle;">
    { Re:Code } • Read. Review. Refine. | Comprehensive Quality & Reliability Report | OWASP Top 10 Active
  </div>
  <div style="color: #64748b; font-size: 10px; white-space: nowrap; vertical-align: middle;">
    Page ${pageNumber} of ${totalPages}
  </div>
</footer>`;
}

module.exports = {
  generateReviewPdf,
  decodeHtmlEntities,
  normalizePdfText,
  normalizePdfCode,
  getMonospaceFont,
  formatIstTimestamp,
  getPdfFooterHtml,
};
