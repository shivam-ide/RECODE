const { generateReviewPdf } = require('../reports/pdfGenerator');

/**
 * Re:Code — Export Service for PDF Reports
 *
 * Provides dynamic, content-adaptive PDF generation eliminating trailing blank pages.
 * - Adaptive A4 margins (16mm)
 * - Atomic finding cards (break-inside: avoid)
 * - Strictly adapts page count to content length (1 page for concise audits, N pages with zero trailing blanks)
 */
module.exports = {
  generateReviewPdf,
  generatePdfReport: generateReviewPdf,
};
