const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/**
 * Re:Code — Enterprise Dynamic PDF Audit Service
 *
 * Implements strict content-adaptive pagination:
 * - Adaptive A4 margins: 16mm (45.35pt)
 * - Zero trailing blank pages: dynamic height prediction and safe footer rendering
 * - Atomic finding cards: avoids awkward page splits mid-card (break-inside: avoid)
 * - Responsive page count: 1 page for concise audits, exactly N pages without empty sheet at end
 *
 * @param {Object} reviewData - Canonical or persisted review payload
 * @param {Object} [options={}] - Customization options
 * @returns {Promise<Buffer>} Generated PDF binary buffer
 */
function generateReviewPdf(reviewData = {}, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      // 16mm standard A4 margin in typographic points (16 * 72 / 25.4 = ~45.35pt)
      const MARGIN = 45.35;

      const doc = new PDFDocument({
        margin: MARGIN,
        size: 'A4',
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // 1. Data Normalization
      const projectName =
        reviewData.project_name || reviewData.projectName || 'Unnamed Project';
      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            Number(reviewData.health_score ?? reviewData.healthScore ?? reviewData.score ?? 100)
          )
        )
      );
      const grade = reviewData.grade || 'A+';
      const sourceType =
        reviewData.source_type || reviewData.sourceType || 'direct';
      const repoUrl = reviewData.repo_url || reviewData.repoUrl || null;
      const createdAt =
        reviewData.created_at || reviewData.createdAt || new Date().toISOString();
      const files = Array.isArray(reviewData.files) ? reviewData.files : [];
      const issues = Array.isArray(reviewData.issues) ? reviewData.issues : [];

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
      doc.fillColor('#888888').font('Helvetica').fontSize(8).text(
        `Scanned: ${new Date(createdAt).toUTCString()}  |  ${sourceLabel}`,
        MARGIN + 14,
        MARGIN + 62,
        { width: 320, ellipsis: true, lineBreak: false }
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
          const fPath = f.file_path || f.path || 'snippet.js';
          const fLang = f.language || 'JavaScript';
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
          '✓ Clean codebase. No high or medium vulnerabilities were discovered during static AST and Gemini analysis.',
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
          const title = issue.title || issue.ruleId || issue.rule_id || 'Review Finding';
          const ruleId = issue.ruleId || issue.rule_id || 'GENERAL_ISSUE';
          const line = issue.line || issue.line_number || 1;
          const file = issue.file || issue.file_path || 'source file';
          const description = issue.description || issue.explanation || 'No detailed explanation provided.';
          const diffBefore = issue.diff_before || '';
          const diffAfter = issue.diff_after || '';

          // Truncate minified lines exceeding 120 chars to first 117 chars + "..."
          const truncateLine = (l) => {
            if (!l) return '';
            return l.length > 120 ? l.slice(0, 117) + '...' : l;
          };
          const beforeLines = diffBefore ? diffBefore.split('\n').slice(0, 4).map(truncateLine).join('\n') : '';
          const afterLines = diffAfter ? diffAfter.split('\n').slice(0, 4).map(truncateLine).join('\n') : '';
          const diffBeforeHeight = beforeLines ? Math.min(48, 14 + beforeLines.split('\n').length * 9) : 0;
          const diffAfterHeight = afterLines ? Math.min(48, 14 + afterLines.split('\n').length * 9) : 0;
          
          // Estimate total card height
          const cardRequiredHeight = 44 + 20 + diffBeforeHeight + (diffBeforeHeight ? 4 : 0) + diffAfterHeight + (diffAfterHeight ? 4 : 0) + 10;

          // If current card would spill past safe bottom, break page before starting this card
          if (doc.y + cardRequiredHeight > safeBottomY && doc.y > MARGIN + 40) {
            doc.addPage();
            doc.y = MARGIN + 10;
          }

          // Finding Title & Severity Pill
          doc.fillColor(tagColor).font('Helvetica-Bold').fontSize(8.5).text(`[${sev}]`, MARGIN, doc.y, { continued: true, lineBreak: false });
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9.5).text(`  ${index + 1}. ${title}`, { lineBreak: false });
          doc.y += 12;

          // Engine attribution: HYBRID (AST + AI) when corroborated
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

          // Code Diff Blocks (Render atomically inside card with truncation and ellipsis to prevent horizontal canvas overflow)
          if (beforeLines) {
            doc.rect(MARGIN, doc.y, contentWidth, diffBeforeHeight).fill('#FFEBEE');
            doc.rect(MARGIN, doc.y, 3, diffBeforeHeight).fill('#D32F2F');
            doc.fillColor('#C62828').font('Helvetica-Bold').fontSize(7).text('VULNERABLE CODE (-)', MARGIN + 8, doc.y + 3, { lineBreak: false });
            doc.fillColor('#B71C1C').font('Courier').fontSize(7.5).text(beforeLines, MARGIN + 8, doc.y + 12, { width: contentWidth - 16, lineBreak: false, ellipsis: true });
            doc.y += diffBeforeHeight + 4;
          }

          if (afterLines) {
            doc.rect(MARGIN, doc.y, contentWidth, diffAfterHeight).fill('#E8F5E9');
            doc.rect(MARGIN, doc.y, 3, diffAfterHeight).fill('#2E7D32');
            doc.fillColor('#2E7D32').font('Helvetica-Bold').fontSize(7).text('REMEDIATED FIX (+)', MARGIN + 8, doc.y + 3, { lineBreak: false });
            doc.fillColor('#1B5E20').font('Courier').fontSize(7.5).text(afterLines, MARGIN + 8, doc.y + 12, { width: contentWidth - 16, lineBreak: false, ellipsis: true });
            doc.y += diffAfterHeight + 4;
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
        
        doc.fillColor('#777777').font('Helvetica').fontSize(7).text(
          '{ Re:Code } • Read. Review. Refine. | Comprehensive Quality & Reliability Report | OWASP Top 10 Active',
          MARGIN,
          footerY,
          { width: contentWidth - 80, lineBreak: false, baseline: 'middle' }
        );

        doc.fillColor('#777777').font('Helvetica').fontSize(7).text(
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

module.exports = {
  generateReviewPdf,
};
