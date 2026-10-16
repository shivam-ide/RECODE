const PDFDocument = require('pdfkit');

/**
 * Re:Code — Automated Review PDF Report Generator
 *
 * Produces high-fidelity, printable PDF audit summaries:
 * 1. Branded Header: Re:Code branding, Project Name, Timestamp, Health Score & Grade Gauge
 * 2. Executive Summary: Letter grade, Severity counts (Critical, High, Medium, Low), Category health percentages
 * 3. Detailed Findings: File path, Line number, Severity, Category, Title, Plain-language explanation, and Before/After Diff Blocks
 * 4. Docked Header/Footer across all pages with pagination
 *
 * @param {Object} reviewData - Canonical or persisted review payload
 * @returns {Promise<Buffer>} Generated PDF binary buffer
 */
function generateReviewPdf(reviewData = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
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
      const contentWidth = pageWidth - 80;

      // ==========================================
      // SECTION 1: HEADER WITH BRANDING & SCORE
      // ==========================================
      // Dark Header Canvas
      doc.rect(40, 40, contentWidth, 80).fill('#0E0E0E');

      // Brand Logo & Tagline
      doc.fillColor('#02C8F0').font('Helvetica-Bold').fontSize(14).text('{ Re:Code }', 55, 52);
      doc.fillColor('#AAAAAA').font('Helvetica').fontSize(9).text('•  Read. Review. Refine.', 135, 55);

      // Report Title & Project Name
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15).text(`Audit Report: ${projectName}`, 55, 74, {
        width: 330,
        ellipsis: true,
      });

      // Metadata subtitle
      const sourceLabel = sourceType === 'github' ? (repoUrl ? `GitHub: ${repoUrl}` : 'Public GitHub Repository') : 'Pasted Code Snippet';
      doc.fillColor('#888888').font('Helvetica').fontSize(8.5).text(
        `Scanned: ${new Date(createdAt).toUTCString()}  |  ${sourceLabel}`,
        55,
        96,
        { width: 330, ellipsis: true }
      );

      // Health Score Box (Right-aligned in header)
      const scoreBoxX = pageWidth - 145;
      doc.rect(scoreBoxX, 48, 90, 64).fill('#1A1A1A');
      doc.rect(scoreBoxX, 48, 90, 64).lineWidth(1).stroke('#333333');

      const scoreColor =
        score >= 90 ? '#27C93F' : score >= 80 ? '#02C8F0' : score >= 70 ? '#FFA116' : '#FF4D4D';
      doc.fillColor(scoreColor).font('Helvetica-Bold').fontSize(17).text(`${score}/100`, scoreBoxX, 58, {
        width: 90,
        align: 'center',
      });
      doc.fillColor('#F1F1F1').font('Helvetica-Bold').fontSize(11).text(`Grade ${grade}`, scoreBoxX, 82, {
        width: 90,
        align: 'center',
      });

      doc.y = 136;

      // ==========================================
      // SECTION 2: EXECUTIVE SUMMARY & METRICS
      // ==========================================
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text('Executive Health Summary', 40, doc.y);
      doc.rect(40, doc.y + 4, contentWidth, 1).fill('#E0E0E0');
      doc.y += 12;

      // Severity Stat Cards (4 flat columns)
      const cardWidth = (contentWidth - 30) / 4;
      const cardY = doc.y;

      // 1. Critical
      doc.rect(40, cardY, cardWidth, 42).fill('#FFF0F0');
      doc.rect(40, cardY, cardWidth, 42).lineWidth(1).stroke('#FFCDD2');
      doc.fillColor('#D32F2F').font('Helvetica-Bold').fontSize(16).text(String(severityCounts.CRITICAL), 40, cardY + 6, { width: cardWidth, align: 'center' });
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text('CRITICAL ISSUES', 40, cardY + 26, { width: cardWidth, align: 'center' });

      // 2. High
      const card2X = 40 + cardWidth + 10;
      doc.rect(card2X, cardY, cardWidth, 42).fill('#FFF8E1');
      doc.rect(card2X, cardY, cardWidth, 42).lineWidth(1).stroke('#FFE082');
      doc.fillColor('#E65100').font('Helvetica-Bold').fontSize(16).text(String(severityCounts.HIGH), card2X, cardY + 6, { width: cardWidth, align: 'center' });
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text('HIGH ISSUES', card2X, cardY + 26, { width: cardWidth, align: 'center' });

      // 3. Medium
      const card3X = card2X + cardWidth + 10;
      doc.rect(card3X, cardY, cardWidth, 42).fill('#F5F5F5');
      doc.rect(card3X, cardY, cardWidth, 42).lineWidth(1).stroke('#E0E0E0');
      doc.fillColor('#616161').font('Helvetica-Bold').fontSize(16).text(String(severityCounts.MEDIUM), card3X, cardY + 6, { width: cardWidth, align: 'center' });
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text('MEDIUM ISSUES', card3X, cardY + 26, { width: cardWidth, align: 'center' });

      // 4. Low
      const card4X = card3X + cardWidth + 10;
      doc.rect(card4X, cardY, cardWidth, 42).fill('#E1F5FE');
      doc.rect(card4X, cardY, cardWidth, 42).lineWidth(1).stroke('#B3E5FC');
      doc.fillColor('#0288D1').font('Helvetica-Bold').fontSize(16).text(String(severityCounts.LOW), card4X, cardY + 6, { width: cardWidth, align: 'center' });
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(8).text('LOW ISSUES', card4X, cardY + 26, { width: cardWidth, align: 'center' });

      doc.y = cardY + 54;

      // Category Metrics Bar
      doc.rect(40, doc.y, contentWidth, 30).fill('#F8F9FA');
      doc.rect(40, doc.y, contentWidth, 30).lineWidth(1).stroke('#E9ECEF');
      const metricsText = `Bugs Health: ${bugsHealth}%   |   Security Health: ${securityHealth}%   |   Quality: ${qualityHealth}%   |   Optimization: ${optimizationHealth}%`;
      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(8.5).text(metricsText, 40, doc.y + 10, { width: contentWidth, align: 'center' });

      doc.y += 42;

      // Evaluated Files Section (if provided)
      if (files.length > 0) {
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10.5).text(`Evaluated Files (${files.length})`, 40, doc.y);
        doc.y += 12;
        files.slice(0, 8).forEach((f) => {
          const path = f.file_path || f.path || 'snippet.js';
          const lang = f.language || 'JavaScript';
          const lines = f.lines_count || f.linesCount || 0;
          doc.fillColor('#444444').font('Helvetica').fontSize(8.5).text(
            `• ${path}  —  Language: ${lang}  |  ${lines} lines evaluated  |  ${f.issues_count || 0} issues`,
            48,
            doc.y
          );
          doc.y += 11;
        });
        doc.y += 8;
      }

      // ==========================================
      // SECTION 3: DETAILED FINDINGS & REMEDIATIONS
      // ==========================================
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text(`Detailed Findings (${issues.length})`, 40, doc.y);
      doc.rect(40, doc.y + 4, contentWidth, 1).fill('#E0E0E0');
      doc.y += 14;

      if (issues.length === 0) {
        doc.fillColor('#2E7D32').font('Helvetica-Bold').fontSize(10.5).text('✓ Clean codebase. No high or medium vulnerabilities were discovered during static AST and Gemini analysis.', 45, doc.y);
        doc.y += 24;
      } else {
        issues.forEach((issue, index) => {
          // Check if space remains on page, otherwise add new page
          if (doc.y > doc.page.height - 120) {
            doc.addPage();
            doc.y = 50;
          }

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

          // Finding Title & Severity Pill
          doc.fillColor(tagColor).font('Helvetica-Bold').fontSize(9).text(`[${sev}]`, 40, doc.y, { continued: true });
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text(`  ${index + 1}. ${title}`);
          doc.y += 3;

          // Rule & Location Metadata
          doc.fillColor('#666666').font('Helvetica').fontSize(8).text(
            `Rule ID: ${ruleId}   |   Location: ${file} (Line ${line})   |   Engine: ${issue.engine_source || 'HYBRID'}`,
            40,
            doc.y
          );
          doc.y += 5;

          // Plain Language Explanation
          doc.fillColor('#333333').font('Helvetica').fontSize(8.5).text(description, 40, doc.y, {
            width: contentWidth,
            lineGap: 2,
          });
          doc.y += 6;

          // Code Diff Blocks
          if (diffBefore) {
            const beforeLines = diffBefore.split('\n').slice(0, 4).join('\n');
            const boxH = Math.min(50, 14 + beforeLines.split('\n').length * 10);

            if (doc.y + boxH > doc.page.height - 50) {
              doc.addPage();
              doc.y = 50;
            }

            doc.rect(40, doc.y, contentWidth, boxH).fill('#FFEBEE');
            doc.rect(40, doc.y, 3, boxH).fill('#D32F2F');
            doc.fillColor('#C62828').font('Helvetica-Bold').fontSize(7.5).text('VULNERABLE CODE (-)', 48, doc.y + 4);
            doc.fillColor('#B71C1C').font('Courier').fontSize(8).text(beforeLines, 48, doc.y + 14, { width: contentWidth - 16 });
            doc.y += boxH + 4;
          }

          if (diffAfter) {
            const afterLines = diffAfter.split('\n').slice(0, 4).join('\n');
            const boxH = Math.min(50, 14 + afterLines.split('\n').length * 10);

            if (doc.y + boxH > doc.page.height - 50) {
              doc.addPage();
              doc.y = 50;
            }

            doc.rect(40, doc.y, contentWidth, boxH).fill('#E8F5E9');
            doc.rect(40, doc.y, 3, boxH).fill('#2E7D32');
            doc.fillColor('#2E7D32').font('Helvetica-Bold').fontSize(7.5).text('REMEDIATED FIX (+)', 48, doc.y + 4);
            doc.fillColor('#1B5E20').font('Courier').fontSize(8).text(afterLines, 48, doc.y + 14, { width: contentWidth - 16 });
            doc.y += boxH + 4;
          }

          doc.y += 8;
        });
      }

      // ==========================================
      // SECTION 4: PAGE NUMBERS & FOOTER ON ALL PAGES
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.rect(40, doc.page.height - 35, contentWidth, 0.5).fill('#CCCCCC');
        doc.fillColor('#777777').font('Helvetica').fontSize(7.5).text(
          '{ Re:Code } • Read. Review. Refine. | College Project by Shivam Vishwakarma | OWASP Top 10 Active',
          40,
          doc.page.height - 26,
          { width: contentWidth - 80 }
        );
        doc.fillColor('#777777').font('Helvetica').fontSize(7.5).text(
          `Page ${i + 1} of ${range.count}`,
          pageWidth - 100,
          doc.page.height - 26,
          { width: 60, align: 'right' }
        );
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
